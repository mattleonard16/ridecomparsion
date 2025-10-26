'use client'

import { useState } from 'react'

// Popular routes data
const POPULAR_ROUTES = [
  {
    id: 'sfo-downtown',
    pickup: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
    destination: 'Downtown San Francisco, San Francisco, CA, USA',
    displayName: 'SFO → Downtown SF',
    estimatedPrice: '~$45-65',
    estimatedTime: '35-50 min'
  },
  {
    id: 'stanford-apple',
    pickup: 'Stanford University, Stanford, CA, USA', 
    destination: 'Apple Park, Cupertino, CA, USA',
    displayName: 'Stanford → Apple Park',
    estimatedPrice: '~$15-25',
    estimatedTime: '15-20 min'
  },
  {
    id: 'sjc-santa-clara',
    pickup: 'San Jose International Airport (SJC), San Jose, CA, USA',
    destination: 'Santa Clara, CA, USA',
    displayName: 'SJC → Santa Clara', 
    estimatedPrice: '~$20-30',
    estimatedTime: '20-25 min'
  },
  {
    id: 'palo-alto-google',
    pickup: 'Palo Alto, CA, USA',
    destination: 'Googleplex, Mountain View, CA, USA',
    displayName: 'Palo Alto → Google',
    estimatedPrice: '~$12-18', 
    estimatedTime: '10-15 min'
  }
]

interface RouteListProps {
  onRouteSelect: (route: { pickup: string, destination: string }) => void
  processingRouteId: string | null
}

export default function RouteList({ onRouteSelect, processingRouteId }: RouteListProps) {
  const handleRouteClick = (route: typeof POPULAR_ROUTES[0]) => {
    onRouteSelect({
      pickup: route.pickup,
      destination: route.destination
    })
  }

  return (
    <section className="relative snap-start min-h-screen flex items-center bg-black overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-900/5 to-black" />
      
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="relative z-10 container mx-auto px-4 max-w-5xl w-full">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            Popular <span className="animate-color-shift">Bay Area</span> Routes
          </h2>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">
            Click any route to get <span className="text-white font-semibold">instant price comparisons</span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {POPULAR_ROUTES.map((route) => {
            const isProcessing = processingRouteId === route.id
            return (
              <button 
                key={route.id}
                onClick={() => handleRouteClick(route)}
                disabled={isProcessing}
                className={`group glass-card-strong border-2 rounded-2xl p-6 sm:p-7 text-left transition-all duration-300 active:scale-[0.98] ${
                  isProcessing 
                    ? 'border-blue-500/50 cursor-not-allowed shadow-2xl shadow-blue-500/20' 
                    : 'border-white/10 hover:border-blue-500/40 hover-lift shadow-xl'
                }`}
              >
                <div className={`text-lg sm:text-xl font-black flex items-center gap-3 mb-3 ${
                  isProcessing ? 'text-blue-400' : 'text-white group-hover:text-blue-400'
                }`}>
                  {isProcessing && (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                  )}
                  {route.displayName}
                </div>
                <div className="text-sm">
                  {isProcessing ? (
                    <span className="text-blue-400 font-semibold">Getting live prices...</span>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-bold text-green-400">{route.estimatedPrice}</span>
                      <span className="hidden sm:inline text-gray-600">•</span>
                      <span className="text-gray-400">{route.estimatedTime}</span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">
            Estimates based on <span className="text-gray-400 font-medium">current traffic conditions</span>
          </p>
        </div>
      </div>
    </section>
  )
} 