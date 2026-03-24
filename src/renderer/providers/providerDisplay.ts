import { getProvider } from './providerRegistry'

export type ProviderDisplayMeta = {
  name: string
  icon: string
  fallbackIcon: string
}

function toTitleCase(value: string): string {
  if (!value) {
    return '?'
  }

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getFallbackIcon(providerName: string, providerId: string): string {
  const normalizedName = providerName.trim()

  if (normalizedName) {
    return normalizedName.charAt(0)
  }

  return toTitleCase(providerId).charAt(0)
}

export function getProviderDisplayMeta(providerId: string): ProviderDisplayMeta {
  const provider = getProvider(providerId)
  const name = provider?.name?.trim() || toTitleCase(providerId)

  return {
    name,
    icon: provider?.icon ?? '',
    fallbackIcon: getFallbackIcon(name, providerId)
  }
}
