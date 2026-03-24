import { describe, expect, it } from 'vitest'

import type { AppConfig, AppState, ProviderUsageData } from '../../shared/types'
import { appReducer, normalizeCheckedDimensions } from './AppContext'

function createProviderUsageData(): ProviderUsageData {
  return {
    providerId: 'zhipu',
    dimensions: [
      {
        id: 'token_5h',
        label: '每5小时 Token',
        usedPercent: 31,
        used: 62000,
        total: 200000,
        resetTime: '12:00',
        isChecked: true
      },
      {
        id: 'mcp_monthly',
        label: 'MCP 每月额度',
        usedPercent: 12,
        used: 240,
        total: 2000,
        resetTime: '03-27',
        isChecked: false
      }
    ],
    lastUpdated: 1
  }
}

function createConfig(checkedDimensions: string[]): AppConfig {
  return {
    providers: [
      {
        providerId: 'zhipu',
        auth: {
          authToken: 'sk-test'
        },
        checkedDimensions,
        enabled: true
      }
    ],
    refreshInterval: 60,
    windowPosition: { x: 100, y: 100 },
    windowState: 'normal',
    isExpanded: false
  }
}

function createState(checkedDimensions: string[]): AppState {
  const usageData = createProviderUsageData()

  return {
    config: createConfig(checkedDimensions),
    usageData: new Map([[usageData.providerId, usageData]]),
    isLoading: false,
    settingsOpen: false
  }
}

describe('normalizeCheckedDimensions', () => {
  it('keeps only the first valid checked dimension from legacy multi-select config', () => {
    expect(
      normalizeCheckedDimensions(
        ['missing', 'mcp_monthly', 'token_5h'],
        ['token_5h', 'mcp_monthly']
      )
    ).toEqual(['mcp_monthly'])
  })

  it('falls back to the first available dimension when no checked dimension remains valid', () => {
    expect(normalizeCheckedDimensions(['missing'], ['token_5h', 'mcp_monthly'])).toEqual([
      'token_5h'
    ])
  })
})

describe('appReducer', () => {
  it('replaces the previously selected dimension instead of accumulating multiple selections', () => {
    const nextState = appReducer(createState(['token_5h']), {
      type: 'TOGGLE_DIMENSION',
      payload: {
        providerId: 'zhipu',
        dimensionId: 'mcp_monthly'
      }
    })

    expect(nextState.config.providers[0]?.checkedDimensions).toEqual(['mcp_monthly'])
    expect(
      nextState.usageData.get('zhipu')?.dimensions.map((dimension) => ({
        id: dimension.id,
        isChecked: dimension.isChecked
      }))
    ).toEqual([
      { id: 'token_5h', isChecked: false },
      { id: 'mcp_monthly', isChecked: true }
    ])
  })

  it('keeps the selected dimension when the current option is clicked again', () => {
    const nextState = appReducer(createState(['token_5h']), {
      type: 'TOGGLE_DIMENSION',
      payload: {
        providerId: 'zhipu',
        dimensionId: 'token_5h'
      }
    })

    expect(nextState.config.providers[0]?.checkedDimensions).toEqual(['token_5h'])
  })

  it('normalizes loaded legacy config to a single checked dimension', () => {
    const initialState = createState(['token_5h'])

    const nextState = appReducer(initialState, {
      type: 'SET_CONFIG',
      payload: {
        providers: [
          {
            providerId: 'zhipu',
            auth: {
              authToken: 'sk-test'
            },
            checkedDimensions: ['token_5h', 'mcp_monthly'],
            enabled: true
          }
        ]
      }
    })

    expect(nextState.config.providers[0]?.checkedDimensions).toEqual(['token_5h'])
  })

  it('collapses legacy multi-select config to one valid dimension when usage data arrives', () => {
    const nextState = appReducer(createState(['missing', 'mcp_monthly', 'token_5h']), {
      type: 'SET_USAGE_DATA',
      payload: createProviderUsageData()
    })

    expect(nextState.config.providers[0]?.checkedDimensions).toEqual(['mcp_monthly'])
    expect(
      nextState.usageData.get('zhipu')?.dimensions.map((dimension) => ({
        id: dimension.id,
        isChecked: dimension.isChecked
      }))
    ).toEqual([
      { id: 'token_5h', isChecked: false },
      { id: 'mcp_monthly', isChecked: true }
    ])
  })
})
