'use client'

import { UserMenu } from '@/components/user-menu'

export default function Hero() {
  return (
    <section className="relative snap-start min-h-screen bg-black overflow-visible flex flex-col justify-center py-16 sm:py-24 md:py-32">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      
      {/* User menu - glassmorphic */}
      <div className="absolute top-4 right-4 z-10">
        <UserMenu />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 max-w-5xl w-full">
        <div className="text-center">
          <div className="animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black mb-4 sm:mb-6 leading-tight">
              <span className="animate-color-shift">
                Compare Rideshares
              </span>
              <br />
              <span className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-white/90 font-bold">
                Save Money, Save Time
              </span>
            </h1>
          </div>
          
          <div className="animate-fade-in-up animation-delay-200">
            <p className="text-lg sm:text-xl md:text-2xl text-gray-400 mb-8 sm:mb-10 max-w-3xl mx-auto font-medium leading-relaxed">
              Get real-time pricing across <span className="text-white font-semibold">Uber, Lyft & Taxi</span> services.
              <br className="hidden sm:block" />
              Smart recommendations powered by live surge data.
            </p>
          </div>

          {/* Trust Signals */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mb-8 sm:mb-10 text-sm">
            <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 animate-pulse"></span>
              <span className="text-gray-300">Compare 3 services instantly</span>
            </div>
            <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 animate-pulse"></span>
              <span className="text-gray-300">Save up to 40% on rides</span>
            </div>
            <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full flex-shrink-0 animate-pulse"></span>
              <span className="text-gray-300">Real-time surge alerts</span>
            </div>
          </div>

          {/* Service Logos */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-10">
            <div className="flex items-center gap-3 hover-lift">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-white font-bold text-lg sm:text-xl">U</span>
              </div>
              <span className="text-gray-300 font-semibold text-lg">Uber</span>
            </div>
            <div className="text-gray-600 hidden sm:block font-light">vs</div>
            <div className="flex items-center gap-3 hover-lift">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-pink-600 to-pink-700 rounded-xl flex items-center justify-center border border-pink-400/20 shadow-lg">
                <span className="text-white font-bold text-lg sm:text-xl">L</span>
              </div>
              <span className="text-gray-300 font-semibold text-lg">Lyft</span>
            </div>
            <div className="text-gray-600 hidden sm:block font-light">vs</div>
            <div className="flex items-center gap-3 hover-lift">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center border border-yellow-400/20 shadow-lg">
                <span className="text-black font-bold text-lg sm:text-xl">T</span>
              </div>
              <span className="text-gray-300 font-semibold text-lg">Taxi</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 