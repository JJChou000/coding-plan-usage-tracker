import type { IProvider } from '../../shared/types'

import bailianProvider from './bailianProvider'
import zhipuProvider from './zhipuProvider'

const providerRegistry = new Map<string, IProvider>()

export function registerProvider(provider: IProvider): void {
  if (providerRegistry.has(provider.id)) {
    throw new Error(`Provider ${provider.id} already registered`)
  }

  providerRegistry.set(provider.id, provider)
}

export function getProvider(id: string): IProvider | undefined {
  return providerRegistry.get(id)
}

export function getAllProviders(): IProvider[] {
  return Array.from(providerRegistry.values())
}

for (const provider of [zhipuProvider, bailianProvider]) {
  registerProvider(provider)
}
