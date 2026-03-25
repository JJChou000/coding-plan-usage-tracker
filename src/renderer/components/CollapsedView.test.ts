import { readFileSync } from 'node:fs'

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'
import {
  getCollapsedTimeLabel,
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

  it('uses the primary dimension reset time for the collapsed time label', () => {
    expect(getCollapsedTimeLabel(createProviderUsageData().dimensions[0])).toBe('03-27')
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
  it('places provider identity, usage metric, and refresh time as three ordered regions', () => {
    const view = CollapsedView({
      providers: [createProviderUsageData()],
      configs: [createProviderConfig()],
      onToggleExpand: () => undefined
    })

    const rows = getElementChildren(view)
    const rowChildren = getElementChildren(rows[0])

    expect(rowChildren[0].props.className).toContain('collapsed-view__identity')
    expect(rowChildren[1].props.className).toContain('collapsed-view__metric')
    expect(rowChildren[2].props.className).toContain('collapsed-view__refresh')
  })

  it('keeps the compact collapsed grid rules that reduce the gap between provider name and metric', () => {
    const css = readFileSync(new URL('./CollapsedView.css', import.meta.url), 'utf8')

    expect(css).toContain('grid-template-columns: auto minmax(32px, 1fr) auto;')
    expect(css).toContain('gap: 4px;')
    expect(css).toContain('padding: 0 4px;')
    expect(css).toContain('min-width: 32px;')
    expect(css).toContain('justify-self: center;')
    expect(css).toContain('min-width: 31px;')
  })

  it('keeps the collapsed width compact enough for the denser layout', () => {
    const provider = createProviderUsageData()

    const collapsedSize = getFloatingSize(false, 'normal', [provider])
    const expandedSize = getFloatingSize(true, 'normal', [provider])

    expect(collapsedSize.width).toBe(176)
    expect(collapsedSize.width).toBeLessThan(expandedSize.width)
  })
})

describe('CollapsedView', () => {
  it('renders the primary dimension reset time instead of the provider refresh time', () => {
    const html = renderToStaticMarkup(
      createElement(CollapsedView, {
        providers: [createProviderUsageData()],
        configs: [createProviderConfig()],
        onToggleExpand: () => {}
      })
    )

    expect(html).toContain('03-27')
    expect(html).not.toContain('09:07')
  })

  it('applies the shared emphasis treatment to the primary metric and refresh time', () => {
    const html = renderToStaticMarkup(
      createElement(CollapsedView, {
        providers: [createProviderUsageData()],
        configs: [createProviderConfig()],
        onToggleExpand: () => {}
      })
    )

    expect(html).toContain('class="collapsed-view__metric floating-window__data-emphasis"')
    expect(html).toContain(
      'class="collapsed-view__refresh-text floating-window__data-emphasis"'
    )
  })

  it('defines the shared emphasis text style used by metrics and time labels', () => {
    const css = readFileSync(new URL('./FloatingWindow.css', import.meta.url), 'utf8')

    expect(css).toContain('.floating-window__data-emphasis {')
    expect(css).toContain('color: var(--text-primary);')
    expect(css).toContain('text-shadow:')
  })
})
