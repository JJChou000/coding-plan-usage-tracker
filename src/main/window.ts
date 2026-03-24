import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

import type { AppConfig } from '../shared/types'
import { getConfig, setConfig } from './configStore'

const FLOATING_WINDOW_WIDTH = 320
const FLOATING_WINDOW_HEIGHT = 120
const SETTINGS_WINDOW_WIDTH = 960
const SETTINGS_WINDOW_HEIGHT = 720
const SETTINGS_WINDOW_MIN_WIDTH = 720
const SETTINGS_WINDOW_MIN_HEIGHT = 560
const EDGE_DOCK_THRESHOLD = 20
const HANDLE_WIDTH = 24
const MIN_WINDOW_WIDTH = HANDLE_WIDTH
const MIN_WINDOW_HEIGHT = HANDLE_WIDTH
const ANIMATION_STEPS = 8
const ANIMATION_INTERVAL_MS = 12

let floatingWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let dragListenerRegistered = false
let dockingListenerRegistered = false

function isWindowState(value: unknown): value is AppConfig['windowState'] {
  return (
    value === 'normal' ||
    value === 'docked-left' ||
    value === 'docked-right' ||
    value === 'docked-top' ||
    value === 'docked-bottom'
  )
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

function animateWindowPosition(win: BrowserWindow, targetX: number, targetY: number): void {
  const [startX, startY] = win.getPosition()

  if (startX === targetX && startY === targetY) {
    return
  }

  let currentStep = 0
  const timer = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(timer)
      return
    }

    currentStep += 1
    const progress = currentStep / ANIMATION_STEPS
    const easedProgress = 1 - Math.pow(1 - progress, 3)
    const nextX = Math.round(startX + (targetX - startX) * easedProgress)
    const nextY = Math.round(startY + (targetY - startY) * easedProgress)

    win.setPosition(nextX, nextY)

    if (currentStep >= ANIMATION_STEPS) {
      clearInterval(timer)
    }
  }, ANIMATION_INTERVAL_MS)
}

function getDisplayWorkArea(win: BrowserWindow): Electron.Rectangle {
  return screen.getDisplayMatching(win.getBounds()).workArea
}

function getDockedPositionForBounds(
  bounds: Pick<Electron.Rectangle, 'x' | 'y' | 'width' | 'height'>,
  nextState: Exclude<AppConfig['windowState'], 'normal'>,
  workArea: Electron.Rectangle
): { x: number; y: number } {
  const maxX = workArea.x + workArea.width - bounds.width
  const maxY = workArea.y + workArea.height - bounds.height

  switch (nextState) {
    case 'docked-left':
      return {
        x: workArea.x - bounds.width + HANDLE_WIDTH,
        y: clamp(bounds.y, workArea.y, maxY)
      }
    case 'docked-right':
      return {
        x: workArea.x + workArea.width - HANDLE_WIDTH,
        y: clamp(bounds.y, workArea.y, maxY)
      }
    case 'docked-top':
      return {
        x: clamp(bounds.x, workArea.x, maxX),
        y: workArea.y - bounds.height + HANDLE_WIDTH
      }
    case 'docked-bottom':
      return {
        x: clamp(bounds.x, workArea.x, maxX),
        y: workArea.y + workArea.height - HANDLE_WIDTH
      }
  }
}

function getSanitizedFloatingWindowPosition(
  config: AppConfig,
  size: { width: number; height: number } = {
    width: FLOATING_WINDOW_WIDTH,
    height: FLOATING_WINDOW_HEIGHT
  }
): { x: number; y: number } {
  const bounds = {
    x: config.windowPosition.x,
    y: config.windowPosition.y,
    width: size.width,
    height: size.height
  }
  const workArea = getWorkAreaForPoint(config.windowPosition)

  if (config.windowState === 'normal') {
    return getClampedPosition(bounds, workArea)
  }

  return getDockedPositionForBounds(bounds, config.windowState, workArea)
}

function getRestoredPosition(win: BrowserWindow): { x: number; y: number } {
  const bounds = win.getBounds()
  const workArea = getDisplayWorkArea(win)
  const clampedPosition = getClampedPosition(bounds, workArea)

  if (bounds.x < workArea.x + EDGE_DOCK_THRESHOLD) {
    return { x: workArea.x, y: clampedPosition.y }
  }

  if (bounds.x + bounds.width > workArea.x + workArea.width - EDGE_DOCK_THRESHOLD) {
    return {
      x: workArea.x + workArea.width - bounds.width,
      y: clampedPosition.y
    }
  }

  if (bounds.y < workArea.y + EDGE_DOCK_THRESHOLD) {
    return { x: clampedPosition.x, y: workArea.y }
  }

  if (bounds.y + bounds.height > workArea.y + workArea.height - EDGE_DOCK_THRESHOLD) {
    return {
      x: clampedPosition.x,
      y: workArea.y + workArea.height - bounds.height
    }
  }

  return clampedPosition
}

export function ensureFloatingWindowVisible(
  win: BrowserWindow,
  windowState: AppConfig['windowState'] = 'normal'
): { x: number; y: number } {
  const currentBounds = win.getBounds()
  const workArea = getDisplayWorkArea(win)
  const targetPosition =
    windowState === 'normal'
      ? getClampedPosition(currentBounds, workArea)
      : getDockedPositionForBounds(currentBounds, windowState, workArea)

  if (currentBounds.x !== targetPosition.x || currentBounds.y !== targetPosition.y) {
    win.setPosition(targetPosition.x, targetPosition.y)
  }

  return targetPosition
}

export function createFloatingWindow(): BrowserWindow {
  const config = getConfig()
  const initialPosition = getSanitizedFloatingWindowPosition(config)

  const win = new BrowserWindow({
    width: FLOATING_WINDOW_WIDTH,
    height: FLOATING_WINDOW_HEIGHT,
    x: initialPosition.x,
    y: initialPosition.y,
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

  floatingWindow = win
  attachExternalLinkHandler(win)

  if (
    initialPosition.x !== config.windowPosition.x ||
    initialPosition.y !== config.windowPosition.y
  ) {
    setConfig({
      windowPosition: initialPosition
    })
  }

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    if (floatingWindow === win) {
      floatingWindow = null
    }
  })

  void loadRendererWindow(win)

  return win
}

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore()
    }

    if (!settingsWindow.isVisible()) {
      settingsWindow.show()
    }

    settingsWindow.focus()
    return settingsWindow
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

  settingsWindow = win
  attachExternalLinkHandler(win)

  win.on('ready-to-show', () => {
    if (!win.isMaximized()) {
      win.maximize()
    }

    win.show()
  })

  win.on('closed', () => {
    if (settingsWindow === win) {
      settingsWindow = null
    }
  })

  void loadRendererWindow(win, 'settings')

  return win
}

export function setupWindowDrag(win: BrowserWindow): void {
  floatingWindow = win

  if (dragListenerRegistered) {
    return
  }

  ipcMain.on('window:set-position', (_event, position) => {
    if (!floatingWindow || floatingWindow.isDestroyed() || !hasPointShape(position)) {
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
  floatingWindow = win

  if (dockingListenerRegistered) {
    return
  }

  ipcMain.on('window:set-state', (_event, nextState) => {
    if (!floatingWindow || floatingWindow.isDestroyed() || !isWindowState(nextState)) {
      return
    }

    const targetPosition =
      nextState === 'normal'
        ? getRestoredPosition(floatingWindow)
        : getDockedPositionForBounds(
            floatingWindow.getBounds(),
            nextState,
            getDisplayWorkArea(floatingWindow)
          )

    animateWindowPosition(floatingWindow, targetPosition.x, targetPosition.y)
    setConfig({
      windowState: nextState,
      windowPosition: targetPosition
    })
  })

  dockingListenerRegistered = true
}

export function resizeWindow(win: BrowserWindow, width: number, height: number): void {
  const nextWidth = Math.max(MIN_WINDOW_WIDTH, Math.round(width))
  const nextHeight = Math.max(MIN_WINDOW_HEIGHT, Math.round(height))

  win.setSize(nextWidth, nextHeight)
}
