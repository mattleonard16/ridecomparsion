'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Navigation2, Loader2, Locate, Shield, Plane } from 'lucide-react'
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

// Cache for API results
const searchCache = new Map()

interface RideComparisonFormProps {
  selectedRoute?: {
    pickup: string
    destination: string
  } | null
  onRouteProcessed?: () => void
}

export default function RideComparisonForm({ selectedRoute, onRouteProcessed }: RideComparisonFormProps) {
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // reCAPTCHA integration
  const { executeRecaptcha, isLoaded: isRecaptchaLoaded, error: recaptchaError } = useRecaptcha()
  const [results, setResults] = useState<{
    uber: {
      price: string
      waitTime: string
      driversNearby: number
      service: string
      surgeMultiplier?: string
    }
    lyft: {
      price: string
      waitTime: string
      driversNearby: number
      service: string
      surgeMultiplier?: string
    }
    taxi: {
      price: string
      waitTime: string
      driversNearby: number
      service: string
      surgeMultiplier?: string
    }
  } | null>(null)
  const [insights, setInsights] = useState('')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<
    Array<{ display_name: string; lat: string; lon: string; name?: string; place_id?: string }>
  >([])
  const [destinationSuggestions, setDestinationSuggestions] = useState<
    Array<{ display_name: string; lat: string; lon: string; name?: string; place_id?: string }>
  >([])
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null)
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null)
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isLoadingDestSuggestions, setIsLoadingDestSuggestions] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [showForm, setShowForm] = useState(true)
  const [surgeInfo, setSurgeInfo] = useState<{
    isActive: boolean
    reason: string
    multiplier: number
  } | null>(null)
  const [timeRecommendations, setTimeRecommendations] = useState<string[]>([])
  const [showAirportSelector, setShowAirportSelector] = useState(false)
  const [airportSelectorMode, setAirportSelectorMode] = useState<'pickup' | 'destination'>('pickup')
  // const [showPriceAlert, setShowPriceAlert] = useState(false)
  // const [priceAlertThreshold, setPriceAlertThreshold] = useState("")

  const pickupRef = useRef<HTMLDivElement>(null)
  const destinationRef = useRef<HTMLDivElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()
  const destDebounceTimeoutRef = useRef<NodeJS.Timeout>()

  // Handle popular route selection
  useEffect(() => {
    if (selectedRoute) {
      setPickup(selectedRoute.pickup)
      setDestination(selectedRoute.destination)
      setShowForm(true) // Ensure form is visible
      
      // Auto-submit the form after setting the values
      const submitForm = async () => {
        setIsLoading(true)
        setResults(null)
        setInsights('')
        setError('')
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
            }
          }

          const response = await fetch('/api/compare-rides', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              pickup: selectedRoute.pickup, 
              destination: selectedRoute.destination,
              recaptchaToken
            }),
          })

          const data = await response.json()

          if (!response.ok) {
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
          console.error('Error:', error)
          setError('Failed to get pricing for this route. Please try again.')
        } finally {
          setIsLoading(false)
        }
      }

      // Small delay to allow UI to update
      setTimeout(submitForm, 200)
      
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
  const searchPlaces = async (
    query: string
  ): Promise<
    Array<{ display_name: string; lat: string; lon: string; name?: string; place_id?: string }>
  > => {
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
    }, 300) // 300ms delay
  }

  const handleSuggestionClick = (suggestion: {
    display_name: string
    lat: string
    lon: string
    name?: string
    place_id?: string
  }) => {
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

    // Set new timeout for  search
    destDebounceTimeoutRef.current = setTimeout(() => {
      debouncedFetchDestinationSuggestions(value)
    }, 300) // 300ms delay
  }

  const handleDestinationSuggestionClick = (suggestion: {
    display_name: string
    lat: string
    lon: string
    name?: string
    place_id?: string
  }) => {
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
          recaptchaToken // Include reCAPTCHA token if available
        }),
      }).catch(error => {
        console.error('Fetch error:', error)
        throw new Error('Network error')
      })

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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 relative" ref={pickupRef}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                  <label htmlFor="pickup" className="font-semibold text-white">
                    Pickup Location
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={isGettingLocation}
                  className="flex items-center text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 touch-none select-none transition-colors"
                  title="Use my current location"
                >
                  {isGettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Locate className="h-4 w-4 mr-1" />
                  )}
                  <span className="hidden sm:inline">Use Location</span>
                  <span className="sm:hidden">📍</span>
                </button>
              </div>
              <div className="relative">
                <input
                  id="pickup"
                  placeholder="Enter pickup location (e.g., Santa Clara University, Cupertino)"
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
                  className="w-full px-4 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-white/10 transition-all duration-300 outline-none text-base"
                  required
                />
                {/* Mobile-friendly clear button */}
                {pickup && (
                  <button
                    type="button"
                    onClick={() => setPickup('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors touch-manipulation"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Pickup Suggestions Dropdown */}
              {showPickupSuggestions && (
                <div className="absolute z-10 w-full glass-card-strong rounded-xl shadow-2xl max-h-60 overflow-y-auto border border-white/20 mt-2">
                  {isLoadingSuggestions ? (
                    <div className="p-4 text-center text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading suggestions...
                    </div>
                  ) : (
                    suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.place_id || index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="p-4 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-sm text-white">
                          {suggestion.name || suggestion.display_name.split(',')[0]}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-1">
                          {suggestion.display_name}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Airport Quick Select for Pickup */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => openAirportSelector('pickup')}
                className="flex items-center px-5 py-2.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all duration-300 border border-blue-500/20 hover:border-blue-500/40"
              >
                <Plane className="h-4 w-4 mr-2" />
                Select Airport for Pickup
              </button>
            </div>

            <div className="space-y-2 relative" ref={destinationRef}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Navigation2 className="h-5 w-5 text-gray-400 mr-2" />
                  <label htmlFor="destination" className="font-semibold text-white">
                    Destination
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
                    // Add haptic feedback
                    if (navigator.vibrate) {
                      navigator.vibrate(30)
                    }
                  }}
                  className="flex items-center text-sm text-blue-400 hover:text-blue-300 touch-none select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Swap pickup and destination"
                  disabled={!pickup || !destination}
                >
                  <span className="text-lg">↕</span>
                  <span className="hidden sm:inline ml-1">Swap</span>
                </button>
              </div>
              <div className="relative">
                <input
                  id="destination"
                  placeholder="Enter destination (e.g., San Jose Airport, SFO)"
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
                  className="w-full px-4 py-4 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-white/10 transition-all duration-300 outline-none text-base"
                  required
                />
                {/* Mobile-friendly clear button */}
                {destination && (
                  <button
                    type="button"
                    onClick={() => setDestination('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors touch-manipulation"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Destination Suggestions Dropdown */}
              {showDestinationSuggestions && (
                <div className="absolute z-10 w-full glass-card-strong rounded-xl shadow-2xl max-h-60 overflow-y-auto border border-white/20 mt-2">
                  {isLoadingDestSuggestions ? (
                    <div className="p-4 text-center text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading suggestions...
                    </div>
                  ) : (
                    destinationSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.place_id || index}
                        onClick={() => handleDestinationSuggestionClick(suggestion)}
                        className="p-4 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-sm text-white">
                          {suggestion.name || suggestion.display_name.split(',')[0]}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-1">
                          {suggestion.display_name}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Airport Quick Select for Destination */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => openAirportSelector('destination')}
                className="flex items-center px-5 py-2.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition-all duration-300 border border-blue-500/20 hover:border-blue-500/40"
              >
                <Plane className="h-4 w-4 mr-2" />
                Select Airport for Destination
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-5 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold touch-manipulation shadow-lg hover:shadow-purple-500/50 hover-lift"
              disabled={isLoading}
              onTouchStart={() => {
                // Add haptic feedback on touch start
                if (navigator.vibrate) {
                  navigator.vibrate(20)
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Finding rides...
                </div>
              ) : (
                '🚀 Compare Prices'
              )}
            </button>
            
            {/* reCAPTCHA Protection Indicator */}
            <div className="flex items-center justify-center text-xs text-gray-500 mt-2">
              <Shield className="h-3 w-3 mr-1" />
              {isRecaptchaLoaded ? (
                <span className="text-gray-400">Protected by reCAPTCHA</span>
              ) : recaptchaError ? (
                <span className="text-orange-400">Security protection loading...</span>
              ) : (
                <span className="text-gray-500">Loading security protection...</span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Airport Selector Modal */}
      {showAirportSelector && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card-strong rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden border border-white/20 shadow-2xl">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Plane className="h-6 w-6 text-blue-400" />
                  <div>
                    <div className="font-semibold text-white text-lg">
                      Select Airport for {airportSelectorMode === 'pickup' ? 'Pickup' : 'Destination'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">Choose from major U.S. airports</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAirportSelector(false)}
                  className="text-gray-400 hover:text-white transition-colors text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                {getPopularAirports().map((airport) => (
                  <button
                    key={airport.code}
                    onClick={() => handleAirportSelect(airport.code, airport.name)}
                    className="p-4 text-left hover:bg-white/10 rounded-xl transition-all duration-300 group border border-white/5 hover:border-blue-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {airport.code} - {airport.name}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {airport.city}, {airport.state}
                        </div>
                        {airport.terminals.length > 1 && (
                          <div className="text-xs text-blue-400 mt-1">
                            {airport.terminals.length} terminals available
                          </div>
                        )}
                      </div>
                      <MapPin className="h-5 w-5 text-gray-500 group-hover:text-blue-400 ml-2 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-white/5">
              <div className="text-xs text-gray-400 text-center">
                Don&apos;t see your airport? Use the regular search above for other locations.
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 backdrop-blur-sm">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
          />
        )}
      </section>
    </div>
  )
}
