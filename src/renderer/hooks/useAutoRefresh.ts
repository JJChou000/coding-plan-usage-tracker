import { useCallback, useEffect, useRef } from 'react'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'
import { useAppContext } from '../context/AppContext'
import { getProvider } from '../providers/providerRegistry'

const RETRY_DELAYS_MS = [30_000, 60_000, 300_000] as const

function getRetryDelayMs(failureCount: number, intervalSeconds: number): number {
  if (failureCount <= 0) {
    return intervalSeconds * 1000
  }

  return RETRY_DELAYS_MS[Math.min(failureCount - 1, RETRY_DELAYS_MS.length - 1)]
}

function getCheckedDimensions(config: ProviderConfig, data: ProviderUsageData): string[] {
  if (config.checkedDimensions.length > 0) {
    return config.checkedDimensions
  }

  return data.dimensions[0] ? [data.dimensions[0].id] : []
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
  const timeoutRef = useRef<number | null>(null)
  const failureCountRef = useRef(0)
  const inFlightRef = useRef(false)
  const providersRef = useRef(state.config.providers)

  useEffect(() => {
    providersRef.current = state.config.providers
  }, [state.config.providers])

  const clearScheduledRefresh = (): void => {
    if (timeoutRef.current === null) {
      return
    }

    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }

  const refreshNow = useCallback(async (): Promise<void> => {
    if (!enabled || inFlightRef.current) {
      return
    }

    const enabledProviders = providersRef.current.filter((config) => config.enabled)

    if (enabledProviders.length === 0) {
      dispatch({ type: 'SET_LOADING', payload: false })
      return
    }

    inFlightRef.current = true
    dispatch({ type: 'SET_LOADING', payload: true })

    let hasError = false

    try {
      await Promise.all(
        enabledProviders.map(async (config) => {
          const provider = getProvider(config.providerId)

          if (!provider) {
            hasError = true
            dispatch({
              type: 'SET_USAGE_DATA',
              payload: {
                providerId: config.providerId,
                dimensions: [],
                lastUpdated: Date.now(),
                error: `未找到 provider: ${config.providerId}`
              }
            })
            return
          }

          const result = await provider.fetchUsage(config.auth)
          const normalizedResult = applyCheckedDimensions(config, result)

          if (normalizedResult.error) {
            hasError = true
          }

          dispatch({
            type: 'SET_USAGE_DATA',
            payload: normalizedResult
          })
        })
      )
    } catch {
      hasError = true
    } finally {
      failureCountRef.current = hasError ? failureCountRef.current + 1 : 0
      dispatch({ type: 'SET_LOADING', payload: false })
      inFlightRef.current = false
    }
  }, [dispatch, enabled])

  useEffect(() => {
    if (!enabled) {
      clearScheduledRefresh()
      return
    }

    const scheduleNextRefresh = (): void => {
      clearScheduledRefresh()
      timeoutRef.current = window.setTimeout(
        () => {
          void refreshNow().finally(scheduleNextRefresh)
        },
        getRetryDelayMs(failureCountRef.current, intervalSeconds)
      )
    }

    void refreshNow().finally(scheduleNextRefresh)

    return () => {
      clearScheduledRefresh()
    }
  }, [enabled, intervalSeconds, refreshNow, state.config.providers])

  return {
    refreshNow
  }
}

export default useAutoRefresh
