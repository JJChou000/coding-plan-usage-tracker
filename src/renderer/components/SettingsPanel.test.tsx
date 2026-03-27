import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_WINDOW_OPACITY } from '../../shared/windowOpacity'

const testState = {
  config: {
    providers: [],
    refreshInterval: 60,
    windowOpacity: DEFAULT_WINDOW_OPACITY,
    windowPosition: { x: 100, y: 100 },
    windowState: 'normal' as const,
    isExpanded: false
  },
  usageData: new Map(),
  isLoading: false,
  settingsOpen: true
}

const mockDispatch = vi.fn()

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    state: testState,
    dispatch: mockDispatch
  })
}))

import SettingsPanel, { restoreFloatingWindowFromSettings } from './SettingsPanel'

describe('SettingsPanel window recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as typeof globalThis & {
      window: Window & typeof globalThis
    }).window = {
      electronAPI: {
        restoreFloatingWindow: vi.fn().mockResolvedValue(undefined)
      }
    } as never
  })

  it('renders the reset floating window action without the release note block', () => {
    const html = renderToStaticMarkup(createElement(SettingsPanel))

    expect(html).toContain('重置浮窗位置')
    expect(html).not.toContain('v0.2.2 版本更新')
    expect(html).not.toContain('当前版本建议优先只吸附在右边')
  })

  it('delegates the reset action to electronAPI.restoreFloatingWindow', async () => {
    const restoreMock = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as typeof globalThis & {
      window: Window & typeof globalThis
    }).window = {
      electronAPI: {
        restoreFloatingWindow: restoreMock
      }
    } as never

    await expect(restoreFloatingWindowFromSettings()).resolves.toBe(true)
    expect(restoreMock).toHaveBeenCalledTimes(1)
  })
})
