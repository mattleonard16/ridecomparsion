'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { getRoutePriceHistory, getHourlyPriceAverage } from '@/lib/supabase'

interface PriceSnapshot {
  timestamp: string
  service_type: string
  final_price: number
  surge_multiplier: number
  weather_condition?: string
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [priceData, setPriceData] = useState<PriceSnapshot[]>([])
  const [hourlyAverages, setHourlyAverages] = useState<any[]>([])
  const [selectedService, setSelectedService] = useState<'uber' | 'lyft' | 'taxi'>('uber')
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  useEffect(() => {
    async function loadData() {
      if (!user) return

      setDataLoading(true)
      try {
        // For demo, using a mock route ID
        // In production, this would come from user's saved routes
        const mockRouteId = 'route-1'
        
        const [history, averages] = await Promise.all([
          getRoutePriceHistory(mockRouteId, 7),
          getHourlyPriceAverage(mockRouteId, selectedService),
        ])

        setPriceData(history as any)
        setHourlyAverages(averages)
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setDataLoading(false)
      }
    }

    loadData()
  }, [user, selectedService])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Track price trends and optimize your ride timing</p>
        </div>

        {/* Service Selector */}
        <div className="mb-6 flex gap-2">
          {(['uber', 'lyft', 'taxi'] as const).map((service) => (
            <button
              key={service}
              onClick={() => setSelectedService(service)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedService === service
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {service.charAt(0).toUpperCase() + service.slice(1)}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Trends Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">7-Day Price Trends</h2>
              {priceData.length > 0 ? (
                <div className="space-y-3">
                  {priceData.slice(0, 10).map((snapshot, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">
                          ${snapshot.final_price.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(snapshot.timestamp).toLocaleDateString()} at{' '}
                          {new Date(snapshot.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        {snapshot.surge_multiplier > 1 && (
                          <div className="text-sm font-medium text-orange-600">
                            {snapshot.surge_multiplier}x surge
                          </div>
                        )}
                        {snapshot.weather_condition && (
                          <div className="text-xs text-gray-500">{snapshot.weather_condition}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No price data available yet.</p>
                  <p className="text-sm mt-2">Start comparing rides to see trends!</p>
                </div>
              )}
            </div>

            {/* Hourly Averages Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Best Times to Ride</h2>
              {hourlyAverages.length > 0 ? (
                <div className="space-y-2">
                  {hourlyAverages.map((avg, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="text-gray-700">
                        {avg.hour}:00 - {avg.hour + 1}:00
                      </div>
                      <div className="font-medium text-gray-900">${avg.avg_price?.toFixed(2) || 'N/A'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No hourly data available yet.</p>
                  <p className="text-sm mt-2">More data needed for analysis.</p>
                </div>
              )}
            </div>

            {/* Surge Insights Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Surge Insights</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="font-medium text-blue-900 mb-1">💡 Pro Tip</div>
                  <p className="text-sm text-blue-700">
                    Prices are typically lowest between 10 AM - 3 PM on weekdays
                  </p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="font-medium text-orange-900 mb-1">⚠️ Peak Hours</div>
                  <p className="text-sm text-orange-700">
                    Expect 1.5-2.5x surge during rush hours (7-9 AM, 5-7 PM)
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="font-medium text-purple-900 mb-1">🌧️ Weather Impact</div>
                  <p className="text-sm text-purple-700">
                    Rain can increase prices by 20-40% due to higher demand
                  </p>
                </div>
              </div>
            </div>

            {/* Savings Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Savings</h2>
              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="text-4xl font-bold text-green-600 mb-2">$0.00</div>
                  <div className="text-gray-600">Total saved this month</div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">0</div>
                    <div className="text-sm text-gray-600">Comparisons</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">0</div>
                    <div className="text-sm text-gray-600">Alerts Set</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}

