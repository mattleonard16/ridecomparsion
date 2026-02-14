/**
 * Insights Aggregation Cron Job
 *
 * Aggregates PriceSnapshot data into RouteInsights for active routes.
 * Run nightly via Vercel Cron or similar service.
 * Requires CRON_SECRET env var for authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { aggregateAllActiveRoutes } from '@/lib/services/insights-aggregator'

/**
 * Verify cron secret using constant-time comparison
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const expectedToken = `Bearer ${cronSecret}`
  if (authHeader.length !== expectedToken.length) return false

  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured', success: false }, { status: 503 })
  }

  try {
    const result = await aggregateAllActiveRoutes(30)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processed: result.processed,
      errors: result.errors,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = GET
