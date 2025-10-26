'use client'

const FEATURES = [
  {
    id: 'real-time',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Real-time Pricing',
    description: 'Get current surge pricing and accurate fare estimates across all services',
    bgColor: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/30'
  },
  {
    id: 'smart-recommendations',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Smart Recommendations',
    description: 'AI-powered suggestions for best value and fastest rides based on live data',
    bgColor: 'bg-green-500/20',
    iconColor: 'text-green-400',
    borderColor: 'border-green-500/30'
  },
  {
    id: 'bay-area',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Bay Area Optimized',
    description: 'Specially tuned algorithms for San Francisco Bay Area routes and traffic patterns',
    bgColor: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/30'
  }
]

export default function FeatureGrid() {
  return (
    <section className="relative snap-start min-h-screen flex items-center bg-black overflow-hidden">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-900/5 to-black" />
      
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="relative z-10 container mx-auto px-4 max-w-6xl w-full">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
            Why Choose <span className="animate-color-shift">Our Platform</span>
          </h2>
          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto">
            Advanced features designed to <span className="text-white font-semibold">save you time and money</span> on every ride
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((feature, index) => (
            <div 
              key={feature.id}
              className={`glass-card-strong rounded-2xl p-8 shadow-2xl border-2 ${feature.borderColor} hover-lift transition-all duration-300 group`}
            >
              <div className={`w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border ${feature.borderColor}`}>
                <div className={feature.iconColor}>
                  {feature.icon}
                </div>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-black text-white mb-4">
                {feature.title}
              </h3>
              
              <p className="text-gray-300 text-base leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 sm:mt-16 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 glass-card rounded-full border border-green-500/30 text-sm text-gray-300">
            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-500/50"></span>
            <span>Live data updated every <span className="text-white font-semibold">30 seconds</span></span>
          </div>
        </div>
      </div>
    </section>
  )
} 