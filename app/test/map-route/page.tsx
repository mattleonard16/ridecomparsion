'use client'

import { useState, useEffect } from 'react'
import {
  Map,
  MapMarker,
  MarkerContent,
  MapRoute,
  useMap,
  ROUTE_LAYER_PREFIX,
} from '@/components/ui/map'

// Test helpers exposed to window for E2E testing
interface TestMapHelpers {
  map: maplibregl.Map
  getRouteLayerId: () => string | null
}

// Expose map instance and helpers to window for E2E testing
function MapTestHelper() {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (isLoaded && map) {
      // Expose map and helper functions to window for Playwright
      const helpers: TestMapHelpers = {
        map,
        getRouteLayerId: () => {
          // Find the route layer by searching for layers with the exported prefix
          const style = map.getStyle()
          const routeLayer = style?.layers?.find(
            l => l.id.startsWith(ROUTE_LAYER_PREFIX) && l.type === 'line'
          )
          return routeLayer?.id ?? null
        },
      }
      ;(window as unknown as { __testMapHelpers: TestMapHelpers }).__testMapHelpers = helpers
    }
    return () => {
      delete (window as unknown as { __testMapHelpers?: TestMapHelpers }).__testMapHelpers
    }
  }, [map, isLoaded])

  return null
}

export default function MapRouteTestPage() {
  const [interactive, setInteractive] = useState(true)
  const [showDash, setShowDash] = useState(false)
  const [hoverCount, setHoverCount] = useState(0)

  const coordinates: [number, number][] = [
    [-122.44, 37.78], // West side
    [-122.39, 37.78], // East side - horizontal line through center
  ]

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">MapRoute E2E Test Page</h1>

      <div className="mb-4 flex gap-4 flex-wrap">
        <button
          data-testid="toggle-interactive"
          onClick={() => setInteractive(!interactive)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Interactive: {interactive ? 'ON' : 'OFF'}
        </button>
        <button
          data-testid="toggle-dash"
          onClick={() => setShowDash(!showDash)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Dashed: {showDash ? 'ON' : 'OFF'}
        </button>
        <span data-testid="hover-count" className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded">
          Hover count: {hoverCount}
        </span>
      </div>

      <div
        className="h-[500px] w-full rounded-lg overflow-hidden border"
        data-testid="map-container"
      >
        <Map center={[-122.415, 37.78]} zoom={13}>
          <MapTestHelper />
          <MapRoute
            id="test-route"
            coordinates={coordinates}
            interactive={interactive}
            dashArray={showDash ? [10, 10] : undefined}
            onMouseEnter={() => setHoverCount(c => c + 1)}
            width={8}
          />
          <MapMarker longitude={coordinates[0][0]} latitude={coordinates[0][1]}>
            <MarkerContent>
              <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg" />
            </MarkerContent>
          </MapMarker>
          <MapMarker longitude={coordinates[1][0]} latitude={coordinates[1][1]}>
            <MarkerContent>
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg" />
            </MarkerContent>
          </MapMarker>
        </Map>
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>
          <strong>Test instructions:</strong>
        </p>
        <ul className="list-disc ml-5 mt-2 space-y-1">
          <li>
            Hover over the route line - hover count should increment and line should highlight
          </li>
          <li>Toggle Interactive OFF - hovering should NOT increment count or change cursor</li>
          <li>Toggle Dashed ON/OFF - route should switch between dashed and solid</li>
          <li>Toggle theme (if available) - route color should adapt to light/dark mode</li>
        </ul>
      </div>
    </div>
  )
}
