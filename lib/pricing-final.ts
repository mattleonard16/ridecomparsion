import type { Coordinates, ServiceType } from '@/types'
import { kmToMiles } from './location'
import { isAirportLocation } from './airports'

// Production pricing configuration - calibrated based on real data
const PRICING_CONFIG = {
  version: "2024.2",
  services: {
    uber: {
      base: 2.15,          
      perMile: 1.38,       
      perMin: 0.32,       
      booking: 1.45,
      safetyFee: 0.65,
      minFare: 9.25,
      airportPickupFee: 5.50,  
      airportDropoffFee: 2.75, 
      cbdSurcharge: 2.50,      
      longRideFee: { threshold: 25, fee: 4.50 } 
    },
    lyft: {
      base: 2.05,
      perMile: 1.28,
      perMin: 0.28,
      booking: 1.25,
      safetyFee: 0.55,
      minFare: 8.95,
      airportPickupFee: 5.25,
      airportDropoffFee: 2.50,
      cbdSurcharge: 2.25,
      longRideFee: { threshold: 25, fee: 4.25 }
    },
    taxi: {
      base: 4.25,
      perMile: 3.15,
      perMin: 0.65,
      booking: 0.0,
      safetyFee: 0.0,
      minFare: 15.0,
      airportPickupFee: 6.50,
      airportDropoffFee: 0.0,
      cbdSurcharge: 3.00,
      longRideFee: { threshold: 30, fee: 5.00 }
    }
  },
  surgeSchedule: {
    weekday: {
      6: 1.05, 7: 1.15, 8: 1.35, 9: 1.15,    
      17: 1.15, 18: 1.45, 19: 1.25,          
      23: 1.15, 0: 1.15, 1: 1.05, 2: 1.05    
    },
    weekend: {
      10: 1.0, 12: 1.05, 14: 1.0,
      18: 1.1, 20: 1.25, 22: 1.45, 0: 1.65, 1: 1.65, 2: 1.35
    }
  },
  locationModifiers: {
    airports: { lateNight: 1.15, peakHours: 1.25 },     
    downtown: { businessHours: 1.1, nightlife: 1.25 }   
  }
}

interface PricingInput {
  service: ServiceType
  pickupCoords: Coordinates
  destCoords: Coordinates
  distanceKm: number
  durationMin: number
  timestamp?: Date
  osrmDurationSec?: number
  expectedDurationSec?: number
}

interface PricingBreakdown {
  baseFare: number
  distanceFee: number
  timeFee: number
  bookingFee: number
  safetyFee: number
  airportFees: number
  locationSurcharge: number
  longRideFee: number
  subtotal: number
  surgeMultiplier: number
  surgeFee: number
  trafficMultiplier: number
  trafficFee: number
  finalFare: number
  appliedMinFare: boolean
  confidence: number
}

interface PricingResult {
  price: number
  breakdown: PricingBreakdown
  surgeReason: string
  debugInfo?: any
}

export class EnhancedPricingEngine {
  private config = PRICING_CONFIG
  private isDebug = process.env.NODE_ENV === 'development'

  private log(message: string, data?: any) {
    if (this.isDebug) {
      console.debug(`[PRICING] ${message}`, data || '')
    }
  }

  private isAirport(coords: Coordinates) {
    return isAirportLocation(coords)
  }

  private isDowntown(coords: Coordinates): boolean {
    const [lon, lat] = coords
    // SF Financial District
    if (lat >= 37.785 && lat <= 37.805 && lon >= -122.415 && lon <= -122.395) return true
    // Downtown SJ
    if (lat >= 37.325 && lat <= 37.345 && lon >= -121.895 && lon <= -121.875) return true
    return false
  }

  private getTimeBasedMultiplier(
    pickupCoords: Coordinates,
    destCoords: Coordinates,
    timestamp: Date = new Date()
  ): { multiplier: number; surgeReason: string } {
    const hour = timestamp.getHours()
    const day = timestamp.getDay()
    const isWeekend = day === 0 || day === 6

    // Get base surge from schedule
    const scheduleType = isWeekend ? 'weekend' : 'weekday'
    const schedule = this.config.surgeSchedule[scheduleType]
    let baseSurge = schedule[hour as keyof typeof schedule] || 1.0

    // Location-based modifiers
    const isAirportRoute = this.isAirport(pickupCoords) !== null || this.isAirport(destCoords) !== null
    const isLateNight = hour >= 23 || hour <= 5
    const isPeakHours = (!isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)))

    let locationMultiplier = 1.0
    let reason = 'Standard pricing'

    if (isAirportRoute) {
      if (isLateNight) {
        locationMultiplier = this.config.locationModifiers.airports.lateNight
        reason = 'Late night airport premium'
      } else if (isPeakHours) {
        locationMultiplier = this.config.locationModifiers.airports.peakHours
        reason = 'Peak hours airport demand'
      } else {
        reason = 'Airport route'
      }
    } else if (isLateNight) {
      reason = 'Late night premium'
    } else if (isPeakHours) {
      reason = 'Rush hour demand'
    }

    if (this.isDowntown(pickupCoords) || this.isDowntown(destCoords)) {
      const isBusinessHours = hour >= 9 && hour <= 17
      const isNightlife = hour >= 20 || hour <= 2
      
      if (isBusinessHours) {
        locationMultiplier *= this.config.locationModifiers.downtown.businessHours
        reason = reason === 'Standard pricing' ? 'Downtown business hours' : reason + ' + downtown'
      } else if (isNightlife) {
        locationMultiplier *= this.config.locationModifiers.downtown.nightlife
        reason = reason === 'Standard pricing' ? 'Downtown nightlife' : reason + ' + nightlife'
      }
    }

    const finalMultiplier = Math.min(baseSurge * locationMultiplier, 2.5)

    this.log(`Surge calculation: base=${baseSurge.toFixed(2)}, location=${locationMultiplier.toFixed(2)}, final=${finalMultiplier.toFixed(2)} (${reason})`)

    return { multiplier: finalMultiplier, surgeReason: reason }
  }

  private calculateTrafficMultiplier(
    osrmDurationSec?: number,
    expectedDurationSec?: number
  ): { multiplier: number; reason: string } {
    if (!osrmDurationSec || !expectedDurationSec) {
      return { multiplier: 1.0, reason: 'No traffic data' }
    }

    const ratio = osrmDurationSec / expectedDurationSec
    
    if (ratio > 1.5) {
      return { multiplier: 1.25, reason: 'Heavy traffic congestion' }
    } else if (ratio > 1.3) {
      return { multiplier: 1.15, reason: 'Moderate traffic' }
    } else if (ratio > 1.1) {
      return { multiplier: 1.05, reason: 'Light traffic' }
    }
    
    return { multiplier: 1.0, reason: 'Normal traffic conditions' }
  }

  public calculateFare(input: PricingInput): PricingResult {
    const { service, pickupCoords, destCoords, distanceKm, durationMin, timestamp = new Date(), osrmDurationSec, expectedDurationSec } = input
    
    const config = this.config.services[service]
    if (!config) {
      throw new Error(`Service ${service} not supported`)
    }

    this.log(`Calculating fare for ${service}`, { distanceKm, durationMin, pickup: pickupCoords, dest: destCoords })

    // 1. Base calculations
    const distanceMiles = kmToMiles(distanceKm)
    const baseFare = config.base
    const distanceFee = distanceMiles * config.perMile
    const timeFee = durationMin * config.perMin
    const bookingFee = config.booking
    const safetyFee = config.safetyFee

    // 2. Location-based fees
    let airportFees = 0
    let locationSurcharge = 0
    let longRideFee = 0

    // Airport fees
    const isPickupAirport = this.isAirport(pickupCoords) !== null
    const isDestAirport = this.isAirport(destCoords) !== null
    
    if (isPickupAirport) airportFees += config.airportPickupFee
    if (isDestAirport) airportFees += config.airportDropoffFee

    // Downtown surcharge
    if (this.isDowntown(pickupCoords) || this.isDowntown(destCoords)) {
      const hour = timestamp.getHours()
      const isBusinessHours = hour >= 9 && hour <= 17
      const isNightlife = hour >= 20 || hour <= 2
      
      if (isBusinessHours) {
        locationSurcharge = config.cbdSurcharge * 0.6
      } else if (isNightlife) {
        locationSurcharge = config.cbdSurcharge * 0.9
      } else {
        locationSurcharge = config.cbdSurcharge * 0.7
      }
    }

    // Long ride fee
    if (distanceMiles >= config.longRideFee.threshold) {
      longRideFee = config.longRideFee.fee
    }

    // 3. Calculate surge and traffic
    const { multiplier: surgeMultiplier, surgeReason } = this.getTimeBasedMultiplier(pickupCoords, destCoords, timestamp)
    const { multiplier: trafficMultiplier, reason: trafficReason } = this.calculateTrafficMultiplier(osrmDurationSec, expectedDurationSec)

    // 4. Calculate total
    const subtotal = baseFare + distanceFee + timeFee + bookingFee + safetyFee + airportFees + locationSurcharge + longRideFee
    const fareWithSurge = subtotal * surgeMultiplier
    const fareWithTraffic = fareWithSurge * trafficMultiplier
    const finalFare = Math.max(fareWithTraffic, config.minFare)

    // 5. Calculate confidence score
    let confidence = 0.9
    if (surgeMultiplier > 2.0) confidence -= 0.15
    else if (surgeMultiplier > 1.5) confidence -= 0.1
    
    if (distanceKm > 50) confidence -= 0.15
    else if (distanceKm > 25) confidence -= 0.1

    const hour = timestamp.getHours()
    if (hour >= 1 && hour <= 5) confidence -= 0.1

    confidence = Math.max(confidence, 0.5)

    const breakdown: PricingBreakdown = {
      baseFare,
      distanceFee,
      timeFee,
      bookingFee,
      safetyFee,
      airportFees,
      locationSurcharge,
      longRideFee,
      subtotal,
      surgeMultiplier,
      surgeFee: subtotal * (surgeMultiplier - 1),
      trafficMultiplier,
      trafficFee: fareWithSurge * (trafficMultiplier - 1),
      finalFare,
      appliedMinFare: finalFare === config.minFare,
      confidence
    }

    this.log(`Final fare calculation`, {
      subtotal: subtotal.toFixed(2),
      surge: `${surgeMultiplier.toFixed(2)}x`,
      traffic: `${trafficMultiplier.toFixed(2)}x`,
      final: finalFare.toFixed(2),
      confidence: `${(confidence * 100).toFixed(1)}%`
    })

    return {
      price: finalFare,
      breakdown,
      surgeReason,
      debugInfo: this.isDebug ? {
        config: config,
        inputs: input,
        calculations: {
          distanceMiles,
          isPickupAirport,
          isDestAirport,
          isDowntown: this.isDowntown(pickupCoords) || this.isDowntown(destCoords),
          trafficReason
        }
      } : undefined
    }
  }
}

// Singleton instance
export const pricingEngine = new EnhancedPricingEngine()

// Convenience function for backward compatibility
export function calculateEnhancedFare(
  service: ServiceType,
  pickupCoords: Coordinates,
  destCoords: Coordinates,
  distanceKm: number,
  durationMin: number,
  timestamp?: Date
): PricingResult {
  return pricingEngine.calculateFare({
    service,
    pickupCoords,
    destCoords,
    distanceKm,
    durationMin,
    timestamp
  })
}

// Time recommendation functions
export function getTimeBasedMultiplier(
  pickupCoords: Coordinates,
  destCoords: Coordinates,
  timestamp?: Date
): { multiplier: number; surgeReason: string } {
  return pricingEngine['getTimeBasedMultiplier'](pickupCoords, destCoords, timestamp)
}

export function getBestTimeRecommendations(): string[] {
  const now = new Date()
  const hour = now.getHours()

  // Show only 2 most relevant tips based on current time
  if (hour >= 14 && hour <= 16) {
    return [
      "Great timing! You're booking during off-peak hours with potential savings",
      'Best prices are typically 2-4 PM (avoid rush hours for optimal rates)',
    ]
  } else if (hour >= 7 && hour <= 9) {
    return [
      'Morning rush pricing in effect. Expect 15-35% increase over standard rates',
      'Best prices: 2-4 PM (off-peak rates available)',
    ]
  } else if (hour >= 17 && hour <= 19) {
    return [
      'Evening rush pricing. Consider waiting until after 8 PM for better rates',
      'Best prices: 2-4 PM (off-peak rates available)',
    ]
  } else if (hour >= 20 || hour <= 5) {
    return [
      'Late night premium in effect (15-25% increase for night service)',
      'Best prices: 2-4 PM (avoid peak hours for optimal savings)',
    ]
  } else {
    return [
      'Good timing! Standard rates currently in effect',
      'Avoid rush hours: 7-9 AM and 5-7 PM (up to 35% increase)',
    ]
  }
} 
