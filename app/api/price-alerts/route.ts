import { type NextRequest, NextResponse } from 'next/server'
import { withCors } from '@/lib/cors'
import { withRateLimit } from '@/lib/rate-limiter'
import { createPriceAlert } from '@/lib/database'
import { auth } from '@/auth'
import { z } from 'zod'

const PriceAlertSchema = z.object({
  routeId: z.string().min(1, 'Route ID is required'),
  targetPrice: z.number().positive('Target price must be positive'),
  service: z.enum(['uber', 'lyft', 'taxi', 'any']).default('any'),
  alertType: z.enum(['below', 'above']).default('below'),
})

async function handlePost(request: NextRequest) {
  try {
    // Auth check
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        { status: 400 }
      )
    }

    const { routeId, targetPrice, service, alertType } = validation.data

    const alert = await createPriceAlert(session.user.id, routeId, targetPrice, service, alertType)

    if (!alert) {
      return NextResponse.json(
        { error: 'Failed to create price alert. Route may not exist.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      alertId: alert.id,
      message: 'Price alert created successfully',
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error('[PriceAlerts POST] Error:', err)
    return NextResponse.json(
      { error: 'Failed to create price alert', detail: err?.message },
      { status: 500 }
    )
  }
}

export const POST = withCors(withRateLimit(handlePost))
