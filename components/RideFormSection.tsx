'use client'

import RideComparisonForm from '@/components/ride-comparison-form'

interface RideFormSectionProps {
  selectedRoute: { pickup: string; destination: string } | null
  onRouteProcessed: () => void
}

export default function RideFormSection({ selectedRoute, onRouteProcessed }: RideFormSectionProps) {
  return (
    <section
      id="compare"
      className="relative snap-start min-h-screen bg-background overflow-visible py-8 sm:py-12"
    >
      {/* Subtle background */}
      <div className="absolute inset-0 bg-route-pattern opacity-10" />

      <div className="relative z-10 container mx-auto px-4 max-w-4xl w-full">
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-primary font-mono text-sm tracking-widest uppercase mb-4 block">
            Get Started
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground mb-4">
            Compare Prices
          </h2>
          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto">
            Enter your pickup and destination for{' '}
            <span className="text-foreground font-semibold">real-time price comparisons</span>
          </p>
        </div>

        <div className="card-elevated rounded-2xl p-6 sm:p-10 scroll-mt-20">
          <RideComparisonForm selectedRoute={selectedRoute} onRouteProcessed={onRouteProcessed} />
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We compare prices from multiple services to help you find the best deal.
            <span className="text-foreground/70 font-medium"> No booking fees or hidden charges.</span>
          </p>
        </div>
      </div>
    </section>
  )
}
