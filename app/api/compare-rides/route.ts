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
import { generateRecommendations } from '@/lib/services/recommendations'
import { enhanceWithAI } from '@/lib/services/ai-insights'

/**
 * Get or generate a request ID for traceability
 */
function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}

/**
 * Create response headers with request ID
 */
function createResponseHeaders(
  requestId: string,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'x-request-id': requestId,
    ...additionalHeaders,
  }
}

async function handleGet(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const { searchParams } = new URL(request.url)
    const pickup = searchParams.get('pickup')
    const destination = searchParams.get('destination')

    if (!pickup || !destination) {
      return NextResponse.json(
        { error: 'Pickup and destination are required' },
        { status: 400, headers: createResponseHeaders(requestId) }
      )
    }

    const isPrecomputedRoute = !!findPrecomputedRouteByAddresses(pickup, destination)

    const comparisons = await compareRidesByAddresses(
      pickup,
      destination,
      ['uber', 'lyft', 'taxi', 'waymo'],
      new Date(),
      {
        userId: null,
        sessionId: request.headers.get('x-session-id') ?? undefined,
        persist: true,
      }
    )

    if (!comparisons) {
      return NextResponse.json(
        { error: 'Could not compute comparisons' },
        { status: 500, headers: createResponseHeaders(requestId) }
      )
    }

    const cacheControl = isPrecomputedRoute
      ? 'private, max-age=300, stale-while-revalidate=1800'
      : 'private, max-age=30, stale-while-revalidate=120'

    // Non-blocking: generate AI recommendations in parallel
    const aiRecommendations = await generateRecommendations({
      routeId: comparisons.routeId ?? undefined,
      timestamp: new Date(),
    })
      .then(r => enhanceWithAI(r.recommendations))
      .catch(() => [])

    return NextResponse.json(
      {
        routeId: comparisons.routeId,
        comparisons: comparisons.results,
        insights: comparisons.insights,
        pickupCoords: comparisons.pickup,
        destinationCoords: comparisons.destination,
        surgeInfo: comparisons.surgeInfo,
        timeRecommendations: comparisons.timeRecommendations,
        aiRecommendations,
      },
      {
        headers: createResponseHeaders(requestId, { 'Cache-Control': cacheControl }),
      }
    )
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to prefetch ride comparisons',
      },
      { status: 500, headers: createResponseHeaders(requestId) }
    )
  }
}

async function handlePost(request: NextRequest) {
  const requestId = getRequestId(request)

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
          return NextResponse.json(
            { error: 'Security verification failed. Please refresh and try again.' },
            { status: 403, headers: createResponseHeaders(requestId) }
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
            { status: 403, headers: createResponseHeaders(requestId) }
          )
        }

        // For other errors in production, fail closed
        if (isProduction) {
          return NextResponse.json(
            { error: 'Security verification unavailable. Please try again later.' },
            { status: 503, headers: createResponseHeaders(requestId) }
          )
        }
        // In development, continue without reCAPTCHA
      }
    } else if (!isPrecomputedRoute && !body.recaptchaToken && isProduction) {
      // In production, require reCAPTCHA token for non-precomputed routes
      return NextResponse.json(
        { error: 'Security token required' },
        { status: 400, headers: createResponseHeaders(requestId) }
      )
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
        services: ['uber', 'lyft', 'taxi', 'waymo'], // Default all services
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
          { status: 400, headers: createResponseHeaders(requestId) }
        )
      }

      requestData = validation.data

      const fromName = requestData.from.name
      const toName = requestData.to.name

      if (detectSpamPatterns(fromName) || detectSpamPatterns(toName)) {
        return NextResponse.json(
          { error: 'Invalid location names detected' },
          { status: 400, headers: createResponseHeaders(requestId) }
        )
      }

      if (
        detectSuspiciousCoordinates(
          { lat: requestData.from.lat, lng: requestData.from.lng },
          { lat: requestData.to.lat, lng: requestData.to.lng }
        )
      ) {
        return NextResponse.json(
          { error: 'Invalid route: pickup and destination are too close' },
          { status: 400, headers: createResponseHeaders(requestId) }
        )
      }
    }

    if (isLegacyRequest) {
      const { pickup, destination } = body

      if (!pickup || !destination) {
        return NextResponse.json(
          { error: 'Pickup and destination are required' },
          { status: 400, headers: createResponseHeaders(requestId) }
        )
      }

      // Apply validation to legacy requests (security fix)
      const sanitizedPickup = sanitizeString(pickup)
      const sanitizedDestination = sanitizeString(destination)

      if (detectSpamPatterns(sanitizedPickup) || detectSpamPatterns(sanitizedDestination)) {
        return NextResponse.json(
          { error: 'Invalid location names detected' },
          { status: 400, headers: createResponseHeaders(requestId) }
        )
      }

      const comparisons = await compareRidesByAddresses(
        sanitizedPickup,
        sanitizedDestination,
        ['uber', 'lyft', 'taxi', 'waymo'],
        new Date(),
        {
          userId: null,
          sessionId: request.headers.get('x-session-id') ?? undefined,
          persist: true,
        }
      )

      if (!comparisons) {
        return NextResponse.json(
          { error: 'Could not compute comparisons' },
          { status: 500, headers: createResponseHeaders(requestId) }
        )
      }

      // Non-blocking: generate AI recommendations
      const aiRecsLegacy = await generateRecommendations({
        routeId: comparisons.routeId ?? undefined,
        timestamp: new Date(),
      })
        .then(r => enhanceWithAI(r.recommendations))
        .catch(() => [])

      return NextResponse.json(
        {
          routeId: comparisons.routeId,
          comparisons: comparisons.results,
          insights: comparisons.insights,
          pickupCoords: comparisons.pickup,
          destinationCoords: comparisons.destination,
          surgeInfo: comparisons.surgeInfo,
          timeRecommendations: comparisons.timeRecommendations,
          aiRecommendations: aiRecsLegacy,
        },
        { headers: createResponseHeaders(requestId) }
      )
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
      return NextResponse.json(
        { error: 'Could not compute comparisons' },
        { status: 500, headers: createResponseHeaders(requestId) }
      )
    }

    // Non-blocking: generate AI recommendations
    const aiRecs = await generateRecommendations({
      routeId: comparisons.routeId ?? undefined,
      userId: authenticatedUserId ?? undefined,
      timestamp: new Date(),
    })
      .then(r => enhanceWithAI(r.recommendations))
      .catch(() => [])

    return NextResponse.json(
      {
        routeId: comparisons.routeId,
        comparisons: comparisons.results,
        insights: comparisons.insights,
        pickupCoords: comparisons.pickup,
        destinationCoords: comparisons.destination,
        surgeInfo: comparisons.surgeInfo,
        timeRecommendations: comparisons.timeRecommendations,
        aiRecommendations: aiRecs,
      },
      { headers: createResponseHeaders(requestId) }
    )
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to compare rides',
      },
      { status: 500, headers: createResponseHeaders(requestId) }
    )
  }
}

// Export CORS-wrapped and rate-limited handlers
export const GET = withCors(withRateLimit(handleGet))
export const POST = withCors(withRateLimit(handlePost))
export const OPTIONS = withCors(handleGet) // No rate limit on preflight
