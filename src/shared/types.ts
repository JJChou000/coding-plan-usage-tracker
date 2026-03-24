// ===== 厂商配置 =====
/** 单个配额维度（百分比条） */
export interface QuotaDimension {
  id: string
  label: string
  usedPercent: number
  used: number
  total: number
  resetTime?: string
  isChecked: boolean
}

/** 厂商用量数据 */
export interface ProviderUsageData {
  providerId: string
  dimensions: QuotaDimension[]
  lastUpdated: number
  error?: string
}

/** 厂商认证字段定义 */
export interface AuthField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
  required: boolean
}

/** 厂商 Provider 接口 */
export interface IProvider {
  id: string
  name: string
  icon: string
  getAuthFields(): AuthField[]
  fetchUsage(authConfig: Record<string, string>): Promise<ProviderUsageData>
}

// ===== 应用配置（electron-store 持久化） =====
export interface ProviderConfig {
  providerId: string
  auth: Record<string, string>
  checkedDimensions: string[]
  enabled: boolean
}

export interface AppConfig {
  providers: ProviderConfig[]
  refreshInterval: number
  windowOpacity: number
  windowPosition: { x: number; y: number }
  windowState: 'normal' | 'docked-left' | 'docked-right' | 'docked-top' | 'docked-bottom'
  isExpanded: boolean
}

// ===== 全局状态 =====
export interface AppState {
  config: AppConfig
  usageData: Map<string, ProviderUsageData>
  isLoading: boolean
  settingsOpen: boolean
}
