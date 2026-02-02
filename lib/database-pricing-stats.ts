/**
 * Geohash clustering and pricing statistics operations.
 * Handles cluster-based price analysis and statistical calculations.
 */

import { prisma } from '@/lib/prisma'
import { type ServiceType } from '@/lib/generated/prisma'
import { encodeRouteGeohash, getNeighborPrefixes } from '@/lib/geo'
import { isDatabaseAvailable, reportPersistenceError } from './database-logging'
import { mapServiceToEnum, type RideServiceName } from './service-mappings'

// ============================================================================
// Types and Interfaces
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

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DAYS_BACK = 7
const MIN_SAMPLES_THRESHOLD = 8
// CLUSTER_GEOHASH_PRECISION: Controls the geographic area for price clustering queries.
// Lower precision = larger area (6 = ~1.2km cells). This is intentionally coarser than
// ROUTE_GEOHASH_PRECISION (storage) to aggregate prices from nearby routes.
const CLUSTER_PRECISION = Number(process.env.CLUSTER_GEOHASH_PRECISION ?? 6)
const MAX_SAMPLES = 300

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute statistical values from an array of prices.
 * Uses a single pass algorithm for efficiency.
 */
export function computeStats(values: readonly number[]): PriceStats {
  if (!values.length) {
    return { count: 0, avg: 0, min: 0, max: 0, stddev: 0 }
  }

  const result = values.reduce(
    (acc, v) => ({
      sum: acc.sum + v,
      sumSq: acc.sumSq + v * v,
      min: v < acc.min ? v : acc.min,
      max: v > acc.max ? v : acc.max,
    }),
    { sum: 0, sumSq: 0, min: values[0], max: values[0] }
  )

  const n = values.length
  const avg = result.sum / n
  const variance = Math.max(0, result.sumSq / n - avg * avg)
  const stddev = Math.sqrt(variance)

  return {
    count: n,
    avg: Number(avg.toFixed(2)),
    min: result.min,
    max: result.max,
    stddev: Number(stddev.toFixed(2)),
  }
}

/**
 * Calculate confidence score based on sample counts.
 * Higher sample counts yield higher confidence.
 */
export function calculateConfidence(exactCount: number, clusterCount: number): number {
  if (exactCount >= MIN_SAMPLES_THRESHOLD) {
    return Math.min(0.95, 0.7 + exactCount * 0.01)
  }
  if (clusterCount >= MIN_SAMPLES_THRESHOLD) {
    return Math.min(0.85, 0.5 + clusterCount * 0.005)
  }
  return 0.5
}

/**
 * Optimized neighbor query using raw SQL with LIKE ANY pattern.
 * This is significantly faster than 81 OR conditions (9 pickup × 9 destination neighbors).
 */
export async function queryNeighborClusterPrices(
  pickupNeighbors: readonly string[],
  destNeighbors: readonly string[],
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

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get pricing statistics for a route, with cluster fallback
 * Uses exact route stats if N>=8, otherwise falls back to cluster stats
 */
export async function getRouteAndClusterPriceStats(
  routeId: string,
  service: RideServiceName,
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
  service: RideServiceName,
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
