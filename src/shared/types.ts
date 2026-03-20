// ===== 厂商配置 =====
/** 单个配额维度（百分比条） */
export interface QuotaDimension {
  id: string // 唯一标识，如 'token_5h', 'mcp_monthly'
  label: string // 显示名称，如 '每5小时 Token', 'MCP 每月额度'
  usedPercent: number // 使用百分比 0-100
  used: number // 已用量（原始值）
  total: number // 总量（原始值）
  resetTime?: string // 重置时间（ISO 格式或可读文本）
  isChecked: boolean // 是否在折叠态显示
}

/** 厂商用量数据 */
export interface ProviderUsageData {
  providerId: string
  dimensions: QuotaDimension[]
  lastUpdated: number // 时间戳
  error?: string // 错误信息
}

/** 厂商认证字段定义 */
export interface AuthField {
  key: string // 字段名
  label: string // 显示标签
  type: 'text' | 'password' // 输入类型
  placeholder?: string
  required: boolean
}

/** 厂商 Provider 接口 */
export interface IProvider {
  id: string // 唯一ID，如 'zhipu', 'bailian'
  name: string // 显示名称
  icon: string // 图标路径或 base64
  getAuthFields(): AuthField[]
  fetchUsage(authConfig: Record<string, string>): Promise<ProviderUsageData>
}

// ===== 应用配置（electron-store 持久化） =====
export interface ProviderConfig {
  providerId: string
  auth: Record<string, string> // 认证信息 {token: 'sk-xxx'}
  checkedDimensions: string[] // 折叠态展示的维度 ID 列表
  enabled: boolean
}

export interface AppConfig {
  providers: ProviderConfig[]
  refreshInterval: number // 刷新间隔（秒），默认 60
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
