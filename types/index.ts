// Branded types for better type safety
export type Brand<K, T extends string> = K & { __brand: T }

// Location and coordinate types
export type Latitude = number
export type Longitude = number
export type Coordinates = [Longitude, Latitude]

// Price and currency types
export type PriceAmount = number
export type PriceString = string

// Service and ride types
export type ServiceType = 'uber' | 'lyft' | 'taxi' | 'waymo'
export type RideService = string

// Location suggestion interface
export interface LocationSuggestion {
  display_name: string
  lat: string
  lon: string
  name?: string
  place_id?: string
}

// Ride comparison result interface
export interface RideResult {
  price: PriceString
  waitTime: string
  driversNearby: number
  service: RideService
  surgeMultiplier?: string
}

// Complete comparison results
export type ComparisonResults = Partial<Record<ServiceType, RideResult>>

export interface ComparisonPersistenceContext {
  routeId: string | null
  pickupAddress: string
  destinationAddress: string
  userId?: string | null
  sessionId?: string | null
}

// Surge information
export interface SurgeInfo {
  isActive: boolean
  reason: string
  multiplier: number
}

// AI Recommendation types
export interface AIRecommendation {
  id?: string
  type: 'DEPARTURE_TIME' | 'SERVICE_CHOICE' | 'SURGE_FORECAST' | 'SAVINGS_INSIGHT'
  title: string
  message: string
  confidence: number
  dataPoints: {
    potentialSavings?: number
    bestHour?: number
    currentPrice?: number
    bestPrice?: number
    bestService?: string
    surgeEndEstimate?: string
  }
}

// API response types
export interface ComparisonApiResponse {
  comparisons: ComparisonResults
  insights: string
  pickupCoords: Coordinates
  destinationCoords: Coordinates
  surgeInfo: SurgeInfo
  timeRecommendations: string[]
  aiRecommendations?: AIRecommendation[]
}

// Common places type
export interface CommonPlace {
  display_name: string
  name: string
  lat: string
  lon: string
}

export type CommonPlaces = Record<string, CommonPlace>
