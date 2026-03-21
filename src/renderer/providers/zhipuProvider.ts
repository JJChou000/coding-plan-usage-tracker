import type { AuthField, IProvider, ProviderUsageData, QuotaDimension } from '../../shared/types'

const ZHIPU_PROVIDER_ID = 'zhipu'
const ZHIPU_BASE_URL = 'https://open.bigmodel.cn'

const ZHIPU_AUTH_FIELDS: AuthField[] = [
  {
    key: 'authToken',
    label: 'API Token',
    type: 'password',
    placeholder: '输入智谱 API Token (sk-...)',
    required: true
  }
]

interface ZhipuUsageLimit {
  type?: string
  usage?: number | string | null
  currentValue?: number | string | null
  percentage?: number | string | null
  nextResetTime?: number | string | null
}

export interface ZhipuUsageRequestConfig {
  providerId: typeof ZHIPU_PROVIDER_ID
  baseUrl: typeof ZHIPU_BASE_URL
  headers: {
    Authorization: string
  }
  endpoints: {
    quotaLimit: string
    modelUsage: string
    toolUsage: string
  }
}

type ZhipuRawUsageResponse = unknown

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isProviderUsageData(value: unknown): value is ProviderUsageData {
  return (
    isRecord(value) &&
    typeof value.providerId === 'string' &&
    Array.isArray(value.dimensions) &&
    typeof value.lastUpdated === 'number'
  )
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100))
}

function formatResetTime(nextResetTime: unknown): string | undefined {
  const timestamp = toFiniteNumber(nextResetTime)

  if (timestamp === null || timestamp <= 0) {
    return undefined
  }

  const resetDate = new Date(timestamp)

  if (Number.isNaN(resetDate.getTime())) {
    return undefined
  }

  return resetDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function resolveLimits(rawResponse: ZhipuRawUsageResponse): ZhipuUsageLimit[] {
  if (isProviderUsageData(rawResponse)) {
    return []
  }

  const source =
    isRecord(rawResponse) && isRecord(rawResponse.quotaLimit)
      ? rawResponse.quotaLimit
      : isRecord(rawResponse)
        ? rawResponse
        : {}
  const sourceData = source.data

  if (isRecord(sourceData) && Array.isArray(sourceData.limits)) {
    return sourceData.limits as ZhipuUsageLimit[]
  }

  if (Array.isArray(source.limits)) {
    return source.limits as ZhipuUsageLimit[]
  }

  return []
}

function getUsedPercent(limit: ZhipuUsageLimit): number {
  const used = toFiniteNumber(limit.currentValue) ?? 0
  const total = toFiniteNumber(limit.usage) ?? 0

  if (total > 0) {
    return clampPercent((used / total) * 100)
  }

  return clampPercent(toFiniteNumber(limit.percentage) ?? 0)
}

function createDimension(
  limit: ZhipuUsageLimit,
  overrides: Pick<QuotaDimension, 'id' | 'label' | 'isChecked'> & {
    resetTime?: string
  }
): QuotaDimension {
  return {
    id: overrides.id,
    label: overrides.label,
    usedPercent: getUsedPercent(limit),
    used: toFiniteNumber(limit.currentValue) ?? 0,
    total: toFiniteNumber(limit.usage) ?? 0,
    resetTime: overrides.resetTime,
    isChecked: overrides.isChecked
  }
}

function getResponseError(rawResponse: ZhipuRawUsageResponse): string | undefined {
  if (!isRecord(rawResponse)) {
    return undefined
  }

  if (typeof rawResponse.error === 'string' && rawResponse.error.trim().length > 0) {
    return rawResponse.error
  }

  if (isRecord(rawResponse.quotaLimit) && typeof rawResponse.quotaLimit.error === 'string') {
    return rawResponse.quotaLimit.error
  }

  return undefined
}

export function buildZhipuUsageRequest(
  authConfig: Record<string, string>
): ZhipuUsageRequestConfig {
  const authToken = authConfig.authToken?.trim() ?? ''

  return {
    providerId: ZHIPU_PROVIDER_ID,
    baseUrl: ZHIPU_BASE_URL,
    headers: {
      Authorization: authToken
    },
    endpoints: {
      quotaLimit: `${ZHIPU_BASE_URL}/api/monitor/usage/quota/limit`,
      modelUsage: `${ZHIPU_BASE_URL}/api/monitor/usage/model-usage`,
      toolUsage: `${ZHIPU_BASE_URL}/api/monitor/usage/tool-usage`
    }
  }
}

export function parseZhipuUsageResponse(rawResponse: ZhipuRawUsageResponse): ProviderUsageData {
  if (isProviderUsageData(rawResponse)) {
    return rawResponse
  }

  const limits = resolveLimits(rawResponse)
  const tokenLimit = limits.find((limit) => limit.type === 'TOKENS_LIMIT')
  const mcpLimit = limits.find((limit) => limit.type === 'TIME_LIMIT')
  const dimensions: QuotaDimension[] = []

  if (tokenLimit) {
    dimensions.push(
      createDimension(tokenLimit, {
        id: 'token_5h',
        label: '每5小时 Token',
        resetTime: formatResetTime(tokenLimit.nextResetTime),
        isChecked: true
      })
    )
  }

  if (mcpLimit) {
    dimensions.push(
      createDimension(mcpLimit, {
        id: 'mcp_monthly',
        label: 'MCP 每月额度',
        isChecked: false
      })
    )
  }

  const error = getResponseError(rawResponse)

  if (dimensions.length === 0) {
    return {
      providerId: ZHIPU_PROVIDER_ID,
      dimensions: [],
      lastUpdated: Date.now(),
      error: error ?? '智谱用量数据格式不正确'
    }
  }

  return {
    providerId: ZHIPU_PROVIDER_ID,
    dimensions,
    lastUpdated: Date.now(),
    ...(error ? { error } : {})
  }
}

const zhipuProvider: IProvider = {
  id: ZHIPU_PROVIDER_ID,
  name: '智谱 CodeGeeX',
  icon: '🔸',
  getAuthFields(): AuthField[] {
    return ZHIPU_AUTH_FIELDS
  },
  async fetchUsage(authConfig: Record<string, string>): Promise<ProviderUsageData> {
    if (!authConfig.authToken?.trim()) {
      return {
        providerId: ZHIPU_PROVIDER_ID,
        dimensions: [],
        lastUpdated: Date.now(),
        error: '缺少智谱 API Token'
      }
    }

    const requestConfig = buildZhipuUsageRequest(authConfig)

    const rawResponse = await window.electronAPI.fetchUsage(requestConfig.providerId, {
      authToken: requestConfig.headers.Authorization
    })

    return parseZhipuUsageResponse(rawResponse)
  }
}

export default zhipuProvider
