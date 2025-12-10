/**
 * Multi-Layer Rate Limiting System
 *
 * Implements enterprise-grade protection against API abuse with 2-tier defense:
 * 1. Burst Protection: Prevents rapid-fire spam (configurable via RATE_LIMIT_BURST)
 * 2. Per-Hour Limits: Sustained abuse prevention (configurable via RATE_LIMIT_PER_HOUR)
 *
 * Uses Upstash Redis for persistent rate limiting across serverless instances.
 * Falls back to in-memory storage when Redis is not configured or fails.
 */

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisAvailable } from './redis'

/**
 * Parse environment variable as integer with validation
 * Returns default if value is missing, non-numeric, or <= 0
 */
function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(`[RateLimit] Invalid env config: "${value}", using default ${defaultValue}`)
    return defaultValue
  }
  return parsed
}

// Rate limiter configuration (env-driven with validated defaults)
const RATE_LIMIT_CONFIG = {
  REQUESTS_PER_HOUR: parseEnvInt(process.env.RATE_LIMIT_PER_HOUR, 50),
  BURST_REQUESTS: parseEnvInt(process.env.RATE_LIMIT_BURST, 3),
  BURST_WINDOW_SECONDS: parseEnvInt(process.env.RATE_LIMIT_BURST_WINDOW, 10),
} as const

// In-memory fallback storage (used when Redis is not configured or fails)
const inMemoryBurstTracking = new Map<string, { count: number; resetTime: number }>()
const inMemoryHourTracking = new Map<string, { count: number; resetTime: number }>()

// Track if we're currently using in-memory fallback (runtime state)
let usingInMemoryFallback = !isRedisAvailable

// Redis-backed rate limiters (only created if Redis is available)
const redisRateLimiters = redis
  ? {
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMIT_CONFIG.BURST_REQUESTS,
        `${RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS}s`
      ),
      prefix: 'ratelimit:burst',
    }),
    hour: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR, '1h'),
      prefix: 'ratelimit:hour',
    }),
  }
  : null

/**
 * Get client identifier from request
 */
function getClientId(request: Request): string {
  // Try to get real IP from headers (for production with proxy)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  // Fallback to a combination of headers for identification
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const acceptLanguage = request.headers.get('accept-language') || 'unknown'

  // Create a simple hash of identifying characteristics
  const identifier = forwardedFor || realIp || `${userAgent}-${acceptLanguage}`

  // Simple hash function for consistent client identification
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return `client_${Math.abs(hash)}`
}

/**
 * Check rate limit using Redis (when available)
 */
async function checkRateLimitRedis(
  clientId: string
): Promise<{ allowed: boolean; remainingRequests: number; resetTime: number; reason?: string }> {
  if (!redisRateLimiters) {
    throw new Error('Redis rate limiters not initialized')
  }

  // Check burst limit first
  const burstResult = await redisRateLimiters.burst.limit(clientId)
  if (!burstResult.success) {
    return {
      allowed: false,
      remainingRequests: burstResult.remaining,
      resetTime: burstResult.reset,
      reason: `Burst limit exceeded (${RATE_LIMIT_CONFIG.BURST_REQUESTS} requests per ${RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS} seconds)`,
    }
  }

  // Check per-hour limit
  const hourResult = await redisRateLimiters.hour.limit(clientId)
  if (!hourResult.success) {
    return {
      allowed: false,
      remainingRequests: hourResult.remaining,
      resetTime: hourResult.reset,
      reason: `Rate limit exceeded (${RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR} requests per hour)`,
    }
  }

  // Return the most restrictive values so headers reflect the active constraint
  return {
    allowed: true,
    remainingRequests: Math.min(burstResult.remaining, hourResult.remaining),
    resetTime: Math.min(burstResult.reset, hourResult.reset),
  }
}

/**
 * Check rate limit using in-memory storage (fallback)
 */
function checkRateLimitInMemory(
  clientId: string
): { allowed: boolean; remainingRequests: number; resetTime: number; reason?: string } {
  const now = Date.now()

  // Check burst protection
  const burstData = inMemoryBurstTracking.get(clientId)
  if (burstData) {
    if (now < burstData.resetTime) {
      if (burstData.count >= RATE_LIMIT_CONFIG.BURST_REQUESTS) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: burstData.resetTime,
          reason: `Burst limit exceeded (${RATE_LIMIT_CONFIG.BURST_REQUESTS} requests per ${RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS} seconds)`,
        }
      }
      burstData.count++
    } else {
      inMemoryBurstTracking.set(clientId, {
        count: 1,
        resetTime: now + RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS * 1000,
      })
    }
  } else {
    inMemoryBurstTracking.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS * 1000,
    })
  }

  // Check per-hour limit
  const hourData = inMemoryHourTracking.get(clientId)
  if (hourData) {
    if (now < hourData.resetTime) {
      if (hourData.count >= RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: hourData.resetTime,
          reason: `Rate limit exceeded (${RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR} requests per hour)`,
        }
      }
      hourData.count++
    } else {
      inMemoryHourTracking.set(clientId, { count: 1, resetTime: now + 3600000 })
    }
  } else {
    inMemoryHourTracking.set(clientId, { count: 1, resetTime: now + 3600000 })
  }

  // Get fresh data from Maps (may have been reset above)
  const currentBurstData = inMemoryBurstTracking.get(clientId)!
  const currentHourData = inMemoryHourTracking.get(clientId)!

  const burstRemaining = RATE_LIMIT_CONFIG.BURST_REQUESTS - currentBurstData.count
  const hourRemaining = RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR - currentHourData.count

  // Return the most restrictive values so headers reflect the active constraint
  return {
    allowed: true,
    remainingRequests: Math.min(burstRemaining, hourRemaining),
    resetTime: Math.min(currentBurstData.resetTime, currentHourData.resetTime),
  }
}

/**
 * Check if request should be rate limited
 * Uses Redis when available, falls back to in-memory storage
 */
export async function checkRateLimit(request: Request): Promise<{
  allowed: boolean
  remainingRequests: number
  resetTime: number
  reason?: string
}> {
  const clientId = getClientId(request)

  if (isRedisAvailable && redisRateLimiters) {
    try {
      const result = await checkRateLimitRedis(clientId)
      usingInMemoryFallback = false // Redis is working
      return result
    } catch (error) {
      console.error('Redis rate limit check failed, falling back to in-memory:', error)
      usingInMemoryFallback = true // Mark that we fell back
      // Fall through to in-memory
    }
  }

  return checkRateLimitInMemory(clientId)
}

/**
 * Clean up old in-memory rate limiters (call periodically)
 * Only runs when in-memory storage is actually being used
 */
export function cleanupRateLimiters(): void {
  // Only cleanup if we're actually using in-memory storage
  // (either Redis not configured, or Redis failed and we fell back)
  if (!usingInMemoryFallback) {
    return
  }

  const now = Date.now()

  // Clean up burst tracking older than window + 1 hour buffer
  Array.from(inMemoryBurstTracking.entries()).forEach(([key, data]) => {
    if (now > data.resetTime + 3600000) {
      inMemoryBurstTracking.delete(key)
    }
  })

  // Clean up hour tracking older than 2 hours
  Array.from(inMemoryHourTracking.entries()).forEach(([key, data]) => {
    if (now > data.resetTime + 3600000) {
      inMemoryHourTracking.delete(key)
    }
  })
}

// Handler type for middleware
type Handler = (req: NextRequest) => Promise<NextResponse> | NextResponse

/**
 * Rate limiting middleware wrapper
 *
 * Usage:
 *   import { withRateLimit } from '@/lib/rate-limiter'
 *
 *   async function handlePost(req: NextRequest) {
 *     // your logic (rate limiting already applied)
 *     return NextResponse.json({ ok: true })
 *   }
 *
 *   export const POST = withCors(withRateLimit(handlePost))
 */
export function withRateLimit(handler: Handler): Handler {
  return async (req: NextRequest) => {
    // Periodic cleanup (1% chance per request, runs for ALL traffic including 429s)
    if (Math.random() < 0.01) {
      cleanupRateLimiters()
    }

    const result = await checkRateLimit(req)

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          details: result.reason,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': result.remainingRequests.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
          },
        }
      )
    }

    // Execute the actual handler
    const response = await handler(req)

    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Remaining', result.remainingRequests.toString())
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString())

    return response
  }
}

// Export for testing
export { isRedisAvailable }
