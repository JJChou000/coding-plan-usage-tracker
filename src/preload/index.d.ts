import type { AppConfig, ProviderUsageData } from '../shared/types'

export interface ElectronAPI {
  getConfig: () => Promise<AppConfig>
  setConfig: (config: AppConfig) => Promise<void>
  fetchUsage: (providerId: string) => Promise<ProviderUsageData>
  onUsageData: (callback: (data: ProviderUsageData) => void) => void
  setWindowPosition: (pos: { x: number; y: number }) => void
  setWindowState: (state: string) => void
  resizeWindow: (width: number, height: number) => void
  onRefresh: (callback: () => void) => void
  onOpenSettings: (callback: () => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
