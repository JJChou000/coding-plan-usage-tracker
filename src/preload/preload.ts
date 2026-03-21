import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ProviderUsageData } from '../shared/types'

const electronAPI = {
  getConfig: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
  setConfig: (config: AppConfig) => ipcRenderer.invoke('config:set', config),
  fetchUsage: (providerId: string, authConfig?: Record<string, string>) =>
    ipcRenderer.invoke('usage:fetch', providerId, authConfig) as Promise<unknown>,
  onUsageData: (callback: (data: ProviderUsageData) => void) =>
    ipcRenderer.on('usage:data', (_event, data: ProviderUsageData) => callback(data)),
  onConfigUpdated: (callback: (config: AppConfig) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, config: AppConfig): void =>
      callback(config)
    ipcRenderer.on('config:updated', listener)

    return () => {
      ipcRenderer.off('config:updated', listener)
    }
  },
  setWindowPosition: (pos: { x: number; y: number }) =>
    ipcRenderer.send('window:set-position', pos),
  setWindowState: (state: string) => ipcRenderer.send('window:set-state', state),
  resizeWindow: (width: number, height: number) => ipcRenderer.send('window:resize', width, height),
  onRefresh: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:refresh', listener)

    return () => {
      ipcRenderer.off('app:refresh', listener)
    }
  },
  onOpenSettings: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:open-settings', listener)

    return () => {
      ipcRenderer.off('app:open-settings', listener)
    }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
} else {
  // @ts-expect-error bridged for non-isolated development fallback
  window.electronAPI = electronAPI
}
