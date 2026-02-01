/**
 * Vercel Cron endpoint for weather data collection
 * Runs every 15 minutes via vercel.json configuration
 */

import { fetchAndStoreWeatherData } from '@/lib/etl/weather-cron'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // SECURITY: Verify cron secret in ALL environments
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[SECURITY] CRON_SECRET not configured - weather cron endpoint is unprotected')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await fetchAndStoreWeatherData()

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    console.error('Weather cron error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
