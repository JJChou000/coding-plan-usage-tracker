import { app, Menu, Tray, nativeImage, type BrowserWindow, type NativeImage } from 'electron'
import { join } from 'path'

import { createSettingsWindow } from './window'

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

function buildTrayMenu(getMainWindow: () => BrowserWindow | null): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: '刷新数据',
      click: () => {
        const mainWindow = getMainWindow()

        if (!mainWindow || mainWindow.isDestroyed()) {
          return
        }

        mainWindow.webContents.send('app:refresh')
      }
    },
    {
      label: '设置',
      click: () => {
        createSettingsWindow()
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
    const mainWindow = getMainWindow()

    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  })

  return tray
}
