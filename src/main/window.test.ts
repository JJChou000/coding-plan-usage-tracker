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

import {
  ensureFloatingWindowVisible,
  getWindowBoundsForState,
  resizeWindow,
  restoreFloatingWindow
} from './window'

function createMockWindow(initialBounds: { x: number; y: number; width: number; height: number }): {
  win: BrowserWindow
  setBounds: ReturnType<typeof vi.fn>
  setPosition: ReturnType<typeof vi.fn>
  setResizable: ReturnType<typeof vi.fn>
  setSize: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
  focus: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
} {
  let bounds = { ...initialBounds }
  const setBounds = vi.fn(
    (nextBounds: { x: number; y: number; width: number; height: number }) => {
      bounds = { ...nextBounds }
    }
  )
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
  const setResizable = vi.fn()

  return {
    win: {
      getBounds: () => ({ ...bounds }),
      setBounds,
      setPosition,
      setResizable,
      setSize,
      isResizable: () => false,
      isMinimized: () => true,
      restore,
      isVisible: () => false,
      show,
      focus
    } as unknown as BrowserWindow,
    setBounds,
    setPosition,
    setResizable,
    setSize,
    show,
    focus,
    restore
  }
}

describe('getWindowBoundsForState', () => {
  it('shrinks an oversized right-docked window down to the handle bounds', () => {
    const nextBounds = getWindowBoundsForState(
      {
        x: 1512,
        y: 120,
        width: 320,
        height: 120
      },
      'docked-right',
      {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      }
    )

    expect(nextBounds).toEqual({
      x: 1896,
      y: 120,
      width: 24,
      height: 52
    })
  })
})

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

    const { win, setBounds, setResizable } = createMockWindow({
      x: 1700,
      y: 120,
      width: 248,
      height: 52
    })

    resizeWindow(win, 320, 120)

    expect(setResizable).toHaveBeenNthCalledWith(1, true)
    expect(setBounds).toHaveBeenCalledWith(
      {
        x: 1600,
        y: 120,
        width: 320,
        height: 120
      },
      false
    )
    expect(setResizable).toHaveBeenNthCalledWith(2, false)
    expect(setConfig).toHaveBeenCalledWith({
      windowPosition: { x: 1600, y: 120 }
    })
  })

  it('shrinks a docked-right floating window to the requested handle size', () => {
    vi.mocked(getConfig).mockReturnValue({
      providers: [],
      refreshInterval: 60,
      windowPosition: { x: 1512, y: 120 },
      windowState: 'docked-right',
      isExpanded: false,
      windowOpacity: 1
    })

    const { win, setBounds, setResizable } = createMockWindow({
      x: 1512,
      y: 120,
      width: 320,
      height: 120
    })

    resizeWindow(win, 24, 52)

    expect(setResizable).toHaveBeenNthCalledWith(1, true)
    expect(setBounds).toHaveBeenCalledWith(
      {
        x: 1896,
        y: 120,
        width: 24,
        height: 52
      },
      false
    )
    expect(setResizable).toHaveBeenNthCalledWith(2, false)
    expect(setConfig).toHaveBeenCalledWith({
      windowPosition: { x: 1896, y: 120 }
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

describe('ensureFloatingWindowVisible', () => {
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

  it('corrects an old oversized right-docked window before showing it again', () => {
    const { win, setBounds } = createMockWindow({
      x: 1512,
      y: 120,
      width: 320,
      height: 120
    })

    const nextPosition = ensureFloatingWindowVisible(win, 'docked-right')

    expect(setBounds).toHaveBeenCalledWith(
      {
        x: 1896,
        y: 120,
        width: 24,
        height: 52
      },
      false
    )
    expect(nextPosition).toEqual({ x: 1896, y: 120 })
  })
})
