import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { useEffect, useState, memo, useCallback, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom icons for pickup and destination
const pickupIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const destinationIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// Performance monitoring removed - check console logs instead

// Enhanced map controller with smooth transitions
function MapViewController({
  pickup,
  destination,
  routeCoordinates,
  isRouteLoading,
  onUpdateTiming,
}: {
  pickup: [number, number]
  destination: [number, number]
  routeCoordinates: [number, number][]
  isRouteLoading: boolean
  onUpdateTiming: (time: number) => void
}) {
  const map = useMap()
  const hasInitialized = useRef(false)
  const updateStartTime = useRef<number>()

  useEffect(() => {
    if (!map) return

    updateStartTime.current = performance.now()

    // Immediate markers update - don't wait for route
    const markerBounds = L.latLngBounds([
      [pickup[1], pickup[0]],
      [destination[1], destination[0]],
    ])

    // Add padding to ensure markers are visible
    const paddedBounds = markerBounds.pad(0.1)

    if (!hasInitialized.current) {
      // First load - instant fit
      map.fitBounds(paddedBounds, {
        padding: [20, 20],
        animate: false, // No animation on first load for speed
      })
      hasInitialized.current = true
    } else {
      // Subsequent updates - smooth fly animation
      map.flyToBounds(paddedBounds, {
        padding: [20, 20],
        duration: 1.0, // 1 second smooth animation
        easeLinearity: 0.25,
      })
    }

    // Report timing when animation completes
    const timing = performance.now() - updateStartTime.current
    onUpdateTiming(timing)
  }, [map, pickup, destination, onUpdateTiming])

  // Separate effect for route-based bounds (optional refinement)
  useEffect(() => {
    if (!map || !routeCoordinates.length || isRouteLoading) return

    // When route loads, optionally refine the bounds (subtle adjustment)
    const routeBounds = L.latLngBounds(routeCoordinates)
    const currentBounds = map.getBounds()

    // Only adjust if route extends significantly beyond current view
    if (!currentBounds.contains(routeBounds)) {
      map.flyToBounds(routeBounds, {
        padding: [15, 15],
        duration: 0.8,
        easeLinearity: 0.25,
      })
    }
  }, [map, routeCoordinates, isRouteLoading])

  return null
}

// Loading indicator component
function RouteLoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null

  return (
    <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium text-gray-700">Loading route...</span>
      </div>
    </div>
  )
}

type RouteMapClientProps = {
  pickup: [number, number] // [lon, lat]
  destination: [number, number] // [lon, lat]
}

const RouteMapClient = ({ pickup, destination }: RouteMapClientProps) => {
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([])
  const [isRouteLoading, setIsRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(false)
  const [updateCount, setUpdateCount] = useState(0)
  const [lastUpdateTime, setLastUpdateTime] = useState(0)
  const [routeLoadTime, setRouteLoadTime] = useState<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()

  // Optimized center calculation
  const center: [number, number] = [
    (pickup[1] + destination[1]) / 2,
    (pickup[0] + destination[0]) / 2,
  ]

  // Timing callback
  const handleUpdateTiming = useCallback((time: number) => {
    setLastUpdateTime(Math.round(time))
    setUpdateCount(prev => prev + 1)
  }, [])

  // Enhanced route fetching with HTTPS and better debugging
  const fetchRoute = useCallback(
    async (pickupCoords: [number, number], destCoords: [number, number], signal: AbortSignal) => {
      const routeStartTime = performance.now()

      try {
        const [pickupLon, pickupLat] = pickupCoords
        const [destLon, destLat] = destCoords

        // Use HTTPS endpoint to avoid mixed content issues
        const url = `https://router.project-osrm.org/route/v1/driving/${pickupLon},${pickupLat};${destLon},${destLat}?overview=full&geometries=geojson&alternatives=false`

        const response = await fetch(url, {
          signal,
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          mode: 'cors',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.code === 'Ok' && data.routes?.length > 0) {
          const route = data.routes[0]

          if (!route.geometry?.coordinates) {
            throw new Error('Route geometry missing')
          }

          // Convert coordinates from [lon, lat] to [lat, lon] for Leaflet
          const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [
            coord[1], // latitude
            coord[0], // longitude
          ])

          setRouteCoordinates(coordinates)
          setRouteError(false)
          setRouteLoadTime(Math.round(performance.now() - routeStartTime))
        } else {
          throw new Error(`OSRM error: ${data.code} - ${data.message || 'No route found'}`)
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.name : 'Unknown error'
        if (errorMessage === 'AbortError') return // Ignore aborted requests

        // Fallback to straight line on error
        setRouteCoordinates([
          [pickupCoords[1], pickupCoords[0]], // [lat, lon]
          [destCoords[1], destCoords[0]], // [lat, lon]
        ])
        setRouteError(true)
        setRouteLoadTime(Math.round(performance.now() - routeStartTime))
      }
    },
    []
  )

  // Effect with debouncing and cancellation
  useEffect(() => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Start loading immediately for UI feedback
    setIsRouteLoading(true)

    // Debounce route fetching to avoid spam
    debounceTimeoutRef.current = setTimeout(async () => {
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      await fetchRoute(pickup, destination, abortController.signal)

      // Only set loading false if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setIsRouteLoading(false)
      }
    }, 300) // 300ms debounce

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [pickup, destination, fetchRoute])

  // Generate a unique key to force map updates when locations change significantly
  const mapKey = `${pickup[0].toFixed(3)}-${pickup[1].toFixed(3)}-${destination[0].toFixed(3)}-${destination[1].toFixed(3)}`

  return (
    <div className="mt-4 relative">
      <MapContainer
        key={mapKey}
        center={center}
        zoom={10}
        style={{ height: 300, width: '100%' }}
        className="rounded-lg overflow-hidden"
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        />

        {/* Pickup marker (green) */}
        <Marker position={[pickup[1], pickup[0]]} icon={pickupIcon} />

        {/* Destination marker (red) */}
        <Marker position={[destination[1], destination[0]]} icon={destinationIcon} />

        {/* Route polyline with loading state */}
        {routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            color={routeError ? '#ef4444' : '#2563eb'}
            weight={4}
            opacity={isRouteLoading ? 0.4 : 0.8}
            dashArray={routeError ? '10, 10' : undefined}
          />
        )}

        {/* Map view controller */}
        <MapViewController
          pickup={pickup}
          destination={destination}
          routeCoordinates={routeCoordinates}
          isRouteLoading={isRouteLoading}
          onUpdateTiming={handleUpdateTiming}
        />
      </MapContainer>

      {/* Loading indicator overlay */}
      <RouteLoadingIndicator isLoading={isRouteLoading} />

      {/* Error indicator */}
      {routeError && !isRouteLoading && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-xs text-orange-700">Using direct route</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(RouteMapClient)
