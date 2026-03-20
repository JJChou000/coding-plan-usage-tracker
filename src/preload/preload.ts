import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ProviderUsageData } from '../shared/types'

const electronAPI = {
  getConfig: () => ipcRenderer.invoke('config:get') as Promise<AppConfig>,
  setConfig: (config: AppConfig) => ipcRenderer.invoke('config:set', config),
  fetchUsage: (providerId: string) => ipcRenderer.invoke('usage:fetch', providerId) as Promise<ProviderUsageData>,
  onUsageData: (callback: (data: ProviderUsageData) => void) =>
    ipcRenderer.on('usage:data', (_event, data: ProviderUsageData) => callback(data)),
  setWindowPosition: (pos: { x: number; y: number }) => ipcRenderer.send('window:set-position', pos),
  setWindowState: (state: string) => ipcRenderer.send('window:set-state', state),
  resizeWindow: (width: number, height: number) => ipcRenderer.send('window:resize', width, height),
  onRefresh: (callback: () => void) => ipcRenderer.on('app:refresh', () => callback()),
  onOpenSettings: (callback: () => void) => ipcRenderer.on('app:open-settings', () => callback())
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
} else {
  // @ts-expect-error bridged for non-isolated development fallback
  window.electronAPI = electronAPI
}
