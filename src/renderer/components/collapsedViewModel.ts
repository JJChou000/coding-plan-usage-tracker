import type { ProviderConfig, ProviderUsageData, QuotaDimension } from '../../shared/types'

export type DockedHandleDisplay = {
  providerId?: string
  text: string
  state: 'usage' | 'placeholder'
}

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

export function formatRefreshTimeLabel(lastUpdated: number, timeZone?: string): string | undefined {
  if (!Number.isFinite(lastUpdated)) {
    return undefined
  }

  const formattedTime = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {})
  }).format(new Date(lastUpdated))

  return `刷新 ${formattedTime}`
}

export function getDockedHandleDisplay(
  configs: ProviderConfig[],
  providers: ProviderUsageData[]
): DockedHandleDisplay {
  const providerMap = new Map(providers.map((provider) => [provider.providerId, provider]))
  let fallbackProviderId: string | undefined

  for (const config of configs) {
    if (!config.enabled) {
      continue
    }

    const provider = providerMap.get(config.providerId)

    if (!provider) {
      continue
    }

    fallbackProviderId ??= provider.providerId

    const primaryDimension = getPrimaryDimension(provider, config)

    if (!primaryDimension) {
      continue
    }

    return {
      providerId: provider.providerId,
      text: `${Math.round(primaryDimension.usedPercent)}%`,
      state: 'usage'
    }
  }

  return {
    providerId: fallbackProviderId,
    text: '--',
    state: 'placeholder'
  }
}
