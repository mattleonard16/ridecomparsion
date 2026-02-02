'use client'

import MapLibreGL from 'maplibre-gl'
import { useTheme } from 'next-themes'
import { useEffect, useId, useState } from 'react'

import { useMap } from './map'

// Exported constants for layer ID prefixes (used by E2E tests to decouple from internal naming)
export const ROUTE_LAYER_PREFIX = 'route-layer-'
export const ROUTE_SOURCE_PREFIX = 'route-source-'

type MapRouteProps = {
  /** Optional unique identifier for the route layer */
  id?: string
  /** Array of [longitude, latitude] coordinate pairs defining the route */
  coordinates: [number, number][]
  /** Line color as CSS color value (default: theme-aware blue) */
  color?: string
  /** Line width in pixels (default: 4) */
  width?: number
  /** Line opacity from 0 to 1 (default: 0.85) */
  opacity?: number
  /** Dash pattern [dash length, gap length] for dashed lines */
  dashArray?: [number, number]
  /** Callback when the route line is clicked */
  onClick?: () => void
  /** Callback when mouse enters the route line */
  onMouseEnter?: () => void
  /** Callback when mouse leaves the route line */
  onMouseLeave?: () => void
  /** Whether the route is interactive (shows pointer cursor on hover). Default: true */
  interactive?: boolean
  /** Line color when hovered (default: theme-aware highlight) */
  hoverColor?: string
  /** Line width when hovered (default: width + 2) */
  hoverWidth?: number
}

// Theme-aware default colors for routes
const routeColors = {
  light: {
    default: '#1d4ed8', // blue-700 - darker blue for better contrast on light maps
    hover: '#1e40af', // blue-800
    casing: '#ffffff', // white outline for contrast
  },
  dark: {
    default: '#3b82f6', // blue-500
    hover: '#60a5fa', // blue-400
    casing: '#1e293b', // slate-800 outline for contrast
  },
}

function MapRoute({
  id: customId,
  coordinates,
  color,
  width = 4,
  opacity = 0.85,
  dashArray,
  onClick,
  onMouseEnter,
  onMouseLeave,
  interactive = true,
  hoverColor,
  hoverWidth,
}: MapRouteProps) {
  const { map, isLoaded } = useMap()
  const { resolvedTheme } = useTheme()
  const generatedId = useId()
  const id = customId ?? generatedId
  const sourceId = `${ROUTE_SOURCE_PREFIX}${id}`
  const layerId = `${ROUTE_LAYER_PREFIX}${id}`
  const casingLayerId = `${ROUTE_LAYER_PREFIX}${id}-casing`
  const [isHovered, setIsHovered] = useState(false)

  // Compute theme-aware colors
  const themeColors = resolvedTheme === 'dark' ? routeColors.dark : routeColors.light
  const effectiveColor = color ?? themeColors.default
  const effectiveHoverColor = hoverColor ?? themeColors.hover
  const effectiveHoverWidth = hoverWidth ?? width + 2
  const casingColor = themeColors.casing
  const casingWidth = width + 4 // Casing is slightly wider than the route

  // Add source and layer on mount
  useEffect(() => {
    if (!isLoaded || !map) return

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [] },
      },
    })

    // Add casing layer first (underneath) for better contrast
    map.addLayer({
      id: casingLayerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': casingColor,
        'line-width': casingWidth,
        'line-opacity': opacity * 0.8,
      },
    })

    // Add main route layer on top
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': effectiveColor,
        'line-width': width,
        'line-opacity': opacity,
        ...(dashArray && { 'line-dasharray': dashArray }),
      },
    })

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map, sourceId, layerId, casingLayerId])

  // When coordinates change, update the source data
  useEffect(() => {
    if (!isLoaded || !map || coordinates.length < 2) return

    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates },
      })
    }
  }, [isLoaded, map, coordinates, sourceId])

  // Update paint properties when props change
  // We track the "base" values and apply them, but if hovered, re-apply hover styles after
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return

    // Update casing properties
    if (map.getLayer(casingLayerId)) {
      map.setPaintProperty(casingLayerId, 'line-color', casingColor)
      map.setPaintProperty(
        casingLayerId,
        'line-width',
        (isHovered ? effectiveHoverWidth : width) + 4
      )
      map.setPaintProperty(casingLayerId, 'line-opacity', opacity * 0.8)
    }

    // Always update base properties
    map.setPaintProperty(layerId, 'line-color', isHovered ? effectiveHoverColor : effectiveColor)
    map.setPaintProperty(layerId, 'line-width', isHovered ? effectiveHoverWidth : width)
    map.setPaintProperty(layerId, 'line-opacity', opacity)

    // Handle dashArray - explicitly clear when undefined (fix: dashArray never clears)
    if (dashArray) {
      map.setPaintProperty(layerId, 'line-dasharray', dashArray)
    } else {
      // Use [1, 0] to force solid line - empty array [] can be invalid in MapLibre spec
      map.setPaintProperty(layerId, 'line-dasharray', [1, 0])
    }
  }, [
    isLoaded,
    map,
    layerId,
    casingLayerId,
    effectiveColor,
    effectiveHoverColor,
    casingColor,
    width,
    effectiveHoverWidth,
    opacity,
    dashArray,
    isHovered,
  ])

  // Reset hover state when interactive becomes false
  useEffect(() => {
    if (!interactive && isHovered) {
      setIsHovered(false)
      if (map) {
        map.getCanvas().style.cursor = ''
      }
    }
  }, [interactive, isHovered, map])

  // Handle hover and click events
  useEffect(() => {
    if (!isLoaded || !map) return

    const handleMouseEnter = () => {
      // When not interactive, don't fire callbacks or change styles
      if (!interactive) return

      map.getCanvas().style.cursor = 'pointer'
      // Apply hover styles
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', effectiveHoverColor)
        map.setPaintProperty(layerId, 'line-width', effectiveHoverWidth)
      }
      setIsHovered(true)
      onMouseEnter?.()
    }

    const handleMouseLeave = () => {
      // When not interactive, don't fire callbacks or change styles
      if (!interactive) return

      map.getCanvas().style.cursor = ''
      // Restore original styles
      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', effectiveColor)
        map.setPaintProperty(layerId, 'line-width', width)
      }
      setIsHovered(false)
      onMouseLeave?.()
    }

    const handleClick = () => {
      // When not interactive, don't fire click callback
      if (!interactive) return
      onClick?.()
    }

    map.on('mouseenter', layerId, handleMouseEnter)
    map.on('mouseleave', layerId, handleMouseLeave)
    map.on('click', layerId, handleClick)

    return () => {
      map.off('mouseenter', layerId, handleMouseEnter)
      map.off('mouseleave', layerId, handleMouseLeave)
      map.off('click', layerId, handleClick)
    }
  }, [
    isLoaded,
    map,
    layerId,
    interactive,
    onClick,
    onMouseEnter,
    onMouseLeave,
    effectiveColor,
    effectiveHoverColor,
    width,
    effectiveHoverWidth,
  ])

  return null
}

export { MapRoute }
export type { MapRouteProps }
