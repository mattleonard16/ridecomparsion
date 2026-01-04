'use client'

import { useCallback } from 'react'
import { ArrowRight, Loader2, Train, Clock } from 'lucide-react'

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
    code: 'RL-01',
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
    code: 'RL-02',
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
    code: 'RL-03',
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
    code: 'RL-04',
  },
]

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
    <section
      id="routes"
      className="relative snap-start min-h-screen bg-background overflow-hidden flex flex-col justify-center py-16 sm:py-24 md:py-28 scanline-overlay"
    >
      {/* Subtle background */}
      <div className="absolute inset-0 bg-dot-grid opacity-30" />

      <div className="relative z-10 container mx-auto px-4 max-w-5xl w-full">
        {/* Departure Board Header */}
        <div className="mb-12 border-b-4 border-foreground pb-4 flex items-end justify-between">
          <div>
            <span className="text-primary font-mono text-xs tracking-widest uppercase mb-2 block animate-pulse-dot">
              ● LIVE STATUS
            </span>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-normal text-foreground leading-none tracking-tight">
              DEPARTURES
            </h2>
          </div>
          <div className="hidden sm:block text-right">
            <div className="font-mono text-sm text-muted-foreground">SYSTEM TIME</div>
            <div className="font-mono text-xl text-foreground font-bold">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Departure Board Grid */}
        <div className="grid grid-cols-1 gap-3">
          {/* Header Row */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider border-b border-border/50">
            <div className="col-span-2">Line / Code</div>
            <div className="col-span-5">Destination</div>
            <div className="col-span-3">Est. Time</div>
            <div className="col-span-2 text-right">Status</div>
          </div>

          {POPULAR_ROUTES.map((route, index) => {
            const isProcessing = processingRouteId === route.id
            return (
              <button
                key={route.id}
                onClick={() => handleRouteClick(route)}
                disabled={isProcessing}
                className={`group relative overflow-hidden transition-all duration-200 w-full text-left
                  ${isProcessing ? 'opacity-80' : 'hover:-translate-y-1'}
                `}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="card-transit p-0 sm:grid sm:grid-cols-12 sm:gap-4 flex flex-col">
                  {/* Mobile Layout */}
                  <div className="sm:hidden p-4 border-b border-border/50 flex justify-between items-center bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-sm ${route.lineColor}`}></div>
                      <span className="font-mono text-sm font-bold">{route.code}</span>
                    </div>
                    {isProcessing ? (
                      <span className="text-accent font-mono text-xs animate-pulse">
                        PROCESSING
                      </span>
                    ) : (
                      <span className="text-primary font-mono text-xs">ON TIME</span>
                    )}
                  </div>

                  {/* Desktop Columns */}

                  {/* Line Info */}
                  <div className="col-span-2 p-4 sm:border-r border-border/50 flex items-center gap-3 bg-muted/10 group-hover:bg-muted/30 transition-colors">
                    <div className={`w-1.5 h-8 rounded-sm ${route.lineColor}`}></div>
                    <span className="font-mono text-lg text-foreground tracking-tight">
                      {route.code}
                    </span>
                  </div>

                  {/* Route Info */}
                  <div className="col-span-5 p-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono mb-1">
                      <span>{route.shortName}</span>
                      <ArrowRight className="w-3 h-3" />
                      <span>{route.endName}</span>
                    </div>
                    <div className="font-display text-2xl text-foreground group-hover:text-primary transition-colors">
                      {route.displayName}
                    </div>
                  </div>

                  {/* Time & Price */}
                  <div className="col-span-3 p-4 flex flex-col justify-center sm:border-l border-border/50 bg-muted/5">
                    <div className="flex items-center gap-2 text-foreground font-bold font-mono text-lg">
                      {isProcessing ? (
                        <span className="animate-pulse">---</span>
                      ) : (
                        route.estimatedPrice
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {route.estimatedTime}
                    </div>
                  </div>

                  {/* Status Button */}
                  <div className="col-span-2 p-4 flex items-center justify-end sm:border-l border-border/50 bg-muted/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                    ) : (
                      <span className="font-mono text-sm font-bold tracking-wider group-hover:tracking-widest transition-all">
                        SELECT
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground opacity-60">
          <Train className="w-3 h-3" />
          <span>CLICK ANY ROUTE FOR LIVE PRICING</span>
        </div>
      </div>
    </section>
  )
}
