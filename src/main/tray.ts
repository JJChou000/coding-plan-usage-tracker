import { app, Menu, Tray, nativeImage, type BrowserWindow, type NativeImage } from 'electron'
import { join } from 'path'

import { createSettingsWindow } from './window'
import { getConfig } from './configStore'
import { ensureFloatingWindowVisible } from './window'

let tray: Tray | null = null

function loadTrayIcon(): NativeImage {
  const trayIconPath = join(__dirname, '../../resources/icons/tray-icon.png')
  const appIconPath = join(__dirname, '../../resources/icons/app-icon.png')
  let icon = nativeImage.createFromPath(trayIconPath)

  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(appIconPath)
  }

  if (icon.isEmpty()) {
    return nativeImage.createEmpty()
  }

  return icon.resize({ width: 16, height: 16 })
}

export function refreshFromTray(mainWindow: BrowserWindow | null): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  mainWindow.webContents.send('app:refresh')
}

export function openSettingsFromTray(): BrowserWindow {
  const settingsWindow = createSettingsWindow()
  const notifyOpenSettings = (): void => {
    if (settingsWindow.isDestroyed()) {
      return
    }

    settingsWindow.webContents.send('app:open-settings')
  }

  if (settingsWindow.webContents.isLoadingMainFrame()) {
    settingsWindow.webContents.once('did-finish-load', notifyOpenSettings)
  } else {
    notifyOpenSettings()
  }

  return settingsWindow
}

export function showMainWindowFromTray(mainWindow: BrowserWindow | null): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }

  const { windowState } = getConfig()

  ensureFloatingWindowVisible(mainWindow, windowState)

  if (!mainWindow.isVisible()) {
    mainWindow.show()
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
}

function buildTrayMenu(getMainWindow: () => BrowserWindow | null): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: '刷新数据',
      click: () => {
        refreshFromTray(getMainWindow())
      }
    },
    {
      label: '设置',
      click: () => {
        openSettingsFromTray()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])
}

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  if (tray) {
    tray.setContextMenu(buildTrayMenu(getMainWindow))
    return tray
  }

  tray = new Tray(loadTrayIcon())
  tray.setToolTip('Coding Plan Usage Tracker')
  tray.setContextMenu(buildTrayMenu(getMainWindow))

  tray.on('click', () => {
    showMainWindowFromTray(getMainWindow())
  })

  return tray
}
