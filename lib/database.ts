import { prisma } from '@/lib/prisma'
import { $Enums, type ServiceType, type TrafficLevel } from '@/lib/generated/prisma'
import { createHash } from 'crypto'

const ServiceTypeEnum = $Enums.ServiceType
const TrafficLevelEnum = $Enums.TrafficLevel

/**
 * Check if database is available
 * In production, throws an error if DATABASE_URL is missing (unless ALLOW_DB_MOCK is set)
 */
const isDatabaseAvailable = (): boolean => {
  const hasDb = !!process.env.DATABASE_URL

  if (!hasDb && process.env.NODE_ENV === 'production' && !process.env.ALLOW_DB_MOCK) {
    throw new Error(
      'DATABASE_URL is required in production. Set ALLOW_DB_MOCK=true to bypass (not recommended).'
    )
  }

  return hasDb
}

/**
 * Report a persistence error to monitoring (Axiom/Sentry if configured)
 */
function reportPersistenceError(operation: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.error(`[DB] ${operation} failed:`, errorMessage)

  // Forward to Axiom if configured
  if (process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
    // Fire-and-forget log to Axiom
    fetch(`https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          _time: new Date().toISOString(),
          level: 'error',
          operation,
          error: errorMessage,
          service: 'rideshare-db',
        },
      ]),
    }).catch(() => {
      // Silently ignore Axiom errors to avoid cascade
    })
  }
}

// Generate route hash for uniqueness
function generateRouteHash(
  pickupLat: number,
  pickupLng: number,
  destLat: number,
  destLng: number
): string {
  const hash = createHash('sha256')
  hash.update(`${pickupLat},${pickupLng},${destLat},${destLng}`)
  return hash.digest('hex').substring(0, 16)
}

/**
 * Find or create a route in the database
 */
export async function findOrCreateRoute(
  pickupAddress: string,
  pickupCoords: [number, number],
  destAddress: string,
  destCoords: [number, number],
  distance?: number,
  duration?: number
): Promise<string | null> {
  if (!isDatabaseAvailable()) {
    const mockRouteId = `mock-route-${pickupCoords[0]}-${pickupCoords[1]}-${destCoords[0]}-${destCoords[1]}`.replace(
      /\./g,
      ''
    )
    console.log('🔧 [MOCK] Created route:', mockRouteId)
    return mockRouteId
  }

  try {
    const routeHash = generateRouteHash(
      pickupCoords[1],
      pickupCoords[0],
      destCoords[1],
      destCoords[0]
    )

    const existingRoute = await prisma.route.findUnique({
      where: { route_hash: routeHash },
      select: { id: true },
    })

    if (existingRoute) {
      return existingRoute.id
    }

    const newRoute = await prisma.route.create({
      data: {
        pickup_address: pickupAddress,
        pickup_lat: pickupCoords[1],
        pickup_lng: pickupCoords[0],
        destination_address: destAddress,
        destination_lat: destCoords[1],
        destination_lng: destCoords[0],
        distance_miles: distance,
        duration_minutes: duration,
        route_hash: routeHash,
      },
      select: { id: true },
    })

    return newRoute.id
  } catch (error) {
    reportPersistenceError('findOrCreateRoute', error)
    return null
  }
}

/**
 * Log a price snapshot
 */
export async function logPriceSnapshot(
  routeId: string,
  service: 'uber' | 'lyft' | 'taxi',
  price: number,
  surge: number = 1.0,
  waitTime?: number,
  factors?: {
    weather?: string
    temperature?: number
    isRaining?: boolean
    trafficLevel?: 'light' | 'moderate' | 'heavy' | 'severe'
    nearbyEvents?: string[]
  }
): Promise<void> {
  if (!isDatabaseAvailable()) {
    const now = new Date()
    console.log('🔧 [MOCK] Price snapshot:', {
      service,
      price: `$${price.toFixed(2)}`,
      surge: `${surge}x`,
      waitTime: `${waitTime} min`,
      timestamp: now.toISOString(),
    })
    return
  }

  try {
    const now = new Date()

    // Map service string to ServiceType enum
    const serviceType: ServiceType =
      service === 'uber' ? ServiceTypeEnum.UBER : service === 'lyft' ? ServiceTypeEnum.LYFT : ServiceTypeEnum.TAXI

    // Map traffic level string to TrafficLevel enum
    let trafficLevel: TrafficLevel | null = null
    if (factors?.trafficLevel) {
      switch (factors.trafficLevel) {
        case 'light':
          trafficLevel = TrafficLevelEnum.LIGHT
          break
        case 'moderate':
          trafficLevel = TrafficLevelEnum.MODERATE
          break
        case 'heavy':
          trafficLevel = TrafficLevelEnum.HEAVY
          break
        case 'severe':
          trafficLevel = TrafficLevelEnum.SEVERE
          break
      }
    }

    await prisma.priceSnapshot.create({
      data: {
        routeId,
        service: serviceType,
        base_price: price / surge,
        surge_multiplier: surge,
        final_price: price,
        wait_time_minutes: waitTime,
        day_of_week: now.getUTCDay(),
        hour_of_day: now.getUTCHours(),
        weather_condition: factors?.weather,
        weather_temp_f: factors?.temperature,
        is_raining: factors?.isRaining || false,
        traffic_level: trafficLevel,
        nearby_events: factors?.nearbyEvents || [],
      },
    })
  } catch (error) {
    reportPersistenceError('logPriceSnapshot', error)
  }
}

/**
 * Log a search
 */
export async function logSearch(
  routeId: string | null,
  userId: string | null,
  results: any,
  sessionId?: string
): Promise<void> {
  if (!isDatabaseAvailable()) {
    console.log('🔧 [MOCK] Search logged:', {
      routeId,
      userId,
      sessionId,
      resultsCount: Object.keys(results).length,
      timestamp: new Date().toISOString(),
    })
    return
  }

  try {
    await prisma.searchLog.create({
      data: {
        routeId: routeId || undefined,
        userId: userId || undefined,
        session_id: sessionId,
        results_shown: results,
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
      },
    })
  } catch (error) {
    reportPersistenceError('logSearch', error)
  }
}

/**
 * Get route price history
 */
export async function getRoutePriceHistory(routeId: string, daysBack: number = 7) {
  if (!isDatabaseAvailable()) {
    return []
  }

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const snapshots = await prisma.priceSnapshot.findMany({
      where: {
        routeId,
        createdAt: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
        service: true,
        final_price: true,
        surge_multiplier: true,
        weather_condition: true,
      },
    })

    return snapshots.map((snapshot: { createdAt: Date; service: string; final_price: number; surge_multiplier: number; weather_condition: string | null }) => ({
      timestamp: snapshot.createdAt.toISOString(),
      service_type: snapshot.service.toLowerCase(),
      final_price: snapshot.final_price,
      surge_multiplier: snapshot.surge_multiplier,
      weather_condition: snapshot.weather_condition,
    }))
  } catch (error) {
    reportPersistenceError('getRoutePriceHistory', error)
    return []
  }
}

/**
 * Get average prices by hour for a route
 */
export async function getHourlyPriceAverage(routeId: string, service: 'uber' | 'lyft' | 'taxi') {
  if (!isDatabaseAvailable()) {
    return []
  }

  try {
    const serviceType: ServiceType =
      service === 'uber' ? ServiceTypeEnum.UBER : service === 'lyft' ? ServiceTypeEnum.LYFT : ServiceTypeEnum.TAXI

    // Get snapshots for this route and service
    const snapshots = await prisma.priceSnapshot.findMany({
      where: {
        routeId,
        service: serviceType,
      },
      select: {
        hour_of_day: true,
        final_price: true,
      },
    })

    // Group by hour and calculate average
    const hourlyData: Record<number, { sum: number; count: number }> = {}
    snapshots.forEach((snapshot: { hour_of_day: number; final_price: number }) => {
      if (!hourlyData[snapshot.hour_of_day]) {
        hourlyData[snapshot.hour_of_day] = { sum: 0, count: 0 }
      }
      hourlyData[snapshot.hour_of_day].sum += snapshot.final_price
      hourlyData[snapshot.hour_of_day].count += 1
    })

    // Convert to array format
    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: parseInt(hour, 10),
        avg_price: data.sum / data.count,
      }))
      .sort((a, b) => a.hour - b.hour)
  } catch (error) {
    reportPersistenceError('getHourlyPriceAverage', error)
    return []
  }
}

/**
 * Save a route for a user
 */
export async function saveRouteForUser(userId: string, routeId: string, nickname?: string): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    console.log('🔧 [MOCK] Saved route for user:', { userId, routeId, nickname })
    return true
  }

  try {
    // First, get the route to extract coordinates
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      select: {
        pickup_address: true,
        pickup_lat: true,
        pickup_lng: true,
        destination_address: true,
        destination_lat: true,
        destination_lng: true,
      },
    })

    if (!route) {
      console.error('Route not found:', routeId)
      return false
    }

    await prisma.savedRoute.upsert({
      where: routeId ? { routeId } : { id: 'temp-id' }, // Use a temporary ID if routeId is null
      update: {
        fromName: route.pickup_address,
        fromLat: route.pickup_lat,
        fromLng: route.pickup_lng,
        toName: route.destination_address,
        toLat: route.destination_lat,
        toLng: route.destination_lng,
      },
      create: {
        userId,
        routeId,
        fromName: route.pickup_address,
        fromLat: route.pickup_lat,
        fromLng: route.pickup_lng,
        toName: route.destination_address,
        toLat: route.destination_lat,
        toLng: route.destination_lng,
      },
    })

    return true
  } catch (error) {
    reportPersistenceError('saveRouteForUser', error)
    return false
  }
}

/**
 * Create a price alert
 */
export async function createPriceAlert(
  userId: string,
  routeId: string,
  targetPrice: number,
  service: 'uber' | 'lyft' | 'taxi' | 'any' = 'any',
  alertType: 'below' | 'above' = 'below'
) {
  if (!isDatabaseAvailable()) {
    console.log('🔧 [MOCK] Created price alert:', { userId, routeId, targetPrice, service, alertType })
    return null
  }

  try {
    // First, get or create a saved route
    const route = await prisma.route.findUnique({
      where: { id: routeId },
    })

    if (!route) {
      console.error('Route not found:', routeId)
      return null
    }

    // Find or create saved route
    let savedRoute = routeId ? await prisma.savedRoute.findUnique({
      where: { routeId },
    }) : null

    if (!savedRoute && routeId) {
      savedRoute = await prisma.savedRoute.create({
        data: {
          userId,
          routeId,
          fromName: route.pickup_address,
          fromLat: route.pickup_lat,
          fromLng: route.pickup_lng,
          toName: route.destination_address,
          toLat: route.destination_lat,
          toLng: route.destination_lng,
        },
      })
    }

    const serviceType: ServiceType =
      service === 'uber'
        ? ServiceTypeEnum.UBER
        : service === 'lyft'
          ? ServiceTypeEnum.LYFT
          : service === 'taxi'
            ? ServiceTypeEnum.TAXI
            : ServiceTypeEnum.UBER // Default for 'any'

    if (!savedRoute) {
      console.error('Saved route not found or could not be created')
      return null
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        savedRouteId: savedRoute.id,
        service: serviceType,
        targetPrice,
      },
    })

    return alert
  } catch (error) {
    reportPersistenceError('createPriceAlert', error)
    return null
  }
}

/**
 * Log weather data
 */
export async function logWeatherData(
  coords: [number, number],
  weatherData: {
    temperature: number
    condition: string
    precipitation?: number
    windSpeed?: number
    visibility?: number
    rawData?: any
  }
): Promise<void> {
  if (!isDatabaseAvailable()) {
    console.log('🔧 [MOCK] Weather logged:', { coords, weatherData })
    return
  }

  try {
    await prisma.weatherLog.create({
      data: {
        coords_lat: coords[1],
        coords_lng: coords[0],
        temperature_f: weatherData.temperature,
        condition: weatherData.condition,
        precipitation_inch: weatherData.precipitation,
        wind_speed_mph: weatherData.windSpeed,
        visibility_miles: weatherData.visibility,
        is_severe:
          weatherData.condition.toLowerCase().includes('storm') ||
          weatherData.condition.toLowerCase().includes('severe'),
        raw_data: weatherData.rawData,
      },
    })
  } catch (error) {
    reportPersistenceError('logWeatherData', error)
  }
}

// Legacy exports for backward compatibility
// Note: This is a getter to avoid throwing at module load time in production
export const isSupabaseMockMode = (() => {
  try {
    return !isDatabaseAvailable()
  } catch {
    // In production without DATABASE_URL, isDatabaseAvailable() throws
    // Return false here since we're about to fail anyway
    return false
  }
})()
