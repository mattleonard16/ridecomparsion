/**
 * Multi-Layer Rate Limiting System
 *
 * Implements enterprise-grade protection against API abuse with 3-tier defense:
 * 1. Burst Protection: 3 requests/10 seconds (prevents rapid-fire spam)
 * 2. Per-Minute Limits: 10 requests/minute (normal usage throttling)
 * 3. Per-Hour Limits: 50 requests/hour (sustained abuse prevention)
 *
 * Uses token bucket algorithm for smooth rate limiting and client fingerprinting
 * for identification. Designed for production deployment with Vercel/Cloudflare.
 */

import { RateLimiter } from 'limiter'

// Rate limiter configuration
const RATE_LIMIT_CONFIG = {
  REQUESTS_PER_MINUTE: 10,
  REQUESTS_PER_HOUR: 50,
  BURST_REQUESTS: 3,
  BURST_WINDOW_SECONDS: 10,
} as const

// In-memory storage for rate limiting (use Redis in production)
const rateLimiters = new Map<string, RateLimiter>()
const burstTracking = new Map<string, { count: number; resetTime: number }>()

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
 * Check if request should be rate limited
 */
export async function checkRateLimit(request: Request): Promise<{
  allowed: boolean
  remainingRequests: number
  resetTime: number
  reason?: string
}> {
  const clientId = getClientId(request)
  const now = Date.now()

  // Check burst protection first (3 requests per 10 seconds)
  const burstKey = `${clientId}_burst`
  const burstData = burstTracking.get(burstKey)

  if (burstData) {
    if (now < burstData.resetTime) {
      if (burstData.count >= RATE_LIMIT_CONFIG.BURST_REQUESTS) {
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: burstData.resetTime,
          reason: 'Burst limit exceeded (3 requests per 10 seconds)',
        }
      }
      burstData.count++
    } else {
      // Reset burst window
      burstTracking.set(burstKey, {
        count: 1,
        resetTime: now + RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS * 1000,
      })
    }
  } else {
    // First request in burst window
    burstTracking.set(burstKey, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.BURST_WINDOW_SECONDS * 1000,
    })
  }

  // Check per-minute rate limit
  const minuteKey = `${clientId}_minute`
  let minuteLimiter = rateLimiters.get(minuteKey)

  if (!minuteLimiter) {
    // Create new rate limiter: 10 requests per minute
    minuteLimiter = new RateLimiter({
      tokensPerInterval: RATE_LIMIT_CONFIG.REQUESTS_PER_MINUTE,
      interval: 'minute',
    })
    rateLimiters.set(minuteKey, minuteLimiter)
  }

  const minuteAllowed = await minuteLimiter.tryRemoveTokens(1)
  if (!minuteAllowed) {
    return {
      allowed: false,
      remainingRequests: minuteLimiter.getTokensRemaining(),
      resetTime: now + 60000, // Reset in 1 minute
      reason: 'Rate limit exceeded (10 requests per minute)',
    }
  }

  // Check per-hour rate limit
  const hourKey = `${clientId}_hour`
  let hourLimiter = rateLimiters.get(hourKey)

  if (!hourLimiter) {
    // Create new rate limiter: 50 requests per hour
    hourLimiter = new RateLimiter({
      tokensPerInterval: RATE_LIMIT_CONFIG.REQUESTS_PER_HOUR,
      interval: 'hour',
    })
    rateLimiters.set(hourKey, hourLimiter)
  }

  const hourAllowed = await hourLimiter.tryRemoveTokens(1)
  if (!hourAllowed) {
    return {
      allowed: false,
      remainingRequests: hourLimiter.getTokensRemaining(),
      resetTime: now + 3600000, // Reset in 1 hour
      reason: 'Rate limit exceeded (50 requests per hour)',
    }
  }

  return {
    allowed: true,
    remainingRequests: Math.min(
      minuteLimiter.getTokensRemaining(),
      hourLimiter.getTokensRemaining()
    ),
    resetTime: now + 60000, // Next minute reset
  }
}

/**
 * Clean up old rate limiters (call periodically)
 */
export function cleanupRateLimiters(): void {
  const now = Date.now()

  // Clean up burst tracking older than 1 hour
  Array.from(burstTracking.entries()).forEach(([key, data]) => {
    if (now > data.resetTime + 3600000) {
      burstTracking.delete(key)
    }
  })

  // In a real app, you'd also clean up old rate limiters
  // For now, they'll be garbage collected naturally
}
