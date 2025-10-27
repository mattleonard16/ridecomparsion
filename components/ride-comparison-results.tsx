import { AlertCircle, Share2, Bell, Bookmark } from 'lucide-react'
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  // const [priceAlerts] = useState<Array<{ threshold: number; timestamp: Date }>>([])

  // Function to generate booking URLs with deep links
  const getBookingUrl = (serviceName: string, pickupCoords?: [number, number], destCoords?: [number, number]) => {
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

  // Share ride comparison results
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
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
        // Show toast or alert
        alert('Ride comparison copied to clipboard!')
      }
    } catch (error) {
      console.error('Error sharing:', error)
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text} ${window.location.href}`)
        alert('Ride comparison copied to clipboard!')
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError)
      }
    }
  }

  // Share ETA with family/friends
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
        // Fallback: copy to clipboard
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

  // Handle save route
  const handleSaveRoute = async () => {
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    // For now, we'll use a mock route ID since we need coordinates
    // In production, this would come from the API response
    const mockRouteId = `route-${Date.now()}`
    const nickname = `${pickup?.split(',')[0] || 'Pickup'} → ${destination?.split(',')[0] || 'Destination'}`
    
    const success = await saveRouteForUser(user.id, mockRouteId, nickname)
    if (success) {
      setRouteSaved(true)
      setTimeout(() => setRouteSaved(false), 3000)
    }
  }

  // Handle price alert setting
  const handleSetPriceAlert = (threshold: number) => {
    if (!user) {
      setShowAuthDialog(true)
      return
    }

    const newAlert = { threshold, timestamp: new Date() }
    // setPriceAlerts(prev => [...prev, newAlert])

    // Store in localStorage for persistence
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
      color: 'bg-black',
      textColor: 'text-black',
      hoverBg: 'hover:bg-black',
      hoverText: 'hover:text-white',
      borderColor: 'border-black',
    },
    {
      name: 'Lyft',
      data: results.lyft,
      color: 'bg-pink-600',
      textColor: 'text-pink-600',
      hoverBg: 'hover:bg-pink-600',
      hoverText: 'hover:text-white',
      borderColor: 'border-pink-600',
    },
    {
      name: 'Taxi',
      data: results.taxi,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700',
      hoverBg: 'hover:bg-yellow-500',
      hoverText: 'hover:text-black',
      borderColor: 'border-yellow-500',
    },
  ]

  // Find the best option based on price
  const bestPrice = services.reduce((best, current) => {
    const currentPrice = Number.parseFloat(current.data.price.replace('$', ''))
    const bestPrice = Number.parseFloat(best.data.price.replace('$', ''))
    return currentPrice < bestPrice ? current : best
  }, services[0])

  // Find the best option based on wait time
  const bestWaitTime = services.reduce((best, current) => {
    const currentTime = Number.parseInt(current.data.waitTime.replace(' min', ''))
    const bestTime = Number.parseInt(best.data.waitTime.replace(' min', ''))
    return currentTime < bestTime ? current : best
  }, services[0])

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Clean Header Section */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl sm:text-4xl font-black text-white">Your Ride <span className="gradient-text-blue">Options</span></h2>
          <div className="flex gap-2">
            <button
              onClick={handleSaveRoute}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-300 ${
                routeSaved
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'glass-card border-white/20 text-gray-300 hover:bg-white/10'
              }`}
              title={user ? 'Save this route' : 'Sign in to save routes'}
            >
              <Bookmark className={`h-4 w-4 ${routeSaved ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{routeSaved ? 'Saved!' : 'Save Route'}</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 glass-card text-gray-300 hover:bg-white/10 transition-all duration-300"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={() => setShowPriceAlert(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 glass-card text-gray-300 hover:bg-white/10 transition-all duration-300"
              title={user ? 'Set price alert' : 'Sign in to set alerts'}
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alert</span>
            </button>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="glass-card-strong rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-black text-green-400">{bestPrice.data.price}</div>
              <div className="text-sm text-gray-400">Best Price <span className="text-white font-semibold">({bestPrice.name})</span></div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-black text-blue-400">{bestWaitTime.data.waitTime}</div>
              <div className="text-sm text-gray-400">Fastest Pickup <span className="text-white font-semibold">({bestWaitTime.name})</span></div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-black text-purple-400">
                $
                {(
                  services.reduce((sum, s) => sum + parseFloat(s.data.price.replace('$', '')), 0) /
                  3
                ).toFixed(0)}
              </div>
              <div className="text-sm text-gray-400">Average Price</div>
            </div>
          </div>
        </div>

        {/* Smart Recommendation */}
        {insights && (
          <div className="glass-card-strong border border-blue-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <AlertCircle className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-white mb-2 text-lg">Smart Recommendation</div>
                <div className="text-gray-300 leading-relaxed">{insights}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {services.map(service => (
          <div
            key={service.name}
            className={`glass-card-strong rounded-2xl border-2 overflow-hidden shadow-2xl hover-lift transition-all duration-300 ${
              service.name === bestPrice.name
                ? 'border-green-500/50 ring-2 ring-green-500/20'
                : 'border-white/10'
            }`}
          >
            {/* Service Header */}
            <div className={`${service.color} p-5 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                    <span className={`font-black text-xl ${service.textColor}`}>
                      {service.name[0]}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white">{service.name}</h3>
                </div>
                {service.data.surgeMultiplier && (
                  <span className="bg-orange-500/20 text-orange-300 text-xs font-bold px-3 py-1.5 rounded-full border border-orange-500/30">
                    {service.data.surgeMultiplier} surge
                  </span>
                )}
              </div>
            </div>

            {/* Price Highlight */}
            <div className="p-8 text-center border-b border-white/10">
              <div
                className={`text-5xl font-black mb-3 ${
                  service.name === bestPrice.name ? 'text-green-400 animate-pulse' : 'text-white'
                }`}
              >
                {service.data.price}
              </div>
              {service.name === bestPrice.name && (
                <div className="inline-block bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-bold px-4 py-1.5 rounded-full">
                  Best Price
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                  <div
                    className={`text-3xl font-black mb-1 ${
                      service.name === bestWaitTime.name ? 'text-blue-400' : 'text-white'
                    }`}
                  >
                    {service.data.waitTime}
                  </div>
                  <div className="text-gray-400 text-xs font-medium">
                    {service.name === bestWaitTime.name ? 'Fastest' : 'Wait Time'}
                  </div>
                </div>
                <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-3xl font-black text-white mb-1">
                    {service.data.driversNearby}
                  </div>
                  <div className="text-gray-400 text-xs font-medium">Drivers</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleBooking(service.name)}
                  className={`w-full py-4 px-6 rounded-xl font-bold transition-all duration-300 shadow-lg ${
                    service.name === 'Taxi'
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                      : `${service.color} text-white hover:opacity-90 hover-lift hover:shadow-2xl`
                  }`}
                  disabled={service.name === 'Taxi'}
                >
                  {service.name === 'Taxi' ? `Call ${service.name}` : `Book ${service.name}`}
                </button>

                <button
                  onClick={() => handleShareETA(service.name, service.data.waitTime)}
                  className="w-full py-3 px-4 text-sm bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-white/10"
                >
                  <Share2 className="h-4 w-4" />
                  Share ETA
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Information Section */}
      <div className="space-y-4">
        {/* Surge Information */}
        {surgeInfo && surgeInfo.isActive && (
          <div className="glass-card-strong border border-orange-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-orange-300">
                <strong className="text-white">Surge Pricing Active:</strong> {surgeInfo.reason} (approx.{' '}
                <span className="text-orange-400 font-bold">{surgeInfo.multiplier.toFixed(1)}×</span> increase)
              </div>
            </div>
          </div>
        )}

        {/* Time Recommendations */}
        {timeRecommendations.length > 0 && (
          <div className="glass-card-strong border border-green-500/30 rounded-2xl p-6">
            <div className="text-green-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <strong className="text-white text-lg">Best Time Tips:</strong>
              </div>
              <ul className="ml-13 space-y-2">
                {timeRecommendations.map((tip, index) => (
                  <li key={index} className="text-sm text-gray-300">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 pt-6 border-t border-white/10">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover-lift font-semibold"
        >
          <Share2 className="h-5 w-5" />
          Share Results
        </button>
        <button
          onClick={() => setShowPriceAlert(true)}
          className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 shadow-lg hover-lift font-semibold"
        >
          <Bell className="h-5 w-5" />
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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
