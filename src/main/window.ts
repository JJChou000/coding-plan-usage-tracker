import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

import type { AppConfig } from '../shared/types'
import { getConfig, setConfig } from './configStore'

const FLOATING_WINDOW_WIDTH = 320
const FLOATING_WINDOW_HEIGHT = 120
const RESTORED_WINDOW_WIDTH = 176
const RESTORED_WINDOW_HEIGHT = 52
const SETTINGS_WINDOW_WIDTH = 960
const SETTINGS_WINDOW_HEIGHT = 720
const SETTINGS_WINDOW_MIN_WIDTH = 720
const SETTINGS_WINDOW_MIN_HEIGHT = 560
const HANDLE_WIDTH = 24
const MIN_WINDOW_WIDTH = HANDLE_WIDTH
const MIN_WINDOW_HEIGHT = HANDLE_WIDTH

let dragListenerRegistered = false
let dockingListenerRegistered = false

type ManagedWindowKind = 'floating' | 'settings'
type SupportedWindowState = Extract<AppConfig['windowState'], 'normal' | 'docked-right'>
type DockedWindowState = Exclude<SupportedWindowState, 'normal'>
type FloatingWindowBounds = Pick<Electron.Rectangle, 'x' | 'y' | 'width' | 'height'>
type FloatingWindowSize = Pick<Electron.Rectangle, 'width' | 'height'>
type FloatingWindowPlacement = {
  windowState: SupportedWindowState
  windowPosition: { x: number; y: number }
}
type WindowStateRequest = {
  state: AppConfig['windowState']
  size?: FloatingWindowSize
}

const windowInstances = new WeakMap<BrowserWindow, ManagedWindowKind>()

function isWindowState(value: unknown): value is AppConfig['windowState'] {
  return (
    value === 'normal' ||
    value === 'docked-left' ||
    value === 'docked-right' ||
    value === 'docked-top' ||
    value === 'docked-bottom'
  )
}

function isFloatingWindowSize(value: unknown): value is FloatingWindowSize {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const size = value as Record<string, unknown>

  return typeof size.width === 'number' && typeof size.height === 'number'
}

function resolveWindowStateRequest(value: unknown): WindowStateRequest | null {
  if (isWindowState(value)) {
    return { state: value }
  }

  if (typeof value !== 'object' || value === null) {
    return null
  }

  const request = value as Record<string, unknown>

  if (!isWindowState(request.state)) {
    return null
  }

  return {
    state: request.state,
    size: isFloatingWindowSize(request.size) ? request.size : undefined
  }
}

function hasPointShape(value: unknown): value is { x: number; y: number } {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const point = value as Record<string, unknown>

  return typeof point.x === 'number' && typeof point.y === 'number'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getWorkAreaForPoint(point: { x: number; y: number }): Electron.Rectangle {
  return screen.getDisplayNearestPoint(point).workArea
}

function getClampedPosition(
  bounds: Pick<Electron.Rectangle, 'x' | 'y' | 'width' | 'height'>,
  workArea: Electron.Rectangle
): { x: number; y: number } {
  const maxX = workArea.x + workArea.width - bounds.width
  const maxY = workArea.y + workArea.height - bounds.height

  return {
    x: clamp(bounds.x, workArea.x, maxX),
    y: clamp(bounds.y, workArea.y, maxY)
  }
}

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function registerWindowInstance(win: BrowserWindow, kind: ManagedWindowKind): void {
  windowInstances.set(win, kind)
}

function resolveWindowInstance(kind: ManagedWindowKind): BrowserWindow | null {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) {
      continue
    }

    if (windowInstances.get(win) === kind) {
      return win
    }
  }

  return null
}

function attachExternalLinkHandler(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)

    return { action: 'deny' }
  })
}

async function loadRendererWindow(win: BrowserWindow, hash?: string): Promise<void> {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const baseUrl = process.env['ELECTRON_RENDERER_URL']
    const targetUrl = hash ? `${baseUrl}#${hash}` : baseUrl

    await win.loadURL(targetUrl)
    return
  }

  await win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
}

function getDisplayWorkArea(win: BrowserWindow): Electron.Rectangle {
  return screen.getDisplayMatching(win.getBounds()).workArea
}

function normalizeWindowSize(size: FloatingWindowSize): FloatingWindowSize {
  return {
    width: Math.max(MIN_WINDOW_WIDTH, Math.round(size.width)),
    height: Math.max(MIN_WINDOW_HEIGHT, Math.round(size.height))
  }
}

function getDefaultDockedSize(): FloatingWindowSize {
  return {
    width: HANDLE_WIDTH,
    height: RESTORED_WINDOW_HEIGHT
  }
}

function getDockedSize(
  bounds: Pick<Electron.Rectangle, 'width' | 'height'>,
  size?: FloatingWindowSize
): FloatingWindowSize {
  if (size) {
    return normalizeWindowSize(size)
  }

  if (bounds.width <= HANDLE_WIDTH * 2) {
    return normalizeWindowSize(bounds)
  }

  return getDefaultDockedSize()
}

function applyWindowBounds(win: BrowserWindow, bounds: FloatingWindowBounds): void {
  const wasResizable = win.isResizable()

  if (!wasResizable) {
    win.setResizable(true)
  }

  win.setBounds(bounds, false)

  if (!wasResizable) {
    win.setResizable(false)
  }
}

function getDockedPositionForBounds(
  bounds: Pick<Electron.Rectangle, 'x' | 'y' | 'width' | 'height'>,
  _nextState: DockedWindowState,
  workArea: Electron.Rectangle
): { x: number; y: number } {
  const maxY = workArea.y + workArea.height - bounds.height

  return {
    x: workArea.x + workArea.width - HANDLE_WIDTH,
    y: clamp(bounds.y, workArea.y, maxY)
  }
}

export function normalizeFloatingWindowState(
  windowState: AppConfig['windowState']
): SupportedWindowState {
  return windowState === 'docked-right' ? 'docked-right' : 'normal'
}

export function getSanitizedFloatingWindowPlacement(
  config: AppConfig,
  size?: FloatingWindowSize
): FloatingWindowPlacement {
  const windowState = normalizeFloatingWindowState(config.windowState)
  const resolvedSize =
    windowState === 'docked-right'
      ? size ?? getDefaultDockedSize()
      : size ?? {
          width: FLOATING_WINDOW_WIDTH,
          height: FLOATING_WINDOW_HEIGHT
        }
  const targetBounds = getWindowBoundsForState(
    {
      x: config.windowPosition.x,
      y: config.windowPosition.y,
      width: resolvedSize.width,
      height: resolvedSize.height
    },
    windowState,
    getWorkAreaForPoint(config.windowPosition),
    windowState === 'normal' ? resolvedSize : undefined
  )

  return {
    windowState,
    windowPosition: { x: targetBounds.x, y: targetBounds.y }
  }
}

export function getWindowBoundsForState(
  bounds: FloatingWindowBounds,
  windowState: AppConfig['windowState'],
  workArea: Electron.Rectangle,
  size?: FloatingWindowSize
): FloatingWindowBounds {
  const sanitizedWindowState = normalizeFloatingWindowState(windowState)

  if (sanitizedWindowState === 'normal') {
    const nextSize = size ? normalizeWindowSize(size) : bounds
    const nextBounds = {
      ...bounds,
      width: nextSize.width,
      height: nextSize.height
    }

    return {
      ...nextBounds,
      ...getClampedPosition(nextBounds, workArea)
    }
  }

  const dockedSize = getDockedSize(bounds, size)
  const dockedBounds = {
    x: bounds.x,
    y: bounds.y,
    width: dockedSize.width,
    height: dockedSize.height
  }

  return {
    ...dockedBounds,
    ...getDockedPositionForBounds(dockedBounds, sanitizedWindowState, workArea)
  }
}

function getInitialFloatingWindowBounds(config: AppConfig): FloatingWindowBounds {
  const windowState = normalizeFloatingWindowState(config.windowState)
  const initialSize =
    windowState === 'docked-right'
      ? getDefaultDockedSize()
      : {
          width: FLOATING_WINDOW_WIDTH,
          height: FLOATING_WINDOW_HEIGHT
        }

  return getWindowBoundsForState(
    {
      x: config.windowPosition.x,
      y: config.windowPosition.y,
      width: initialSize.width,
      height: initialSize.height
    },
    windowState,
    getWorkAreaForPoint(config.windowPosition)
  )
}

export function ensureFloatingWindowVisible(
  win: BrowserWindow,
  windowState: AppConfig['windowState'] = 'normal'
): FloatingWindowPlacement {
  const currentBounds = win.getBounds()
  const workArea = getDisplayWorkArea(win)
  const sanitizedWindowState = normalizeFloatingWindowState(windowState)
  const targetBounds = getWindowBoundsForState(currentBounds, sanitizedWindowState, workArea)

  if (
    currentBounds.x !== targetBounds.x ||
    currentBounds.y !== targetBounds.y ||
    currentBounds.width !== targetBounds.width ||
    currentBounds.height !== targetBounds.height
  ) {
    applyWindowBounds(win, targetBounds)
  }

  return {
    windowState: sanitizedWindowState,
    windowPosition: { x: targetBounds.x, y: targetBounds.y }
  }
}

export function restoreFloatingWindow(win: BrowserWindow): { x: number; y: number } {
  const currentBounds = win.getBounds()
  const workArea = getDisplayWorkArea(win)
  const restoredBounds = {
    ...currentBounds,
    width: Math.max(RESTORED_WINDOW_WIDTH, currentBounds.width),
    height: Math.max(RESTORED_WINDOW_HEIGHT, currentBounds.height)
  }
  const restoredPosition = getClampedPosition(restoredBounds, workArea)

  win.setSize(restoredBounds.width, restoredBounds.height)
  win.setPosition(restoredPosition.x, restoredPosition.y)

  if (win.isMinimized()) {
    win.restore()
  }

  if (!win.isVisible()) {
    win.show()
  }

  win.focus()

  setConfig({
    windowState: 'normal',
    windowPosition: restoredPosition
  })

  return restoredPosition
}

export function createFloatingWindow(): BrowserWindow {
  const config = getConfig()
  const initialWindowState = normalizeFloatingWindowState(config.windowState)
  const initialBounds = getInitialFloatingWindowBounds(config)

  const win = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    x: initialBounds.x,
    y: initialBounds.y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    autoHideMenuBar: true,
    title: 'Coding Plan Usage Tracker',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true
    }
  })

  registerWindowInstance(win, 'floating')
  attachExternalLinkHandler(win)

  if (
    initialWindowState !== config.windowState ||
    initialBounds.x !== config.windowPosition.x ||
    initialBounds.y !== config.windowPosition.y
  ) {
    setConfig({
      windowState: initialWindowState,
      windowPosition: { x: initialBounds.x, y: initialBounds.y }
    })
  }

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    windowInstances.delete(win)
  })

  void loadRendererWindow(win)

  return win
}

export function createSettingsWindow(): BrowserWindow {
  const existingSettingsWindow = resolveWindowInstance('settings')

  if (existingSettingsWindow) {
    if (existingSettingsWindow.isMinimized()) {
      existingSettingsWindow.restore()
    }

    if (!existingSettingsWindow.isVisible()) {
      existingSettingsWindow.show()
    }

    existingSettingsWindow.focus()
    return existingSettingsWindow
  }

  const win = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    minWidth: SETTINGS_WINDOW_MIN_WIDTH,
    minHeight: SETTINGS_WINDOW_MIN_HEIGHT,
    show: false,
    frame: true,
    alwaysOnTop: false,
    center: true,
    autoHideMenuBar: true,
    title: 'Coding Plan Usage Tracker - 设置',
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true
    }
  })

  registerWindowInstance(win, 'settings')
  attachExternalLinkHandler(win)

  win.on('ready-to-show', () => {
    if (!win.isMaximized()) {
      win.maximize()
    }

    win.show()
  })

  win.on('closed', () => {
    windowInstances.delete(win)
  })

  void loadRendererWindow(win, 'settings')

  return win
}

export function setupWindowDrag(win: BrowserWindow): void {
  registerWindowInstance(win, 'floating')

  if (dragListenerRegistered) {
    return
  }

  ipcMain.on('window:set-position', (_event, position) => {
    const floatingWindow = resolveWindowInstance('floating')

    if (!floatingWindow || !hasPointShape(position)) {
      return
    }

    const nextPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y)
    }

    floatingWindow.setPosition(nextPosition.x, nextPosition.y)
    setConfig({ windowPosition: nextPosition })
  })

  dragListenerRegistered = true
}

export function setupEdgeDocking(win: BrowserWindow): void {
  registerWindowInstance(win, 'floating')

  if (dockingListenerRegistered) {
    return
  }

  ipcMain.on('window:set-state', (_event, nextRequest) => {
    const floatingWindow = resolveWindowInstance('floating')
    const request = resolveWindowStateRequest(nextRequest)

    if (!floatingWindow || !request) {
      return
    }

    const sanitizedWindowState = normalizeFloatingWindowState(request.state)

    if (sanitizedWindowState === 'normal') {
      restoreFloatingWindow(floatingWindow)
      return
    }

    const targetBounds = getWindowBoundsForState(
      floatingWindow.getBounds(),
      sanitizedWindowState,
      getDisplayWorkArea(floatingWindow),
      request.size
    )

    applyWindowBounds(floatingWindow, targetBounds)
    setConfig({
      windowState: sanitizedWindowState,
      windowPosition: { x: targetBounds.x, y: targetBounds.y }
    })
  })

  dockingListenerRegistered = true
}

export function resizeWindow(win: BrowserWindow, width: number, height: number): void {
  const nextWidth = Math.max(MIN_WINDOW_WIDTH, Math.round(width))
  const nextHeight = Math.max(MIN_WINDOW_HEIGHT, Math.round(height))
  const windowState = getConfig().windowState
  const sanitizedWindowState = normalizeFloatingWindowState(windowState)
  const nextBounds = getWindowBoundsForState(
    {
      ...win.getBounds(),
      width: nextWidth,
      height: nextHeight
    },
    sanitizedWindowState,
    getDisplayWorkArea(win),
    { width: nextWidth, height: nextHeight }
  )

  applyWindowBounds(win, nextBounds)
  setConfig({
    windowState: sanitizedWindowState,
    windowPosition: { x: nextBounds.x, y: nextBounds.y }
  })
}
