import { API_CONFIG } from '@/lib/constants'
import { findOrCreateRoute, logPriceSnapshot, logSearch } from '@/lib/database'
import { getAirportByCode, parseAirportCode } from '@/lib/airports'
import { getBestTimeRecommendations, getTimeBasedMultiplier, pricingEngine } from '@/lib/pricing'
import { sanitizeString } from '@/lib/validation'
import { findPrecomputedRouteByAddresses } from '@/lib/popular-routes-data'
import type {
  ComparisonResults,
  Coordinates,
  Latitude,
  RideResult,
  ServiceType,
  SurgeInfo,
  Longitude,
  PriceString,
  RideService,
} from '@/types'

const GEOCODE_CACHE = new Map<string, { value: Coordinates; expiresAt: number }>()
const ROUTE_CACHE = new Map<string, { value: RouteMetrics; expiresAt: number }>()
const COMPARISON_CACHE = new Map<string, { value: ComparisonComputation; expiresAt: number }>()

// Cache size limits to prevent memory leaks
const MAX_CACHE_SIZE = 1000
const CACHE_CLEANUP_THRESHOLD = 0.8 // Trigger cleanup at 80% capacity

/**
 * Clean up expired entries from a cache
 */
function cleanupCache<T>(cache: Map<string, { value: T; expiresAt: number }>): void {
  const now = Date.now()
  const keysToDelete: string[] = []
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => cache.delete(key))
}

/**
 * Perform cache maintenance - cleanup expired entries and evict oldest if over capacity
 */
function maintainCache<T>(cache: Map<string, { value: T; expiresAt: number }>): void {
  // First, clean up expired entries
  cleanupCache(cache)

  // If still over threshold, evict oldest entries (first inserted)
  if (cache.size > MAX_CACHE_SIZE * CACHE_CLEANUP_THRESHOLD) {
    const entriesToRemove = cache.size - Math.floor(MAX_CACHE_SIZE * 0.5)
    const keys = Array.from(cache.keys())
    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
      cache.delete(keys[i])
    }
  }
}

type PricingComputation = ReturnType<typeof pricingEngine.calculateFare>

interface RouteMetrics {
  distanceKm: number
  durationMin: number
  osrmDurationSec?: number
}

interface ComparisonComputation {
  routeId: string | null
  results: ComparisonResults
  surgeInfo: SurgeInfo
  timeRecommendations: string[]
  pickup: Coordinates
  destination: Coordinates
  insights: string
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  uber: 'UberX',
  lyft: 'Lyft Standard',
  taxi: 'Yellow Cab',
  waymo: 'Waymo One',
}

const DEFAULT_SERVICES: ServiceType[] = ['uber', 'lyft', 'taxi', 'waymo']

// Waymo service area bounding boxes
const WAYMO_SERVICE_AREAS = {
  sanFrancisco: {
    minLat: 37.7,
    maxLat: 37.82,
    minLon: -122.52,
    maxLon: -122.35,
  },
  peninsula: {
    minLat: 37.4,
    maxLat: 37.7,
    minLon: -122.5,
    maxLon: -122.1,
  },
}

/**
 * Check if coordinates are within Waymo's service area
 */
function isInWaymoServiceArea(coords: Coordinates): boolean {
  const [lon, lat] = coords

  for (const area of Object.values(WAYMO_SERVICE_AREAS)) {
    if (lat >= area.minLat && lat <= area.maxLat && lon >= area.minLon && lon <= area.maxLon) {
      return true
    }
  }
  return false
}

/**
 * Filter services based on route eligibility (e.g., Waymo service area)
 */
function filterServicesForRoute(
  services: ServiceType[],
  pickup: Coordinates,
  destination: Coordinates
): ServiceType[] {
  return services.filter(service => {
    if (service === 'waymo') {
      // Both pickup and destination must be in Waymo service area
      return isInWaymoServiceArea(pickup) && isInWaymoServiceArea(destination)
    }
    return true
  })
}

export async function compareRidesByAddresses(
  pickupAddress: string,
  destinationAddress: string,
  services: ServiceType[] = DEFAULT_SERVICES,
  timestamp: Date = new Date(),
  options?: {
    userId?: string | null
    sessionId?: string | null
    persist?: boolean
  }
): Promise<ComparisonComputation | null> {
  const sanitizedPickup = sanitizeString(pickupAddress)
  const sanitizedDestination = sanitizeString(destinationAddress)

  const cacheKey = `${sanitizedPickup.toLowerCase()}-${sanitizedDestination.toLowerCase()}`
  const cached = COMPARISON_CACHE.get(cacheKey)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const precomputedRoute = findPrecomputedRouteByAddresses(sanitizedPickup, sanitizedDestination)

  let pickupCoords: Coordinates | null
  let destinationCoords: Coordinates | null

  if (precomputedRoute) {
    pickupCoords = precomputedRoute.pickup.coordinates
    destinationCoords = precomputedRoute.destination.coordinates
  } else {
    // Parallelize geocoding calls for better performance (~200-500ms savings)
    const [pickup, destination] = await Promise.all([
      geocodeWithCache(sanitizedPickup),
      geocodeWithCache(sanitizedDestination),
    ])
    pickupCoords = pickup
    destinationCoords = destination
  }

  if (!pickupCoords || !destinationCoords) {
    return null
  }

  const result = await compareRidesByCoordinates(
    { name: sanitizedPickup, coordinates: pickupCoords },
    { name: sanitizedDestination, coordinates: destinationCoords },
    services,
    timestamp,
    {
      userId: options?.userId ?? null,
      sessionId: options?.sessionId ?? null,
      persist: options?.persist ?? true,
      pickupAddress: sanitizedPickup,
      destinationAddress: sanitizedDestination,
      precomputedMetrics: precomputedRoute?.metrics,
    }
  )

  const cacheTTL = precomputedRoute ? 1800000 : 45000
  maintainCache(COMPARISON_CACHE)
  COMPARISON_CACHE.set(cacheKey, {
    value: result,
    expiresAt: now + cacheTTL,
  })

  return result
}

export async function compareRidesByCoordinates(
  pickup: { name: string; coordinates: Coordinates },
  destination: { name: string; coordinates: Coordinates },
  services: ServiceType[] = DEFAULT_SERVICES,
  timestamp: Date = new Date(),
  options?: {
    userId?: string | null
    sessionId?: string | null
    persist?: boolean
    pickupAddress?: string
    destinationAddress?: string
    precomputedMetrics?: RouteMetrics
  }
): Promise<ComparisonComputation> {
  const normalisedServices = services.length ? services : DEFAULT_SERVICES
  const uniqueServices = Array.from(
    new Set<ServiceType>(normalisedServices.map(service => service.toLowerCase() as ServiceType))
  )

  // Filter services based on route eligibility (e.g., Waymo service area)
  let eligibleServices = filterServicesForRoute(
    uniqueServices,
    pickup.coordinates,
    destination.coordinates
  )

  // Guard against empty services (e.g., only Waymo selected but outside service area)
  if (eligibleServices.length === 0) {
    // Fall back to default services excluding Waymo for this route
    const fallbackServices = DEFAULT_SERVICES.filter(s => s !== 'waymo')
    eligibleServices = filterServicesForRoute(
      fallbackServices,
      pickup.coordinates,
      destination.coordinates
    )
  }

  const metrics = options?.precomputedMetrics
    ? options.precomputedMetrics
    : await getRouteMetrics(pickup.coordinates, destination.coordinates)

  const shouldPersist = options?.persist !== false
  const pickupAddress = options?.pickupAddress ?? pickup.name
  const destinationAddress = options?.destinationAddress ?? destination.name

  // Start route creation early (await later for routeId needed by save/alert features)
  const routeIdPromise: Promise<string | null> = shouldPersist
    ? findOrCreateRoute(
        pickupAddress,
        [pickup.coordinates[0], pickup.coordinates[1]],
        destinationAddress,
        [destination.coordinates[0], destination.coordinates[1]],
        metrics.distanceKm,
        metrics.durationMin
      )
    : Promise.resolve(null)

  const resultsEntries = eligibleServices.map(service => {
    const computation = pricingEngine.calculateFare({
      service,
      pickupCoords: pickup.coordinates,
      destCoords: destination.coordinates,
      distanceKm: metrics.distanceKm,
      durationMin: metrics.durationMin,
      timestamp,
      osrmDurationSec: metrics.osrmDurationSec,
      expectedDurationSec: metrics.durationMin * 60,
    })

    return [service, buildRideResult(service, computation, metrics), computation] as const
  })

  const comparisonResults = Object.fromEntries(
    resultsEntries.map(([service, result]) => [service, result])
  ) as ComparisonResults

  const { multiplier, surgeReason } = getTimeBasedMultiplier(
    pickup.coordinates,
    destination.coordinates,
    timestamp
  )

  const surgeInfo: SurgeInfo = {
    multiplier,
    reason: surgeReason,
    isActive: multiplier > 1.05,
  }

  // Await routeId (needed for save route and price alert features)
  // but fire-and-forget the logging operations for faster response
  const routeId = await routeIdPromise

  // Fire-and-forget: Log price snapshots and search asynchronously (non-blocking)
  if (shouldPersist && routeId) {
    // Log price snapshots for each service
    resultsEntries.forEach(([service, _, computation]) => {
      logPriceSnapshot(
        routeId,
        service,
        computation.breakdown.finalFare,
        computation.breakdown.surgeMultiplier,
        deriveWaitMinutes(service, computation.breakdown.surgeMultiplier, metrics.durationMin),
        {
          weather: computation.surgeReason,
          trafficLevel: classifyTraffic(computation.breakdown.trafficMultiplier),
        }
      ).catch(() => {
        // Price snapshot logging failed (non-critical) - ignore
      })
    })

    // Log the search
    logSearch(
      routeId,
      options?.userId ?? null,
      comparisonResults,
      options?.sessionId ?? undefined
    ).catch(() => {
      // Search logging failed (non-critical) - ignore
    })
  }

  return {
    routeId,
    results: comparisonResults,
    surgeInfo,
    timeRecommendations: getBestTimeRecommendations(),
    pickup: pickup.coordinates,
    destination: destination.coordinates,
    insights: generateRecommendation(comparisonResults),
  }
}

function classifyTraffic(
  multiplier: number
): 'light' | 'moderate' | 'heavy' | 'severe' | undefined {
  if (multiplier <= 1.1) return 'light'
  if (multiplier <= 1.25) return 'moderate'
  if (multiplier <= 1.4) return 'heavy'
  return 'severe'
}

async function geocodeWithCache(address: string): Promise<Coordinates | null> {
  const cacheKey = address.toLowerCase()
  const cached = GEOCODE_CACHE.get(cacheKey)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const airportCode = parseAirportCode(address)
  if (airportCode) {
    const airport = getAirportByCode(airportCode)
    if (airport) {
      maintainCache(GEOCODE_CACHE)
      GEOCODE_CACHE.set(cacheKey, {
        value: airport.coordinates,
        expiresAt: now + API_CONFIG.CACHE_TTL,
      })
      return airport.coordinates
    }
  }

  const url = `${API_CONFIG.NOMINATIM_BASE_URL}?q=${encodeURIComponent(address)}&format=json&limit=1`
  const response = await resilientFetch(url)

  if (!response.ok) {
    return null
  }

  const data: Array<{ lon: string; lat: string }> = await response.json()
  if (!data.length) {
    return null
  }

  const lon = parseFloat(data[0].lon) as Longitude
  const lat = parseFloat(data[0].lat) as Latitude
  const coordinates: Coordinates = [lon, lat]
  maintainCache(GEOCODE_CACHE)
  GEOCODE_CACHE.set(cacheKey, {
    value: coordinates,
    expiresAt: now + API_CONFIG.CACHE_TTL,
  })

  return coordinates
}

async function getRouteMetrics(
  pickup: Coordinates,
  destination: Coordinates
): Promise<RouteMetrics> {
  const cacheKey = `${pickup[0]},${pickup[1]}-${destination[0]},${destination[1]}`
  const now = Date.now()
  const cached = ROUTE_CACHE.get(cacheKey)

  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const url = `${API_CONFIG.OSRM_BASE_URL}/${pickup[0]},${pickup[1]};${destination[0]},${destination[1]}?overview=false`
  const response = await resilientFetch(url)

  if (!response.ok) {
    throw new Error(`OSRM request failed with status ${response.status}`)
  }

  const data: OSRMResponse = await response.json()

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error(`OSRM response invalid: ${data.code}`)
  }

  const route = data.routes[0]
  const metrics: RouteMetrics = {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    osrmDurationSec: route.duration,
  }

  maintainCache(ROUTE_CACHE)
  ROUTE_CACHE.set(cacheKey, {
    value: metrics,
    expiresAt: now + API_CONFIG.ROUTE_CACHE_TTL,
  })

  return metrics
}

async function resilientFetch(url: string): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), API_CONFIG.REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': API_CONFIG.USER_AGENT,
        },
      })

      clearTimeout(timeout)
      return response
    } catch (error) {
      clearTimeout(timeout)
      lastError = error

      if (attempt === API_CONFIG.MAX_RETRIES) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed after retries')
}

function buildRideResult(
  service: ServiceType,
  computation: PricingComputation,
  metrics: RouteMetrics
): RideResult {
  const surgeMultiplier = computation.breakdown.surgeMultiplier
  const waitMinutes = deriveWaitMinutes(service, surgeMultiplier, metrics.durationMin)
  const driversNearby = deriveDriversNearby(service, surgeMultiplier, metrics.distanceKm)

  return {
    price: formatCurrency(computation.price),
    waitTime: `${waitMinutes} min`,
    driversNearby,
    service: SERVICE_LABELS[service] as RideService,
    surgeMultiplier: surgeMultiplier > 1.05 ? `${surgeMultiplier.toFixed(2)}x` : undefined,
  }
}

function deriveWaitMinutes(
  service: ServiceType,
  surgeMultiplier: number,
  durationMin: number
): number {
  // Base wait times: Waymo has longer waits (7 min), Taxi moderate (6 min), rideshare fastest (4 min)
  const base = service === 'waymo' ? 7 : service === 'taxi' ? 6 : 4
  const demandPenalty =
    surgeMultiplier > 1.4 ? 3 : surgeMultiplier > 1.2 ? 2 : surgeMultiplier > 1.05 ? 1 : 0
  const tripComplexity = Math.min(4, Math.round(durationMin / 15))

  // Waymo has a higher max wait time (22 min) due to smaller fleet
  const maxWait = service === 'waymo' ? 22 : 18
  return Math.max(2, Math.min(maxWait, base + demandPenalty + tripComplexity))
}

function deriveDriversNearby(
  service: ServiceType,
  surgeMultiplier: number,
  distanceKm: number
): number {
  // Waymo has the smallest fleet (2 base), followed by taxi (3), lyft (4), uber (5)
  const baseDrivers = service === 'waymo' ? 2 : service === 'taxi' ? 3 : service === 'lyft' ? 4 : 5
  const surgePenalty = surgeMultiplier > 1.4 ? 2 : surgeMultiplier > 1.2 ? 1 : 0
  const distanceFactor = distanceKm > 30 ? 1 : 0

  return Math.max(1, baseDrivers - surgePenalty - distanceFactor)
}

function formatCurrency(amount: number): PriceString {
  return `$${amount.toFixed(2)}`
}

function generateRecommendation(results: ComparisonResults): string {
  const parsed = Object.entries(results).map(([service, result]) => ({
    service,
    price: parseFloat(result.price.replace('$', '')),
    wait: parseInt(result.waitTime.replace(' min', ''), 10),
  }))

  // Guard against empty results
  if (parsed.length === 0) {
    return 'No ride services available for this route.'
  }

  const scores = parsed.map(entry => ({
    service: entry.service,
    score: entry.price * 0.7 + entry.wait * 0.3,
    price: entry.price,
    wait: entry.wait,
  }))

  const best = scores.reduce((prev, curr) => (curr.score < prev.score ? curr : prev))
  const cheapest = scores.reduce((prev, curr) => (curr.price < prev.price ? curr : prev))
  const fastest = scores.reduce((prev, curr) => (curr.wait < prev.wait ? curr : prev))

  let recommendation = `Based on price and wait time, ${capitalise(best.service)} looks like the best overall choice.`

  if (best.service !== cheapest.service) {
    recommendation += ` ${capitalise(cheapest.service)} is the most budget-friendly ride today.`
  }

  if (best.service !== fastest.service) {
    recommendation += ` ${capitalise(fastest.service)} should arrive the quickest.`
  }

  return recommendation.trim()
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

interface OSRMResponse {
  code: string
  routes: Array<{
    distance: number
    duration: number
  }>
}
