import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { IProvider } from '../../shared/types'

async function loadProviderRegistry() {
  vi.resetModules()
  return import('./providerRegistry')
}

function createProvider(id: string): IProvider {
  return {
    id,
    name: `Provider ${id}`,
    icon: '',
    getAuthFields: () => [],
    fetchUsage: async () => ({
      providerId: id,
      dimensions: [],
      lastUpdated: Date.now()
    })
  }
}

describe('providerRegistry', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should expose auto-registered providers', async () => {
    const { getAllProviders, getProvider } = await loadProviderRegistry()

    expect(getProvider('zhipu')).toBeDefined()
    expect(getProvider('bailian')).toBeDefined()
    expect(getAllProviders().map((provider) => provider.id)).toEqual(['zhipu', 'bailian'])
  })

  it('should throw when registering a duplicate provider id', async () => {
    const { registerProvider } = await loadProviderRegistry()

    expect(() => registerProvider(createProvider('zhipu'))).toThrowError(
      'Provider zhipu already registered'
    )
  })
})
