import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent, type Tray } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import { getConfig, setConfig } from './configStore'
import { createTray } from './tray'
import { createFloatingWindow, resizeWindow, setupEdgeDocking, setupWindowDrag } from './window'
import type { AppConfig, ProviderUsageData } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
let isQuitting = false
let appHandlersRegistered = false
let resizeListenerRegistered = false

function isConfigPatch(value: unknown): value is Partial<AppConfig> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildMockUsageData(providerId: string): ProviderUsageData {
  const lastUpdated = Date.now()

  if (providerId === 'zhipu') {
    return {
      providerId,
      dimensions: [
        {
          id: 'token_5h',
          label: '每5小时 Token',
          usedPercent: 31,
          used: 62000,
          total: 200000,
          resetTime: '12:00',
          isChecked: true
        },
        {
          id: 'mcp_monthly',
          label: 'MCP 每月额度',
          usedPercent: 0,
          used: 0,
          total: 2000,
          resetTime: '03-27',
          isChecked: false
        }
      ],
      lastUpdated
    }
  }

  if (providerId === 'bailian') {
    return {
      providerId,
      dimensions: [
        {
          id: 'usage_5h',
          label: '近5小时用量',
          usedPercent: 6,
          used: 540,
          total: 9000,
          resetTime: '10:32:42',
          isChecked: true
        },
        {
          id: 'usage_7d',
          label: '近一周用量',
          usedPercent: 25,
          used: 4500,
          total: 18000,
          resetTime: '03-23',
          isChecked: false
        },
        {
          id: 'usage_30d',
          label: '近一月用量',
          usedPercent: 18,
          used: 3240,
          total: 18000,
          resetTime: '04-13',
          isChecked: false
        }
      ],
      lastUpdated
    }
  }

  return {
    providerId,
    dimensions: [],
    lastUpdated,
    error: 'Provider mock data not configured yet.'
  }
}

function handleUsageFetch(event: IpcMainInvokeEvent, providerId: unknown): ProviderUsageData {
  const resolvedProviderId =
    typeof providerId === 'string' && providerId.length > 0 ? providerId : 'unknown'
  const data = buildMockUsageData(resolvedProviderId)

  event.sender.send('usage:data', data)

  return data
}

function broadcastConfigUpdate(config: AppConfig): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }

    window.webContents.send('config:updated', config)
  }
}

function registerAppIpcHandlers(): void {
  if (appHandlersRegistered) {
    return
  }

  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_event, configPatch) => {
    if (isConfigPatch(configPatch)) {
      setConfig(configPatch)
      broadcastConfigUpdate(getConfig())
    }
  })
  ipcMain.handle('usage:fetch', handleUsageFetch)

  appHandlersRegistered = true
}

function bindWindowIpc(): void {
  if (resizeListenerRegistered) {
    return
  }

  ipcMain.on('window:resize', (_event, width, height) => {
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return
    }

    resizeWindow(mainWindow, width, height)
  })

  resizeListenerRegistered = true
}

function bootstrapFloatingWindow(): BrowserWindow {
  const win = createFloatingWindow()

  mainWindow = win
  win.on('close', (event) => {
    if (isQuitting) {
      return
    }

    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })
  setupWindowDrag(win)
  setupEdgeDocking(win)
  bindWindowIpc()

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.codingplanusagetracker.app')
  registerAppIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  bootstrapFloatingWindow()
  appTray = createTray(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrapFloatingWindow()
    }

    if (!appTray) {
      appTray = createTray(() => mainWindow)
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // Keep the app alive so the tray can control reopening and exiting.
})
