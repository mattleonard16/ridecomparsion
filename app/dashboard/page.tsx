'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { getRoutePriceHistory, getHourlyPriceAverage } from '@/lib/database'
import { TrendingDown, Clock, Zap, ArrowLeft, BarChart3 } from 'lucide-react'

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background */}
      <div className="fixed inset-0 bg-diagonal-lines opacity-10 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-7xl pt-24">
        {/* Header */}
        <div className="mb-10">
          <span className="text-primary font-mono text-sm tracking-widest uppercase mb-4 block">
            Analytics
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-lg">Track price trends and optimize your ride timing</p>
        </div>

        {/* Service Selector */}
        <div className="mb-8 flex gap-2">
          {(['uber', 'lyft', 'taxi'] as const).map(service => (
            <button
              key={service}
              onClick={() => setSelectedService(service)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${selectedService === service
                ? 'bg-primary text-primary-foreground'
                : 'card-interactive text-muted-foreground hover:text-foreground'
                }`}
            >
              {service.charAt(0).toUpperCase() + service.slice(1)}
            </button>
          ))}
        </div>

        {dataLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Trends Card */}
            <div className="card-elevated rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">7-Day Price Trends</h2>
              </div>
              {priceData.length > 0 ? (
                <div className="space-y-3">
                  {priceData.slice(0, 10).map((snapshot, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          ${snapshot.final_price.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(snapshot.timestamp).toLocaleDateString()} at{' '}
                          {new Date(snapshot.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        {snapshot.surge_multiplier > 1 && (
                          <div className="text-sm font-medium text-primary">
                            {snapshot.surge_multiplier}x surge
                          </div>
                        )}
                        {snapshot.weather_condition && (
                          <div className="text-xs text-muted-foreground">{snapshot.weather_condition}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No price data available yet.</p>
                  <p className="text-sm mt-2">Start comparing rides to see trends!</p>
                </div>
              )}
            </div>

            {/* Hourly Averages Card */}
            <div className="card-elevated rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-secondary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Best Times to Ride</h2>
              </div>
              {hourlyAverages.length > 0 ? (
                <div className="space-y-2">
                  {hourlyAverages.map((avg, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors"
                    >
                      <div className="text-muted-foreground">
                        {avg.hour}:00 - {avg.hour + 1}:00
                      </div>
                      <div className="font-bold text-foreground">
                        ${avg.avg_price?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No hourly data available yet.</p>
                  <p className="text-sm mt-2">More data needed for analysis.</p>
                </div>
              )}
            </div>

            {/* Surge Insights Card */}
            <div className="card-elevated rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Surge Insights</h2>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-lg">
                  <div className="font-medium text-foreground mb-1">💡 Pro Tip</div>
                  <p className="text-sm text-muted-foreground">
                    Prices are typically lowest between 10 AM - 3 PM on weekdays
                  </p>
                </div>
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="font-medium text-foreground mb-1">⚠️ Peak Hours</div>
                  <p className="text-sm text-muted-foreground">
                    Expect 1.5-2.5x surge during rush hours (7-9 AM, 5-7 PM)
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-medium text-foreground mb-1">🌧️ Weather Impact</div>
                  <p className="text-sm text-muted-foreground">
                    Rain can increase prices by 20-40% due to higher demand
                  </p>
                </div>
              </div>
            </div>

            {/* Savings Card */}
            <div className="card-elevated rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-secondary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Your Savings</h2>
              </div>
              <div className="space-y-6">
                <div className="text-center py-6">
                  <div className="text-5xl font-black text-secondary mb-2">$0.00</div>
                  <div className="text-muted-foreground">Total saved this month</div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className="text-3xl font-black text-foreground">0</div>
                    <div className="text-sm text-muted-foreground">Comparisons</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black text-foreground">0</div>
                    <div className="text-sm text-muted-foreground">Alerts Set</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-semibold hover-lift"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
