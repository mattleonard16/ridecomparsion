/**
 * Data Retention Cleanup Cron Job
 * Deletes old logs and snapshots to prevent unbounded table growth
 *
 * Retention policy:
 * - SearchLog: 90 days
 * - WeatherLog: 90 days
 * - TrafficLog: 90 days
 * - EventLog: 90 days (past events)
 * - PriceSnapshot: 365 days
 *
 * Run via Vercel Cron or similar service
 * Requires CRON_SECRET env var for authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const RETENTION_DAYS = {
  searchLog: 90,
  weatherLog: 90,
  trafficLog: 90,
  eventLog: 90,
  priceSnapshot: 365,
} as const

interface CleanupResult {
  table: string
  deleted: number
  cutoffDate: string
}

/**
 * Verify cron secret for authenticated access
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // In development, allow access without secret
    return process.env.NODE_ENV === 'development'
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Get cutoff date for a given retention period
 */
function getCutoffDate(daysBack: number): Date {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysBack)
  return cutoff
}

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if database is available
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database not configured', success: false },
      { status: 503 }
    )
  }

  const results: CleanupResult[] = []
  const errors: string[] = []

  // Cleanup SearchLog
  try {
    const cutoff = getCutoffDate(RETENTION_DAYS.searchLog)
    const deleted = await prisma.searchLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    results.push({
      table: 'SearchLog',
      deleted: deleted.count,
      cutoffDate: cutoff.toISOString(),
    })
  } catch (error) {
    errors.push(`SearchLog: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Cleanup WeatherLog
  try {
    const cutoff = getCutoffDate(RETENTION_DAYS.weatherLog)
    const deleted = await prisma.weatherLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    results.push({
      table: 'WeatherLog',
      deleted: deleted.count,
      cutoffDate: cutoff.toISOString(),
    })
  } catch (error) {
    errors.push(`WeatherLog: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Cleanup TrafficLog
  try {
    const cutoff = getCutoffDate(RETENTION_DAYS.trafficLog)
    const deleted = await prisma.trafficLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    results.push({
      table: 'TrafficLog',
      deleted: deleted.count,
      cutoffDate: cutoff.toISOString(),
    })
  } catch (error) {
    errors.push(`TrafficLog: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Cleanup EventLog (past events only)
  // Delete events where start_time is old AND (end_time is old OR end_time is NULL)
  try {
    const cutoff = getCutoffDate(RETENTION_DAYS.eventLog)
    const deleted = await prisma.eventLog.deleteMany({
      where: {
        start_time: { lt: cutoff },
        OR: [
          { end_time: { lt: cutoff } },
          { end_time: null },
        ],
      },
    })
    results.push({
      table: 'EventLog',
      deleted: deleted.count,
      cutoffDate: cutoff.toISOString(),
    })
  } catch (error) {
    errors.push(`EventLog: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Cleanup PriceSnapshot
  try {
    const cutoff = getCutoffDate(RETENTION_DAYS.priceSnapshot)
    const deleted = await prisma.priceSnapshot.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    results.push({
      table: 'PriceSnapshot',
      deleted: deleted.count,
      cutoffDate: cutoff.toISOString(),
    })
  } catch (error) {
    errors.push(`PriceSnapshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0)

  return NextResponse.json({
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    totalDeleted,
    results,
    errors: errors.length > 0 ? errors : undefined,
  })
}

// POST is an alias for GET (some cron systems use POST)
export const POST = GET

