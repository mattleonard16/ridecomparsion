import { type NextRequest, NextResponse } from 'next/server'
import { withCors } from '@/lib/cors'
import { checkRateLimit, cleanupRateLimiters } from '@/lib/rate-limiter'
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

async function handleGet(request: NextRequest) {
  try {
    // Apply rate limiting to GET requests
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: rateLimitResult.reason,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      )
    }

    console.log('[CompareAPI GET] Request received')
    const { searchParams } = new URL(request.url)
    const pickup = searchParams.get('pickup')
    const destination = searchParams.get('destination')

    console.log('[CompareAPI GET] Params:', { pickup, destination })

    if (!pickup || !destination) {
      console.error('[CompareAPI GET] Missing params')
      return NextResponse.json({ error: 'Pickup and destination are required' }, { status: 400 })
    }

    const isPrecomputedRoute = !!findPrecomputedRouteByAddresses(pickup, destination)

    console.log('[CompareAPI GET] Calling compareRidesByAddresses')
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

    console.log('[CompareAPI GET] Success, returning data')
    return NextResponse.json(
      {
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
          'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      }
    )
  } catch (error: any) {
    console.error('[CompareAPI GET] Error:', error)
    console.error('[CompareAPI GET] Error stack:', error?.stack)
    return NextResponse.json(
      {
        error: 'Failed to prefetch ride comparisons',
        detail: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

async function handlePost(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request)

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: rateLimitResult.reason,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      )
    }

    const body = await request.json()

    const isPrecomputedRoute = body.pickup && body.destination &&
      !!findPrecomputedRouteByAddresses(body.pickup, body.destination)

    if (body.recaptchaToken && !isPrecomputedRoute) {
      const recaptchaResult = await verifyRecaptchaToken(
        body.recaptchaToken,
        RECAPTCHA_CONFIG.ACTIONS.RIDE_COMPARISON,
        RECAPTCHA_CONFIG.NORMAL_THRESHOLD
      )

      if (!recaptchaResult.success) {
        if (recaptchaResult.error?.includes('Action mismatch')) {
          console.warn('reCAPTCHA action mismatch, continuing:', recaptchaResult.error)
        } else if (recaptchaResult.score !== undefined && recaptchaResult.score < 0.3) {
          return NextResponse.json(
            {
              error: 'Security verification failed. Please try again.',
              details: 'Your request appears to be automated. Please try again in a few moments.',
            },
            { status: 403 }
          )
        } else {
          console.warn('Continuing without reCAPTCHA verification due to:', recaptchaResult.error)
        }
      } else {
        console.log(
          `reCAPTCHA verified: score ${recaptchaResult.score}, action ${recaptchaResult.action}`
        )
      }
    } else if (isPrecomputedRoute) {
      console.log('[CompareAPI] Skipping reCAPTCHA for pre-computed route')
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
        return NextResponse.json({ error: 'Could not compute comparisons' }, { status: 500 })
      }

      return NextResponse.json(
        {
          comparisons: comparisons.results,
          insights: comparisons.insights,
          pickupCoords: comparisons.pickup,
          destinationCoords: comparisons.destination,
          surgeInfo: comparisons.surgeInfo,
          timeRecommendations: comparisons.timeRecommendations,
        },
        {
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          },
        }
      )
    }

    const pickup = requestData.from.name
    const destination = requestData.to.name

    const comparisons = await compareRidesByAddresses(
      pickup,
      destination,
      requestData.services,
      new Date(),
      {
        userId: request.headers.get('x-user-id'),
        sessionId: request.headers.get('x-session-id') ?? undefined,
        persist: true,
      }
    )

    if (!comparisons) {
      return NextResponse.json({ error: 'Could not compute comparisons' }, { status: 500 })
    }

    // 8. Add rate limit headers to successful responses
    return NextResponse.json(
      {
        comparisons: comparisons.results,
        insights: comparisons.insights,
        pickupCoords: comparisons.pickup,
        destinationCoords: comparisons.destination,
        surgeInfo: comparisons.surgeInfo,
        timeRecommendations: comparisons.timeRecommendations,
      },
      {
        headers: {
          'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      }
    )
  } catch (error: any) {
    console.error('[CompareAPI POST] Error comparing rides:', error)
    console.error('[CompareAPI POST] Error stack:', error?.stack)
    return NextResponse.json(
      {
        error: 'Failed to compare rides',
        detail: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  } finally {
    // Periodic cleanup (run occasionally)
    if (Math.random() < 0.01) {
      // 1% chance per request
      cleanupRateLimiters()
    }
  }
}

// Export CORS-wrapped handlers
export const GET = withCors(handleGet)
export const POST = withCors(handlePost)
export const OPTIONS = withCors(handleGet)
