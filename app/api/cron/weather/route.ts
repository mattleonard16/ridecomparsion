/**
 * Vercel Cron endpoint for weather data collection
 * Runs every 15 minutes via vercel.json configuration
 */

import { fetchAndStoreWeatherData } from '@/lib/etl/weather-cron'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Verify cron secret using constant-time comparison
 */
function verifyCronSecret(request: Request): { valid: boolean; error?: string; status?: number } {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return { valid: false, error: 'Server misconfigured', status: 503 }
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return { valid: false, error: 'Unauthorized', status: 401 }
  }

  const expectedToken = `Bearer ${cronSecret}`

  // Use constant-time comparison to prevent timing attacks
  if (authHeader.length !== expectedToken.length) {
    return { valid: false, error: 'Unauthorized', status: 401 }
  }

  try {
    const isValid = timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))
    if (!isValid) {
      return { valid: false, error: 'Unauthorized', status: 401 }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: 'Unauthorized', status: 401 }
  }
}

export async function GET(request: Request) {
  // SECURITY: Verify cron secret in ALL environments using constant-time comparison
  const authResult = verifyCronSecret(request)
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const result = await fetchAndStoreWeatherData()

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
