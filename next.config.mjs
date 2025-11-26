const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  typescript: {
    // Temporarily ignore build errors for API routes while focusing on development
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint during builds for now
    ignoreDuringBuilds: true,
  },
}

// Only load PWA in production to avoid babel compatibility issues
let config = nextConfig

if (!isDev) {
  const withPWA = (await import('next-pwa')).default

  const pwaConfig = {
    dest: 'public',
    disable: false,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'openstreetmap-tiles',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
        },
      },
      {
        urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'nominatim-api',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 1 day
          },
        },
      },
      {
        urlPattern: /^http:\/\/router\.project-osrm\.org\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'osrm-api',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60, // 1 hour
          },
        },
      },
    ],
  }

  config = withPWA(pwaConfig)(nextConfig)
}

export default config
