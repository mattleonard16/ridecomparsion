import { PrismaClient } from '@/lib/generated/prisma'

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Log connection pool status on startup (development only)
 */
function logConnectionStatus() {
  if (process.env.NODE_ENV !== 'development') return

  const hasPooledUrl = !!process.env.DATABASE_URL
  const hasDirectUrl = !!process.env.DIRECT_URL

  if (hasPooledUrl && hasDirectUrl) {
    console.debug('Database configured with connection pooling (DATABASE_URL + DIRECT_URL)')
  } else if (hasPooledUrl) {
    console.debug('Database configured without DIRECT_URL - migrations may fail in serverless')
  } else {
    console.debug('DATABASE_URL not configured - lib/database.ts functions will use mock mode')
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  logConnectionStatus()
}
