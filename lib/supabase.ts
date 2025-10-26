import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Environment variables (add to .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key'

// Check if we're in development with mock credentials
const isMockMode = supabaseUrl.includes('mock-project') || supabaseAnonKey === 'mock-key'

if (isMockMode) {
  console.log('🚧 Supabase running in MOCK mode - data will not persist')
}

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Export mock mode flag for conditional logic
export const isSupabaseMockMode = isMockMode

// Helper functions for common operations

/**
 * Find or create a route in the database
 */
export async function findOrCreateRoute(
  pickupAddress: string,
  pickupCoords: [number, number],
  destAddress: string,
  destCoords: [number, number],
  distance?: number,
  duration?: number
) {
  // In mock mode, return a fake route ID
  if (isMockMode) {
    const mockRouteId = `mock-route-${pickupCoords[0]}-${pickupCoords[1]}-${destCoords[0]}-${destCoords[1]}`.replace(/\./g, '')
    console.log('🔧 [MOCK] Created route:', mockRouteId)
    return mockRouteId
  }

  const routeData: Database['public']['Tables']['routes']['Insert'] = {
    pickup_address: pickupAddress,
    pickup_lat: pickupCoords[1],
    pickup_lng: pickupCoords[0],
    destination_address: destAddress,
    destination_lat: destCoords[1],
    destination_lng: destCoords[0],
    distance_miles: distance,
    duration_minutes: duration,
  }

  // Try to find existing route by coordinates
  const { data: existingRoute } = await supabase
    .from('routes')
    .select('id')
    .eq('pickup_lat', pickupCoords[1])
    .eq('pickup_lng', pickupCoords[0])
    .eq('destination_lat', destCoords[1])
    .eq('destination_lng', destCoords[0])
    .maybeSingle()

  if (existingRoute) {
    return (existingRoute as any).id
  }

  // Create new route
  const { data: newRoute, error } = await supabase
    .from('routes')
    .insert(routeData as any)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Error creating route:', error)
    return null
  }

  return (newRoute as any)?.id ?? null
}

/**
 * Log a price snapshot
 */
export async function logPriceSnapshot(
  routeId: string,
  service: 'uber' | 'lyft' | 'taxi',
  price: number,
  surge: number = 1.0,
  waitTime?: number,
  factors?: {
    weather?: string
    temperature?: number
    isRaining?: boolean
    trafficLevel?: 'light' | 'moderate' | 'heavy' | 'severe'
    nearbyEvents?: string[]
  }
) {
  const now = new Date()
  
  const snapshot: Database['public']['Tables']['price_snapshots']['Insert'] = {
    route_id: routeId,
    service_type: service,
    base_price: price / surge, // Calculate base price
    surge_multiplier: surge,
    final_price: price,
    wait_time_minutes: waitTime,
    day_of_week: now.getDay(),
    hour_of_day: now.getHours(),
    weather_condition: factors?.weather,
    weather_temp_f: factors?.temperature,
    is_raining: factors?.isRaining || false,
    traffic_level: factors?.trafficLevel,
    nearby_events: factors?.nearbyEvents || [],
  }

  // In mock mode, just log to console
  if (isMockMode) {
    console.log('🔧 [MOCK] Price snapshot:', {
      service,
      price: `$${price.toFixed(2)}`,
      surge: `${surge}x`,
      waitTime: `${waitTime} min`,
      timestamp: now.toISOString()
    })
    return
  }

  const { error } = await supabase
    .from('price_snapshots')
    .insert(snapshot as any)

  if (error) {
    console.error('Error logging price snapshot:', error)
  }
}

/**
 * Log a search
 */
export async function logSearch(
  routeId: string | null,
  userId: string | null,
  results: any,
  sessionId?: string
) {
  // In mock mode, just log to console
  if (isMockMode) {
    console.log('🔧 [MOCK] Search logged:', {
      routeId,
      userId,
      sessionId,
      resultsCount: Object.keys(results).length,
      timestamp: new Date().toISOString()
    })
    return
  }

  const searchLog: Database['public']['Tables']['search_logs']['Insert'] = {
    route_id: routeId,
    user_id: userId,
    session_id: sessionId,
    results_shown: results,
    user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
  }

  const { error } = await supabase
    .from('search_logs')
    .insert(searchLog as any)

  if (error) {
    console.error('Error logging search:', error)
  }
}

/**
 * Get route price history
 */
export async function getRoutePriceHistory(
  routeId: string,
  daysBack: number = 7
) {
  const { data, error } = await supabase
    .rpc('get_route_price_history', {
      p_route_id: routeId,
      p_days_back: daysBack,
    } as any)

  if (error) {
    console.error('Error fetching price history:', error)
    return []
  }

  return data || []
}

/**
 * Get average prices by hour for a route
 */
export async function getHourlyPriceAverage(
  routeId: string,
  service: 'uber' | 'lyft' | 'taxi'
) {
  const { data, error } = await supabase
    .rpc('get_hourly_price_average', {
      p_route_id: routeId,
      p_service: service,
    } as any)

  if (error) {
    console.error('Error fetching hourly averages:', error)
    return []
  }

  return data || []
}

/**
 * Save a route for a user
 */
export async function saveRouteForUser(
  userId: string,
  routeId: string,
  nickname?: string
) {
  const savedRoute: Database['public']['Tables']['saved_routes']['Insert'] = {
    user_id: userId,
    route_id: routeId,
    nickname: nickname ?? null,
  }

  const { error } = await supabase
    .from('saved_routes')
    .upsert(savedRoute as any)

  if (error) {
    console.error('Error saving route:', error)
    return false
  }

  return true
}

/**
 * Create a price alert
 */
export async function createPriceAlert(
  userId: string,
  routeId: string,
  targetPrice: number,
  service: 'uber' | 'lyft' | 'taxi' | 'any' = 'any',
  alertType: 'below' | 'above' = 'below'
) {
  const priceAlert: Database['public']['Tables']['price_alerts']['Insert'] = {
    user_id: userId,
    route_id: routeId,
    service_type: service,
    target_price: targetPrice,
    alert_type: alertType,
  }

  const { data, error } = await supabase
    .from('price_alerts')
    .insert(priceAlert as any)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Error creating price alert:', error)
    return null
  }

  return data
}

/**
 * Log weather data
 */
export async function logWeatherData(
  coords: [number, number],
  weatherData: {
    temperature: number
    condition: string
    precipitation?: number
    windSpeed?: number
    visibility?: number
    rawData?: any
  }
) {
  const weatherLog: Database['public']['Tables']['weather_logs']['Insert'] = {
    lat: coords[1],
    lng: coords[0],
    temperature_f: weatherData.temperature,
    condition: weatherData.condition,
    precipitation_inch: weatherData.precipitation,
    wind_speed_mph: weatherData.windSpeed,
    visibility_miles: weatherData.visibility,
    is_severe: weatherData.condition.includes('storm') || weatherData.condition.includes('severe'),
    raw_data: weatherData.rawData,
  }

  const { error } = await supabase
    .from('weather_logs')
    .insert(weatherLog as any)

  if (error) {
    console.error('Error logging weather:', error)
  }
}

/**
 * Log event data
 */
export async function logEventData(event: {
  name: string
  venue: string
  coords: [number, number]
  type: string
  startTime: Date
  endTime?: Date
  attendance?: number
  rawData?: any
}) {
  const eventLog: Database['public']['Tables']['event_logs']['Insert'] = {
    event_name: event.name,
    venue_name: event.venue,
    venue_lat: event.coords[1],
    venue_lng: event.coords[0],
    event_type: event.type,
    start_time: event.startTime.toISOString(),
    end_time: event.endTime?.toISOString(),
    expected_attendance: event.attendance,
    raw_data: event.rawData,
  }

  const { error } = await supabase
    .from('event_logs')
    .insert(eventLog as any)

  if (error) {
    console.error('Error logging event:', error)
  }
}
