/**
 * Multi-Layer Rate Limiting System
 *
 * Implements enterprise-grade protection against API abuse with 3-tier defense:
 * 1. Burst Protection: 3 requests/10 seconds (prevents rapid-fire spam)
 * 2. Per-Minute Limits: 10 requests/minute (normal usage throttling)
 * 3. Per-Hour Limits: 50 requests/hour (sustained abuse prevention)
 *
 * Uses Upstash Redis for persistent rate limiting across serverless instances.
 * Falls back to in-memory storage when Redis is not configured.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { redis, isRedisAvailable } from './redis'

// Rate limiter configuration
const RATE_LIMIT_CONFIG = {
  REQUESTS_PER_MINUTE: 10,
  REQUESTS_PER_HOUR: 50,
  BURST_REQUESTS: 3,
  BURST_WINDOW_SECONDS: 10,
} as const

// In-memory fallback storage (used when Redis is not configured)
const inMemoryBurstTracking = new Map<string, { count: number; resetTime: number }>()
const inMemoryMinuteTracking = new Map<string, { count: number; resetTime: number }>()
const inMemoryHourTracking = new Map<string, { count: number; resetTime: number }>()

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
    minute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE, '1m'),
      prefix: 'ratelimit:minute',
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

  const now = Date.now()

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

  // Check per-minute limit
  const minuteResult = await redisRateLimiters.minute.limit(clientId)
  if (!minuteResult.success) {
    return {
      allowed: false,
      remainingRequests: minuteResult.remaining,
      resetTime: minuteResult.reset,
      reason: `Rate limit exceeded (${RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE} requests per minute)`,
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

  return {
    allowed: true,
    remainingRequests: Math.min(minuteResult.remaining, hourResult.remaining),
    resetTime: now + 60000,
  }
}

/**
 * Check rate limit using in-memory storage (fallback)
 */
function checkRateLimitInMemory(
  clientId: string
): { allowed: boolean; remainingRequests: number; resetTime: number; reason?: string } {
  const now = Date.now()

  // Check burst protection (3 requests per 10 seconds)
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

  // Check per-minute limit
  const minuteData = inMemoryMinuteTracking.get(clientId)
  if (minuteData) {
    if (now < minuteData.resetTime) {
      if (minuteData.count >= RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: minuteData.resetTime,
          reason: `Rate limit exceeded (${RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE} requests per minute)`,
        }
      }
      minuteData.count++
    } else {
      inMemoryMinuteTracking.set(clientId, { count: 1, resetTime: now + 60000 })
    }
  } else {
    inMemoryMinuteTracking.set(clientId, { count: 1, resetTime: now + 60000 })
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

  const minuteRemaining = minuteData
    ? RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE - minuteData.count
    : RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE - 1
  const hourRemaining = hourData
    ? RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR - hourData.count
    : RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR - 1

  return {
    allowed: true,
    remainingRequests: Math.min(minuteRemaining, hourRemaining),
    resetTime: now + 60000,
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
      return await checkRateLimitRedis(clientId)
    } catch (error) {
      console.error('Redis rate limit check failed, falling back to in-memory:', error)
      // Fall through to in-memory
    }
  }

  return checkRateLimitInMemory(clientId)
}

/**
 * Clean up old in-memory rate limiters (call periodically)
 * Only needed for in-memory fallback, Redis handles its own cleanup
 */
export function cleanupRateLimiters(): void {
  if (isRedisAvailable) {
    // Redis handles TTL-based cleanup automatically
    return
  }

  const now = Date.now()

  // Clean up burst tracking older than window + 1 hour buffer
  Array.from(inMemoryBurstTracking.entries()).forEach(([key, data]) => {
    if (now > data.resetTime + 3600000) {
      inMemoryBurstTracking.delete(key)
    }
  })

  // Clean up minute tracking older than 2 hours
  Array.from(inMemoryMinuteTracking.entries()).forEach(([key, data]) => {
    if (now > data.resetTime + 3600000) {
      inMemoryMinuteTracking.delete(key)
    }
  })

  // Clean up hour tracking older than 2 hours
  Array.from(inMemoryHourTracking.entries()).forEach(([key, data]) => {
    if (now > data.resetTime + 3600000) {
      inMemoryHourTracking.delete(key)
    }
  })
}

// Export for testing
export { isRedisAvailable }
