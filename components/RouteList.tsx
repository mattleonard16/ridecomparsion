'use client'

import { useCallback } from 'react'
import { ArrowRight, Loader2, Clock, MapPin } from 'lucide-react'

const POPULAR_ROUTES = [
  {
    id: 'sfo-downtown',
    pickup: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
    destination: 'Downtown San Francisco, San Francisco, CA, USA',
    displayName: 'SFO → Downtown SF',
    shortName: 'SFO',
    endName: 'Downtown',
    estimatedPrice: '$45-65',
    estimatedTime: '35-50 min',
    lineColor: 'bg-primary',
  },
  {
    id: 'stanford-apple',
    pickup: 'Stanford University, Stanford, CA, USA',
    destination: 'Apple Park, Cupertino, CA, USA',
    displayName: 'Stanford → Apple Park',
    shortName: 'Stanford',
    endName: 'Apple',
    estimatedPrice: '$15-25',
    estimatedTime: '15-20 min',
    lineColor: 'bg-secondary',
  },
  {
    id: 'sjc-santa-clara',
    pickup: 'San Jose International Airport (SJC), San Jose, CA, USA',
    destination: 'Santa Clara, CA, USA',
    displayName: 'SJC → Santa Clara',
    shortName: 'SJC',
    endName: 'Santa Clara',
    estimatedPrice: '$20-30',
    estimatedTime: '20-25 min',
    lineColor: 'bg-accent',
  },
  {
    id: 'palo-alto-google',
    pickup: 'Palo Alto, CA, USA',
    destination: 'Googleplex, Mountain View, CA, USA',
    displayName: 'Palo Alto → Google',
    shortName: 'Palo Alto',
    endName: 'Google',
    estimatedPrice: '$12-18',
    estimatedTime: '10-15 min',
    lineColor: 'bg-primary',
  },
]

const ANIMATION_DELAYS = ['delay-100', 'delay-200', 'delay-300', 'delay-400'] as const

interface RouteListProps {
  onRouteSelect: (route: { pickup: string; destination: string }) => void
  processingRouteId: string | null
}

export default function RouteList({ onRouteSelect, processingRouteId }: RouteListProps) {
  const handleRouteClick = useCallback(
    (route: (typeof POPULAR_ROUTES)[0]) => {
      onRouteSelect({
        pickup: route.pickup,
        destination: route.destination,
      })
    },
    [onRouteSelect]
  )

  return (
    <section id="routes" className="relative bg-background overflow-hidden py-16">
      <div className="relative z-10 container mx-auto px-4 max-w-6xl w-full">
        {/* Elegant Section Header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-normal text-foreground leading-tight tracking-tight mb-3">
            Popular Routes
          </h2>
          <p className="text-muted-foreground font-sans text-base sm:text-lg max-w-xl mx-auto tracking-wide">
            Explore the most traveled routes in the Bay Area
          </p>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {POPULAR_ROUTES.map((route, index) => {
            const isProcessing = processingRouteId === route.id
            const delayClass = ANIMATION_DELAYS[index] ?? ''
            return (
              <button
                key={route.id}
                onClick={() => handleRouteClick(route)}
                disabled={isProcessing}
                className={`group relative overflow-hidden text-left rounded-xl glass-card card-shine float-hover
                  ${isProcessing ? 'opacity-80 cursor-wait' : 'cursor-pointer'}
                  animate-fade-in-up ${delayClass}
                `}
              >
                {/* Gradient Top Border */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${route.lineColor} opacity-80`}
                />

                <div className="p-6 pt-7">
                  {/* Route Name */}
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="font-sans">{route.shortName}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-sans">{route.endName}</span>
                  </div>

                  <h3 className="font-display text-xl text-foreground group-hover:text-primary transition-colors mb-4 leading-snug">
                    {route.displayName}
                  </h3>

                  {/* Price & Duration */}
                  <div className="space-y-2">
                    <div className="text-secondary font-semibold text-2xl tabular-nums">
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-muted-foreground text-base font-normal">
                            Loading...
                          </span>
                        </span>
                      ) : (
                        route.estimatedPrice
                      )}
                    </div>
                    <div className="text-muted-foreground text-sm flex items-center gap-1.5 font-sans">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{route.estimatedTime}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Helper Text */}
        <div className="mt-10 text-center">
          <p className="text-muted-foreground text-sm font-sans">
            Click any route to compare prices
          </p>
        </div>
      </div>
    </section>
  )
}
