'use client'

import { useCallback } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

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
  },
]

interface RouteListProps {
  onRouteSelect: (route: { pickup: string; destination: string }) => void
  processingRouteId: string | null
}

export default function RouteList({ onRouteSelect, processingRouteId }: RouteListProps) {
  const handleRouteClick = useCallback(
    (route: (typeof POPULAR_ROUTES)[0]) => {
      console.log('[RouteClick]', route.pickup, '→', route.destination)
      onRouteSelect({
        pickup: route.pickup,
        destination: route.destination,
      })

      setTimeout(() => {
        const compareSection = document.getElementById('compare')
        if (compareSection) {
          compareSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        }
      }, 50)
    },
    [onRouteSelect]
  )

  return (
    <section id="routes" className="relative snap-start min-h-screen bg-background overflow-hidden flex flex-col justify-center py-16 sm:py-24 md:py-28">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-diagonal-lines opacity-10" />

      <div className="relative z-10 container mx-auto px-4 max-w-5xl w-full">
        {/* Header */}
        <div className="mb-12">
          <span className="text-secondary font-mono text-sm tracking-widest uppercase mb-4 block">
            Quick Start
          </span>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground leading-[0.95]">
            Popular Routes
          </h2>
          <p className="text-muted-foreground text-lg mt-4 max-w-xl">
            Click any route to get instant price comparisons across all services.
          </p>
        </div>

        {/* Routes grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {POPULAR_ROUTES.map(route => {
            const isProcessing = processingRouteId === route.id
            return (
              <button
                key={route.id}
                onClick={() => handleRouteClick(route)}
                disabled={isProcessing}
                className={`group text-left rounded-xl p-6 transition-all duration-200 ${
                  isProcessing
                    ? 'card-elevated border-primary/50'
                    : 'card-interactive hover-lift'
                }`}
              >
                {/* Route path visualization */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-3 h-3 rounded-full bg-secondary flex-shrink-0" />
                    <span className="font-bold text-foreground truncate">{route.shortName}</span>
                  </div>
                  <div className="flex-shrink-0 text-muted-foreground">
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    <span className="font-bold text-foreground truncate">{route.endName}</span>
                    <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0" />
                  </div>
                </div>

                {/* Price and time */}
                <div className="flex items-center justify-between">
                  {isProcessing ? (
                    <span className="text-primary font-medium text-sm">Getting live prices...</span>
                  ) : (
                    <>
                      <span className="text-xl font-black text-foreground">{route.estimatedPrice}</span>
                      <span className="text-sm text-muted-foreground">{route.estimatedTime}</span>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Estimates based on current traffic • Actual prices may vary
          </p>
        </div>
      </div>
    </section>
  )
}
