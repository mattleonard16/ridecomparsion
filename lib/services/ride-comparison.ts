import { API_CONFIG } from '@/lib/constants'
import { getAirportByCode, parseAirportCode } from '@/lib/airports'
import { getBestTimeRecommendations, getTimeBasedMultiplier, pricingEngine } from '@/lib/pricing-final'
import { sanitizeString } from '@/lib/validation'
import type {
  ComparisonResults,
  Coordinates,
  Latitude,
  RideResult,
  ServiceType,
  SurgeInfo,
  Longitude,
} from '@/types'

const GEOCODE_CACHE = new Map<string, { value: Coordinates; expiresAt: number }>()
const ROUTE_CACHE = new Map<string, { value: RouteMetrics; expiresAt: number }>()

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
  timestamp: Date = new Date()
): Promise<ComparisonComputation | null> {
  const sanitizedPickup = sanitizeString(pickupAddress)
  const sanitizedDestination = sanitizeString(destinationAddress)

  const pickupCoords = await geocodeWithCache(sanitizedPickup)
  const destinationCoords = await geocodeWithCache(sanitizedDestination)

  if (!pickupCoords || !destinationCoords) {
    return null
  }

  return compareRidesByCoordinates(
    { name: sanitizedPickup, coordinates: pickupCoords },
    { name: sanitizedDestination, coordinates: destinationCoords },
    services,
    timestamp
  )
}

export async function compareRidesByCoordinates(
  pickup: { name: string; coordinates: Coordinates },
  destination: { name: string; coordinates: Coordinates },
  services: ServiceType[] = DEFAULT_SERVICES,
  timestamp: Date = new Date()
): Promise<ComparisonComputation> {
  const normalisedServices = services.length ? services : DEFAULT_SERVICES
  const uniqueServices = Array.from(
    new Set<ServiceType>(normalisedServices.map((service) => service.toLowerCase() as ServiceType))
  )

  const metrics = await getRouteMetrics(pickup.coordinates, destination.coordinates)

  const resultsEntries = uniqueServices.map((service) => {
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

    return [service, buildRideResult(service, computation, metrics)] as const
  })

  const comparisonResults = Object.fromEntries(resultsEntries) as ComparisonResults

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

  return {
    results: comparisonResults,
    surgeInfo,
    timeRecommendations: getBestTimeRecommendations(),
    pickup: pickup.coordinates,
    destination: destination.coordinates,
    insights: generateRecommendation(comparisonResults),
  }
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

  throw lastError instanceof Error
    ? lastError
    : new Error('Request failed after retries')
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
    service: SERVICE_LABELS[service],
    surgeMultiplier: surgeMultiplier > 1.05 ? `${surgeMultiplier.toFixed(2)}x` : undefined,
  }
}

function deriveWaitMinutes(
  service: ServiceType,
  surgeMultiplier: number,
  durationMin: number
): number {
  const base = service === 'taxi' ? 6 : 4
  const demandPenalty = surgeMultiplier > 1.4 ? 3 : surgeMultiplier > 1.2 ? 2 : surgeMultiplier > 1.05 ? 1 : 0
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

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function generateRecommendation(results: ComparisonResults): string {
  const parsed = Object.entries(results).map(([service, result]) => ({
    service,
    price: parseFloat(result.price.replace('$', '')),
    wait: parseInt(result.waitTime.replace(' min', ''), 10),
  }))

  const scores = parsed.map((entry) => ({
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
