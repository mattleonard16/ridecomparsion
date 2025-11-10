/**
 * Weather Data ETL Cron Job
 * Fetches weather data for Bay Area locations every 15 minutes
 * Run via Vercel Cron or similar service
 */

import { logWeatherData } from '@/lib/supabase'

const BAY_AREA_LOCATIONS = [
  { name: 'San Francisco', coords: [-122.4194, 37.7749] as [number, number] },
  { name: 'San Jose', coords: [-121.8863, 37.3382] as [number, number] },
  { name: 'Oakland', coords: [-122.2711, 37.8044] as [number, number] },
  { name: 'SFO Airport', coords: [-122.379, 37.6213] as [number, number] },
  { name: 'Palo Alto', coords: [-122.143, 37.4419] as [number, number] },
  { name: 'Santa Clara', coords: [-121.9552, 37.3541] as [number, number] },
]

interface OpenWeatherResponse {
  main: {
    temp: number // Kelvin
    feels_like: number
    humidity: number
  }
  weather: Array<{
    main: string
    description: string
  }>
  wind: {
    speed: number // m/s
  }
  rain?: {
    '1h'?: number // mm
  }
  visibility?: number // meters
}

export async function fetchAndStoreWeatherData() {
  const apiKey = process.env.OPENWEATHER_API_KEY

  if (!apiKey) {
    console.error('Missing OPENWEATHER_API_KEY')
    return { success: false, error: 'Missing API key' }
  }

  const results = []

  for (const location of BAY_AREA_LOCATIONS) {
    try {
      // Fetch weather data
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?` +
          `lat=${location.coords[1]}&lon=${location.coords[0]}` +
          `&appid=${apiKey}`
      )

      if (!response.ok) {
        console.error(`Weather API error for ${location.name}:`, response.status)
        continue
      }

      const data: OpenWeatherResponse = await response.json()

      // Convert and store
      const weatherData = {
        temperature: Math.round(((data.main.temp - 273.15) * 9) / 5 + 32), // K to F
        condition: data.weather[0]?.main || 'Unknown',
        precipitation: data.rain?.['1h'] ? data.rain['1h'] * 0.0393701 : 0, // mm to inches
        windSpeed: Math.round(data.wind.speed * 2.237), // m/s to mph
        visibility: data.visibility ? data.visibility * 0.000621371 : undefined, // meters to miles
        rawData: data,
      }

      await logWeatherData(location.coords, weatherData)

      results.push({
        location: location.name,
        success: true,
        data: weatherData,
      })

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    } catch (error) {
      console.error(`Error fetching weather for ${location.name}:`, error)
      results.push({
        location: location.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    locations: results.length,
    results,
  }
}

// Vercel Cron handler
export async function GET() {
  const result = await fetchAndStoreWeatherData()

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
