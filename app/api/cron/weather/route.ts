/**
 * Vercel Cron endpoint for weather data collection
 * Runs every 15 minutes via vercel.json configuration
 */

import { fetchAndStoreWeatherData } from '@/lib/etl/weather-cron'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify this is from Vercel Cron (in production)
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production') {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
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
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
