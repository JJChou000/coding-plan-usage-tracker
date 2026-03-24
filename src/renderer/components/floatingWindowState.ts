import type { AppConfig, ProviderUsageData } from '../../shared/types'

export type ProviderErrorSummary = {
  providerId: string
  providerName: string
  message: string
}

export function getEnabledProviders(
  configs: AppConfig['providers'],
  usageData: Map<string, ProviderUsageData>
): ProviderUsageData[] {
  return configs
    .filter((config) => config.enabled)
    .map((config) => usageData.get(config.providerId))
    .filter((provider): provider is ProviderUsageData => Boolean(provider))
}

function getProviderDisplayName(providerId: string): string {
  switch (providerId) {
    case 'zhipu':
      return '智谱'
    case 'bailian':
      return '百炼'
    default:
      return providerId
  }
}

export function getProviderErrors(
  configs: AppConfig['providers'],
  usageData: Map<string, ProviderUsageData>
): ProviderErrorSummary[] {
  return configs
    .filter((config) => config.enabled)
    .flatMap((config) => {
      const message = usageData.get(config.providerId)?.error?.trim()

      if (!message) {
        return []
      }

      return [
        {
          providerId: config.providerId,
          providerName: getProviderDisplayName(config.providerId),
          message
        }
      ]
    })
}
