import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./configStore', () => ({
  getConfig: vi.fn(() => ({
    providers: [],
    refreshInterval: 60,
    windowPosition: { x: 1700, y: 120 },
    windowState: 'normal',
    isExpanded: false,
    windowOpacity: 1
  })),
  setConfig: vi.fn()
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: false
  }
}))

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  ipcMain: {
    on: vi.fn()
  },
  screen: {
    getDisplayMatching: vi.fn(),
    getDisplayNearestPoint: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

import { screen, type BrowserWindow } from 'electron'
import { getConfig, setConfig } from './configStore'

import { resizeWindow, restoreFloatingWindow } from './window'

function createMockWindow(initialBounds: { x: number; y: number; width: number; height: number }): {
  win: BrowserWindow
  setPosition: ReturnType<typeof vi.fn>
  setSize: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
} {
  let bounds = { ...initialBounds }
  const setSize = vi.fn((width: number, height: number) => {
    bounds = {
      ...bounds,
      width,
      height
    }
  })
  const setPosition = vi.fn((x: number, y: number) => {
    bounds = {
      ...bounds,
      x,
      y
    }
  })
  const show = vi.fn()
  const focus = vi.fn()
  const restore = vi.fn()

  return {
    win: {
      getBounds: () => ({ ...bounds }),
      setPosition,
      setSize,
      isMinimized: () => true,
      restore,
      isVisible: () => false,
      show,
      focus
    } as unknown as BrowserWindow,
    setPosition,
    setSize,
    show,
    focus,
    restore
  }
}

describe('resizeWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(screen.getDisplayMatching).mockReturnValue({
      workArea: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      }
    } as never)
  })

  it('re-clamps the floating window after it grows near the right edge', () => {
    vi.mocked(getConfig).mockReturnValue({
      providers: [],
      refreshInterval: 60,
      windowPosition: { x: 1700, y: 120 },
      windowState: 'normal',
      isExpanded: false,
      windowOpacity: 1
    })

    const { win, setPosition, setSize } = createMockWindow({
      x: 1700,
      y: 120,
      width: 248,
      height: 52
    })

    resizeWindow(win, 320, 120)

    expect(setSize).toHaveBeenCalledWith(320, 120)
    expect(setPosition).toHaveBeenCalledWith(1600, 120)
    expect(setConfig).toHaveBeenCalledWith({
      windowPosition: { x: 1600, y: 120 }
    })
  })

  it('restores a docked floating window back into the visible work area', () => {
    const { win, setPosition, setSize, restore, show, focus } = createMockWindow({
      x: -240,
      y: 120,
      width: 24,
      height: 52
    })

    const restoredPosition = restoreFloatingWindow(win)

    expect(setSize).toHaveBeenCalledWith(176, 52)
    expect(setPosition).toHaveBeenCalledWith(0, 120)
    expect(restore).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(restoredPosition).toEqual({ x: 0, y: 120 })
    expect(setConfig).toHaveBeenCalledWith({
      windowState: 'normal',
      windowPosition: { x: 0, y: 120 }
    })
  })
})
