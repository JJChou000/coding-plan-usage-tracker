import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./configStore', () => ({
  getConfig: vi.fn(() => ({
    providers: [],
    refreshInterval: 60,
    windowPosition: { x: 360, y: -96 },
    windowState: 'docked-top',
    isExpanded: false,
    windowOpacity: 1
  })),
  setConfig: vi.fn()
}))

vi.mock('./window', () => ({
  createSettingsWindow: vi.fn(),
  ensureFloatingWindowVisible: vi.fn(() => ({
    windowState: 'normal',
    windowPosition: { x: 360, y: 0 }
  }))
}))

vi.mock('electron', () => ({
  app: {
    quit: vi.fn()
  },
  Menu: {
    buildFromTemplate: vi.fn(() => ({}))
  },
  Tray: class Tray {},
  nativeImage: {
    createFromPath: vi.fn(() => ({
      isEmpty: () => true,
      resize: () => ({})
    })),
    createEmpty: vi.fn(() => ({}))
  }
}))

import type { BrowserWindow } from 'electron'

import { getConfig, setConfig } from './configStore'
import { showMainWindowFromTray } from './tray'
import { ensureFloatingWindowVisible } from './window'

function createMockWindow(): BrowserWindow {
  return {
    isDestroyed: () => false,
    isVisible: () => false,
    show: vi.fn(),
    isMinimized: () => true,
    restore: vi.fn(),
    focus: vi.fn()
  } as unknown as BrowserWindow
}

describe('showMainWindowFromTray', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back from a legacy unsupported dock state and persists the safe placement', () => {
    const mainWindow = createMockWindow()

    showMainWindowFromTray(mainWindow)

    expect(getConfig).toHaveBeenCalledTimes(1)
    expect(ensureFloatingWindowVisible).toHaveBeenCalledWith(mainWindow, 'docked-top')
    expect(setConfig).toHaveBeenCalledWith({
      windowState: 'normal',
      windowPosition: { x: 360, y: 0 }
    })
  })
})
