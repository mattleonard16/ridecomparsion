import { AlertCircle, Share2, Bell, Bookmark } from 'lucide-react'
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, memo } from 'react'
import PriceAlert from './price-alert'
import { useAuth } from '@/lib/auth-context'
import { saveRouteForUser } from '@/lib/supabase'
import { AuthDialog } from './auth-dialog'

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
      <div className="text-center space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900">Your Ride Options</h2>
          <div className="flex gap-2">
            <button
              onClick={handleSaveRoute}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                routeSaved
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
              title={user ? 'Save this route' : 'Sign in to save routes'}
            >
              <Bookmark className={`h-4 w-4 ${routeSaved ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">{routeSaved ? 'Saved!' : 'Save Route'}</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={() => setShowPriceAlert(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              title={user ? 'Set price alert' : 'Sign in to set alerts'}
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alert</span>
            </button>
          </div>
        </div>

        {/* Quick Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-xl p-6 border border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{bestPrice.data.price}</div>
              <div className="text-sm text-gray-600">Best Price ({bestPrice.name})</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{bestWaitTime.data.waitTime}</div>
              <div className="text-sm text-gray-600">Fastest Pickup ({bestWaitTime.name})</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                $
                {(
                  services.reduce((sum, s) => sum + parseFloat(s.data.price.replace('$', '')), 0) /
                  3
                ).toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">Average Price</div>
            </div>
          </div>
        </div>

        {/* Smart Recommendation */}
        {insights && (
          <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <AlertCircle className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900 mb-1">💡 Smart Recommendation</div>
                <div className="text-gray-700">{insights}</div>
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
            className={`bg-white rounded-2xl border-2 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 ${
              service.name === bestPrice.name
                ? 'border-green-300 ring-2 ring-green-100'
                : 'border-gray-200'
            }`}
          >
            {/* Service Header */}
            <div className={`${service.color} p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <span className={`font-bold text-lg ${service.textColor}`}>
                      {service.name[0]}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white">{service.name}</h3>
                </div>
                {service.data.surgeMultiplier && (
                  <span className="bg-orange-100 text-orange-800 text-xs font-medium px-3 py-1 rounded-full">
                    {service.data.surgeMultiplier} surge
                  </span>
                )}
              </div>
            </div>

            {/* Price Highlight */}
            <div className="p-6 text-center border-b border-gray-100">
              <div
                className={`text-4xl font-bold mb-2 ${
                  service.name === bestPrice.name ? 'text-green-600' : 'text-gray-800'
                }`}
              >
                {service.data.price}
              </div>
              {service.name === bestPrice.name && (
                <div className="text-green-600 text-sm font-medium">💰 Best Price</div>
              )}
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div
                    className={`text-2xl font-bold ${
                      service.name === bestWaitTime.name ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    {service.data.waitTime}
                  </div>
                  <div className="text-gray-500 text-sm">
                    {service.name === bestWaitTime.name ? '⚡ Fastest' : 'Wait Time'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {service.data.driversNearby}
                  </div>
                  <div className="text-gray-500 text-sm">Drivers</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => handleBooking(service.name)}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200 ${
                    service.name === 'Taxi'
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : `${service.color} text-white hover:opacity-90 transform hover:scale-105`
                  }`}
                  disabled={service.name === 'Taxi'}
                >
                  {service.name === 'Taxi' ? `Call ${service.name}` : `Book ${service.name}`}
                </button>

                <button
                  onClick={() => handleShareETA(service.name, service.data.waitTime)}
                  className="w-full py-2 px-4 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="h-3 w-3" />
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
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 text-sm">⚡</span>
              </div>
              <div className="text-orange-800">
                <strong>Surge Pricing Active:</strong> {surgeInfo.reason} (approx.{' '}
                {surgeInfo.multiplier.toFixed(1)}× increase)
              </div>
            </div>
          </div>
        )}

        {/* Time Recommendations */}
        {timeRecommendations.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="text-green-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-sm">💡</span>
                </div>
                <strong>Best Time Tips:</strong>
              </div>
              <ul className="ml-8 space-y-1">
                {timeRecommendations.map((tip, index) => (
                  <li key={index} className="text-sm">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Share2 className="h-4 w-4" />
          Share Results
        </button>
        <button
          onClick={() => setShowPriceAlert(true)}
          className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md">
            <AuthDialog
              onClose={() => setShowAuthDialog(false)}
              onSuccess={() => setShowAuthDialog(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
})
