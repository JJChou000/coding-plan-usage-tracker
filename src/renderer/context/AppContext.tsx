/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode
} from 'react'

import type { AppConfig, AppState, ProviderUsageData } from '../../shared/types'

export type AppAction =
  | { type: 'SET_CONFIG'; payload: Partial<AppConfig> }
  | { type: 'SET_USAGE_DATA'; payload: ProviderUsageData }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'TOGGLE_EXPAND' }
  | { type: 'TOGGLE_DIMENSION'; payload: { providerId: string; dimensionId: string } }
  | { type: 'TOGGLE_SETTINGS' }

export type AppContextValue = {
  state: AppState
  dispatch: Dispatch<AppAction>
}

const DEFAULT_CONFIG: AppConfig = {
  providers: [],
  refreshInterval: 60,
  windowPosition: { x: 100, y: 100 },
  windowState: 'normal',
  isExpanded: false
}

function serializeConfig(config: AppConfig): string {
  return JSON.stringify(config)
}

function createDefaultState(): AppState {
  return {
    config: DEFAULT_CONFIG,
    usageData: new Map(),
    isLoading: false,
    settingsOpen: false
  }
}

function mergeConfig(currentConfig: AppConfig, patch: Partial<AppConfig>): AppConfig {
  return {
    ...currentConfig,
    ...patch,
    windowPosition: patch.windowPosition ?? currentConfig.windowPosition,
    providers: patch.providers ?? currentConfig.providers
  }
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        config: mergeConfig(state.config, action.payload)
      }
    case 'SET_USAGE_DATA': {
      const providerConfig = state.config.providers.find(
        (config) => config.providerId === action.payload.providerId
      )
      const shouldSeedCheckedDimensions =
        Boolean(providerConfig) &&
        providerConfig!.checkedDimensions.length === 0 &&
        action.payload.dimensions.length > 0
      const checkedDimensions = shouldSeedCheckedDimensions
        ? [action.payload.dimensions[0].id]
        : (providerConfig?.checkedDimensions ?? [])
      const nextPayload =
        checkedDimensions.length > 0
          ? {
              ...action.payload,
              dimensions: action.payload.dimensions.map((dimension) => ({
                ...dimension,
                isChecked: checkedDimensions.includes(dimension.id)
              }))
            }
          : action.payload
      const nextUsageData = new Map(state.usageData)
      nextUsageData.set(action.payload.providerId, nextPayload)

      return {
        ...state,
        config: shouldSeedCheckedDimensions
          ? {
              ...state.config,
              providers: state.config.providers.map((config) =>
                config.providerId === action.payload.providerId
                  ? {
                      ...config,
                      checkedDimensions
                    }
                  : config
              )
            }
          : state.config,
        usageData: nextUsageData
      }
    }
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }
    case 'TOGGLE_EXPAND':
      return {
        ...state,
        config: {
          ...state.config,
          isExpanded: !state.config.isExpanded
        }
      }
    case 'TOGGLE_DIMENSION': {
      const { providerId, dimensionId } = action.payload

      const nextProviders = state.config.providers.map((config) => {
        if (config.providerId !== providerId) {
          return config
        }

        const isChecked = config.checkedDimensions.includes(dimensionId)

        if (isChecked && config.checkedDimensions.length === 1) {
          return config
        }

        return {
          ...config,
          checkedDimensions: isChecked
            ? config.checkedDimensions.filter((item) => item !== dimensionId)
            : [...config.checkedDimensions, dimensionId]
        }
      })

      const nextUsageData = new Map(state.usageData)
      const providerUsage = nextUsageData.get(providerId)

      if (providerUsage) {
        const activeConfig = nextProviders.find((config) => config.providerId === providerId)
        const checkedDimensions = new Set(activeConfig?.checkedDimensions ?? [])

        nextUsageData.set(providerId, {
          ...providerUsage,
          dimensions: providerUsage.dimensions.map((dimension) =>
            checkedDimensions.size > 0
              ? {
                  ...dimension,
                  isChecked: checkedDimensions.has(dimension.id)
                }
              : dimension
          )
        })
      }

      return {
        ...state,
        config: {
          ...state.config,
          providers: nextProviders
        },
        usageData: nextUsageData
      }
    }
    case 'TOGGLE_SETTINGS':
      return {
        ...state,
        settingsOpen: !state.settingsOpen
      }
    default:
      return state
  }
}

const AppContext = createContext<AppContextValue | null>(null)

export interface AppContextProviderProps {
  children: ReactNode
  initialState?: AppState
}

export function AppContextProvider({
  children,
  initialState
}: AppContextProviderProps): React.JSX.Element {
  const resolvedInitialState = initialState ?? createDefaultState()
  const [state, dispatch] = useReducer(appReducer, resolvedInitialState)
  const hasConfigApi = typeof window.electronAPI?.getConfig === 'function'
  const hasConfigUpdateListener = typeof window.electronAPI?.onConfigUpdated === 'function'
  const hasConfigPersistenceApi = typeof window.electronAPI?.setConfig === 'function'
  const currentConfigSnapshot = serializeConfig(state.config)
  const currentConfigSnapshotRef = useRef(currentConfigSnapshot)
  const syncedConfigSnapshotRef = useRef(serializeConfig(resolvedInitialState.config))
  const pendingConfigSnapshotRef = useRef<string | null>(null)
  const hasHydratedConfigRef = useRef(!hasConfigApi)

  useEffect(() => {
    currentConfigSnapshotRef.current = currentConfigSnapshot
  }, [currentConfigSnapshot])

  useEffect(() => {
    if (!hasConfigApi) {
      return
    }

    let isMounted = true
    const syncConfig = (config: AppConfig): void => {
      if (!isMounted) {
        return
      }

      const nextSnapshot = serializeConfig(config)

      syncedConfigSnapshotRef.current = nextSnapshot
      pendingConfigSnapshotRef.current = null
      hasHydratedConfigRef.current = true

      if (nextSnapshot === currentConfigSnapshotRef.current) {
        return
      }

      dispatch({
        type: 'SET_CONFIG',
        payload: config
      })
    }

    void window.electronAPI
      .getConfig()
      .then(syncConfig)
      .catch((error) => {
        hasHydratedConfigRef.current = true

        if (import.meta.env.DEV) {
          console.error('Failed to load app config from main process.', error)
        }
      })

    const unsubscribe = hasConfigUpdateListener
      ? window.electronAPI.onConfigUpdated(syncConfig)
      : () => undefined

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [hasConfigApi, hasConfigUpdateListener])

  useEffect(() => {
    if (!hasConfigPersistenceApi || !hasHydratedConfigRef.current) {
      return
    }

    if (
      currentConfigSnapshot === syncedConfigSnapshotRef.current ||
      currentConfigSnapshot === pendingConfigSnapshotRef.current
    ) {
      return
    }

    pendingConfigSnapshotRef.current = currentConfigSnapshot

    let isCancelled = false

    void window.electronAPI
      .setConfig(state.config)
      .then(() => {
        if (isCancelled) {
          return
        }

        syncedConfigSnapshotRef.current = currentConfigSnapshot

        if (pendingConfigSnapshotRef.current === currentConfigSnapshot) {
          pendingConfigSnapshotRef.current = null
        }
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        if (pendingConfigSnapshotRef.current === currentConfigSnapshot) {
          pendingConfigSnapshotRef.current = null
        }

        if (import.meta.env.DEV) {
          console.error('Failed to persist app config.', error)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [currentConfigSnapshot, hasConfigPersistenceApi, state.config])

  useEffect(() => {
    const debugWindow = window as typeof window & {
      __CPUT_RENDERER_DEBUG__?: {
        getStateSnapshot: () => {
          config: AppConfig
          usageData: ProviderUsageData[]
          isLoading: boolean
          settingsOpen: boolean
        }
        toggleDimension: (providerId: string, dimensionId: string) => void
        toggleExpand: () => void
        updateConfig: (patch: Partial<AppConfig>) => void
      }
    }

    debugWindow.__CPUT_RENDERER_DEBUG__ = {
      getStateSnapshot: () => ({
        config: state.config,
        usageData: Array.from(state.usageData.values()),
        isLoading: state.isLoading,
        settingsOpen: state.settingsOpen
      }),
      toggleDimension: (providerId: string, dimensionId: string) => {
        dispatch({
          type: 'TOGGLE_DIMENSION',
          payload: { providerId, dimensionId }
        })
      },
      toggleExpand: () => {
        dispatch({ type: 'TOGGLE_EXPAND' })
      },
      updateConfig: (patch: Partial<AppConfig>) => {
        dispatch({
          type: 'SET_CONFIG',
          payload: patch
        })
      }
    }

    return () => {
      delete debugWindow.__CPUT_RENDERER_DEBUG__
    }
  }, [dispatch, state])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }

  return context
}
