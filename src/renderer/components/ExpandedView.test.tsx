import { readFileSync } from 'node:fs'

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'
import ExpandedView from './ExpandedView'

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
        resetTime: '16:30',
        isChecked: true
      },
      {
        id: 'token_weekly',
        label: '每周用量',
        usedPercent: 25,
        used: 1500,
        total: 6000,
        resetTime: '2026-03-31 00:00',
        isChecked: false
      },
      {
        id: 'mcp_monthly',
        label: 'MCP 每月额度',
        usedPercent: 12,
        used: 240,
        total: 2000,
        resetTime: '2026-04-01 00:00',
        isChecked: false
      }
    ],
    lastUpdated: Date.UTC(2026, 2, 24, 9, 7, 0)
  }
}

describe('ExpandedView', () => {
  it('renders reset times for each expanded dimension', () => {
    const html = renderToStaticMarkup(
      <ExpandedView
        providers={[createProviderUsageData()]}
        configs={[createProviderConfig()]}
        onToggleExpand={() => {}}
        onToggleDimension={() => {}}
      />
    )

    expect(html).toContain('16:30')
    expect(html).toContain('2026-03-31 00:00')
    expect(html).toContain('2026-04-01 00:00')
  })

  it('renders the weekly dimension between the 5-hour and MCP dimensions', () => {
    const html = renderToStaticMarkup(
      <ExpandedView
        providers={[createProviderUsageData()]}
        configs={[createProviderConfig()]}
        onToggleExpand={() => {}}
        onToggleDimension={() => {}}
      />
    )

    const tokenIndex = html.indexOf('每 5 小时 Token')
    const weeklyIndex = html.indexOf('每周用量')
    const mcpIndex = html.indexOf('MCP 每月额度')

    expect(tokenIndex).toBeGreaterThan(-1)
    expect(weeklyIndex).toBeGreaterThan(tokenIndex)
    expect(mcpIndex).toBeGreaterThan(weeklyIndex)
  })

  it('applies the shared emphasis treatment to both percentage and reset time', () => {
    const html = renderToStaticMarkup(
      <ExpandedView
        providers={[createProviderUsageData()]}
        configs={[createProviderConfig()]}
        onToggleExpand={() => {}}
        onToggleDimension={() => {}}
      />
    )

    expect(html).toContain('class="expanded-view__percent floating-window__data-emphasis"')
    expect(html).toContain('class="expanded-view__reset floating-window__data-emphasis"')
  })

  it('reserves a dedicated reset-time column in CSS to avoid truncation regressions', () => {
    const css = readFileSync(new URL('./ExpandedView.css', import.meta.url), 'utf8')

    expect(css).toContain(
      'grid-template-columns: 16px minmax(0, 1fr) minmax(68px, 1fr) minmax(40px, max-content) minmax(108px, max-content);'
    )
    expect(css).toContain('white-space: nowrap;')
  })
})
