'use client'

import RideComparisonForm from '@/components/ride-comparison-form'

interface RideFormSectionProps {
  selectedRoute: { pickup: string, destination: string } | null
  onRouteProcessed: () => void
}

export default function RideFormSection({ selectedRoute, onRouteProcessed }: RideFormSectionProps) {
  return (
    <section className="relative snap-start min-h-screen flex items-center bg-black overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-purple-900/5 to-black" />
      
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="relative z-10 container mx-auto px-4 max-w-4xl w-full">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            Compare Prices <span className="gradient-text-blue">Now</span>
          </h2>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">
            Enter your pickup and destination to get <span className="text-white font-semibold">real-time price comparisons</span>
          </p>
        </div>

        <div className="glass-card-strong rounded-3xl p-6 sm:p-10 shadow-2xl border border-white/10">
          <RideComparisonForm 
            selectedRoute={selectedRoute}
            onRouteProcessed={onRouteProcessed}
          />
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            🔒 We compare prices from multiple services to help you find the best deal. 
            <span className="text-gray-400 font-medium"> No booking fees or hidden charges.</span>
          </p>
        </div>
      </div>
    </section>
  )
} 