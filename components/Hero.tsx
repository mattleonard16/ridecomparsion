'use client'

import { UserMenu } from '@/components/user-menu'

export default function Hero() {
  return (
    <section className="snap-start min-h-screen flex items-center bg-gradient-to-b from-white to-slate-50">
      <div className="absolute top-4 right-4 z-10">
        <UserMenu />
      </div>
      <div className="container mx-auto px-4 max-w-4xl w-full">
        <div className="text-center">
          <div className="animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent leading-tight">
              Compare Rideshares
              <br />
              <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
                Save Money, Save Time
              </span>
            </h1>
          </div>
          
          <div className="animate-fade-in-up animation-delay-200">
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto font-medium leading-relaxed">
              Get real-time pricing across Uber, Lyft & Taxi services.
              <br className="hidden sm:block" />
              Smart recommendations powered by live surge data.
            </p>
          </div>

          {/* Trust Signals */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 mb-6 sm:mb-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
              <span>Compare 3 services instantly</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
              <span>Save up to 40% on rides</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0"></span>
              <span>Real-time surge alerts</span>
            </div>
          </div>

          {/* Service Logos */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-base sm:text-lg">U</span>
              </div>
              <span className="text-gray-700 font-medium">Uber</span>
            </div>
            <div className="text-gray-400 hidden sm:block">vs</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-pink-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-base sm:text-lg">L</span>
              </div>
              <span className="text-gray-700 font-medium">Lyft</span>
            </div>
            <div className="text-gray-400 hidden sm:block">vs</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-base sm:text-lg">T</span>
              </div>
              <span className="text-gray-700 font-medium">Taxi</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 