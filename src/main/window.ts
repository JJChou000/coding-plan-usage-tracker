import { BrowserWindow, ipcMain, screen, shell } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'

import type { AppConfig } from '../shared/types'
import { getConfig, setConfig } from './configStore'

const FLOATING_WINDOW_WIDTH = 320
const FLOATING_WINDOW_HEIGHT = 120
const SETTINGS_WINDOW_WIDTH = 500
const SETTINGS_WINDOW_HEIGHT = 400
const EDGE_DOCK_THRESHOLD = 20
const HANDLE_WIDTH = 24
const MIN_WINDOW_WIDTH = 160
const MIN_WINDOW_HEIGHT = 80
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

function getDockedPosition(
  win: BrowserWindow,
  nextState: Exclude<AppConfig['windowState'], 'normal'>
): { x: number; y: number } {
  const bounds = win.getBounds()
  const workArea = getDisplayWorkArea(win)
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

function getRestoredPosition(win: BrowserWindow): { x: number; y: number } {
  const bounds = win.getBounds()
  const workArea = getDisplayWorkArea(win)
  const maxX = workArea.x + workArea.width - bounds.width
  const maxY = workArea.y + workArea.height - bounds.height

  if (bounds.x < workArea.x + EDGE_DOCK_THRESHOLD) {
    return { x: workArea.x, y: clamp(bounds.y, workArea.y, maxY) }
  }

  if (bounds.x + bounds.width > workArea.x + workArea.width - EDGE_DOCK_THRESHOLD) {
    return { x: maxX, y: clamp(bounds.y, workArea.y, maxY) }
  }

  if (bounds.y < workArea.y + EDGE_DOCK_THRESHOLD) {
    return { x: clamp(bounds.x, workArea.x, maxX), y: workArea.y }
  }

  if (bounds.y + bounds.height > workArea.y + workArea.height - EDGE_DOCK_THRESHOLD) {
    return { x: clamp(bounds.x, workArea.x, maxX), y: maxY }
  }

  return {
    x: clamp(bounds.x, workArea.x, maxX),
    y: clamp(bounds.y, workArea.y, maxY)
  }
}

export function createFloatingWindow(): BrowserWindow {
  const config = getConfig()

  const win = new BrowserWindow({
    width: FLOATING_WINDOW_WIDTH,
    height: FLOATING_WINDOW_HEIGHT,
    x: config.windowPosition.x,
    y: config.windowPosition.y,
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
      sandbox: false
    }
  })

  floatingWindow = win
  attachExternalLinkHandler(win)

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
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    show: false,
    frame: true,
    alwaysOnTop: false,
    autoHideMenuBar: true,
    title: 'Coding Plan Usage Tracker - 设置',
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  settingsWindow = win
  attachExternalLinkHandler(win)

  win.on('ready-to-show', () => {
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
      nextState === 'normal' ? getRestoredPosition(floatingWindow) : getDockedPosition(floatingWindow, nextState)

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
