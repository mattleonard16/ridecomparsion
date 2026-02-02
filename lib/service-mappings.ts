/**
 * Service type mapping utilities.
 *
 * Centralizes the mapping between application service strings and Prisma ServiceType enums.
 * This avoids code duplication across database-logging.ts, database-pricing-stats.ts, etc.
 */

import { $Enums, type ServiceType } from '@/lib/generated/prisma'

// ============================================================================
// Constants
// ============================================================================

/**
 * Service name constants (lowercase strings used throughout the application)
 */
export const SERVICE_NAMES = {
  UBER: 'uber',
  LYFT: 'lyft',
  TAXI: 'taxi',
  WAYMO: 'waymo',
  ANY: 'any',
} as const

/**
 * Array of all ride service names (excludes 'any')
 */
export const RIDE_SERVICE_NAMES = [
  SERVICE_NAMES.UBER,
  SERVICE_NAMES.LYFT,
  SERVICE_NAMES.TAXI,
  SERVICE_NAMES.WAYMO,
] as const

/**
 * Array of all service names including 'any'
 */
export const ALL_SERVICE_NAMES = [...RIDE_SERVICE_NAMES, SERVICE_NAMES.ANY] as const

// ============================================================================
// Types
// ============================================================================

/**
 * Union type for ride services (uber | lyft | taxi | waymo)
 */
export type RideServiceName = (typeof RIDE_SERVICE_NAMES)[number]

/**
 * Union type for all services including 'any'
 */
export type ServiceName = (typeof ALL_SERVICE_NAMES)[number]

/**
 * Re-export Prisma ServiceType for convenience
 */
export type { ServiceType }

// ============================================================================
// Prisma Enum Reference
// ============================================================================

const ServiceTypeEnum = $Enums.ServiceType

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Immutable mapping from service strings to Prisma ServiceType enums
 */
const SERVICE_TO_ENUM_MAP: Readonly<Record<RideServiceName, ServiceType>> = {
  uber: ServiceTypeEnum.UBER,
  lyft: ServiceTypeEnum.LYFT,
  taxi: ServiceTypeEnum.TAXI,
  waymo: ServiceTypeEnum.WAYMO,
} as const

/**
 * Immutable mapping from Prisma ServiceType enums to service strings
 */
const ENUM_TO_SERVICE_MAP: Readonly<Record<ServiceType, ServiceName>> = {
  [ServiceTypeEnum.UBER]: 'uber',
  [ServiceTypeEnum.LYFT]: 'lyft',
  [ServiceTypeEnum.TAXI]: 'taxi',
  [ServiceTypeEnum.WAYMO]: 'waymo',
  [ServiceTypeEnum.ANY]: 'any',
} as const

/**
 * Map a service string to its corresponding Prisma ServiceType enum.
 *
 * @param service - The service name ('uber', 'lyft', 'taxi', or 'waymo')
 * @returns The corresponding Prisma ServiceType enum value
 *
 * @example
 * const serviceType = mapServiceToEnum('uber') // ServiceType.UBER
 */
export function mapServiceToEnum(service: RideServiceName): ServiceType {
  return SERVICE_TO_ENUM_MAP[service]
}

/**
 * Map a service string to its corresponding Prisma ServiceType enum,
 * including support for 'any'.
 *
 * @param service - The service name ('uber', 'lyft', 'taxi', 'waymo', or 'any')
 * @returns The corresponding Prisma ServiceType enum value
 *
 * @example
 * const serviceType = mapServiceToEnumWithAny('any') // ServiceType.ANY
 */
export function mapServiceToEnumWithAny(service: ServiceName): ServiceType {
  if (service === 'any') {
    return ServiceTypeEnum.ANY
  }
  return SERVICE_TO_ENUM_MAP[service]
}

/**
 * Map a Prisma ServiceType enum to its corresponding service string.
 *
 * @param serviceType - The Prisma ServiceType enum value
 * @returns The corresponding service name string
 *
 * @example
 * const service = mapEnumToService(ServiceType.UBER) // 'uber'
 */
export function mapEnumToService(serviceType: ServiceType): ServiceName {
  return ENUM_TO_SERVICE_MAP[serviceType]
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid ride service name.
 *
 * @param value - The value to check
 * @returns True if the value is a valid RideServiceName
 *
 * @example
 * if (isRideServiceName(input)) {
 *   const serviceType = mapServiceToEnum(input)
 * }
 */
export function isRideServiceName(value: unknown): value is RideServiceName {
  return typeof value === 'string' && RIDE_SERVICE_NAMES.includes(value as RideServiceName)
}

/**
 * Type guard to check if a string is a valid service name (including 'any').
 *
 * @param value - The value to check
 * @returns True if the value is a valid ServiceName
 *
 * @example
 * if (isServiceName(input)) {
 *   const serviceType = mapServiceToEnumWithAny(input)
 * }
 */
export function isServiceName(value: unknown): value is ServiceName {
  return typeof value === 'string' && ALL_SERVICE_NAMES.includes(value as ServiceName)
}
