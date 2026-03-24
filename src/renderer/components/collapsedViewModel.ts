import type { ProviderConfig, ProviderUsageData, QuotaDimension } from '../../shared/types'

export function getPrimaryDimension(
  provider: ProviderUsageData,
  config: ProviderConfig
): QuotaDimension | undefined {
  for (const dimensionId of config.checkedDimensions) {
    const dimension = provider.dimensions.find((item) => item.id === dimensionId)

    if (dimension) {
      return dimension
    }
  }

  return provider.dimensions[0]
}

export function formatRefreshTimeLabel(
  lastUpdated: number,
  timeZone?: string
): string | undefined {
  if (!Number.isFinite(lastUpdated)) {
    return undefined
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(lastUpdated))
}
