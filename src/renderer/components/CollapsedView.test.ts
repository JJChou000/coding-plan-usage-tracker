import { describe, expect, it } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'
import {
  formatRefreshTimeLabel,
  getDockedHandleDisplay,
  getPrimaryDimension
} from './collapsedViewModel'
import CollapsedView from './CollapsedView'
import { getFloatingSize } from './floatingWindowLayout'

type TestElement = ReactElement<{
  children?: ReactNode
  className?: string
}>

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

function getElementChildren(element: unknown): TestElement[] {
  if (!isValidElement<{ children?: ReactNode }>(element)) {
    return []
  }

  return Children.toArray(element.props.children).filter((child): child is TestElement =>
    isValidElement<{ children?: ReactNode; className?: string }>(child)
  )
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

  it('uses the first visible provider primary dimension for the docked handle', () => {
    const zhipuConfig = createProviderConfig()
    const bailianConfig: ProviderConfig = {
      providerId: 'bailian',
      auth: {
        cookie: 'cookie'
      },
      checkedDimensions: ['usage_5h'],
      enabled: true
    }
    const bailianUsage: ProviderUsageData = {
      providerId: 'bailian',
      dimensions: [
        {
          id: 'usage_5h',
          label: '近5小时用量',
          usedPercent: 48,
          used: 4320,
          total: 9000,
          isChecked: true
        }
      ],
      lastUpdated: Date.UTC(2026, 2, 24, 9, 8, 0)
    }

    expect(
      getDockedHandleDisplay(
        [zhipuConfig, bailianConfig],
        [createProviderUsageData(), bailianUsage]
      )
    ).toEqual({
      providerId: 'zhipu',
      text: '31',
      state: 'usage'
    })
  })

  it('falls back to a placeholder when no visible provider has usable quota data', () => {
    const zhipuConfig = createProviderConfig()
    const emptyUsage: ProviderUsageData = {
      providerId: 'zhipu',
      dimensions: [],
      lastUpdated: Date.UTC(2026, 2, 24, 9, 9, 0),
      error: '请求失败'
    }

    expect(getDockedHandleDisplay([zhipuConfig], [emptyUsage])).toEqual({
      providerId: 'zhipu',
      text: '--',
      state: 'placeholder'
    })
  })
})

describe('floating window collapsed layout', () => {
  it('keeps provider identity and usage metric in the same compact summary group', () => {
    const view = CollapsedView({
      providers: [createProviderUsageData()],
      configs: [createProviderConfig()],
      onToggleExpand: () => undefined
    })

    const rows = getElementChildren(view)
    const rowChildren = getElementChildren(rows[0])
    const summaryChildren = getElementChildren(rowChildren[0])

    expect(rowChildren[0].props.className).toContain('collapsed-view__summary')
    expect(summaryChildren[0].props.className).toContain('collapsed-view__identity')
    expect(summaryChildren[1].props.className).toContain('collapsed-view__metric')
  })

  it('keeps the collapsed width compact enough for the denser layout', () => {
    const provider = createProviderUsageData()

    const collapsedSize = getFloatingSize(false, 'normal', [provider])
    const expandedSize = getFloatingSize(true, 'normal', [provider])

    expect(collapsedSize.width).toBe(216)
    expect(collapsedSize.width).toBeLessThan(expandedSize.width)
  })
})
