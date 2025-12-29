'use client'

import { UserMenu } from '@/components/user-menu'
import { ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section id="home" className="relative snap-start min-h-screen bg-background overflow-hidden flex flex-col justify-center py-16 sm:py-24 md:py-32 scanline-overlay">
      {/* Dot Grid Background */}
      <div className="absolute inset-0 bg-dot-grid opacity-40" />

      {/* Platform Stripes Top/Bottom */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-platform-stripe opacity-50" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-platform-stripe opacity-50" />

      {/* User menu */}
      <div className="absolute top-4 right-4 z-10">
        <UserMenu />
      </div>

      <div className="relative z-10 container mx-auto px-4 max-w-5xl w-full">
        <div className="text-center">
          <div className="animate-fade-in-up">
            {/* Transit Status Indicator */}
            <div className="inline-flex items-center gap-3 px-3 py-1 mb-8 border border-border bg-card shadow-sm">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot"></span>
              <span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">System Operational</span>
              <div className="w-px h-3 bg-border"></div>
              <span className="font-mono text-xs tracking-wider text-primary">SF • OAK • SJC</span>
            </div>

            <h1 className="text-6xl sm:text-7xl md:text-9xl font-display font-normal mb-6 leading-[0.85] tracking-tight uppercase text-foreground">
              <span className="block animate-slide-in-right delay-100">Ride</span>
              <span className="block text-primary animate-slide-in-right delay-200">Compare</span>
              <span className="block text-4xl sm:text-5xl md:text-6xl mt-2 font-sans font-light tracking-wide text-muted-foreground animate-slide-in-right delay-300 normal-case">
                Better rides. Better prices.
              </span>
            </h1>
          </div>

          <div className="animate-fade-in-up delay-200">
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-xl mx-auto font-mono leading-relaxed">
              [SYSTEM_MSG]: Comparing real-time fares across<br />
              Uber, Lyft & Taxi networks.
            </p>
          </div>

          {/* Departure Board CTA */}
          <div className="animate-fade-in-up delay-300 mb-20">
            <a
              href="#compare"
              className="group relative inline-flex items-center justify-between gap-6 pl-6 pr-4 py-4 bg-foreground text-background font-mono text-lg hover-mechanical overflow-hidden"
            >
              <div className="absolute inset-0 w-1 bg-accent"></div>
              <span className="font-bold tracking-tight">Compare Rides</span>
              <div className="w-8 h-8 bg-background text-foreground flex items-center justify-center rounded-sm group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </a>
          </div>

          {/* Route Line Indicators */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            {/* Uber Line */}
            <div className="card-transit p-0 flex items-center min-w-[180px] group cursor-default">
              <div className="w-2 h-full min-h-[60px] bg-black group-hover:bg-primary transition-colors"></div>
              <div className="p-4 flex-1 text-left">
                <div className="font-display text-2xl leading-none mb-1">UBER</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Line Active</div>
              </div>
            </div>

            {/* Lyft Line */}
            <div className="card-transit p-0 flex items-center min-w-[180px] group cursor-default">
              <div className="w-2 h-full min-h-[60px] bg-pink-600 group-hover:bg-primary transition-colors"></div>
              <div className="p-4 flex-1 text-left">
                <div className="font-display text-2xl leading-none mb-1">LYFT</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Line Active</div>
              </div>
            </div>

            {/* Taxi Line */}
            <div className="card-transit p-0 flex items-center min-w-[180px] group cursor-default">
              <div className="w-2 h-full min-h-[60px] bg-amber-500 group-hover:bg-primary transition-colors"></div>
              <div className="p-4 flex-1 text-left">
                <div className="font-display text-2xl leading-none mb-1">TAXI</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Line Active</div>
              </div>
            </div>
          </div>

          {/* Ticker Stats */}
          <div className="mt-20 border-y border-border bg-card overflow-hidden py-3">
            <div className="flex animate-ticker whitespace-nowrap">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-12 mx-6">
                  <span className="font-mono text-sm text-muted-foreground">AVG_SAVINGS: <span className="text-foreground font-bold">40%</span></span>
                  <span className="font-mono text-sm text-muted-foreground">NETWORKS: <span className="text-foreground font-bold">3</span></span>
                  <span className="font-mono text-sm text-muted-foreground">LATENCY: <span className="text-foreground font-bold">&lt;200ms</span></span>
                  <span className="text-accent">●</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
