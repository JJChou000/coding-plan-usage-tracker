/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
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
      const nextUsageData = new Map(state.usageData)
      nextUsageData.set(action.payload.providerId, action.payload)

      return {
        ...state,
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
        nextUsageData.set(providerId, {
          ...providerUsage,
          dimensions: providerUsage.dimensions.map((dimension) =>
            dimension.id === dimensionId
              ? {
                  ...dimension,
                  isChecked: !dimension.isChecked
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
  const [state, dispatch] = useReducer(appReducer, initialState ?? createDefaultState())

  useEffect(() => {
    if (typeof window.electronAPI?.getConfig !== 'function') {
      return
    }

    let isMounted = true
    const syncConfig = (config: AppConfig): void => {
      if (!isMounted) {
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
      .catch(() => undefined)

    const unsubscribe = window.electronAPI.onConfigUpdated(syncConfig)

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }

  return context
}
