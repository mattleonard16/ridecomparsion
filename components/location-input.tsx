'use client'

import { useRef, useEffect, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import type { LocationSuggestion, CommonPlaces } from '@/types'
import { useLocationSuggestions } from '@/lib/hooks/useLocationSuggestions'

// Debounce delay for API calls
const DEBOUNCE_DELAY_MS = 150

export interface LocationInputProps {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: LocationSuggestion) => void
  commonPlaces: CommonPlaces
  labelIcon?: React.ReactNode
  headerAction?: React.ReactNode
}

/**
 * LocationInput - Reusable autocomplete input for location selection
 * Handles input field, clear button, suggestions dropdown, and common places matching
 */
export function LocationInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  commonPlaces,
  labelIcon,
  headerAction,
}: LocationInputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()

  const {
    suggestions,
    isLoading,
    showSuggestions,
    fetchSuggestions,
    clearSuggestions,
    setShowSuggestions,
    handleInstantMatches,
  } = useLocationSuggestions({ commonPlaces })

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [setShowSuggestions])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      onChange(newValue)

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }

      // Show instant matches immediately (no debounce for common places)
      handleInstantMatches(newValue)

      // Debounce API call to fetch additional results
      if (newValue.length >= 2) {
        debounceTimeoutRef.current = setTimeout(() => {
          fetchSuggestions(newValue)
        }, DEBOUNCE_DELAY_MS)
      }
    },
    [onChange, handleInstantMatches, fetchSuggestions]
  )

  const handleFocus = useCallback(() => {
    if (value.length >= 2) {
      if (suggestions.length > 0) {
        setShowSuggestions(true)
      } else {
        // Trigger search immediately on focus if there's content
        fetchSuggestions(value)
      }
    }
  }, [value, suggestions.length, setShowSuggestions, fetchSuggestions])

  const handleSuggestionClick = useCallback(
    (suggestion: LocationSuggestion) => {
      onSelect(suggestion)
      clearSuggestions()
    },
    [onSelect, clearSuggestions]
  )

  const handleClear = useCallback(() => {
    onChange('')
    clearSuggestions()
  }, [onChange, clearSuggestions])

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {labelIcon}
          <label htmlFor={id} className="text-sm text-muted-foreground capitalize">
            {label}
          </label>
        </div>
        {headerAction}
      </div>
      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          className="w-full px-4 py-4 pr-10 bg-card border border-border rounded-xl text-foreground placeholder-muted-foreground/60 shadow-sm focus:shadow-md focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 outline-none text-base"
          required
        />
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors touch-manipulation w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute z-10 w-full glass-card rounded-xl mt-2 max-h-60 overflow-y-auto shadow-lg border border-border/50">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <span className="animate-pulse">Searching...</span>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <div
                key={suggestion.place_id || index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="p-3 hover:bg-muted/50 cursor-pointer border-b border-border/30 last:border-b-0 transition-all duration-150 first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-foreground">
                      {suggestion.name || suggestion.display_name.split(',')[0]}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
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
  )
}
