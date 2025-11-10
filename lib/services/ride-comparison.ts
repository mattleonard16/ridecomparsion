import { API_CONFIG } from '@/lib/constants'
import { findOrCreateRoute, logPriceSnapshot, logSearch } from '@/lib/supabase'
import { getAirportByCode, parseAirportCode } from '@/lib/airports'
import { getBestTimeRecommendations, getTimeBasedMultiplier, pricingEngine } from '@/lib/pricing'
import { sanitizeString } from '@/lib/validation'
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
import type { Database } from '@/types/supabase'

const GEOCODE_CACHE = new Map<string, { value: Coordinates; expiresAt: number }>()
const ROUTE_CACHE = new Map<string, { value: RouteMetrics; expiresAt: number }>()
const COMPARISON_CACHE = new Map<string, { value: ComparisonComputation; expiresAt: number }>()

type PricingComputation = ReturnType<typeof pricingEngine.calculateFare>

interface RouteMetrics {
  distanceKm: number
  durationMin: number
  osrmDurationSec?: number
}

interface ComparisonComputation {
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
}

const DEFAULT_SERVICES: ServiceType[] = ['uber', 'lyft', 'taxi']

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
  const startTime = Date.now()
  const sanitizedPickup = sanitizeString(pickupAddress)
  const sanitizedDestination = sanitizeString(destinationAddress)

  // Check comparison cache
  const cacheKey = `${sanitizedPickup.toLowerCase()}-${sanitizedDestination.toLowerCase()}`
  const cached = COMPARISON_CACHE.get(cacheKey)
  const now = Date.now()

  if (cached && cached.expiresAt > now) {
    console.log(`[CompareAPI] Cache hit for ${cacheKey} - ${Date.now() - startTime}ms`)
    return cached.value
  }

  console.log(`[CompareAPI] Starting comparison for ${sanitizedPickup} → ${sanitizedDestination}`)

  const pickupCoords = await geocodeWithCache(sanitizedPickup)
  const destinationCoords = await geocodeWithCache(sanitizedDestination)

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
    }
  )

  // Cache the result for 45 seconds
  COMPARISON_CACHE.set(cacheKey, {
    value: result,
    expiresAt: now + 45000, // 45 seconds
  })

  console.log(`[CompareAPI] Total time: ${Date.now() - startTime}ms`)
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
  }
): Promise<ComparisonComputation> {
  const startTime = Date.now()
  const normalisedServices = services.length ? services : DEFAULT_SERVICES
  const uniqueServices = Array.from(
    new Set<ServiceType>(normalisedServices.map(service => service.toLowerCase() as ServiceType))
  )

  const metricsStart = Date.now()
  const metrics = await getRouteMetrics(pickup.coordinates, destination.coordinates)
  console.log(`[CompareAPI] Route metrics fetched in ${Date.now() - metricsStart}ms`)

  const shouldPersist = options?.persist !== false
  const pickupAddress = options?.pickupAddress ?? pickup.name
  const destinationAddress = options?.destinationAddress ?? destination.name

  // Start route creation in background (non-blocking)
  let routeIdPromise: Promise<string | null> = Promise.resolve(null)
  if (shouldPersist) {
    routeIdPromise = findOrCreateRoute(
      pickupAddress,
      [pickup.coordinates[0], pickup.coordinates[1]],
      destinationAddress,
      [destination.coordinates[0], destination.coordinates[1]],
      metrics.distanceKm,
      metrics.durationMin
    )
  }

  // Calculate pricing for all services (synchronous, fast)
  const pricingStart = Date.now()
  const resultsEntries = uniqueServices.map(service => {
    const serviceStart = Date.now()
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
    console.log(
      `[CompareAPI] ${service.charAt(0).toUpperCase() + service.slice(1)}: ${Date.now() - serviceStart}ms`
    )

    return [service, buildRideResult(service, computation, metrics), computation] as const
  })
  console.log(`[CompareAPI] All pricing calculations: ${Date.now() - pricingStart}ms`)

  const comparisonResults = Object.fromEntries(
    resultsEntries.map(([service, result]) => [service, result])
  ) as ComparisonResults

  // Wait for route ID and log snapshots in background (non-blocking for response)
  if (shouldPersist) {
    routeIdPromise
      .then(routeId => {
        if (routeId) {
          resultsEntries.forEach(([service, _, computation]) => {
            logPriceSnapshot(
              routeId,
              service,
              computation.breakdown.finalFare,
              computation.breakdown.surgeMultiplier,
              deriveWaitMinutes(
                service,
                computation.breakdown.surgeMultiplier,
                metrics.durationMin
              ),
              {
                weather: computation.surgeReason,
                trafficLevel: classifyTraffic(computation.breakdown.trafficMultiplier),
              }
            )
          })
        }
      })
      .catch(err => console.error('[CompareAPI] Route creation error:', err))
  }

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

  // Log search in background (non-blocking for response)
  if (shouldPersist) {
    routeIdPromise
      .then(routeId => {
        logSearch(
          routeId,
          options?.userId ?? null,
          comparisonResults,
          options?.sessionId ?? undefined
        )
      })
      .catch(err => console.error('[CompareAPI] Search logging error:', err))
  }

  const result = {
    results: comparisonResults,
    surgeInfo,
    timeRecommendations: getBestTimeRecommendations(),
    pickup: pickup.coordinates,
    destination: destination.coordinates,
    insights: generateRecommendation(comparisonResults),
  }

  console.log(`[CompareAPI] compareRidesByCoordinates total: ${Date.now() - startTime}ms`)
  return result
}

function classifyTraffic(
  multiplier: number
): Database['public']['Enums']['traffic_level'] | undefined {
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
  const base = service === 'taxi' ? 6 : 4
  const demandPenalty =
    surgeMultiplier > 1.4 ? 3 : surgeMultiplier > 1.2 ? 2 : surgeMultiplier > 1.05 ? 1 : 0
  const tripComplexity = Math.min(4, Math.round(durationMin / 15))

  return Math.max(2, Math.min(18, base + demandPenalty + tripComplexity))
}

function deriveDriversNearby(
  service: ServiceType,
  surgeMultiplier: number,
  distanceKm: number
): number {
  const baseDrivers = service === 'taxi' ? 3 : service === 'lyft' ? 4 : 5
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
