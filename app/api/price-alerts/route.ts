import { type NextRequest, NextResponse } from 'next/server'
import { withCors } from '@/lib/cors'
import { withRateLimit } from '@/lib/rate-limiter'
import { createPriceAlert } from '@/lib/database'
import { auth } from '@/auth'
import { z } from 'zod'

/**
 * Get or generate a request ID for traceability
 */
function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}

/**
 * Create response headers with request ID
 */
function createResponseHeaders(requestId: string): Record<string, string> {
  return {
    'x-request-id': requestId,
  }
}

const PriceAlertSchema = z.object({
  routeId: z.string().min(1, 'Route ID is required'),
  targetPrice: z.number().positive('Target price must be positive'),
  service: z.enum(['uber', 'lyft', 'taxi', 'any']).default('any'),
  alertType: z.enum(['below', 'above']).default('below'),
})

async function handlePost(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    // Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: createResponseHeaders(requestId) }
      )
    }

    const body = await request.json()

    // Validate input
    const validation = PriceAlertSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400, headers: createResponseHeaders(requestId) }
      )
    }

    const { routeId, targetPrice, service, alertType } = validation.data

    const alert = await createPriceAlert(session.user.id, routeId, targetPrice, service, alertType)

    if (!alert) {
      return NextResponse.json(
        { error: 'Failed to create price alert. Route may not exist.' },
        { status: 400, headers: createResponseHeaders(requestId) }
      )
    }

    return NextResponse.json(
      {
        success: true,
        alertId: alert.id,
        message: 'Price alert created successfully',
      },
      { headers: createResponseHeaders(requestId) }
    )
  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json(
      { error: 'Failed to create price alert', detail: err?.message },
      { status: 500, headers: createResponseHeaders(requestId) }
    )
  }
}

export const POST = withCors(withRateLimit(handlePost))
