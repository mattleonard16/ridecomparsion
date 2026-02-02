import type { PriceString } from '@/types'

/**
 * Currency parsing and formatting utilities
 * Centralizes all price string manipulation throughout the codebase
 */

/**
 * Parses a price string in "$XX.XX" format to a number
 * @param priceString - The price string to parse (e.g., "$25.50")
 * @returns The numeric value (e.g., 25.50)
 * @throws Error if the price string is invalid or cannot be parsed
 */
export function parsePrice(priceString: string): number {
  if (typeof priceString !== 'string') {
    throw new Error('Price must be a string')
  }

  const trimmed = priceString.trim()
  if (trimmed.length === 0) {
    throw new Error('Price string cannot be empty')
  }

  // Remove dollar sign and any whitespace
  const cleaned = trimmed.replace(/^\$\s*/, '')
  const parsed = Number.parseFloat(cleaned)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid price format: "${priceString}"`)
  }

  return parsed
}

/**
 * Safely parses a price string, returning a default value on failure
 * @param priceString - The price string to parse
 * @param defaultValue - Value to return if parsing fails (default: 0)
 * @returns The parsed price or the default value
 */
export function parsePriceSafe(priceString: string, defaultValue: number = 0): number {
  try {
    return parsePrice(priceString)
  } catch {
    return defaultValue
  }
}

/**
 * Formats a number to a price string in "$XX.XX" format
 * @param amount - The numeric amount to format
 * @returns The formatted price string (e.g., "$25.50")
 * @throws Error if the amount is not a valid number
 */
export function formatPrice(amount: number): PriceString {
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    throw new Error('Amount must be a valid number')
  }

  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be finite')
  }

  return `$${amount.toFixed(2)}`
}

/**
 * Safely formats a number to a price string, returning a default on failure
 * @param amount - The numeric amount to format
 * @param defaultValue - Value to return if formatting fails (default: "$0.00")
 * @returns The formatted price string or the default value
 */
export function formatPriceSafe(amount: number, defaultValue: PriceString = '$0.00'): PriceString {
  try {
    return formatPrice(amount)
  } catch {
    return defaultValue
  }
}

/**
 * Rounds a price to the nearest cent (2 decimal places)
 * @param amount - The numeric amount to round
 * @returns The rounded amount
 */
export function roundToNearestCent(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Parses a wait time string in "X min" format to minutes
 * @param waitTimeString - The wait time string to parse (e.g., "5 min")
 * @returns The numeric value in minutes
 * @throws Error if the wait time string is invalid
 */
export function parseWaitTime(waitTimeString: string): number {
  if (typeof waitTimeString !== 'string') {
    throw new Error('Wait time must be a string')
  }

  const trimmed = waitTimeString.trim()
  if (trimmed.length === 0) {
    throw new Error('Wait time string cannot be empty')
  }

  // Remove " min" suffix and parse
  const cleaned = trimmed.replace(/\s*min\s*$/i, '')
  const parsed = Number.parseInt(cleaned, 10)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid wait time format: "${waitTimeString}"`)
  }

  return parsed
}

/**
 * Safely parses a wait time string, returning a default value on failure
 * @param waitTimeString - The wait time string to parse
 * @param defaultValue - Value to return if parsing fails (default: 0)
 * @returns The parsed wait time or the default value
 */
export function parseWaitTimeSafe(waitTimeString: string, defaultValue: number = 0): number {
  try {
    return parseWaitTime(waitTimeString)
  } catch {
    return defaultValue
  }
}

/**
 * Formats minutes to a wait time string in "X min" format
 * @param minutes - The number of minutes
 * @returns The formatted wait time string (e.g., "5 min")
 */
export function formatWaitTime(minutes: number): string {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) {
    throw new Error('Minutes must be a valid number')
  }

  return `${Math.round(minutes)} min`
}

/**
 * Formats a surge multiplier for display
 * @param multiplier - The surge multiplier value
 * @param threshold - Only format if above this threshold (default: 1.05)
 * @returns The formatted surge string (e.g., "1.25x") or undefined if below threshold
 */
export function formatSurgeMultiplier(
  multiplier: number,
  threshold: number = 1.05
): string | undefined {
  if (multiplier <= threshold) {
    return undefined
  }

  return `${multiplier.toFixed(2)}x`
}

/**
 * Compares two price strings and returns the difference
 * @param price1 - First price string
 * @param price2 - Second price string
 * @returns The difference (price1 - price2)
 */
export function comparePrices(price1: string, price2: string): number {
  return parsePrice(price1) - parsePrice(price2)
}

/**
 * Calculates the average of multiple price strings
 * @param prices - Array of price strings
 * @returns The average price as a number
 * @throws Error if the array is empty
 */
export function averagePrice(prices: readonly string[]): number {
  if (prices.length === 0) {
    throw new Error('Cannot calculate average of empty array')
  }

  const sum = prices.reduce((acc, price) => acc + parsePrice(price), 0)
  return roundToNearestCent(sum / prices.length)
}

/**
 * Finds the minimum price from an array of price strings
 * @param prices - Array of price strings
 * @returns The minimum price as a number
 * @throws Error if the array is empty
 */
export function minPrice(prices: readonly string[]): number {
  if (prices.length === 0) {
    throw new Error('Cannot find minimum of empty array')
  }

  return Math.min(...prices.map(parsePrice))
}

/**
 * Finds the maximum price from an array of price strings
 * @param prices - Array of price strings
 * @returns The maximum price as a number
 * @throws Error if the array is empty
 */
export function maxPrice(prices: readonly string[]): number {
  if (prices.length === 0) {
    throw new Error('Cannot find maximum of empty array')
  }

  return Math.max(...prices.map(parsePrice))
}
