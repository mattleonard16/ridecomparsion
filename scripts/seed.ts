/**
 * Seed script for local development
 * Populates routes and price snapshots for testing
 */

import { prisma } from '../lib/prisma'
import { $Enums } from '../lib/generated/prisma'
import { createHash } from 'crypto'

const ServiceTypeEnum = $Enums.ServiceType
const TrafficLevelEnum = $Enums.TrafficLevel

// Generate route hash for uniqueness
function generateRouteHash(
  pickupLat: number,
  pickupLng: number,
  destLat: number,
  destLng: number
): string {
  const hash = createHash('sha256')
  hash.update(`${pickupLat},${pickupLng},${destLat},${destLng}`)
  return hash.digest('hex').substring(0, 16)
}

const SAMPLE_ROUTES = [
  {
    pickup_address: 'Santa Clara University, Santa Clara, CA',
    pickup_lat: 37.3496,
    pickup_lng: -121.939,
    destination_address: 'San Jose International Airport, San Jose, CA',
    destination_lat: 37.3639,
    destination_lng: -121.9289,
    distance_miles: 5.2,
    duration_minutes: 12,
  },
  {
    pickup_address: 'San Francisco Ferry Building, San Francisco, CA',
    pickup_lat: 37.7956,
    pickup_lng: -122.3933,
    destination_address: 'Golden Gate Bridge, San Francisco, CA',
    destination_lat: 37.8199,
    destination_lng: -122.4783,
    distance_miles: 8.1,
    duration_minutes: 18,
  },
  {
    pickup_address: 'Stanford University, Palo Alto, CA',
    pickup_lat: 37.4275,
    pickup_lng: -122.1697,
    destination_address: 'San Francisco International Airport, San Francisco, CA',
    destination_lat: 37.6213,
    destination_lng: -122.379,
    distance_miles: 24.3,
    duration_minutes: 35,
  },
]

async function seedRoutes() {
  console.log('🌱 Seeding routes...')

  const routeIds: string[] = []

  for (const route of SAMPLE_ROUTES) {
    const routeHash = generateRouteHash(
      route.pickup_lat,
      route.pickup_lng,
      route.destination_lat,
      route.destination_lng
    )

    try {
      const created = await prisma.route.upsert({
        where: { route_hash: routeHash },
        update: {},
        create: {
          ...route,
          route_hash: routeHash,
        },
      })

      routeIds.push(created.id)
      console.log(`✅ Created route: ${route.pickup_address} → ${route.destination_address}`)
    } catch (error) {
      console.error('Error seeding route:', error)
    }
  }

  return routeIds
}

async function seedPriceSnapshots(routeIds: string[]) {
  console.log('🌱 Seeding price snapshots...')

  const services = [ServiceTypeEnum.UBER, ServiceTypeEnum.LYFT, ServiceTypeEnum.TAXI] as const
  const now = new Date()

  for (const routeId of routeIds) {
    // Create snapshots for the past 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      for (let hour = 6; hour <= 22; hour += 2) {
        const timestamp = new Date(now)
        timestamp.setDate(timestamp.getDate() - dayOffset)
        timestamp.setHours(hour, 0, 0, 0)

        for (const service of services) {
          // Generate realistic prices
          const basePrice =
            service === ServiceTypeEnum.UBER ? 15 : service === ServiceTypeEnum.LYFT ? 14 : 18
          const surgeMultiplier =
            (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)
              ? 1.5 + Math.random() * 0.5
              : 1.0 + Math.random() * 0.3

          const finalPrice = basePrice * surgeMultiplier
          const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)

          try {
            await prisma.priceSnapshot.create({
              data: {
                routeId,
                service,
                base_price: basePrice,
                surge_multiplier: surgeMultiplier,
                final_price: finalPrice,
                wait_time_minutes: Math.floor(3 + Math.random() * 8),
                day_of_week: timestamp.getDay(),
                hour_of_day: timestamp.getHours(),
                weather_condition: Math.random() > 0.8 ? 'Rain' : 'Clear',
                weather_temp_f: 55 + Math.floor(Math.random() * 20),
                is_raining: Math.random() > 0.8,
                traffic_level: isRushHour ? TrafficLevelEnum.HEAVY : TrafficLevelEnum.MODERATE,
                nearby_events: [],
              },
            })
          } catch (error) {
            console.error('Error seeding price snapshot:', error)
          }
        }
      }
    }

    console.log(`✅ Created price snapshots for route ${routeId}`)
  }
}

async function main() {
  console.log('🚀 Starting seed script...')

  try {
    const routeIds = await seedRoutes()

    if (routeIds.length > 0) {
      await seedPriceSnapshots(routeIds)
    }

    console.log('✅ Seed completed successfully!')
  } catch (error) {
    console.error('❌ Seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
