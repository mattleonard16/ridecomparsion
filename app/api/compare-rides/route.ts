import { type NextRequest, NextResponse } from 'next/server'
import { withCors } from '@/lib/cors'
import { withRateLimit } from '@/lib/rate-limiter'
import {
  validateInput,
  RideComparisonRequestSchema,
  detectSuspiciousCoordinates,
  detectSpamPatterns,
  sanitizeString,
} from '@/lib/validation'
import { verifyRecaptchaToken, RECAPTCHA_CONFIG } from '@/lib/recaptcha'
import { compareRidesByAddresses } from '@/lib/services/ride-comparison'
import { findPrecomputedRouteByAddresses } from '@/lib/popular-routes-data'
import { auth } from '@/auth'

async function handleGet(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pickup = searchParams.get('pickup')
    const destination = searchParams.get('destination')

    if (!pickup || !destination) {
      console.error('[CompareAPI GET] Missing params')
      return NextResponse.json({ error: 'Pickup and destination are required' }, { status: 400 })
    }

    const isPrecomputedRoute = !!findPrecomputedRouteByAddresses(pickup, destination)

    const comparisons = await compareRidesByAddresses(
      pickup,
      destination,
      ['uber', 'lyft', 'taxi'],
      new Date(),
      {
        userId: null,
        sessionId: request.headers.get('x-session-id') ?? undefined,
        persist: true,
      }
    )

    if (!comparisons) {
      console.error('[CompareAPI GET] No comparisons returned')
      return NextResponse.json({ error: 'Could not compute comparisons' }, { status: 500 })
    }

    const cacheControl = isPrecomputedRoute
      ? 'private, max-age=300, stale-while-revalidate=1800'
      : 'private, max-age=30, stale-while-revalidate=120'

    return NextResponse.json(
      {
        routeId: comparisons.routeId,
        comparisons: comparisons.results,
        insights: comparisons.insights,
        pickupCoords: comparisons.pickup,
        destinationCoords: comparisons.destination,
        surgeInfo: comparisons.surgeInfo,
        timeRecommendations: comparisons.timeRecommendations,
      },
      {
        headers: {
          'Cache-Control': cacheControl,
        },
      }
    )
  } catch (error: unknown) {
    const err = error as Error
    console.error('[CompareAPI GET] Error:', err)
    console.error('[CompareAPI GET] Error stack:', err?.stack)
    return NextResponse.json(
      {
        error: 'Failed to prefetch ride comparisons',
        detail: err?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json()

    const isPrecomputedRoute =
      body.pickup &&
      body.destination &&
      !!findPrecomputedRouteByAddresses(body.pickup, body.destination)

    const isProduction = process.env.NODE_ENV === 'production'

    // reCAPTCHA verification - fail closed in production
    if (body.recaptchaToken && !isPrecomputedRoute) {
      const recaptchaResult = await verifyRecaptchaToken(
        body.recaptchaToken,
        RECAPTCHA_CONFIG.ACTIONS.RIDE_COMPARISON,
        RECAPTCHA_CONFIG.NORMAL_THRESHOLD
      )

      if (!recaptchaResult.success) {
        // Action mismatch is suspicious - could indicate replay attack
        if (recaptchaResult.error?.includes('Action mismatch')) {
          console.error(
            '[SECURITY] reCAPTCHA action mismatch - potential replay attack:',
            recaptchaResult.error
          )
          return NextResponse.json(
            { error: 'Security verification failed. Please refresh and try again.' },
            { status: 403 }
          )
        }

        // Low score indicates likely bot
        if (
          recaptchaResult.score !== undefined &&
          recaptchaResult.score < RECAPTCHA_CONFIG.LENIENT_THRESHOLD
        ) {
          return NextResponse.json(
            {
              error: 'Security verification failed. Please try again.',
              details: 'Your request appears to be automated. Please try again in a few moments.',
            },
            { status: 403 }
          )
        }

        // For other errors in production, fail closed
        if (isProduction) {
          console.error('[SECURITY] reCAPTCHA verification failed:', recaptchaResult.error)
          return NextResponse.json(
            { error: 'Security verification unavailable. Please try again later.' },
            { status: 503 }
          )
        } else {
          console.warn(
            '[reCAPTCHA] Verification failed in development, continuing:',
            recaptchaResult.error
          )
        }
      }
    } else if (!isPrecomputedRoute && !body.recaptchaToken && isProduction) {
      // In production, require reCAPTCHA token for non-precomputed routes
      return NextResponse.json({ error: 'Security token required' }, { status: 400 })
    }

    let requestData
    if (body.pickup && body.destination) {
      requestData = {
        from: {
          name: sanitizeString(body.pickup),
          lat: '0', // Will be geocoded
          lng: '0',
        },
        to: {
          name: sanitizeString(body.destination),
          lat: '0', // Will be geocoded
          lng: '0',
        },
        services: ['uber', 'lyft', 'taxi'], // Default all services
      }
    } else {
      requestData = body
    }

    const isLegacyRequest = body.pickup && body.destination

    if (!isLegacyRequest) {
      const validation = validateInput(
        RideComparisonRequestSchema,
        requestData,
        'ride comparison request'
      )

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: validation.errors.map(err => ({
              field: err.field,
              message: err.message,
            })),
          },
          { status: 400 }
        )
      }

      requestData = validation.data

      const fromName = requestData.from.name
      const toName = requestData.to.name

      if (detectSpamPatterns(fromName) || detectSpamPatterns(toName)) {
        return NextResponse.json({ error: 'Invalid location names detected' }, { status: 400 })
      }

      if (
        detectSuspiciousCoordinates(
          { lat: requestData.from.lat, lng: requestData.from.lng },
          { lat: requestData.to.lat, lng: requestData.to.lng }
        )
      ) {
        return NextResponse.json(
          { error: 'Invalid route: pickup and destination are too close' },
          { status: 400 }
        )
      }
    }

    if (isLegacyRequest) {
      const { pickup, destination } = body

      if (!pickup || !destination) {
        return NextResponse.json({ error: 'Pickup and destination are required' }, { status: 400 })
      }

      // Apply validation to legacy requests (security fix)
      const sanitizedPickup = sanitizeString(pickup)
      const sanitizedDestination = sanitizeString(destination)

      if (detectSpamPatterns(sanitizedPickup) || detectSpamPatterns(sanitizedDestination)) {
        return NextResponse.json({ error: 'Invalid location names detected' }, { status: 400 })
      }

      const comparisons = await compareRidesByAddresses(
        sanitizedPickup,
        sanitizedDestination,
        ['uber', 'lyft', 'taxi'],
        new Date(),
        {
          userId: null,
          sessionId: request.headers.get('x-session-id') ?? undefined,
          persist: true,
        }
      )

      if (!comparisons) {
        return NextResponse.json({ error: 'Could not compute comparisons' }, { status: 500 })
      }

      return NextResponse.json({
        routeId: comparisons.routeId,
        comparisons: comparisons.results,
        insights: comparisons.insights,
        pickupCoords: comparisons.pickup,
        destinationCoords: comparisons.destination,
        surgeInfo: comparisons.surgeInfo,
        timeRecommendations: comparisons.timeRecommendations,
      })
    }

    const pickup = requestData.from.name
    const destination = requestData.to.name

    // SECURITY: Get userId from authenticated session, not from untrusted headers
    const session = await auth()
    const authenticatedUserId = session?.user?.id ?? null

    const comparisons = await compareRidesByAddresses(
      pickup,
      destination,
      requestData.services,
      new Date(),
      {
        userId: authenticatedUserId,
        sessionId: request.headers.get('x-session-id') ?? undefined,
        persist: true,
      }
    )

    if (!comparisons) {
      return NextResponse.json({ error: 'Could not compute comparisons' }, { status: 500 })
    }

    return NextResponse.json({
      routeId: comparisons.routeId,
      comparisons: comparisons.results,
      insights: comparisons.insights,
      pickupCoords: comparisons.pickup,
      destinationCoords: comparisons.destination,
      surgeInfo: comparisons.surgeInfo,
      timeRecommendations: comparisons.timeRecommendations,
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[CompareAPI POST] Error comparing rides:', err)
    console.error('[CompareAPI POST] Error stack:', err?.stack)
    return NextResponse.json(
      {
        error: 'Failed to compare rides',
        detail: err?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Export CORS-wrapped and rate-limited handlers
export const GET = withCors(withRateLimit(handleGet))
export const POST = withCors(withRateLimit(handlePost))
export const OPTIONS = withCors(handleGet) // No rate limit on preflight
