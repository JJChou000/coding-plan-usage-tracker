import { useCallback, useEffect, useRef } from 'react'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'
import { normalizeCheckedDimensions, useAppContext } from '../context/AppContext'
import { getProvider } from '../providers/providerRegistry'

const RETRY_DELAYS_MS = [30_000, 60_000, 300_000] as const
const REFRESH_TICK_MS = 1_000

function getRetryDelayMs(failureCount: number, intervalSeconds: number): number {
  if (failureCount <= 0) {
    return intervalSeconds * 1000
  }

  return RETRY_DELAYS_MS[Math.min(failureCount - 1, RETRY_DELAYS_MS.length - 1)]
}

function getCheckedDimensions(config: ProviderConfig, data: ProviderUsageData): string[] {
  return normalizeCheckedDimensions(
    config.checkedDimensions,
    data.dimensions.map((dimension) => dimension.id)
  )
}

function applyCheckedDimensions(
  config: ProviderConfig,
  data: ProviderUsageData
): ProviderUsageData {
  const checkedDimensions = new Set(getCheckedDimensions(config, data))

  return {
    ...data,
    dimensions: data.dimensions.map((dimension) => ({
      ...dimension,
      isChecked: checkedDimensions.has(dimension.id)
    }))
  }
}

function buildProviderErrorMessage(providerId: string, error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return `Failed to refresh provider: ${providerId}`
}

function mergeWithPreviousSuccess(
  previousData: ProviderUsageData | undefined,
  nextData: ProviderUsageData
): ProviderUsageData {
  if (!nextData.error || nextData.dimensions.length > 0 || !previousData) {
    return nextData
  }

  // Preserve the last successful quota bars while surfacing the latest error state.
  return {
    ...previousData,
    error: nextData.error
  }
}

function createErrorUsageData(
  providerId: string,
  error: string,
  previousData?: ProviderUsageData
): ProviderUsageData {
  if (!previousData) {
    return {
      providerId,
      dimensions: [],
      lastUpdated: Date.now(),
      error
    }
  }

  return {
    ...previousData,
    error
  }
}

export interface UseAutoRefreshOptions {
  enabled?: boolean
  intervalSeconds: number
}

export interface UseAutoRefreshResult {
  refreshNow: () => Promise<void>
}

export function useAutoRefresh({
  enabled = true,
  intervalSeconds
}: UseAutoRefreshOptions): UseAutoRefreshResult {
  const { state, dispatch } = useAppContext()
  const intervalIdRef = useRef<number | null>(null)
  const providersRef = useRef(state.config.providers)
  const usageDataRef = useRef(state.usageData)
  const intervalSecondsRef = useRef(intervalSeconds)
  const failureCountRef = useRef(0)
  const nextRefreshAtRef = useRef(Date.now())
  const inFlightPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    providersRef.current = state.config.providers
  }, [state.config.providers])

  useEffect(() => {
    usageDataRef.current = state.usageData
  }, [state.usageData])

  useEffect(() => {
    intervalSecondsRef.current = intervalSeconds
  }, [intervalSeconds])

  const clearRefreshInterval = (): void => {
    if (intervalIdRef.current === null) {
      return
    }

    window.clearInterval(intervalIdRef.current)
    intervalIdRef.current = null
  }

  const refreshNow = useCallback(async (): Promise<void> => {
    if (!enabled && inFlightPromiseRef.current === null) {
      return
    }

    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current
    }

    const refreshTask = (async (): Promise<void> => {
      const enabledProviders = providersRef.current.filter((config) => config.enabled)

      if (enabledProviders.length === 0) {
        failureCountRef.current = 0
        nextRefreshAtRef.current = Date.now() + intervalSecondsRef.current * 1000
        dispatch({ type: 'SET_LOADING', payload: false })
        return
      }

      dispatch({ type: 'SET_LOADING', payload: true })

      let hasError = false

      try {
        await Promise.all(
          enabledProviders.map(async (config) => {
            const provider = getProvider(config.providerId)
            const previousData = usageDataRef.current.get(config.providerId)

            if (!provider) {
              hasError = true
              dispatch({
                type: 'SET_USAGE_DATA',
                payload: createErrorUsageData(
                  config.providerId,
                  `Provider not found: ${config.providerId}`,
                  previousData
                )
              })
              return
            }

            try {
              const result = await provider.fetchUsage(config.auth)
              const normalizedResult = applyCheckedDimensions(config, result)
              const mergedResult = mergeWithPreviousSuccess(previousData, normalizedResult)

              if (mergedResult.error) {
                hasError = true
              }

              dispatch({
                type: 'SET_USAGE_DATA',
                payload: mergedResult
              })
            } catch (error) {
              hasError = true
              dispatch({
                type: 'SET_USAGE_DATA',
                payload: createErrorUsageData(
                  config.providerId,
                  buildProviderErrorMessage(config.providerId, error),
                  previousData
                )
              })
            }
          })
        )
      } finally {
        failureCountRef.current = hasError ? failureCountRef.current + 1 : 0
        nextRefreshAtRef.current =
          Date.now() + getRetryDelayMs(failureCountRef.current, intervalSecondsRef.current)
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    })()

    inFlightPromiseRef.current = refreshTask

    try {
      await refreshTask
    } finally {
      if (inFlightPromiseRef.current === refreshTask) {
        inFlightPromiseRef.current = null
      }
    }
  }, [dispatch, enabled])

  useEffect(() => {
    clearRefreshInterval()

    if (!enabled) {
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }

    nextRefreshAtRef.current = Date.now()
    void refreshNow()

    intervalIdRef.current = window.setInterval(() => {
      if (Date.now() < nextRefreshAtRef.current) {
        return
      }

      void refreshNow()
    }, REFRESH_TICK_MS)

    return () => {
      clearRefreshInterval()
    }
  }, [dispatch, enabled, intervalSeconds, refreshNow, state.config.providers])

  return {
    refreshNow
  }
}

export default useAutoRefresh
