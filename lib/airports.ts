import type { Coordinates, Longitude, Latitude } from '@/types'

export interface Airport {
  code: string
  name: string
  city: string
  state: string
  displayName: string
  coordinates: Coordinates
  terminals: Terminal[]
  timezone: string
  popularDestination: boolean
}

export interface Terminal {
  name: string
  code?: string
  coordinates: Coordinates
  ridesharePickup?: {
    description: string
    coordinates: Coordinates
  }
}

// Helper function to create coordinates with proper typing
function coords(lon: number, lat: number): Coordinates {
  return [lon as Longitude, lat as Latitude]
}

// Major U.S. Airports Database
export const AIRPORTS: Record<string, Airport> = {
  // Bay Area (existing)
  SFO: {
    code: 'SFO',
    name: 'San Francisco International Airport',
    city: 'San Francisco',
    state: 'CA',
    displayName: 'San Francisco International Airport (SFO)',
    coordinates: coords(-122.379, 37.6213),
    timezone: 'America/Los_Angeles',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal 1',
        coordinates: coords(-122.3875, 37.62),
        ridesharePickup: {
          description: 'Terminal 1 Departure Level',
          coordinates: coords(-122.3875, 37.62),
        },
      },
      {
        name: 'Terminal 2',
        coordinates: coords(-122.3851, 37.6186),
        ridesharePickup: {
          description: 'Terminal 2 Departure Level',
          coordinates: coords(-122.3851, 37.6186),
        },
      },
      {
        name: 'Terminal 3',
        coordinates: coords(-122.3832, 37.6171),
        ridesharePickup: {
          description: 'Terminal 3 Departure Level',
          coordinates: coords(-122.3832, 37.6171),
        },
      },
      {
        name: 'International Terminal',
        coordinates: coords(-122.3875, 37.6158),
        ridesharePickup: {
          description: 'International Terminal Departure Level',
          coordinates: coords(-122.3875, 37.6158),
        },
      },
    ],
  },
  SJC: {
    code: 'SJC',
    name: 'San Jose International Airport',
    city: 'San Jose',
    state: 'CA',
    displayName: 'San Jose International Airport (SJC)',
    coordinates: coords(-121.9289, 37.3639),
    timezone: 'America/Los_Angeles',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal A',
        coordinates: coords(-121.9289, 37.365),
        ridesharePickup: {
          description: 'Terminal A Departure Level',
          coordinates: coords(-121.9289, 37.365),
        },
      },
      {
        name: 'Terminal B',
        coordinates: coords(-121.9289, 37.3628),
        ridesharePickup: {
          description: 'Terminal B Departure Level',
          coordinates: coords(-121.9289, 37.3628),
        },
      },
    ],
  },
  OAK: {
    code: 'OAK',
    name: 'Oakland International Airport',
    city: 'Oakland',
    state: 'CA',
    displayName: 'Oakland International Airport (OAK)',
    coordinates: coords(-122.2197, 37.7126),
    timezone: 'America/Los_Angeles',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal 1',
        coordinates: coords(-122.2197, 37.7136),
        ridesharePickup: {
          description: 'Terminal 1 Ground Transportation',
          coordinates: coords(-122.2197, 37.7136),
        },
      },
      {
        name: 'Terminal 2',
        coordinates: coords(-122.2197, 37.7116),
        ridesharePickup: {
          description: 'Terminal 2 Ground Transportation',
          coordinates: coords(-122.2197, 37.7116),
        },
      },
    ],
  },

  // Los Angeles Area
  LAX: {
    code: 'LAX',
    name: 'Los Angeles International Airport',
    city: 'Los Angeles',
    state: 'CA',
    displayName: 'Los Angeles International Airport (LAX)',
    coordinates: coords(-118.4085, 33.9425),
    timezone: 'America/Los_Angeles',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal 1',
        coordinates: coords(-118.4085, 33.9445),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Terminal 2',
        coordinates: coords(-118.4085, 33.9435),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Terminal 3',
        coordinates: coords(-118.4085, 33.9425),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Terminal 4',
        coordinates: coords(-118.4085, 33.9415),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Terminal 5',
        coordinates: coords(-118.4085, 33.9405),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Terminal 6',
        coordinates: coords(-118.4085, 33.9395),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Terminal 7',
        coordinates: coords(-118.4085, 33.9385),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
      {
        name: 'Tom Bradley International Terminal',
        coordinates: coords(-118.4085, 33.9375),
        ridesharePickup: {
          description: 'LAX-it Rideshare Hub',
          coordinates: coords(-118.4016, 33.9336),
        },
      },
    ],
  },

  // New York Area
  JFK: {
    code: 'JFK',
    name: 'John F. Kennedy International Airport',
    city: 'New York',
    state: 'NY',
    displayName: 'John F. Kennedy International Airport (JFK)',
    coordinates: coords(-73.7781, 40.6413),
    timezone: 'America/New_York',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal 1',
        coordinates: coords(-73.7781, 40.6423),
        ridesharePickup: {
          description: 'Terminal 1 Arrival Level',
          coordinates: coords(-73.7781, 40.6423),
        },
      },
      {
        name: 'Terminal 4',
        coordinates: coords(-73.7781, 40.6413),
        ridesharePickup: {
          description: 'Terminal 4 Arrival Level',
          coordinates: coords(-73.7781, 40.6413),
        },
      },
      {
        name: 'Terminal 5',
        coordinates: coords(-73.7781, 40.6403),
        ridesharePickup: {
          description: 'Terminal 5 Arrival Level',
          coordinates: coords(-73.7781, 40.6403),
        },
      },
      {
        name: 'Terminal 7',
        coordinates: coords(-73.7781, 40.6393),
        ridesharePickup: {
          description: 'Terminal 7 Arrival Level',
          coordinates: coords(-73.7781, 40.6393),
        },
      },
      {
        name: 'Terminal 8',
        coordinates: coords(-73.7781, 40.6383),
        ridesharePickup: {
          description: 'Terminal 8 Arrival Level',
          coordinates: coords(-73.7781, 40.6383),
        },
      },
    ],
  },
  EWR: {
    code: 'EWR',
    name: 'Newark Liberty International Airport',
    city: 'Newark',
    state: 'NJ',
    displayName: 'Newark Liberty International Airport (EWR)',
    coordinates: coords(-74.1745, 40.6895),
    timezone: 'America/New_York',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal A',
        coordinates: coords(-74.1745, 40.6905),
        ridesharePickup: {
          description: 'Terminal A Ground Level',
          coordinates: coords(-74.1745, 40.6905),
        },
      },
      {
        name: 'Terminal B',
        coordinates: coords(-74.1745, 40.6895),
        ridesharePickup: {
          description: 'Terminal B Ground Level',
          coordinates: coords(-74.1745, 40.6895),
        },
      },
      {
        name: 'Terminal C',
        coordinates: coords(-74.1745, 40.6885),
        ridesharePickup: {
          description: 'Terminal C Ground Level',
          coordinates: coords(-74.1745, 40.6885),
        },
      },
    ],
  },

  // Chicago
  ORD: {
    code: 'ORD',
    name: "O'Hare International Airport",
    city: 'Chicago',
    state: 'IL',
    displayName: "Chicago O'Hare International Airport (ORD)",
    coordinates: coords(-87.9073, 41.9742),
    timezone: 'America/Chicago',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal 1',
        coordinates: coords(-87.9073, 41.9752),
        ridesharePickup: {
          description: 'Terminal 1 Lower Level Door 1E',
          coordinates: coords(-87.9073, 41.9752),
        },
      },
      {
        name: 'Terminal 2',
        coordinates: coords(-87.9073, 41.9742),
        ridesharePickup: {
          description: 'Terminal 2 Lower Level Door 2E',
          coordinates: coords(-87.9073, 41.9742),
        },
      },
      {
        name: 'Terminal 3',
        coordinates: coords(-87.9073, 41.9732),
        ridesharePickup: {
          description: 'Terminal 3 Lower Level Door 3E',
          coordinates: coords(-87.9073, 41.9732),
        },
      },
      {
        name: 'Terminal 5 (International)',
        coordinates: coords(-87.9073, 41.9722),
        ridesharePickup: {
          description: 'Terminal 5 Lower Level Door 5E',
          coordinates: coords(-87.9073, 41.9722),
        },
      },
    ],
  },

  // Atlanta
  ATL: {
    code: 'ATL',
    name: 'Hartsfield-Jackson Atlanta International Airport',
    city: 'Atlanta',
    state: 'GA',
    displayName: 'Hartsfield-Jackson Atlanta International Airport (ATL)',
    coordinates: coords(-84.4277, 33.6407),
    timezone: 'America/New_York',
    popularDestination: true,
    terminals: [
      {
        name: 'Domestic Terminal',
        coordinates: coords(-84.4277, 33.6417),
        ridesharePickup: {
          description: 'Domestic Terminal Ground Transportation',
          coordinates: coords(-84.4277, 33.6417),
        },
      },
      {
        name: 'International Terminal',
        coordinates: coords(-84.4277, 33.6397),
        ridesharePickup: {
          description: 'International Terminal Ground Transportation',
          coordinates: coords(-84.4277, 33.6397),
        },
      },
    ],
  },

  // Seattle
  SEA: {
    code: 'SEA',
    name: 'Seattle-Tacoma International Airport',
    city: 'Seattle',
    state: 'WA',
    displayName: 'Seattle-Tacoma International Airport (SEA)',
    coordinates: coords(-122.3088, 47.4502),
    timezone: 'America/Los_Angeles',
    popularDestination: true,
    terminals: [
      {
        name: 'Main Terminal',
        coordinates: coords(-122.3088, 47.4502),
        ridesharePickup: {
          description: 'Ground Transportation Center',
          coordinates: coords(-122.3088, 47.4502),
        },
      },
    ],
  },

  // Denver
  DEN: {
    code: 'DEN',
    name: 'Denver International Airport',
    city: 'Denver',
    state: 'CO',
    displayName: 'Denver International Airport (DEN)',
    coordinates: coords(-104.6737, 39.8561),
    timezone: 'America/Denver',
    popularDestination: true,
    terminals: [
      {
        name: 'Jeppesen Terminal',
        coordinates: coords(-104.6737, 39.8561),
        ridesharePickup: {
          description: 'Level 6 Island 1 (Rideshare)',
          coordinates: coords(-104.6737, 39.8561),
        },
      },
    ],
  },

  // Boston
  BOS: {
    code: 'BOS',
    name: 'Logan International Airport',
    city: 'Boston',
    state: 'MA',
    displayName: 'Boston Logan International Airport (BOS)',
    coordinates: coords(-71.0096, 42.3656),
    timezone: 'America/New_York',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal A',
        coordinates: coords(-71.0096, 42.3666),
        ridesharePickup: {
          description: 'Terminal A Ground Level',
          coordinates: coords(-71.0096, 42.3666),
        },
      },
      {
        name: 'Terminal B',
        coordinates: coords(-71.0096, 42.3656),
        ridesharePickup: {
          description: 'Terminal B Ground Level',
          coordinates: coords(-71.0096, 42.3656),
        },
      },
      {
        name: 'Terminal C',
        coordinates: coords(-71.0096, 42.3646),
        ridesharePickup: {
          description: 'Terminal C Ground Level',
          coordinates: coords(-71.0096, 42.3646),
        },
      },
      {
        name: 'Terminal E (International)',
        coordinates: coords(-71.0096, 42.3636),
        ridesharePickup: {
          description: 'Terminal E Ground Level',
          coordinates: coords(-71.0096, 42.3636),
        },
      },
    ],
  },

  // Dallas
  DFW: {
    code: 'DFW',
    name: 'Dallas/Fort Worth International Airport',
    city: 'Dallas',
    state: 'TX',
    displayName: 'Dallas/Fort Worth International Airport (DFW)',
    coordinates: coords(-97.0372, 32.8968),
    timezone: 'America/Chicago',
    popularDestination: true,
    terminals: [
      {
        name: 'Terminal A',
        coordinates: coords(-97.0372, 32.8978),
        ridesharePickup: {
          description: 'Terminal A Ground Transportation',
          coordinates: coords(-97.0372, 32.8978),
        },
      },
      {
        name: 'Terminal B',
        coordinates: coords(-97.0372, 32.8968),
        ridesharePickup: {
          description: 'Terminal B Ground Transportation',
          coordinates: coords(-97.0372, 32.8968),
        },
      },
      {
        name: 'Terminal C',
        coordinates: coords(-97.0372, 32.8958),
        ridesharePickup: {
          description: 'Terminal C Ground Transportation',
          coordinates: coords(-97.0372, 32.8958),
        },
      },
      {
        name: 'Terminal D',
        coordinates: coords(-97.0372, 32.8948),
        ridesharePickup: {
          description: 'Terminal D Ground Transportation',
          coordinates: coords(-97.0372, 32.8948),
        },
      },
      {
        name: 'Terminal E',
        coordinates: coords(-97.0372, 32.8938),
        ridesharePickup: {
          description: 'Terminal E Ground Transportation',
          coordinates: coords(-97.0372, 32.8938),
        },
      },
    ],
  },
}

// Utility functions for airport data
export function getAirportByCode(code: string): Airport | undefined {
  return AIRPORTS[code.toUpperCase()]
}

export function getAllAirports(): Airport[] {
  return Object.values(AIRPORTS)
}

export function getPopularAirports(): Airport[] {
  return Object.values(AIRPORTS).filter(airport => airport.popularDestination)
}

export function searchAirports(query: string): Airport[] {
  const normalizedQuery = query.toLowerCase()
  return Object.values(AIRPORTS).filter(
    airport =>
      airport.code.toLowerCase().includes(normalizedQuery) ||
      airport.name.toLowerCase().includes(normalizedQuery) ||
      airport.city.toLowerCase().includes(normalizedQuery) ||
      airport.displayName.toLowerCase().includes(normalizedQuery)
  )
}

export function isAirportLocation(coordinates: Coordinates, tolerance = 0.05): Airport | null {
  const [lon, lat] = coordinates

  for (const airport of Object.values(AIRPORTS)) {
    const [airportLon, airportLat] = airport.coordinates
    if (Math.abs(lat - airportLat) < tolerance && Math.abs(lon - airportLon) < tolerance) {
      return airport
    }
  }

  return null
}

export function getAirportTerminals(airportCode: string): Terminal[] {
  const airport = getAirportByCode(airportCode)
  return airport?.terminals || []
}

export function formatAirportDisplay(airport: Airport, includeTerminals = false): string {
  let display = `${airport.name} (${airport.code})`
  if (includeTerminals && airport.terminals.length > 1) {
    display += ` - ${airport.terminals.length} terminals`
  }
  return display
}

export function parseAirportCode(locationString: string): string | null {
  const airportCode = locationString.toUpperCase().match(/([A-Z]{3})/)?.[1]
  if (airportCode && getAirportByCode(airportCode)) {
    return airportCode
  }
  return null
}
