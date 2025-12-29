'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2, Locate, Shield, Plane, ArrowRight } from 'lucide-react'
import RideComparisonResults from './ride-comparison-results'
import RouteMap from './RouteMap'
import RouteHeader from './route-header'
import { useRecaptcha } from '@/lib/hooks/use-recaptcha'
import { RECAPTCHA_CONFIG } from '@/lib/recaptcha'
import { getPopularAirports } from '@/lib/airports'

// Common places for faster autocomplete
const COMMON_PLACES = {
  'santa clara university': {
    display_name: 'Santa Clara University, Santa Clara, CA, USA',
    name: 'Santa Clara University',
    lat: '37.3496',
    lon: '-121.9390',
  },
  'san jose airport': {
    display_name: 'San Jose International Airport (SJC), San Jose, CA, USA',
    name: 'San Jose Airport (SJC)',
    lat: '37.3639',
    lon: '-121.9289',
  },
  sjc: {
    display_name: 'San Jose International Airport (SJC), San Jose, CA, USA',
    name: 'San Jose Airport (SJC)',
    lat: '37.3639',
    lon: '-121.9289',
  },
  sfo: {
    display_name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
    name: 'San Francisco Airport (SFO)',
    lat: '37.6213',
    lon: '-122.3790',
  },
  'san francisco airport': {
    display_name: 'San Francisco International Airport (SFO), San Francisco, CA, USA',
    name: 'San Francisco Airport (SFO)',
    lat: '37.6213',
    lon: '-122.3790',
  },
  'oakland airport': {
    display_name: 'Oakland International Airport (OAK), Oakland, CA, USA',
    name: 'Oakland Airport (OAK)',
    lat: '37.7126',
    lon: '-122.2197',
  },
  oak: {
    display_name: 'Oakland International Airport (OAK), Oakland, CA, USA',
    name: 'Oakland Airport (OAK)',
    lat: '37.7126',
    lon: '-122.2197',
  },
  'stanford university': {
    display_name: 'Stanford University, Stanford, CA, USA',
    name: 'Stanford University',
    lat: '37.4275',
    lon: '-122.1697',
  },
  cupertino: {
    display_name: 'Cupertino, CA, USA',
    name: 'Cupertino',
    lat: '37.3230',
    lon: '-122.0322',
  },
  'apple park': {
    display_name: 'Apple Park, Cupertino, CA, USA',
    name: 'Apple Park',
    lat: '37.3349',
    lon: '-122.0090',
  },
  google: {
    display_name: 'Googleplex, Mountain View, CA, USA',
    name: 'Google Headquarters',
    lat: '37.4220',
    lon: '-122.0841',
  },
  'mountain view': {
    display_name: 'Mountain View, CA, USA',
    name: 'Mountain View',
    lat: '37.3861',
    lon: '-122.0839',
  },
  'palo alto': {
    display_name: 'Palo Alto, CA, USA',
    name: 'Palo Alto',
    lat: '37.4419',
    lon: '-122.1430',
  },
  'san jose': {
    display_name: 'San Jose, CA, USA',
    name: 'San Jose',
    lat: '37.3382',
    lon: '-121.8863',
  },
  'santa clara': {
    display_name: 'Santa Clara, CA, USA',
    name: 'Santa Clara',
    lat: '37.3541',
    lon: '-121.9552',
  },
  sunnyvale: {
    display_name: 'Sunnyvale, CA, USA',
    name: 'Sunnyvale',
    lat: '37.3688',
    lon: '-122.0363',
  },
  fremont: {
    display_name: 'Fremont, CA, USA',
    name: 'Fremont',
    lat: '37.5485',
    lon: '-121.9886',
  },
  'san francisco': {
    display_name: 'San Francisco, CA, USA',
    name: 'San Francisco',
    lat: '37.7749',
    lon: '-122.4194',
  },
  'downtown san jose': {
    display_name: 'Downtown San Jose, San Jose, CA, USA',
    name: 'Downtown San Jose',
    lat: '37.3382',
    lon: '-121.8863',
  },
}

// Constants
const DEBOUNCE_DELAY_MS = 300
const AUTO_SUBMIT_DELAY_MS = 200

// Cache for API results
const searchCache = new Map()

// Type definitions
type LocationSuggestion = {
  display_name: string
  lat: string
  lon: string
  name?: string
  place_id?: string
}

type RideService = {
  price: string
  waitTime: string
  driversNearby: number
  service: string
  surgeMultiplier?: string
}

type RideResults = {
  uber: RideService
  lyft: RideService
  taxi: RideService
}

type SurgeInfo = {
  isActive: boolean
  reason: string
  multiplier: number
}

interface RideComparisonFormProps {
  selectedRoute?: {
    pickup: string
    destination: string
  } | null
  onRouteProcessed?: () => void
}

export default function RideComparisonForm({
  selectedRoute,
  onRouteProcessed,
}: RideComparisonFormProps) {
  // reCAPTCHA integration
  const { executeRecaptcha, isLoaded: isRecaptchaLoaded, error: recaptchaError } = useRecaptcha()

  // Form state
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [showForm, setShowForm] = useState(true)

  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isLoadingDestSuggestions, setIsLoadingDestSuggestions] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Results state
  const [results, setResults] = useState<RideResults | null>(null)
  const [insights, setInsights] = useState('')
  const [error, setError] = useState('')
  const [surgeInfo, setSurgeInfo] = useState<SurgeInfo | null>(null)
  const [timeRecommendations, setTimeRecommendations] = useState<string[]>([])

  // Location state
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null)
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null)

  // Autocomplete suggestions
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([])
  const [destinationSuggestions, setDestinationSuggestions] = useState<LocationSuggestion[]>([])
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)

  // Airport selector state
  const [showAirportSelector, setShowAirportSelector] = useState(false)
  const [airportSelectorMode, setAirportSelectorMode] = useState<'pickup' | 'destination'>('pickup')

  const pickupRef = useRef<HTMLDivElement>(null)
  const destinationRef = useRef<HTMLDivElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()
  const destDebounceTimeoutRef = useRef<NodeJS.Timeout>()

  // Request deduplication - track in-flight request to prevent duplicate submissions
  const currentRequestRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Handle popular route selection
  useEffect(() => {
    if (selectedRoute) {
      setPickup(selectedRoute.pickup)
      setDestination(selectedRoute.destination)
      setShowForm(true) // Ensure form is visible

      // Execute reCAPTCHA immediately in background
      let recaptchaPromise: Promise<string> = Promise.resolve('')
      if (isRecaptchaLoaded) {
        recaptchaPromise = executeRecaptcha(RECAPTCHA_CONFIG.ACTIONS.RIDE_COMPARISON).catch(err => {
          console.warn('reCAPTCHA failed, proceeding without token:', err)
          return ''
        })
      }

      // Auto-submit the form after setting the values
      const submitForm = async () => {
        // Request deduplication for auto-submit
        const requestKey = `${selectedRoute.pickup}-${selectedRoute.destination}`

        // If this exact request is already in flight, ignore
        if (currentRequestRef.current === requestKey) {
          return
        }

        // Abort any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }

        const abortController = new AbortController()
        abortControllerRef.current = abortController
        currentRequestRef.current = requestKey

        setIsLoading(true)
        setResults(null)
        setInsights('')
        setError('')
        setPickupCoords(null)
        setDestinationCoords(null)

        try {
          // Wait for reCAPTCHA to complete (should be fast since it started immediately)
          const recaptchaToken = await recaptchaPromise

          const response = await fetch('/api/compare-rides', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pickup: selectedRoute.pickup,
              destination: selectedRoute.destination,
              recaptchaToken,
            }),
            signal: abortController.signal,
          }).catch(error => {
            if (error.name === 'AbortError') {
              return null
            }
            throw error
          })

          // If request was aborted, exit early
          if (!response) return

          const data = await response.json()

          if (!response.ok) {
            console.error('[AutoSubmit] Error response:', data)
            setError('Failed to fetch ride comparisons for this route. Please try again.')
            return
          }

          setResults(data.comparisons)
          setInsights(data.insights)
          setPickupCoords(data.pickupCoords)
          setDestinationCoords(data.destinationCoords)
          setSurgeInfo(data.surgeInfo || null)
          setTimeRecommendations(data.timeRecommendations || [])
          setShowForm(false)
        } catch (error) {
          console.error('[AutoSubmit] Fetch error:', error)
          setError('Failed to get pricing for this route. Please try again.')
        } finally {
          setIsLoading(false)
          if (currentRequestRef.current === requestKey) {
            currentRequestRef.current = null
            abortControllerRef.current = null
          }
        }
      }

      // Small delay to allow UI to update
      setTimeout(submitForm, AUTO_SUBMIT_DELAY_MS)

      // Call the callback to clear the selected route
      onRouteProcessed?.()
    }
  }, [selectedRoute, onRouteProcessed, isRecaptchaLoaded, executeRecaptcha])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickupRef.current && !pickupRef.current.contains(event.target as Node)) {
        setShowPickupSuggestions(false)
      }
      if (destinationRef.current && !destinationRef.current.contains(event.target as Node)) {
        setShowDestinationSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Enhanced search function that checks common places first
  const searchPlaces = async (query: string): Promise<LocationSuggestion[]> => {
    const normalizedQuery = query.toLowerCase().trim()

    // Check cache first
    if (searchCache.has(normalizedQuery)) {
      return searchCache.get(normalizedQuery)
    }

    // Check common places first
    const commonMatches = Object.entries(COMMON_PLACES)
      .filter(
        ([key, place]) =>
          key.includes(normalizedQuery) ||
          place.name.toLowerCase().includes(normalizedQuery) ||
          place.display_name.toLowerCase().includes(normalizedQuery)
      )
      .map(([key, place]) => ({
        place_id: key,
        display_name: place.display_name,
        name: place.name,
        lat: place.lat,
        lon: place.lon,
      }))

    // If we have good common matches, return them first
    if (commonMatches.length > 0 && normalizedQuery.length >= 3) {
      try {
        // Still fetch from API but combine results
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' California')}&format=json&limit=3&countrycodes=us&addressdetails=1&extratags=1`,
          {
            headers: {
              'User-Agent': 'RideCompareApp/1.0',
            },
          }
        )
        const apiData = await response.json()

        // Combine common places with API results, prioritizing common places
        const combinedResults = [...commonMatches, ...apiData.slice(0, 3)]
        const uniqueResults = combinedResults
          .filter(
            (item, index, self) =>
              index ===
              self.findIndex(
                t =>
                  t.display_name === item.display_name ||
                  (t.name && item.name && t.name === item.name) ||
                  (t.lat &&
                    item.lat &&
                    Math.abs(parseFloat(t.lat) - parseFloat(item.lat)) < 0.001 &&
                    t.lon &&
                    item.lon &&
                    Math.abs(parseFloat(t.lon) - parseFloat(item.lon)) < 0.001)
              )
          )
          .slice(0, 5)

        searchCache.set(normalizedQuery, uniqueResults)
        return uniqueResults
      } catch (error) {
        console.error('API error, using common places:', error)
        searchCache.set(normalizedQuery, commonMatches)
        return commonMatches
      }
    }

    // Fallback to API only
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' California')}&format=json&limit=5&countrycodes=us&addressdetails=1&extratags=1`,
        {
          headers: {
            'User-Agent': 'RideCompareApp/1.0',
          },
        }
      )
      const data = await response.json()
      searchCache.set(normalizedQuery, data)
      return data
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      return []
    }
  }

  // fetch function for pickup
  const debouncedFetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([])
      setShowPickupSuggestions(false)
      return
    }

    setIsLoadingSuggestions(true)
    try {
      const data = await searchPlaces(query)
      setSuggestions(data)
      setShowPickupSuggestions(data.length > 0)
    } catch (error) {
      console.error('Error fetching suggestions:', error)
      setSuggestions([])
      setShowPickupSuggestions(false)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [])

  // fetch function for destination
  const debouncedFetchDestinationSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setDestinationSuggestions([])
      setShowDestinationSuggestions(false)
      return
    }

    setIsLoadingDestSuggestions(true)
    try {
      const data = await searchPlaces(query)
      setDestinationSuggestions(data)
      setShowDestinationSuggestions(data.length > 0)
    } catch (error) {
      console.error('Error fetching destination suggestions:', error)
      setDestinationSuggestions([])
      setShowDestinationSuggestions(false)
    } finally {
      setIsLoadingDestSuggestions(false)
    }
  }, [])

  const handlePickupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPickup(value)

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Set new timeout for search
    debounceTimeoutRef.current = setTimeout(() => {
      debouncedFetchSuggestions(value)
    }, DEBOUNCE_DELAY_MS)
  }

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    setPickup(suggestion.display_name)
    setSuggestions([])
    setShowPickupSuggestions(false)
    // Immediately update coordinates for instant map response
    setPickupCoords([parseFloat(suggestion.lon), parseFloat(suggestion.lat)])
  }

  const handleDestinationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setDestination(value)

    // Clear existing timeout
    if (destDebounceTimeoutRef.current) {
      clearTimeout(destDebounceTimeoutRef.current)
    }

    // Set new timeout for search
    destDebounceTimeoutRef.current = setTimeout(() => {
      debouncedFetchDestinationSuggestions(value)
    }, DEBOUNCE_DELAY_MS)
  }

  const handleDestinationSuggestionClick = (suggestion: LocationSuggestion) => {
    setDestination(suggestion.display_name)
    setDestinationSuggestions([])
    setShowDestinationSuggestions(false)
    // Immediately update coordinates for instant map response
    setDestinationCoords([parseFloat(suggestion.lon), parseFloat(suggestion.lat)])
  }

  // Airport selector handlers
  const handleAirportSelect = (airportCode: string, airportName: string) => {
    const airportString = `${airportName} (${airportCode})`

    // Get airport coordinates from our database
    import('@/lib/airports').then(({ getAirportByCode }) => {
      const airport = getAirportByCode(airportCode)
      if (airport) {
        const coords: [number, number] = [airport.coordinates[0], airport.coordinates[1]]

        if (airportSelectorMode === 'pickup') {
          setPickup(airportString)
          setPickupCoords(coords)
        } else {
          setDestination(airportString)
          setDestinationCoords(coords)
        }
      } else {
        // Fallback if airport not found
        if (airportSelectorMode === 'pickup') {
          setPickup(airportString)
        } else {
          setDestination(airportString)
        }
      }
    })

    setShowAirportSelector(false)
  }

  const openAirportSelector = (mode: 'pickup' | 'destination') => {
    setAirportSelectorMode(mode)
    setShowAirportSelector(true)
  }

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (destDebounceTimeoutRef.current) {
        clearTimeout(destDebounceTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Request deduplication - create a unique key for this request
    const requestKey = `${pickup}-${destination}`

    // If this exact request is already in flight, ignore the duplicate
    if (currentRequestRef.current === requestKey && isLoading) {
      return
    }

    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    currentRequestRef.current = requestKey

    setIsLoading(true)
    setResults(null)
    setInsights('')
    setError('')
    // Clear coordinates when starting a new search
    setPickupCoords(null)
    setDestinationCoords(null)

    try {
      // Execute reCAPTCHA v3 (invisible, no user interaction required)
      let recaptchaToken = ''
      if (isRecaptchaLoaded) {
        try {
          recaptchaToken = await executeRecaptcha(RECAPTCHA_CONFIG.ACTIONS.RIDE_COMPARISON)
        } catch (recaptchaErr) {
          console.warn('reCAPTCHA failed, proceeding without token:', recaptchaErr)
          // Continue without reCAPTCHA token - the server will handle this gracefully
        }
      }

      const response = await fetch('/api/compare-rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup,
          destination,
          recaptchaToken, // Include reCAPTCHA token if available
        }),
        signal: abortController.signal,
      }).catch(error => {
        // Don't throw on abort
        if (error.name === 'AbortError') {
          return null
        }
        console.error('Fetch error:', error)
        throw new Error('Network error')
      })

      // If request was aborted, exit early
      if (!response) return

      const data = await response.json()

      if (!response.ok) {
        if (data.error && data.error.includes('geocode')) {
          setError('Please enter a more specific or valid address for both pickup and destination.')
        } else if (data.error && data.error.includes('required')) {
          setError('Both pickup and destination addresses are required.')
        } else {
          setError('Failed to fetch ride comparisons. Please try again.')
        }
        // Don't set coordinates on error - they should remain null
        return
      }

      setResults(data.comparisons)
      setInsights(data.insights)
      setPickupCoords(data.pickupCoords)
      setDestinationCoords(data.destinationCoords)
      setSurgeInfo(data.surgeInfo || null)
      setTimeRecommendations(data.timeRecommendations || [])
      setShowForm(false)
    } catch (error) {
      console.error('Error:', error)
      // to simulated data for demo purposes
      const basePrice = 15 + Math.random() * 10
      const baseWaitTime = 2 + Math.floor(Math.random() * 5)

      const simulatedResults = {
        uber: {
          price: `$${(basePrice * 1.05).toFixed(2)}`,
          waitTime: `${baseWaitTime} min`,
          driversNearby: Math.floor(3 + Math.random() * 5),
          service: 'UberX',
        },
        lyft: {
          price: `$${(basePrice * 0.95).toFixed(2)}`,
          waitTime: `${baseWaitTime + 1} min`,
          driversNearby: Math.floor(2 + Math.random() * 4),
          service: 'Lyft Standard',
        },
        taxi: {
          price: `$${(basePrice * 1.2).toFixed(2)}`,
          waitTime: `${baseWaitTime + 3} min`,
          driversNearby: Math.floor(1 + Math.random() * 3),
          service: 'Yellow Cab',
        },
      }

      setResults(simulatedResults)
      setInsights(
        'Based on price and wait time, Lyft appears to be your best option for this trip.'
      )
      setError('Note: Using simulated data due to API connection issues.')
      setShowForm(false)
    } finally {
      setIsLoading(false)
      // Clear request tracking
      if (currentRequestRef.current === requestKey) {
        currentRequestRef.current = null
        abortControllerRef.current = null
      }
    }
  }

  // Get user's current location and reverse geocode
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }

    setIsGettingLocation(true)

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const { latitude, longitude } = position.coords

          // Reverse geocode the coordinates
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            {
              headers: {
                'User-Agent': 'RideCompareApp/1.0',
              },
            }
          )
          const data = await response.json()

          if (data.display_name) {
            setPickup(data.display_name)
            // Immediately set coordinates for instant map response
            setPickupCoords([longitude, latitude])
            // Add haptic feedback if supported
            if (navigator.vibrate) {
              navigator.vibrate(50)
            }
          } else {
            setError('Could not determine your location address.')
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error)
          setError('Failed to get your current address.')
        } finally {
          setIsGettingLocation(false)
        }
      },
      error => {
        console.error('Geolocation error:', error)
        setError('Could not access your location. Please check permissions.')
        setIsGettingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    )
  }

  const handleEdit = () => {
    setShowForm(true)
  }

  const handleReset = () => {
    setPickup('')
    setDestination('')
    setResults(null)
    setInsights('')
    setError('')
    setPickupCoords(null)
    setDestinationCoords(null)
    setSuggestions([])
    setDestinationSuggestions([])
    setShowPickupSuggestions(false)
    setShowDestinationSuggestions(false)
    setShowForm(true)
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {!showForm && results && (
        <RouteHeader
          origin={pickup}
          destination={destination}
          onEdit={handleEdit}
          onReset={handleReset}
        />
      )}

      {showForm && (
        <div className="transition-all duration-300">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2 relative" ref={pickupRef}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2 animate-pulse-dot"></span>
                  <label htmlFor="pickup" className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Origin Station
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={isGettingLocation}
                  className="flex items-center text-xs font-mono text-primary hover:text-primary/80 disabled:opacity-50 touch-none select-none transition-colors uppercase tracking-wide"
                  title="Use my current location"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Locate className="h-3 w-3 mr-1" />
                  )}
                  <span className="hidden sm:inline">Locate Me</span>
                  <span className="sm:hidden">📍</span>
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary transform scale-y-0 group-focus-within:scale-y-100 transition-transform duration-200"></div>
                <input
                  id="pickup"
                  placeholder="ENTER PICKUP LOCATION"
                  value={pickup}
                  onChange={handlePickupChange}
                  onFocus={() => {
                    if (pickup.length >= 2) {
                      if (suggestions.length > 0) {
                        setShowPickupSuggestions(true)
                      } else {
                        // Trigger search immediately on focus if there's content
                        debouncedFetchSuggestions(pickup)
                      }
                    }
                  }}
                  className="w-full px-4 py-5 pl-6 bg-muted/30 border-b-2 border-border text-foreground placeholder-muted-foreground/50 focus:border-primary focus:bg-muted/50 transition-all duration-200 outline-none text-lg font-mono tracking-tight rounded-t-sm"
                  required
                />
                {/* Mobile-friendly clear button */}
                {pickup && (
                  <button
                    type="button"
                    onClick={() => setPickup('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors touch-manipulation font-mono text-xs"
                  >
                    [CLR]
                  </button>
                )}
              </div>

              {/* Pickup Suggestions Dropdown */}
              {showPickupSuggestions && (
                <div className="absolute z-10 w-full card-transit mt-1 max-h-60 overflow-y-auto">
                  {isLoadingSuggestions ? (
                    <div className="p-4 text-center text-muted-foreground font-mono text-xs">
                      <span className="animate-pulse">SEARCHING_DATABASE...</span>
                    </div>
                  ) : (
                    suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.place_id || index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="p-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-b-0 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">▶</span>
                          <div>
                            <div className="font-bold text-sm text-foreground font-mono uppercase tracking-tight">
                              {suggestion.name || suggestion.display_name.split(',')[0]}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5 uppercase">
                              {suggestion.display_name}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Airport Quick Select for Pickup */}
            <div className="flex items-center justify-start border-l-2 border-border pl-4 ml-1">
              <button
                type="button"
                onClick={() => openAirportSelector('pickup')}
                className="flex items-center text-xs font-mono text-muted-foreground hover:text-primary transition-colors group"
              >
                <Plane className="h-3 w-3 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                <span className="border-b border-dashed border-muted-foreground/50 group-hover:border-primary">QUICK_SELECT_AIRPORT</span>
              </button>
            </div>

            <div className="space-y-2 relative" ref={destinationRef}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full mr-2 animate-pulse-dot"></span>
                  <label htmlFor="destination" className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Destination Station
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const temp = pickup
                    const tempCoords = pickupCoords
                    setPickup(destination)
                    setDestination(temp)
                    setPickupCoords(destinationCoords)
                    setDestinationCoords(tempCoords)
                    if (navigator.vibrate) {
                      navigator.vibrate(30)
                    }
                  }}
                  className="flex items-center text-xs font-mono text-muted-foreground hover:text-foreground touch-none select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  title="Swap pickup and destination"
                  disabled={!pickup || !destination}
                >
                  <span className="text-sm mr-1">⇅</span>
                  <span className="hidden sm:inline">Reverse Route</span>
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary transform scale-y-0 group-focus-within:scale-y-100 transition-transform duration-200"></div>
                <input
                  id="destination"
                  placeholder="ENTER DESTINATION"
                  value={destination}
                  onChange={handleDestinationChange}
                  onFocus={() => {
                    if (destination.length >= 2) {
                      if (destinationSuggestions.length > 0) {
                        setShowDestinationSuggestions(true)
                      } else {
                        // Trigger search immediately on focus if there's content
                        debouncedFetchDestinationSuggestions(destination)
                      }
                    }
                  }}
                  className="w-full px-4 py-5 pl-6 bg-muted/30 border-b-2 border-border text-foreground placeholder-muted-foreground/50 focus:border-secondary focus:bg-muted/50 transition-all duration-200 outline-none text-lg font-mono tracking-tight rounded-t-sm"
                  required
                />
                {/* Mobile-friendly clear button */}
                {destination && (
                  <button
                    type="button"
                    onClick={() => setDestination('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors touch-manipulation font-mono text-xs"
                  >
                    [CLR]
                  </button>
                )}
              </div>

              {/* Destination Suggestions Dropdown */}
              {showDestinationSuggestions && (
                <div className="absolute z-10 w-full card-transit mt-1 max-h-60 overflow-y-auto">
                  {isLoadingDestSuggestions ? (
                    <div className="p-4 text-center text-muted-foreground font-mono text-xs">
                      <span className="animate-pulse">SEARCHING_DATABASE...</span>
                    </div>
                  ) : (
                    destinationSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.place_id || index}
                        onClick={() => handleDestinationSuggestionClick(suggestion)}
                        className="p-3 hover:bg-muted cursor-pointer border-b border-border/50 last:border-b-0 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-secondary opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs">▶</span>
                          <div>
                            <div className="font-bold text-sm text-foreground font-mono uppercase tracking-tight">
                              {suggestion.name || suggestion.display_name.split(',')[0]}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5 uppercase">
                              {suggestion.display_name}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Airport Quick Select for Destination */}
            <div className="flex items-center justify-start border-l-2 border-border pl-4 ml-1">
              <button
                type="button"
                onClick={() => openAirportSelector('destination')}
                className="flex items-center text-xs font-mono text-muted-foreground hover:text-secondary transition-colors group"
              >
                <Plane className="h-3 w-3 mr-2 group-hover:-translate-y-0.5 transition-transform" />
                <span className="border-b border-dashed border-muted-foreground/50 group-hover:border-secondary">QUICK_SELECT_AIRPORT</span>
              </button>
            </div>

            <button
              type="submit"
              className="group relative w-full bg-foreground text-background py-5 px-6 overflow-hidden transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover-mechanical"
              disabled={isLoading}
              onTouchStart={() => {
                if (navigator.vibrate) {
                  navigator.vibrate(20)
                }
              }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-accent"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-accent opacity-0 group-hover:opacity-100 transition-opacity clip-path-triangle"></div>

              {isLoading ? (
                <div className="flex items-center justify-center font-mono font-bold tracking-widest text-sm">
                  <span className="animate-pulse">CALCULATING_FARES...</span>
                </div>
              ) : (
                <div className="flex items-center justify-between font-mono font-bold tracking-widest text-lg">
                  <span>Compare Rides</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>

            {/* reCAPTCHA Protection Indicator */}
            <div className="flex items-center justify-center text-xs text-muted-foreground mt-2">
              <Shield className="h-3 w-3 mr-1" />
              {isRecaptchaLoaded ? (
                <span className="text-muted-foreground">Protected by reCAPTCHA</span>
              ) : recaptchaError ? (
                <span className="text-primary">Security protection loading...</span>
              ) : (
                <span className="text-muted-foreground/60">Loading security protection...</span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Airport Selector Modal */}
      {showAirportSelector && (
        <div className="fixed inset-0 bg-background/90 flex items-center justify-center z-50 p-4">
          <div className="card-elevated rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Plane className="h-6 w-6 text-secondary" />
                  <div>
                    <div className="font-bold text-foreground text-lg">
                      Select Airport for{' '}
                      {airportSelectorMode === 'pickup' ? 'Pickup' : 'Destination'}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Choose from major U.S. airports
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAirportSelector(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {getPopularAirports().map(airport => (
                  <button
                    key={airport.code}
                    onClick={() => handleAirportSelect(airport.code, airport.name)}
                    className="p-4 text-left hover:bg-muted rounded-lg transition-all duration-200 group border border-border hover:border-secondary/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-foreground group-hover:text-secondary transition-colors">
                          {airport.code} - {airport.name}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {airport.city}, {airport.state}
                        </div>
                        {airport.terminals.length > 1 && (
                          <div className="text-xs text-secondary mt-1">
                            {airport.terminals.length} terminals available
                          </div>
                        )}
                      </div>
                      <MapPin className="h-5 w-5 text-muted-foreground group-hover:text-secondary ml-2 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/50">
              <div className="text-xs text-muted-foreground text-center">
                Don&apos;t see your airport? Use the regular search above for other locations.
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-5 bg-destructive/10 text-destructive rounded-lg border border-destructive/30">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 mr-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      <section className="space-y-6">
        {pickupCoords && destinationCoords && (
          <RouteMap
            key={`${pickupCoords[0]}-${pickupCoords[1]}-${destinationCoords[0]}-${destinationCoords[1]}`}
            pickup={pickupCoords}
            destination={destinationCoords}
          />
        )}

        {results && (
          <RideComparisonResults
            results={results}
            insights={insights}
            surgeInfo={surgeInfo}
            timeRecommendations={timeRecommendations}
            pickup={pickup}
            destination={destination}
            pickupCoords={pickupCoords}
            destinationCoords={destinationCoords}
          />
        )}
      </section>
    </div>
  )
}
