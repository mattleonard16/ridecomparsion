import { useEffect, useState, useCallback, useRef } from 'react'
import { executeRecaptcha, loadRecaptchaScript, RECAPTCHA_CONFIG } from '../recaptcha'

export interface UseRecaptchaReturn {
  executeRecaptcha: (action?: string) => Promise<string>
  isLoaded: boolean
  error: string | null
}

/**
 * React hook for reCAPTCHA v3 integration
 */
export function useRecaptcha(): UseRecaptchaReturn {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref to track loaded state for stable callback reference
  const isLoadedRef = useRef(false)

  // Keep ref in sync with state
  useEffect(() => {
    isLoadedRef.current = isLoaded
  }, [isLoaded])

  // Load reCAPTCHA script on mount
  useEffect(() => {
    let isMounted = true

    const loadScript = async () => {
      try {
        await loadRecaptchaScript()
        if (isMounted) {
          setIsLoaded(true)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load reCAPTCHA')
          setIsLoaded(false)
        }
      }
    }

    loadScript()

    return () => {
      isMounted = false
    }
  }, [])

  // Execute reCAPTCHA with error handling
  // Uses ref for isLoaded check to maintain stable callback reference
  const execute = useCallback(
    async (action: string = RECAPTCHA_CONFIG.ACTIONS.FORM_SUBMIT): Promise<string> => {
      try {
        if (!isLoadedRef.current) {
          throw new Error('reCAPTCHA not loaded yet')
        }

        const token = await executeRecaptcha(action)
        setError(null)
        return token
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'reCAPTCHA execution failed'
        setError(errorMessage)
        throw new Error(errorMessage)
      }
    },
    [] // Empty deps = stable reference across renders
  )

  return {
    executeRecaptcha: execute,
    isLoaded,
    error,
  }
}
