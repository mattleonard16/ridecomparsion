import { AlertCircle, Share2, Bell, Bookmark, Zap, Clock } from 'lucide-react'
import { useState, memo } from 'react'
import PriceAlert from './price-alert'
import { useAuth } from '@/lib/auth-context'
import { saveRouteForUser } from '@/lib/supabase'
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

type RideComparisonResultsProps = {
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
}

export default memo(function RideComparisonResults({
  results,
  insights,
  surgeInfo,
  timeRecommendations = [],
  pickup = '',
  destination = '',
}: RideComparisonResultsProps) {
  const { user } = useAuth()
  const [showPriceAlert, setShowPriceAlert] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [routeSaved, setRouteSaved] = useState(false)

  const getBookingUrl = (
    serviceName: string,
    pickupCoords?: [number, number],
    destCoords?: [number, number]
  ) => {
    switch (serviceName.toLowerCase()) {
      case 'uber':
        if (pickupCoords && destCoords) {
          return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${pickupCoords[1]}&pickup[longitude]=${pickupCoords[0]}&dropoff[latitude]=${destCoords[1]}&dropoff[longitude]=${destCoords[0]}`
        }
        return 'https://m.uber.com/looking'
      case 'lyft':
        if (pickupCoords && destCoords) {
          return `https://lyft.com/ride?origin=${pickupCoords[1]},${pickupCoords[0]}&destination=${destCoords[1]},${destCoords[0]}`
        }
        return 'https://www.lyft.com/'
      default:
        return '#'
    }
  }

  const handleBooking = (serviceName: string) => {
    const url = getBookingUrl(serviceName)
    if (url !== '#') {
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

    const mockRouteId = `route-${Date.now()}`
    const nickname = `${pickup?.split(',')[0] || 'Pickup'} → ${destination?.split(',')[0] || 'Destination'}`

    const success = await saveRouteForUser(user.id, mockRouteId, nickname)
    if (success) {
      setRouteSaved(true)
      setTimeout(() => setRouteSaved(false), 3000)
    }
  }

  const handleSetPriceAlert = (threshold: number) => {
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    const newAlert = { threshold, timestamp: new Date() }
    const existingAlerts = JSON.parse(localStorage.getItem('priceAlerts') || '[]')
    existingAlerts.push({
      ...newAlert,
      pickup: pickup?.split(',')[0],
      destination: destination?.split(',')[0],
      route:
        pickup && destination ? `${pickup.split(',')[0]} → ${destination.split(',')[0]}` : 'Route',
    })
    localStorage.setItem('priceAlerts', JSON.stringify(existingAlerts))
  }

  const services = [
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
  ]

  const bestPrice = services.reduce((best, current) => {
    const currentPrice = Number.parseFloat(current.data.price.replace('$', ''))
    const bestPrice = Number.parseFloat(best.data.price.replace('$', ''))
    return currentPrice < bestPrice ? current : best
  }, services[0])

  const bestWaitTime = services.reduce((best, current) => {
    const currentTime = Number.parseInt(current.data.waitTime.replace(' min', ''))
    const bestTime = Number.parseInt(best.data.waitTime.replace(' min', ''))
    return currentTime < bestTime ? current : best
  }, services[0])

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-black text-foreground">
          Your Options
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleSaveRoute}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
              routeSaved
                ? 'bg-secondary/20 border-secondary/50 text-secondary'
                : 'card-interactive text-muted-foreground hover:text-foreground'
            }`}
            title={user ? 'Save this route' : 'Sign in to save routes'}
          >
            <Bookmark className={`h-4 w-4 ${routeSaved ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{routeSaved ? 'Saved!' : 'Save'}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg card-interactive text-muted-foreground hover:text-foreground transition-all duration-200"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={() => setShowPriceAlert(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg card-interactive text-muted-foreground hover:text-foreground transition-all duration-200"
            title={user ? 'Set price alert' : 'Sign in to set alerts'}
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alert</span>
          </button>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="card-elevated rounded-xl p-6 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-3xl font-black text-secondary">{bestPrice.data.price}</div>
            <div className="text-sm text-muted-foreground">
              Best Price <span className="text-foreground font-medium">({bestPrice.name})</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black text-primary">{bestWaitTime.data.waitTime}</div>
            <div className="text-sm text-muted-foreground">
              Fastest <span className="text-foreground font-medium">({bestWaitTime.name})</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black text-foreground">
              $
              {(
                services.reduce((sum, s) => sum + parseFloat(s.data.price.replace('$', '')), 0) / 3
              ).toFixed(0)}
            </div>
            <div className="text-sm text-muted-foreground">Average Price</div>
          </div>
        </div>
      </div>

      {/* Smart Recommendation */}
      {insights && (
        <div className="card-solid border-secondary/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-secondary" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-foreground mb-1">Recommendation</div>
              <div className="text-muted-foreground text-sm leading-relaxed">{insights}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {services.map(service => (
          <div
            key={service.name}
            className={`card-solid rounded-xl overflow-hidden hover-lift transition-all duration-200 ${
              service.name === bestPrice.name
                ? 'ring-2 ring-secondary/50'
                : ''
            }`}
          >
            {/* Service Header */}
            <div className={`${service.bgColor} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <span className={`font-black text-lg ${service.name === 'Taxi' ? 'text-black' : service.name === 'Lyft' ? 'text-pink-600' : 'text-black'}`}>
                      {service.name[0]}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white">{service.name}</h3>
                </div>
                {service.data.surgeMultiplier && (
                  <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">
                    {service.data.surgeMultiplier}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="p-6 text-center border-b border-border">
              <div
                className={`text-4xl font-black mb-2 ${
                  service.name === bestPrice.name ? 'text-secondary' : 'text-foreground'
                }`}
              >
                {service.data.price}
              </div>
              {service.name === bestPrice.name && (
                <div className="inline-block bg-secondary/10 border border-secondary/30 text-secondary text-xs font-bold px-3 py-1 rounded">
                  Best Price
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className={`text-2xl font-black mb-0.5 ${
                    service.name === bestWaitTime.name ? 'text-primary' : 'text-foreground'
                  }`}>
                    {service.data.waitTime}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {service.name === bestWaitTime.name ? 'Fastest' : 'Wait'}
                  </div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-black text-foreground mb-0.5">
                    {service.data.driversNearby}
                  </div>
                  <div className="text-muted-foreground text-xs">Drivers</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => handleBooking(service.name)}
                  className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-200 ${
                    service.name === 'Taxi'
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : `${service.bgColor} text-white hover:opacity-90`
                  }`}
                  disabled={service.name === 'Taxi'}
                >
                  {service.name === 'Taxi' ? `Call ${service.name}` : `Book ${service.name}`}
                </button>

                <button
                  onClick={() => handleShareETA(service.name, service.data.waitTime)}
                  className="w-full py-2 px-4 text-sm bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Share2 className="h-3 w-3" />
                  Share ETA
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
                <span className="text-primary font-bold">
                  ({surgeInfo.multiplier.toFixed(1)}×)
                </span>
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
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-6 border-t border-border">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-all duration-200 font-semibold hover-lift"
        >
          <Share2 className="h-4 w-4" />
          Share Results
        </button>
        <button
          onClick={() => setShowPriceAlert(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-semibold hover-lift"
        >
          <Bell className="h-4 w-4" />
          Price Alert
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
