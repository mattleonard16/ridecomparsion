import { type NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, cleanupRateLimiters } from '@/lib/rate-limiter'
import { 
  validateInput, 
  RideComparisonRequestSchema, 
  detectSuspiciousCoordinates,
  detectSpamPatterns,
  sanitizeString
} from '@/lib/validation'
import { verifyRecaptchaToken, RECAPTCHA_CONFIG } from '@/lib/recaptcha'
import { isAirportLocation, getAirportByCode, parseAirportCode } from '@/lib/airports'
import { calculateEnhancedFare, getTimeBasedMultiplier, getBestTimeRecommendations } from '@/lib/pricing'
import type { Coordinates, Longitude, Latitude } from '@/types'

// POST handler
export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting Check
    const rateLimitResult = await checkRateLimit(request)
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded', 
          details: rateLimitResult.reason,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }, 
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      )
    }

         // 2. Parse and validate request body
     const body = await request.json()
     
     // 3. reCAPTCHA Verification (if token provided)
     if (body.recaptchaToken) {
       const recaptchaResult = await verifyRecaptchaToken(
         body.recaptchaToken,
         RECAPTCHA_CONFIG.ACTIONS.RIDE_COMPARISON,
         RECAPTCHA_CONFIG.NORMAL_THRESHOLD
       )
       
       if (!recaptchaResult.success) {
         console.warn('reCAPTCHA verification failed:', recaptchaResult.error)
         
         // For low scores, return a more user-friendly message
         if (recaptchaResult.score !== undefined && recaptchaResult.score < 0.3) {
           return NextResponse.json(
             { 
               error: 'Security verification failed. Please try again.',
               details: 'Your request appears to be automated. Please try again in a few moments.'
             }, 
             { status: 403 }
           )
         }
         
         // For other failures, log but continue (graceful degradation)
         console.warn('Continuing without reCAPTCHA verification due to:', recaptchaResult.error)
       } else {
         console.log(`reCAPTCHA verified: score ${recaptchaResult.score}, action ${recaptchaResult.action}`)
       }
     }
     
     // Legacy support: convert old format to new format
     let requestData
     if (body.pickup && body.destination) {
       // Legacy format - convert to new format
       requestData = {
         from: {
           name: sanitizeString(body.pickup),
           lat: '0', // Will be geocoded
           lng: '0'
         },
         to: {
           name: sanitizeString(body.destination),
           lat: '0', // Will be geocoded
           lng: '0'
         },
         services: ['uber', 'lyft', 'taxi'] // Default all services
       }
     } else {
       requestData = body
     }

         // Skip coordinate validation for legacy requests (will be geocoded)
     const isLegacyRequest = body.pickup && body.destination
     
     if (!isLegacyRequest) {
       // 4. Input Validation for new format
      const validation = validateInput(RideComparisonRequestSchema, requestData, 'ride comparison request')
      
      if (!validation.success) {
        return NextResponse.json(
          { 
            error: 'Invalid input', 
            details: validation.errors.map(err => ({
              field: err.field,
              message: err.message
            }))
          }, 
          { status: 400 }
        )
      }
      
             requestData = validation.data

       // 5. Spam Detection
      const fromName = requestData.from.name
      const toName = requestData.to.name
      
      if (detectSpamPatterns(fromName) || detectSpamPatterns(toName)) {
        return NextResponse.json(
          { error: 'Invalid location names detected' }, 
          { status: 400 }
        )
      }
      
      if (detectSuspiciousCoordinates(
        { lat: requestData.from.lat, lng: requestData.from.lng },
        { lat: requestData.to.lat, lng: requestData.to.lng }
      )) {
        return NextResponse.json(
          { error: 'Invalid route: pickup and destination are too close' }, 
          { status: 400 }
        )
      }
    }

         // 6. Process request (legacy path)
     if (isLegacyRequest) {
       const { pickup, destination } = body

       if (!pickup || !destination) {
         return NextResponse.json({ error: 'Pickup and destination are required' }, { status: 400 })
       }

       // Convert addresses to coordinates
       const pickupCoords = await getCoordinatesFromAddress(pickup)
       const destinationCoords = await getCoordinatesFromAddress(destination)

       if (!pickupCoords || !destinationCoords) {
         return NextResponse.json({ error: 'Could not geocode addresses' }, { status: 400 })
       }

       // Get comparisons
       const comparisons = await getRideComparisons(pickupCoords, destinationCoords)

       // Generate recommendation
       const insights = generateAlgorithmicRecommendation(comparisons)

       return NextResponse.json({
         comparisons,
         insights,
         pickupCoords,
         destinationCoords,
         surgeInfo: comparisons.surgeInfo,
         timeRecommendations: comparisons.timeRecommendations,
       }, {
         headers: {
           'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
           'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
         }
       })
     }

            // 7. Process new format request (future enhancement)
     // For now, convert to legacy format and process
     const pickup = requestData.from.name
     const destination = requestData.to.name

     // Convert addresses to coordinates
     const pickupCoords = await getCoordinatesFromAddress(pickup)
     const destinationCoords = await getCoordinatesFromAddress(destination)

     if (!pickupCoords || !destinationCoords) {
       return NextResponse.json({ error: 'Could not geocode addresses' }, { status: 400 })
     }

     // Get comparisons
     const comparisons = await getRideComparisons(pickupCoords, destinationCoords)

     // Generate recommendation
     const insights = generateAlgorithmicRecommendation(comparisons)

            // 8. Add rate limit headers to successful responses
     return NextResponse.json({
       comparisons,
       insights,
       pickupCoords,
       destinationCoords,
       surgeInfo: comparisons.surgeInfo,
       timeRecommendations: comparisons.timeRecommendations,
     }, {
       headers: {
         'X-RateLimit-Remaining': rateLimitResult.remainingRequests.toString(),
         'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
       }
     })
  } catch (error) {
    console.error('Error comparing rides:', error)
    return NextResponse.json({ error: 'Failed to compare rides' }, { status: 500 })
  } finally {
    // Periodic cleanup (run occasionally)
    if (Math.random() < 0.01) { // 1% chance per request
      cleanupRateLimiters()
    }
  }
}

// Geocode using OpenStreetMap Nominatim, with airport code support
async function getCoordinatesFromAddress(address: string): Promise<[number, number] | null> {
  // First check if this is an airport code
  const airportCode = parseAirportCode(address)
  if (airportCode) {
    const airport = getAirportByCode(airportCode)
    if (airport) {
      console.log(`Using airport coordinates for ${airportCode}:`, airport.coordinates)
      return [airport.coordinates[0] as number, airport.coordinates[1] as number]
    }
  }

  // Fall back to regular geocoding
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'RideCompareApp/1.0 (bjwmyjackwu@gmail.com)',
    },
  })
  const data = await res.json()
  console.log('Nominatim response for', address, ':', data)
  if (!data || data.length === 0) return null
  const { lon, lat } = data[0]
  return [parseFloat(lon), parseFloat(lat)]
}

// Calculate distance and duration using OSRM API
async function getDistanceAndDuration(
  pickupCoords: [number, number],
  destCoords: [number, number]
): Promise<{ distanceKm: number; durationMin: number }> {
  const [pickupLon, pickupLat] = pickupCoords
  const [destLon, destLat] = destCoords

  const url = `http://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${destLon},${destLat}?overview=false`

  const res = await fetch(url)
  const data = await res.json()

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('Failed to fetch route from OSRM')
  }

  const durationMin = data.routes[0].duration / 60 // seconds to minutes
  const distanceKm = data.routes[0].distance / 1000 // meters to kilometers

  return { distanceKm, durationMin }
}



const UBER = {
  base: 1.25, 
  perMile: 1.08, 
  perMin: 0.28, 
  booking: 0.85, 
  airportSurcharge: 4.25,
  minFare: 8.5, 
}

function kmToMiles(km: number) {
  return km * 0.621371
}

const toCoordinates = (coords: [number, number]): Coordinates => [
  coords[0] as Longitude,
  coords[1] as Latitude,
]

// Generate simulated comparison data
async function getRideComparisons(pickupCoords: [number, number], destCoords: [number, number]) {
  const { distanceKm, durationMin } = await getDistanceAndDuration(pickupCoords, destCoords)
  const { multiplier, surgeReason } = getTimeBasedMultiplier(
    toCoordinates(pickupCoords),
    toCoordinates(destCoords)
  )
  const distanceMiles = kmToMiles(distanceKm)

  console.log(
    `Distance: ${distanceKm.toFixed(2)} km, Duration: ${durationMin.toFixed(1)} min, Surge: ${multiplier}x (${surgeReason})`
  )

 
  const LYFT = {
    base: 1.15, 
    perMile: 1.05, 
    perMin: 0.26, 
    booking: 0.75, 
    airportSurcharge: 4.25,
    minFare: 8.0, 
  }
  const TAXI = {
    base: 3.5,
    perMile: 2.75, 
    perMin: 0.55,
    booking: 0.0,
    airportSurcharge: 0.0,
    minFare: 10.0,
  }

  // Airport fee logic
  const isAirport = (pickup: [number, number], dest: [number, number]) =>
    isAirportLocation(toCoordinates(pickup)) !== null ||
    isAirportLocation(toCoordinates(dest)) !== null

  // Calculate base prices first
  let uberBasePriceRaw =
    UBER.base + UBER.perMile * distanceMiles + UBER.perMin * durationMin + UBER.booking
  if (isAirport(pickupCoords, destCoords)) uberBasePriceRaw += UBER.airportSurcharge
  if (uberBasePriceRaw < UBER.minFare) uberBasePriceRaw = UBER.minFare

  let lyftBasePriceRaw =
    LYFT.base + LYFT.perMile * distanceMiles + LYFT.perMin * durationMin + LYFT.booking
  if (isAirport(pickupCoords, destCoords)) lyftBasePriceRaw += LYFT.airportSurcharge
  if (lyftBasePriceRaw < LYFT.minFare) lyftBasePriceRaw = LYFT.minFare

  // Taxi
  let taxiBasePriceRaw
  if (isSantaClaraToSFO(pickupCoords, destCoords)) {
    taxiBasePriceRaw = 89 + Math.random() * (99 - 89)
  } else if (isAirport(pickupCoords, destCoords)) {
    taxiBasePriceRaw = Math.max(
      TAXI.base + TAXI.perMile * distanceMiles + TAXI.perMin * durationMin + TAXI.booking,
      60
    )
  } else {
    taxiBasePriceRaw =
      TAXI.base + TAXI.perMile * distanceMiles + TAXI.perMin * durationMin + TAXI.booking
    if (taxiBasePriceRaw < TAXI.minFare) taxiBasePriceRaw = TAXI.minFare
  }

  // Apply time-based surge pricing
  const uberPriceRaw = uberBasePriceRaw * multiplier
  const lyftPriceRaw = lyftBasePriceRaw * multiplier
  const taxiPriceRaw = taxiBasePriceRaw * Math.min(multiplier, 1.2)
  const baseWaitTime = 2 + Math.floor(Math.random() * 5)
  const surgeWaitMultiplier = multiplier > 1.5 ? 1.5 : 1.0

  return {
    uber: {
      price: `$${uberPriceRaw.toFixed(2)}`,
      waitTime: `${Math.round(baseWaitTime * surgeWaitMultiplier)} min`,
      driversNearby: Math.floor(3 + Math.random() * 5),
      service: 'UberX',
      surgeMultiplier: multiplier > 1.1 ? `${multiplier.toFixed(1)}x` : null,
    },
    lyft: {
      price: `$${lyftPriceRaw.toFixed(2)}`,
      waitTime: `${Math.round((baseWaitTime + 1) * surgeWaitMultiplier)} min`,
      driversNearby: Math.floor(2 + Math.random() * 4),
      service: 'Lyft Standard',
      surgeMultiplier: multiplier * 0.95 > 1.1 ? `${(multiplier * 0.95).toFixed(1)}x` : null,
    },
    taxi: {
      price: `$${taxiPriceRaw.toFixed(2)}`,
      waitTime: `${Math.round((baseWaitTime + 3) * Math.min(surgeWaitMultiplier, 1.2))} min`,
      driversNearby: Math.floor(1 + Math.random() * 3),
      service: 'Yellow Cab',
      surgeMultiplier: multiplier > 1.1 ? `${(multiplier * 0.95).toFixed(1)}x` : null, // Keep visual surge slightly different
    },
    surgeInfo: {
      isActive: multiplier > 1.1,
      reason: surgeReason,
      multiplier: multiplier,
    },
    timeRecommendations: getBestTimeRecommendations(),
  }
}

// Generate insights based on score
function generateAlgorithmicRecommendation(comparisons: {
  uber: { price: string; waitTime: string }
  lyft: { price: string; waitTime: string }
  taxi: { price: string; waitTime: string }
}) {
  const uberPrice = parseFloat(comparisons.uber.price.replace('$', ''))
  const lyftPrice = parseFloat(comparisons.lyft.price.replace('$', ''))
  const taxiPrice = parseFloat(comparisons.taxi.price.replace('$', ''))

  const uberWait = parseInt(comparisons.uber.waitTime.replace(' min', ''))
  const lyftWait = parseInt(comparisons.lyft.waitTime.replace(' min', ''))
  const taxiWait = parseInt(comparisons.taxi.waitTime.replace(' min', ''))

  const uberScore = uberPrice * 0.7 + uberWait * 0.3
  const lyftScore = lyftPrice * 0.7 + lyftWait * 0.3
  const taxiScore = taxiPrice * 0.7 + taxiWait * 0.3

  const scores = [
    { service: 'Uber', score: uberScore, price: uberPrice, wait: uberWait },
    { service: 'Lyft', score: lyftScore, price: lyftPrice, wait: lyftWait },
    { service: 'Taxi', score: taxiScore, price: taxiPrice, wait: taxiWait },
  ]

  const bestOption = scores.reduce((prev, curr) => (prev.score < curr.score ? prev : curr))
  const cheapestOption = scores.reduce((prev, curr) => (prev.price < curr.price ? prev : curr))
  const fastestOption = scores.reduce((prev, curr) => (prev.wait < curr.wait ? prev : curr))

  let recommendation = `Based on a combination of price and wait time, ${bestOption.service} appears to be your best overall option for this trip.`

  if (
    bestOption.service !== cheapestOption.service &&
    bestOption.service !== fastestOption.service
  ) {
    recommendation += ` If you're looking to save money, ${cheapestOption.service} is the cheapest option. For the shortest wait time, choose ${fastestOption.service}.`
  } else if (bestOption.service !== cheapestOption.service) {
    recommendation += ` However, if you're looking to save money, ${cheapestOption.service} is the cheapest option.`
  } else if (bestOption.service !== fastestOption.service) {
    recommendation += ` However, for the shortest wait time, choose ${fastestOption.service}.`
  }

  return recommendation
}

// Add this helper function
function isSantaClaraToSFO(pickup: [number, number], dest: [number, number]) {
  const santaClaraLat = 37.3541
  const santaClaraLon = -121.9552
  const sfoLat = 37.622452
  const sfoLon = -122.3839894
  const isSantaClara = (lat: number, lon: number) =>
    Math.abs(lat - santaClaraLat) < 0.05 && Math.abs(lon - santaClaraLon) < 0.05
  const isSFO = (lat: number, lon: number) =>
    Math.abs(lat - sfoLat) < 0.05 && Math.abs(lon - sfoLon) < 0.05
  return (
    (isSantaClara(pickup[1], pickup[0]) && isSFO(dest[1], dest[0])) ||
    (isSantaClara(dest[1], dest[0]) && isSFO(pickup[1], pickup[0]))
  )
}
