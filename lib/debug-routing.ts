// Debug utility for testing OSRM routing issues
// Usage: Import and call testRoute() in browser console

export async function testRoute(
  pickup: [number, number], // [lon, lat]
  destination: [number, number], // [lon, lat]
  logDetails = true
): Promise<{ success: boolean; coordinates?: [number, number][]; error?: string }> {
  const [pickupLon, pickupLat] = pickup
  const [destLon, destLat] = destination

  if (logDetails) {
    console.log('🧪 Testing OSRM Route:')
    console.log(`  Pickup: [${pickupLon}, ${pickupLat}] (lon, lat)`)
    console.log(`  Destination: [${destLon}, ${destLat}] (lon, lat)`)
  }

  // Test multiple OSRM endpoints
  const endpoints = ['https://router.project-osrm.org', 'http://router.project-osrm.org']

  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}/route/v1/driving/${pickupLon},${pickupLat};${destLon},${destLat}?overview=full&geometries=geojson&alternatives=false`

      if (logDetails) {
        console.log(`🌐 Trying: ${url}`)
      }

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RideshareApp-Debug/1.0',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (logDetails) {
        console.log('📦 OSRM Response:', data)
      }

      if (data.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0]
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [
          coord[1], // lat
          coord[0], // lon
        ])

        if (logDetails) {
          console.log(`✅ Success! Route found with ${coordinates.length} waypoints`)
          console.log('📍 First few waypoints:', coordinates.slice(0, 3))
          console.log('📍 Last few waypoints:', coordinates.slice(-3))
        }

        return { success: true, coordinates }
      } else {
        throw new Error(`OSRM error: ${data.code} - ${data.message || 'Unknown error'}`)
      }
    } catch (error) {
      if (logDetails) {
        console.warn(`❌ Failed with ${endpoint}:`, error)
      }
      continue
    }
  }

  const errorMsg = 'All OSRM endpoints failed'
  if (logDetails) {
    console.error('💥', errorMsg)
  }

  return { success: false, error: errorMsg }
}

// Quick test for common problematic routes
export async function testCommonRoutes() {
  console.log('🧪 Testing Common Problematic Routes...\n')

  const routes = [
    {
      name: 'San Jose Airport → Santa Clara',
      pickup: [-121.9289, 37.3639], // SJC
      destination: [-121.9552, 37.3541], // Santa Clara
    },
    {
      name: 'Stanford → Apple Park',
      pickup: [-122.1697, 37.4275], // Stanford
      destination: [-122.009, 37.3349], // Apple Park
    },
    {
      name: 'Santa Clara → SFO',
      pickup: [-121.9552, 37.3541], // Santa Clara
      destination: [-122.379, 37.6213], // SFO
    },
  ]

  for (const route of routes) {
    console.log(`\n🛣️  Testing: ${route.name}`)
    const result = await testRoute(
      route.pickup as [number, number],
      route.destination as [number, number],
      false
    )

    if (result.success) {
      console.log(`✅ SUCCESS - ${result.coordinates?.length} waypoints`)
    } else {
      console.log(`❌ FAILED - ${result.error}`)
    }
  }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  ;(window as any).testRoute = testRoute
  ;(window as any).testCommonRoutes = testCommonRoutes
}
