import { type NextRequest, NextResponse } from 'next/server'
import { withCors } from '@/lib/cors'
import { withRateLimit } from '@/lib/rate-limiter'
import { getRoutePriceHistory, getHourlyPriceAverage, getSavedRoutesForUser } from '@/lib/database'
import { auth } from '@/auth'

async function handleGet(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const routeId = searchParams.get('routeId')
    const service = searchParams.get('service') as 'uber' | 'lyft' | 'taxi' | null
    const daysBack = parseInt(searchParams.get('daysBack') || '7', 10)
    const getSavedRoutes = searchParams.get('savedRoutes') === 'true'

    // If requesting saved routes, return them
    if (getSavedRoutes) {
      const savedRoutes = await getSavedRoutesForUser(session.user.id)
      return NextResponse.json({ savedRoutes })
    }

    // If no routeId, return saved routes so the user can select one
    if (!routeId) {
      const savedRoutes = await getSavedRoutesForUser(session.user.id)
      return NextResponse.json({
        savedRoutes,
        priceHistory: [],
        hourlyAverages: [],
      })
    }

    // Validate service parameter
    if (service && !['uber', 'lyft', 'taxi'].includes(service)) {
      return NextResponse.json({ error: 'Invalid service type' }, { status: 400 })
    }

    // Validate daysBack
    if (isNaN(daysBack) || daysBack < 1 || daysBack > 90) {
      return NextResponse.json({ error: 'daysBack must be between 1 and 90' }, { status: 400 })
    }

    const [priceHistory, hourlyAverages] = await Promise.all([
      getRoutePriceHistory(routeId, daysBack),
      service ? getHourlyPriceAverage(routeId, service) : Promise.resolve([]),
    ])

    return NextResponse.json({
      priceHistory,
      hourlyAverages,
    })
  } catch (error) {
    console.error('[DashboardAPI] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

export const GET = withCors(withRateLimit(handleGet))
export const OPTIONS = withCors(handleGet)
