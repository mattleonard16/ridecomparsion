import { prisma } from '@/lib/prisma'
import { $Enums, type ServiceType, type TrafficLevel, type AlertType } from '@/lib/generated/prisma'
import { createHash } from 'crypto'
import { encodeRouteGeohash, getNeighborPrefixes, getDefaultPrecision } from '@/lib/geo'

const ServiceTypeEnum = $Enums.ServiceType
const TrafficLevelEnum = $Enums.TrafficLevel
const AlertTypeEnum = $Enums.AlertType

/**
 * Map service string to ServiceType enum
 * Extracted to avoid code duplication (was repeated 5x in the codebase)
 */
function mapServiceToEnum(service: 'uber' | 'lyft' | 'taxi'): ServiceType {
  switch (service) {
    case 'uber':
      return ServiceTypeEnum.UBER
    case 'lyft':
      return ServiceTypeEnum.LYFT
    case 'taxi':
      return ServiceTypeEnum.TAXI
  }
}

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
    const mockRouteId =
      `mock-route-${pickupCoords[0]}-${pickupCoords[1]}-${destCoords[0]}-${destCoords[1]}`.replace(
        /\./g,
        ''
      )
    console.log('[MOCK] Created route:', mockRouteId)
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

    const pickupGeohash = encodeRouteGeohash(pickupCoords[0], pickupCoords[1])
    const destinationGeohash = encodeRouteGeohash(destCoords[0], destCoords[1])

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
        pickup_geohash: pickupGeohash,
        destination_geohash: destinationGeohash,
        geohash_precision: getDefaultPrecision(),
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
    console.log('[MOCK] Price snapshot:', {
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

    const serviceType = mapServiceToEnum(service)

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
    console.log('[MOCK] Search logged:', {
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

    return snapshots.map(
      (snapshot: {
        createdAt: Date
        service: string
        final_price: number
        surge_multiplier: number
        weather_condition: string | null
      }) => ({
        timestamp: snapshot.createdAt.toISOString(),
        service_type: snapshot.service.toLowerCase(),
        final_price: snapshot.final_price,
        surge_multiplier: snapshot.surge_multiplier,
        weather_condition: snapshot.weather_condition,
      })
    )
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
    const serviceType = mapServiceToEnum(service)

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
export async function saveRouteForUser(
  userId: string,
  routeId: string,
  nickname?: string
): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    console.log('[MOCK] Saved route for user:', { userId, routeId, nickname })
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
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
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
 * Get saved routes for a user
 */
export async function getSavedRoutesForUser(userId: string) {
  if (!isDatabaseAvailable()) {
    console.log('[MOCK] Getting saved routes for user:', userId)
    return []
  }

  try {
    const savedRoutes = await prisma.savedRoute.findMany({
      where: { userId },
      include: {
        route: {
          select: {
            id: true,
            pickup_address: true,
            destination_address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return savedRoutes.map(sr => ({
      id: sr.id,
      routeId: sr.routeId,
      fromName: sr.fromName,
      toName: sr.toName,
      createdAt: sr.createdAt,
      route: sr.route,
    }))
  } catch (error) {
    reportPersistenceError('getSavedRoutesForUser', error)
    return []
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
    console.log('[MOCK] Created price alert:', {
      userId,
      routeId,
      targetPrice,
      service,
      alertType,
    })
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

    // Find or create saved route using composite key
    let savedRoute = routeId
      ? await prisma.savedRoute.findUnique({
          where: { userId_routeId: { userId, routeId } },
        })
      : null

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
      service === 'any' ? ServiceTypeEnum.ANY : mapServiceToEnum(service)

    const alertTypeValue: AlertType =
      alertType === 'above' ? AlertTypeEnum.ABOVE : AlertTypeEnum.BELOW

    if (!savedRoute) {
      console.error('Saved route not found or could not be created')
      return null
    }

    const alert = await prisma.priceAlert.create({
      data: {
        userId,
        savedRouteId: savedRoute.id,
        service: serviceType,
        alertType: alertTypeValue,
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
    console.log('[MOCK] Weather logged:', { coords, weatherData })
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

// ============================================================================
// Geohash Cluster Pricing Stats
// ============================================================================

export interface PriceStats {
  count: number
  avg: number
  min: number
  max: number
  stddev: number
}

export interface ClusterPriceStats extends PriceStats {
  precision: number
  pickupPrefix: string
  destinationPrefix: string
  usedNeighbors: boolean
}

export interface RouteClusterStats {
  exact?: PriceStats
  cluster?: ClusterPriceStats
  confidence: number
  source: 'exact' | 'cluster' | 'model'
}

const DEFAULT_DAYS_BACK = 7
const MIN_SAMPLES_THRESHOLD = 8
// CLUSTER_GEOHASH_PRECISION: Controls the geographic area for price clustering queries.
// Lower precision = larger area (6 = ~1.2km cells). This is intentionally coarser than
// ROUTE_GEOHASH_PRECISION (storage) to aggregate prices from nearby routes.
const CLUSTER_PRECISION = Number(process.env.CLUSTER_GEOHASH_PRECISION ?? 6)
const MAX_SAMPLES = 300

/**
 * Optimized neighbor query using raw SQL with LIKE ANY pattern.
 * This is significantly faster than 81 OR conditions (9 pickup × 9 destination neighbors).
 */
async function queryNeighborClusterPrices(
  pickupNeighbors: string[],
  destNeighbors: string[],
  serviceType: ServiceType,
  since: Date,
  maxSamples: number
): Promise<{ final_price: number }[]> {
  // Build LIKE patterns for PostgreSQL LIKE ANY
  const pickupPatterns = pickupNeighbors.map(p => `${p}%`)
  const destPatterns = destNeighbors.map(d => `${d}%`)

  // Use raw query with LIKE ANY for better performance
  const results = await prisma.$queryRaw<{ final_price: number }[]>`
    SELECT ps.final_price
    FROM "PriceSnapshot" ps
    INNER JOIN "Route" r ON ps."routeId" = r.id
    WHERE ps.service = ${serviceType}::"ServiceType"
      AND ps."createdAt" >= ${since}
      AND r.pickup_geohash LIKE ANY(${pickupPatterns})
      AND r.destination_geohash LIKE ANY(${destPatterns})
    ORDER BY ps."createdAt" DESC
    LIMIT ${maxSamples}
  `

  return results
}

function computeStats(values: number[]): PriceStats {
  if (!values.length) {
    return { count: 0, avg: 0, min: 0, max: 0, stddev: 0 }
  }

  let sum = 0
  let sumSq = 0
  let min = values[0]
  let max = values[0]

  for (const v of values) {
    sum += v
    sumSq += v * v
    if (v < min) min = v
    if (v > max) max = v
  }

  const n = values.length
  const avg = sum / n
  const variance = Math.max(0, sumSq / n - avg * avg)
  const stddev = Math.sqrt(variance)

  return { count: n, avg: Number(avg.toFixed(2)), min, max, stddev: Number(stddev.toFixed(2)) }
}

function calculateConfidence(exactCount: number, clusterCount: number): number {
  if (exactCount >= MIN_SAMPLES_THRESHOLD) {
    return Math.min(0.95, 0.7 + exactCount * 0.01)
  }
  if (clusterCount >= MIN_SAMPLES_THRESHOLD) {
    return Math.min(0.85, 0.5 + clusterCount * 0.005)
  }
  return 0.5
}

/**
 * Get pricing statistics for a route, with cluster fallback
 * Uses exact route stats if N>=8, otherwise falls back to cluster stats
 */
export async function getRouteAndClusterPriceStats(
  routeId: string,
  service: 'uber' | 'lyft' | 'taxi',
  options?: {
    daysBack?: number
    geohashPrecision?: number
    maxSamples?: number
  }
): Promise<RouteClusterStats | null> {
  if (!isDatabaseAvailable()) return null

  const daysBack = options?.daysBack ?? DEFAULT_DAYS_BACK
  const precision = options?.geohashPrecision ?? CLUSTER_PRECISION
  const maxSamples = options?.maxSamples ?? MAX_SAMPLES

  try {
    const serviceType = mapServiceToEnum(service)

    const since = new Date()
    since.setDate(since.getDate() - daysBack)

    // 1) Exact route stats
    const exactSnapshots = await prisma.priceSnapshot.findMany({
      where: {
        routeId,
        service: serviceType,
        createdAt: { gte: since },
      },
      select: { final_price: true },
      orderBy: { createdAt: 'desc' },
      take: maxSamples,
    })

    const exactValues = exactSnapshots.map(s => s.final_price)
    const exactStats =
      exactValues.length >= MIN_SAMPLES_THRESHOLD ? computeStats(exactValues) : undefined

    // If exact route has sufficient samples, use it
    if (exactStats && exactStats.count >= MIN_SAMPLES_THRESHOLD) {
      return {
        exact: exactStats,
        confidence: calculateConfidence(exactStats.count, 0),
        source: 'exact',
      }
    }

    // 2) Cluster stats: same pickup/dest geohash prefix
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      select: { pickup_geohash: true, destination_geohash: true },
    })

    if (!route?.pickup_geohash || !route.destination_geohash) {
      return {
        confidence: 0.5,
        source: 'model',
      }
    }

    const pickupPrefix = route.pickup_geohash.slice(0, precision)
    const destPrefix = route.destination_geohash.slice(0, precision)

    // Try direct cluster match first
    let clusterSnapshots = await prisma.priceSnapshot.findMany({
      where: {
        service: serviceType,
        createdAt: { gte: since },
        route: {
          pickup_geohash: { startsWith: pickupPrefix },
          destination_geohash: { startsWith: destPrefix },
        },
      },
      select: { final_price: true },
      orderBy: { createdAt: 'desc' },
      take: maxSamples,
    })

    let usedNeighbors = false

    // Fallback to neighboring geohashes if sample size below threshold
    // Uses optimized raw SQL with LIKE ANY instead of 81 OR conditions
    if (clusterSnapshots.length < MIN_SAMPLES_THRESHOLD) {
      const pickupNeighbors = getNeighborPrefixes(route.pickup_geohash, precision)
      const destNeighbors = getNeighborPrefixes(route.destination_geohash, precision)

      clusterSnapshots = await queryNeighborClusterPrices(
        pickupNeighbors,
        destNeighbors,
        serviceType,
        since,
        maxSamples
      )
      usedNeighbors = true
    }

    const clusterValues = clusterSnapshots.map(s => s.final_price)
    const clusterStatsRaw =
      clusterValues.length >= MIN_SAMPLES_THRESHOLD ? computeStats(clusterValues) : undefined

    if (clusterStatsRaw) {
      return {
        cluster: {
          ...clusterStatsRaw,
          precision,
          pickupPrefix,
          destinationPrefix: destPrefix,
          usedNeighbors,
        },
        confidence: calculateConfidence(exactValues.length, clusterStatsRaw.count),
        source: 'cluster',
      }
    }

    // No sufficient data - fall back to model
    return {
      confidence: 0.5,
      source: 'model',
    }
  } catch (error) {
    reportPersistenceError('getRouteAndClusterPriceStats', error)
    return null
  }
}

/**
 * Get cluster stats for coordinates without an existing route
 */
export async function getClusterPriceStatsByCoords(
  pickupCoords: [number, number],
  destCoords: [number, number],
  service: 'uber' | 'lyft' | 'taxi',
  options?: {
    daysBack?: number
    geohashPrecision?: number
  }
): Promise<ClusterPriceStats | null> {
  if (!isDatabaseAvailable()) return null

  const daysBack = options?.daysBack ?? DEFAULT_DAYS_BACK
  const precision = options?.geohashPrecision ?? CLUSTER_PRECISION

  try {
    const serviceType = mapServiceToEnum(service)

    const since = new Date()
    since.setDate(since.getDate() - daysBack)

    const pickupGeohash = encodeRouteGeohash(pickupCoords[0], pickupCoords[1])
    const destGeohash = encodeRouteGeohash(destCoords[0], destCoords[1])

    const pickupPrefix = pickupGeohash.slice(0, precision)
    const destPrefix = destGeohash.slice(0, precision)

    let snapshots = await prisma.priceSnapshot.findMany({
      where: {
        service: serviceType,
        createdAt: { gte: since },
        route: {
          pickup_geohash: { startsWith: pickupPrefix },
          destination_geohash: { startsWith: destPrefix },
        },
      },
      select: { final_price: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_SAMPLES,
    })

    let usedNeighbors = false

    // Fallback to neighboring geohashes if sample size below threshold
    // Uses optimized raw SQL with LIKE ANY instead of 81 OR conditions
    if (snapshots.length < MIN_SAMPLES_THRESHOLD) {
      const pickupNeighbors = getNeighborPrefixes(pickupGeohash, precision)
      const destNeighbors = getNeighborPrefixes(destGeohash, precision)

      snapshots = await queryNeighborClusterPrices(
        pickupNeighbors,
        destNeighbors,
        serviceType,
        since,
        MAX_SAMPLES
      )
      usedNeighbors = true
    }

    if (snapshots.length < MIN_SAMPLES_THRESHOLD) {
      return null
    }

    const values = snapshots.map(s => s.final_price)
    const stats = computeStats(values)

    return {
      ...stats,
      precision,
      pickupPrefix,
      destinationPrefix: destPrefix,
      usedNeighbors,
    }
  } catch (error) {
    reportPersistenceError('getClusterPriceStatsByCoords', error)
    return null
  }
}

// Legacy exports for backward compatibility
// Note: This is a getter to avoid throwing at module load time in production
export const isSupabaseMockMode = (() => {
  try {
    return !isDatabaseAvailable()
  } catch {
    // In production without DATABASE_URL, isDatabaseAvailable() throws.
    // Return true to indicate mock mode since database is unavailable.
    return true
  }
})()
