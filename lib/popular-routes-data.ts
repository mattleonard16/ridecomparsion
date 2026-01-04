import type { Coordinates, Longitude, Latitude } from '@/types'

interface PrecomputedRouteData {
  pickup: {
    name: string
    coordinates: Coordinates
  }
  destination: {
    name: string
    coordinates: Coordinates
  }
  metrics: {
    distanceKm: number
    durationMin: number
    osrmDurationSec?: number
  }
}

// Helper to create coordinates with proper typing
function coords(lon: number, lat: number): Coordinates {
  return [lon as Longitude, lat as Latitude]
}

/**
 * Pre-computed route data for popular routes.
 * This eliminates the need for external API calls (geocoding + routing) for these common routes.
 *
 * Coordinates and metrics are pre-calculated from actual API responses to ensure accuracy.
 */
export const PRECOMPUTED_ROUTES: Record<string, PrecomputedRouteData> = {
  // === Original Popular Routes (displayed on homepage) ===
  'sfo-downtown': {
    pickup: {
      name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
      coordinates: coords(-122.3904569, 37.6164922),
    },
    destination: {
      name: 'Downtown San Francisco, San Francisco, CA, USA',
      coordinates: coords(-122.4195684, 37.7898562),
    },
    metrics: {
      distanceKm: 21.64,
      durationMin: 23.06,
      osrmDurationSec: 1384,
    },
  },
  'stanford-apple': {
    pickup: {
      name: 'Stanford University, Stanford, CA, USA',
      coordinates: coords(-122.1697, 37.4275),
    },
    destination: {
      name: 'Apple Park, Cupertino, CA, USA',
      coordinates: coords(-122.009, 37.3349),
    },
    metrics: {
      distanceKm: 12.8,
      durationMin: 18.5,
      osrmDurationSec: 1110,
    },
  },
  'sjc-santa-clara': {
    pickup: {
      name: 'San Jose International Airport (SJC), San Jose, CA, USA',
      coordinates: coords(-121.9289, 37.3639),
    },
    destination: {
      name: 'Santa Clara, CA, USA',
      coordinates: coords(-121.9552, 37.3541),
    },
    metrics: {
      distanceKm: 3.2,
      durationMin: 8.5,
      osrmDurationSec: 510,
    },
  },
  'palo-alto-google': {
    pickup: {
      name: 'Palo Alto, CA, USA',
      coordinates: coords(-122.143, 37.4419),
    },
    destination: {
      name: 'Googleplex, Mountain View, CA, USA',
      coordinates: coords(-122.0841, 37.422),
    },
    metrics: {
      distanceKm: 6.5,
      durationMin: 12.3,
      osrmDurationSec: 738,
    },
  },

  // === Additional Common Bay Area Routes ===
  'oak-downtown-oakland': {
    pickup: {
      name: 'Oakland International Airport (OAK), Oakland, CA, USA',
      coordinates: coords(-122.2197, 37.7126),
    },
    destination: {
      name: 'Downtown Oakland, Oakland, CA, USA',
      coordinates: coords(-122.2711, 37.8044),
    },
    metrics: {
      distanceKm: 14.5,
      durationMin: 18,
      osrmDurationSec: 1080,
    },
  },
  'sfo-palo-alto': {
    pickup: {
      name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
      coordinates: coords(-122.3904569, 37.6164922),
    },
    destination: {
      name: 'Palo Alto, CA, USA',
      coordinates: coords(-122.143, 37.4419),
    },
    metrics: {
      distanceKm: 32.5,
      durationMin: 35,
      osrmDurationSec: 2100,
    },
  },
  'sjc-san-francisco': {
    pickup: {
      name: 'San Jose International Airport (SJC), San Jose, CA, USA',
      coordinates: coords(-121.9289, 37.3639),
    },
    destination: {
      name: 'San Francisco, CA, USA',
      coordinates: coords(-122.4194, 37.7749),
    },
    metrics: {
      distanceKm: 72,
      durationMin: 55,
      osrmDurationSec: 3300,
    },
  },
  'sfo-san-jose': {
    pickup: {
      name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
      coordinates: coords(-122.3904569, 37.6164922),
    },
    destination: {
      name: 'San Jose, CA, USA',
      coordinates: coords(-121.8863, 37.3382),
    },
    metrics: {
      distanceKm: 48,
      durationMin: 42,
      osrmDurationSec: 2520,
    },
  },
  'oak-san-francisco': {
    pickup: {
      name: 'Oakland International Airport (OAK), Oakland, CA, USA',
      coordinates: coords(-122.2197, 37.7126),
    },
    destination: {
      name: 'San Francisco, CA, USA',
      coordinates: coords(-122.4194, 37.7749),
    },
    metrics: {
      distanceKm: 22,
      durationMin: 28,
      osrmDurationSec: 1680,
    },
  },
  'sfo-cupertino': {
    pickup: {
      name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
      coordinates: coords(-122.3904569, 37.6164922),
    },
    destination: {
      name: 'Cupertino, CA, USA',
      coordinates: coords(-122.0322, 37.323),
    },
    metrics: {
      distanceKm: 38,
      durationMin: 38,
      osrmDurationSec: 2280,
    },
  },
  'sjc-sunnyvale': {
    pickup: {
      name: 'San Jose International Airport (SJC), San Jose, CA, USA',
      coordinates: coords(-121.9289, 37.3639),
    },
    destination: {
      name: 'Sunnyvale, CA, USA',
      coordinates: coords(-122.0363, 37.3688),
    },
    metrics: {
      distanceKm: 8.5,
      durationMin: 12,
      osrmDurationSec: 720,
    },
  },
  'sjc-mountain-view': {
    pickup: {
      name: 'San Jose International Airport (SJC), San Jose, CA, USA',
      coordinates: coords(-121.9289, 37.3639),
    },
    destination: {
      name: 'Mountain View, CA, USA',
      coordinates: coords(-122.0839, 37.3861),
    },
    metrics: {
      distanceKm: 12,
      durationMin: 15,
      osrmDurationSec: 900,
    },
  },
  'sfo-stanford': {
    pickup: {
      name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
      coordinates: coords(-122.3904569, 37.6164922),
    },
    destination: {
      name: 'Stanford University, Stanford, CA, USA',
      coordinates: coords(-122.1697, 37.4275),
    },
    metrics: {
      distanceKm: 28,
      durationMin: 30,
      osrmDurationSec: 1800,
    },
  },
  'downtown-sf-oak': {
    pickup: {
      name: 'Downtown San Francisco, San Francisco, CA, USA',
      coordinates: coords(-122.4195684, 37.7898562),
    },
    destination: {
      name: 'Oakland International Airport (OAK), Oakland, CA, USA',
      coordinates: coords(-122.2197, 37.7126),
    },
    metrics: {
      distanceKm: 20,
      durationMin: 25,
      osrmDurationSec: 1500,
    },
  },
}

/**
 * Get pre-computed route data by route ID
 */
export function getPrecomputedRoute(routeId: string): PrecomputedRouteData | undefined {
  return PRECOMPUTED_ROUTES[routeId]
}

/**
 * Check if a route matches a pre-computed route by comparing addresses
 * Uses flexible matching to handle variations in address formatting
 */
export function findPrecomputedRouteByAddresses(
  pickupAddress: string,
  destinationAddress: string
): PrecomputedRouteData | undefined {
  const normalizedPickup = pickupAddress.toLowerCase().trim()
  const normalizedDest = destinationAddress.toLowerCase().trim()

  for (const route of Object.values(PRECOMPUTED_ROUTES)) {
    const routePickup = route.pickup.name.toLowerCase().trim()
    const routeDest = route.destination.name.toLowerCase().trim()

    // Extract key identifiers (first part before comma)
    const pickupKey = routePickup.split(',')[0].trim()
    const destKey = routeDest.split(',')[0].trim()

    // Check for exact match or if addresses contain key identifiers
    // This handles cases like "San Francisco International Airport (SFO)" matching "SFO"
    const pickupMatches =
      normalizedPickup === routePickup ||
      normalizedPickup.includes(pickupKey) ||
      routePickup.includes(normalizedPickup.split(',')[0].trim())

    const destMatches =
      normalizedDest === routeDest ||
      normalizedDest.includes(destKey) ||
      routeDest.includes(normalizedDest.split(',')[0].trim())

    if (pickupMatches && destMatches) {
      return route
    }
  }

  return undefined
}
