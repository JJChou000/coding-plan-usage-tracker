import { describe, expect, it } from 'vitest'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'
import { formatRefreshTimeLabel, getPrimaryDimension } from './collapsedViewModel'
import { getFloatingSize } from './floatingWindowLayout'

function createProviderConfig(): ProviderConfig {
  return {
    providerId: 'zhipu',
    auth: {
      authToken: 'sk-test'
    },
    checkedDimensions: ['token_5h'],
    enabled: true
  }
}

function createProviderUsageData(): ProviderUsageData {
  return {
    providerId: 'zhipu',
    dimensions: [
      {
        id: 'token_5h',
        label: '每 5 小时 Token',
        usedPercent: 31,
        used: 62000,
        total: 200000,
        resetTime: '03-27',
        isChecked: true
      },
      {
        id: 'mcp_monthly',
        label: 'MCP 每月额度',
        usedPercent: 12,
        used: 240,
        total: 2000,
        resetTime: '04-01',
        isChecked: false
      }
    ],
    lastUpdated: Date.UTC(2026, 2, 24, 9, 7, 0)
  }
}

describe('CollapsedView helpers', () => {
  it('prefers the configured primary dimension', () => {
    expect(getPrimaryDimension(createProviderUsageData(), createProviderConfig())?.id).toBe(
      'token_5h'
    )
  })

  it('formats refresh time from provider lastUpdated instead of quota resetTime', () => {
    expect(formatRefreshTimeLabel(createProviderUsageData().lastUpdated, 'UTC')).toBe('09:07')
  })
})

describe('floating window collapsed layout', () => {
  it('keeps the collapsed width compact enough for the denser layout', () => {
    const provider = createProviderUsageData()

    const collapsedSize = getFloatingSize(false, 'normal', [provider])
    const expandedSize = getFloatingSize(true, 'normal', [provider])

    expect(collapsedSize.width).toBe(224)
    expect(collapsedSize.width).toBeLessThan(expandedSize.width)
  })
})
