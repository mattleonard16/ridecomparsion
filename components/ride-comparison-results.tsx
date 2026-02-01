import {
  AlertCircle,
  Share2,
  Bell,
  Bookmark,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from 'lucide-react'
import { useState, memo, useMemo } from 'react'
import PriceAlert from './price-alert'
import { useAuth } from '@/lib/auth-context'
import { saveRouteForUser } from '@/lib/database'
import { AuthDialog } from './auth-dialog'
import ModalPortal from './ModalPortal'

type RideData = {
  price: string
  waitTime: string
  driversNearby: number
  service: string
  surgeMultiplier?: string
}

type Results = {
  uber: RideData
  lyft: RideData
  taxi: RideData
}

type ServiceType = 'uber' | 'lyft' | 'taxi'

type PriceStats = {
  count: number
  avg: number
  min: number
  max: number
  stddev: number
}

type RouteClusterStats = {
  exact?: PriceStats
  cluster?: {
    count: number
    avg: number
    min: number
    max: number
    stddev: number
    precision: number
    pickupPrefix: string
    destinationPrefix: string
    usedNeighbors: boolean
  }
  confidence: number
  source: 'exact' | 'cluster' | 'model'
}

type RideComparisonResultsProps = {
  routeId?: string | null
  results: Results
  insights: string
  surgeInfo?: {
    isActive: boolean
    reason: string
    multiplier: number
  } | null
  timeRecommendations?: string[]
  pickup?: string
  destination?: string
  pickupCoords?: [number, number] | null
  destinationCoords?: [number, number] | null
  historicalStats?: Partial<Record<ServiceType, RouteClusterStats | null>>
}

export default memo(function RideComparisonResults({
  routeId = null,
  results,
  insights,
  surgeInfo,
  timeRecommendations = [],
  pickup = '',
  destination = '',
  pickupCoords = null,
  destinationCoords = null,
  historicalStats,
}: RideComparisonResultsProps) {
  const { user } = useAuth()
  const [showPriceAlert, setShowPriceAlert] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [routeSaved, setRouteSaved] = useState(false)

  const getBookingUrl = (serviceName: string) => {
    // Coordinates are [longitude, latitude] format from geocoding
    const pickupLat = pickupCoords ? pickupCoords[1] : null
    const pickupLng = pickupCoords ? pickupCoords[0] : null
    const destLat = destinationCoords ? destinationCoords[1] : null
    const destLng = destinationCoords ? destinationCoords[0] : null

    const pickupName = pickup ? encodeURIComponent(pickup.split(',')[0]) : ''
    const destName = destination ? encodeURIComponent(destination.split(',')[0]) : ''

    switch (serviceName.toLowerCase()) {
      case 'uber':
        if (pickupLat && pickupLng && destLat && destLng) {
          return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}&pickup[nickname]=${pickupName}&dropoff[latitude]=${destLat}&dropoff[longitude]=${destLng}&dropoff[nickname]=${destName}`
        }
        return 'https://m.uber.com/looking'
      case 'lyft':
        if (pickupLat && pickupLng && destLat && destLng) {
          return `https://lyft.com/ride?pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}&destination[latitude]=${destLat}&destination[longitude]=${destLng}`
        }
        return 'https://www.lyft.com/'
      default:
        return '#'
    }
  }

  const handleBooking = (serviceName: string) => {
    const url = getBookingUrl(serviceName)
    if (url !== '#') {
      // For mobile, try to open directly (which may open the app)
      // For desktop, open in new tab
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleShare = async () => {
    const bestPrice = services.reduce((best, current) => {
      const currentPrice = Number.parseFloat(current.data.price.replace('$', ''))
      const bestPriceVal = Number.parseFloat(best.data.price.replace('$', ''))
      return currentPrice < bestPriceVal ? current : best
    }, services[0])

    const routeInfo = pickup && destination ? `${pickup} → ${destination}` : 'ride comparison'
    const shareData = {
      title: 'Ride Comparison Results',
      text: `${routeInfo}: Best option is ${bestPrice.name} at ${bestPrice.data.price} with ${bestPrice.data.waitTime} wait time. Compare more rides with RideCompare!`,
      url: window.location.href,
    }

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
        alert('Ride comparison copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing:', error)
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${window.location.href}`)
        alert('Ride comparison copied to clipboard!')
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError)
      }
    }
  }

  const handleShareETA = async (serviceName: string, waitTime: string) => {
    const estimatedPickupTime = new Date(Date.now() + parseInt(waitTime) * 60000)
    const timeString = estimatedPickupTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })

    const etaMessage =
      pickup && destination
        ? `I'm taking a ${serviceName} from ${pickup.split(',')[0]} to ${destination.split(',')[0]}. Estimated pickup at ${timeString}. I'll update you when I'm on my way!`
        : `I'm taking a ${serviceName}. Estimated pickup at ${timeString}. I'll update you when I'm on my way!`

    const shareData = {
      title: 'My Ride ETA',
      text: etaMessage,
    }

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(etaMessage)
        alert('ETA message copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing ETA:', error)
      try {
        await navigator.clipboard.writeText(etaMessage)
        alert('ETA message copied to clipboard!')
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError)
      }
    }
  }

  const handleSaveRoute = async () => {
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    if (!routeId) {
      console.error('No route ID available to save')
      return
    }

    const nickname = `${pickup?.split(',')[0] || 'Pickup'} → ${destination?.split(',')[0] || 'Destination'}`

    const success = await saveRouteForUser(user.id, routeId, nickname)
    if (success) {
      setRouteSaved(true)
      setTimeout(() => setRouteSaved(false), 3000)
    }
  }

  const handleSetPriceAlert = async (threshold: number) => {
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    // If we have a routeId, use the API to persist the alert
    if (routeId) {
      try {
        const response = await fetch('/api/price-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeId,
            targetPrice: threshold,
            service: 'any',
            alertType: 'below',
          }),
        })

        if (response.ok) {
          // Also store in localStorage for quick access
          const localAlert = {
            threshold,
            timestamp: new Date().toISOString(),
            pickup: pickup?.split(',')[0],
            destination: destination?.split(',')[0],
            route:
              pickup && destination
                ? `${pickup.split(',')[0]} → ${destination.split(',')[0]}`
                : 'Route',
            routeId,
            synced: true,
          }
          const existingAlerts = JSON.parse(localStorage.getItem('priceAlerts') || '[]')
          existingAlerts.push(localAlert)
          localStorage.setItem('priceAlerts', JSON.stringify(existingAlerts))
          return
        }

        console.warn('Failed to save alert to API, falling back to localStorage')
      } catch (error) {
        console.warn('Error saving alert to API:', error)
      }
    }

    // Fallback to localStorage only (for routes without ID or API errors)
    const newAlert = {
      threshold,
      timestamp: new Date().toISOString(),
      pickup: pickup?.split(',')[0],
      destination: destination?.split(',')[0],
      route:
        pickup && destination ? `${pickup.split(',')[0]} → ${destination.split(',')[0]}` : 'Route',
      synced: false,
    }
    const existingAlerts = JSON.parse(localStorage.getItem('priceAlerts') || '[]')
    existingAlerts.push(newAlert)
    localStorage.setItem('priceAlerts', JSON.stringify(existingAlerts))
  }

  // Memoize services array to prevent unnecessary re-renders
  const services = useMemo(
    () => [
      {
        name: 'Uber',
        data: results.uber,
        bgColor: 'bg-black',
        textColor: 'text-foreground',
      },
      {
        name: 'Lyft',
        data: results.lyft,
        bgColor: 'bg-pink-600',
        textColor: 'text-foreground',
      },
      {
        name: 'Taxi',
        data: results.taxi,
        bgColor: 'bg-amber-500',
        textColor: 'text-black',
      },
    ],
    [results.uber, results.lyft, results.taxi]
  )

  // Memoize best price/wait time calculations
  const bestPrice = useMemo(
    () =>
      services.reduce((best, current) => {
        const currentPrice = Number.parseFloat(current.data.price.replace('$', ''))
        const bestPriceVal = Number.parseFloat(best.data.price.replace('$', ''))
        return currentPrice < bestPriceVal ? current : best
      }, services[0]),
    [services]
  )

  const bestWaitTime = useMemo(
    () =>
      services.reduce((best, current) => {
        const currentTime = Number.parseInt(current.data.waitTime.replace(' min', ''))
        const bestTime = Number.parseInt(best.data.waitTime.replace(' min', ''))
        return currentTime < bestTime ? current : best
      }, services[0]),
    [services]
  )

  // Helper to get price comparison vs historical average
  const getPriceComparison = (serviceName: string, currentPrice: number) => {
    const serviceKey = serviceName.toLowerCase() as ServiceType
    const stats = historicalStats?.[serviceKey]
    if (!stats) return null

    const statsForSource =
      stats.source === 'exact' ? stats.exact : stats.source === 'cluster' ? stats.cluster : null
    if (!statsForSource) return null

    const historicalAvg = statsForSource.avg
    if (!historicalAvg) return null

    const diff = currentPrice - historicalAvg
    const percentDiff = ((diff / historicalAvg) * 100).toFixed(0)
    const isHigher = diff > historicalAvg * 0.05 // 5% threshold
    const isLower = diff < -historicalAvg * 0.05

    return {
      avg: historicalAvg,
      diff,
      percentDiff,
      isHigher,
      isLower,
      isTypical: !isHigher && !isLower,
      source: stats.source,
      confidence: stats.confidence,
      sampleCount: statsForSource.count,
    }
  }

  // Check if we have any historical stats to display
  const hasHistoricalStats =
    historicalStats &&
    Object.values(historicalStats).some(
      s => s && ((s.source === 'exact' && s.exact) || (s.source === 'cluster' && s.cluster))
    )

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-normal text-foreground tracking-tight uppercase">
          Your Options
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleSaveRoute}
            className={`flex items-center gap-2 px-4 py-2 border transition-all duration-200 font-mono text-xs font-bold uppercase tracking-wider ${
              routeSaved
                ? 'bg-secondary/20 border-secondary/50 text-secondary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground'
            }`}
            title={user ? 'Save this route' : 'Sign in to save routes'}
          >
            <Bookmark className={`h-4 w-4 ${routeSaved ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{routeSaved ? 'Saved!' : 'Save'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-all duration-200 font-mono text-xs font-bold uppercase tracking-wider"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={() => setShowPriceAlert(true)}
            className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-all duration-200 font-mono text-xs font-bold uppercase tracking-wider"
            title={user ? 'Set price alert' : 'Sign in to set alerts'}
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alert</span>
          </button>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="card-transit p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-4xl font-display text-secondary">{bestPrice.data.price}</div>
            <div className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Best Price <span className="text-foreground font-medium">({bestPrice.name})</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-4xl font-display text-primary">{bestWaitTime.data.waitTime}</div>
            <div className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Fastest <span className="text-foreground font-medium">({bestWaitTime.name})</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-4xl font-display text-foreground">
              $
              {(
                services.reduce((sum, s) => sum + parseFloat(s.data.price.replace('$', '')), 0) / 3
              ).toFixed(0)}
            </div>
            <div className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Average Price
            </div>
          </div>
        </div>
      </div>

      {/* Smart Recommendation */}
      {insights && (
        <div className="card-transit p-0 border-l-4 border-l-secondary bg-secondary/5">
          <div className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0 rounded-sm">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-mono font-bold text-secondary uppercase text-xs tracking-wider mb-1">
                System Recommendation
              </div>
              <div className="text-foreground text-sm font-sans leading-relaxed">{insights}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {services.map(service => (
          <div
            key={service.name}
            className={`card-transit overflow-hidden hover:transform-none transition-all duration-300 relative group
              ${service.name === bestPrice.name ? 'border-primary shadow-md' : 'hover:border-foreground/50'}
            `}
          >
            {/* Recommended Banner */}
            {service.name === bestPrice.name && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 font-mono uppercase z-10 tracking-wider">
                ★ RECOMMENDED
              </div>
            )}

            {/* Service Header - Top Bar */}
            <div className={`${service.bgColor} p-0 h-2 w-full`}></div>

            <div className="p-5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-sm flex items-center justify-center ${service.bgColor} text-white font-black text-xl font-display shadow-sm`}
                  >
                    {service.name[0]}
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-normal text-foreground leading-none">
                      {service.name.toUpperCase()}
                    </h3>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
                      STANDARD SERVICE
                    </div>
                  </div>
                </div>
                {service.data.surgeMultiplier && (
                  <div className="flex flex-col items-end">
                    <span className="bg-accent text-accent-foreground text-xs font-bold px-1.5 py-0.5 font-mono">
                      {service.data.surgeMultiplier}×
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">
                      SURGE ACTIVE
                    </span>
                  </div>
                )}
              </div>

              {/* Price Display */}
              <div className="mb-6 pb-6 border-b border-border border-dashed">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Estimated Fare
                  </span>
                  <div
                    className={`text-4xl font-mono font-bold tracking-tight ${
                      service.name === bestPrice.name ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {service.data.price}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-muted/20 p-3 border border-border/50">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 tracking-wider">
                    Wait Time
                  </div>
                  <div
                    className={`text-xl font-bold font-mono ${
                      service.name === bestWaitTime.name ? 'text-secondary' : 'text-foreground'
                    }`}
                  >
                    {service.data.waitTime}
                  </div>
                </div>
                <div className="bg-muted/20 p-3 border border-border/50">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1 tracking-wider">
                    Nearby Units
                  </div>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {service.data.driversNearby}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleBooking(service.name)}
                  className={`w-full py-3 px-4 font-mono text-sm font-bold uppercase tracking-wider border-2 transition-all duration-150 hover-mechanical relative overflow-hidden group
                    ${
                      service.name === 'Taxi'
                        ? 'border-muted text-muted-foreground cursor-not-allowed bg-muted/10'
                        : 'border-foreground text-foreground hover:bg-foreground hover:text-background'
                    }`}
                  disabled={service.name === 'Taxi'}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {service.name === 'Taxi' ? `CALL DISPATCH` : `Book with ${service.name}`}
                    {service.name !== 'Taxi' && <span className="text-xs">→</span>}
                  </span>
                </button>

                <button
                  onClick={() => handleShareETA(service.name, service.data.waitTime)}
                  className="w-full py-2 px-4 text-xs font-mono font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2 uppercase tracking-wide group"
                >
                  <Share2 className="h-3 w-3 group-hover:text-primary transition-colors" />
                  Transmit ETA
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Information */}
      <div className="space-y-4">
        {/* Surge Information */}
        {surgeInfo && surgeInfo.isActive && (
          <div className="card-solid border-primary/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="text-foreground">
                <strong>Surge Active:</strong>{' '}
                <span className="text-muted-foreground">{surgeInfo.reason}</span>{' '}
                <span className="text-primary font-bold">({surgeInfo.multiplier.toFixed(1)}×)</span>
              </div>
            </div>
          </div>
        )}

        {/* Time Recommendations */}
        {timeRecommendations.length > 0 && (
          <div className="card-solid border-secondary/30 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-secondary" />
              </div>
              <strong className="text-foreground">Best Time Tips</strong>
            </div>
            <ul className="ml-13 space-y-1">
              {timeRecommendations.map((tip, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  • {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Historical Price Context */}
        {hasHistoricalStats && (
          <div className="card-solid border-muted/50 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <strong className="text-foreground">Historical Price Context</strong>
                <div className="text-xs text-muted-foreground">
                  Based on recent trips in this area
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {services.map(service => {
                const currentPrice = Number.parseFloat(service.data.price.replace('$', ''))
                const comparison = getPriceComparison(service.name, currentPrice)

                if (!comparison) return null

                return (
                  <div
                    key={`hist-${service.name}`}
                    className="bg-muted/10 border border-border/50 p-3 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        {service.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {comparison.isHigher && (
                          <>
                            <TrendingUp className="w-3 h-3 text-destructive" />
                            <span className="text-xs font-mono text-destructive">
                              +{comparison.percentDiff}%
                            </span>
                          </>
                        )}
                        {comparison.isLower && (
                          <>
                            <TrendingDown className="w-3 h-3 text-secondary" />
                            <span className="text-xs font-mono text-secondary">
                              {comparison.percentDiff}%
                            </span>
                          </>
                        )}
                        {comparison.isTypical && (
                          <>
                            <Minus className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs font-mono text-muted-foreground">typical</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Avg:</span>
                      <span className="text-sm font-mono font-medium text-foreground">
                        ${comparison.avg.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {comparison.sampleCount} samples
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase ${
                          comparison.confidence >= 0.8
                            ? 'text-secondary'
                            : comparison.confidence >= 0.6
                              ? 'text-muted-foreground'
                              : 'text-muted-foreground/60'
                        }`}
                      >
                        {comparison.source === 'exact'
                          ? 'exact route'
                          : comparison.source === 'cluster'
                            ? 'area avg'
                            : 'estimate'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-6 border-t border-border border-dashed">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-6 py-3 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-all duration-200 font-mono font-bold text-sm uppercase tracking-wider"
        >
          <Share2 className="h-4 w-4" />
          Share Data
        </button>
        <button
          onClick={() => setShowPriceAlert(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-mono font-bold text-sm uppercase tracking-wider shadow-sm"
        >
          <Bell className="h-4 w-4" />
          Set Alert
        </button>
      </div>

      {/* Price Alert Modal */}
      {showPriceAlert && (
        <PriceAlert
          currentBestPrice={Number.parseFloat(bestPrice.data.price.replace('$', ''))}
          onSetAlert={handleSetPriceAlert}
          onClose={() => setShowPriceAlert(false)}
        />
      )}

      {/* Auth Dialog */}
      {showAuthDialog && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 p-4">
            <div className="relative z-[10000] w-full max-w-md">
              <AuthDialog
                onClose={() => setShowAuthDialog(false)}
                onSuccess={() => setShowAuthDialog(false)}
              />
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
})
