'use client'

import { UserMenu } from '@/components/user-menu'
import { MapPin, ArrowRight } from 'lucide-react'

export default function Hero() {
  return (
    <section id="home" className="relative snap-start min-h-screen bg-background overflow-hidden flex flex-col justify-center py-16 sm:py-24 md:py-32">
      {/* Subtle diagonal lines background - more distinctive than orbs */}
      <div className="absolute inset-0 bg-diagonal-lines opacity-30" />
      
      {/* Route-inspired accent line */}
      <div className="absolute left-0 top-1/4 w-1 h-32 bg-gradient-to-b from-transparent via-primary to-transparent" />
      <div className="absolute right-0 bottom-1/4 w-1 h-32 bg-gradient-to-b from-transparent via-secondary to-transparent" />

      {/* User menu */}
      <div className="absolute top-4 right-4 z-10">
        <UserMenu />
      </div>

      <div className="relative z-10 container mx-auto px-4 max-w-5xl w-full">
        <div className="text-center">
          <div className="animate-fade-in-up">
            {/* Small eyebrow text */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card mb-8">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse-subtle"></span>
              <span className="text-sm text-muted-foreground font-medium">Bay Area Rideshare Comparison</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black mb-4 sm:mb-6 leading-[0.9] tracking-tight">
              <span className="text-foreground">Stop</span>
              <br />
              <span className="text-accent-gradient">Overpaying</span>
              <br />
              <span className="text-foreground">for Rides</span>
            </h1>
          </div>

          <div className="animate-fade-in-up animation-delay-200">
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto font-normal leading-relaxed">
              Real-time price comparison across{' '}
              <span className="text-foreground font-semibold">Uber, Lyft & Taxi</span>.
              <br className="hidden sm:block" />
              Find the best deal in seconds.
            </p>
          </div>

          {/* CTA Button */}
          <div className="animate-fade-in-up animation-delay-200 mb-16">
            <a 
              href="#compare"
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-bold text-lg hover-lift transition-all"
            >
              Compare Prices Now
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          {/* Service Cards - cleaner, no glassmorphism */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
            {/* Uber */}
            <div className="card-interactive rounded-xl p-4 flex items-center gap-4 min-w-[160px] hover-lift">
              <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xl">U</span>
              </div>
              <div className="text-left">
                <span className="text-foreground font-bold block">Uber</span>
                <span className="text-muted-foreground text-sm">UberX, XL, Black</span>
              </div>
            </div>

            {/* Lyft */}
            <div className="card-interactive rounded-xl p-4 flex items-center gap-4 min-w-[160px] hover-lift">
              <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xl">L</span>
              </div>
              <div className="text-left">
                <span className="text-foreground font-bold block">Lyft</span>
                <span className="text-muted-foreground text-sm">Standard, XL, Lux</span>
              </div>
            </div>

            {/* Taxi */}
            <div className="card-interactive rounded-xl p-4 flex items-center gap-4 min-w-[160px] hover-lift">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-xl">T</span>
              </div>
              <div className="text-left">
                <span className="text-foreground font-bold block">Taxi</span>
                <span className="text-muted-foreground text-sm">Yellow Cab</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-16 pt-8 border-t border-border">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 sm:gap-16 text-center">
              <div>
                <div className="text-3xl font-black text-foreground">40%</div>
                <div className="text-sm text-muted-foreground">Average Savings</div>
              </div>
              <div className="hidden sm:block w-px h-12 bg-border"></div>
              <div>
                <div className="text-3xl font-black text-foreground">3</div>
                <div className="text-sm text-muted-foreground">Services Compared</div>
              </div>
              <div className="hidden sm:block w-px h-12 bg-border"></div>
              <div>
                <div className="text-3xl font-black text-foreground">&lt;2s</div>
                <div className="text-sm text-muted-foreground">Response Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
