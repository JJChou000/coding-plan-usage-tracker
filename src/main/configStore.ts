import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

import ElectronStoreModule, { type Schema } from 'electron-store'
import { app } from 'electron'

import type { AppConfig, ProviderConfig } from '../shared/types'
import { DEFAULT_WINDOW_OPACITY, normalizeWindowOpacity } from '../shared/windowOpacity'

const defaultConfig: AppConfig = {
  providers: [],
  refreshInterval: 60,
  windowOpacity: DEFAULT_WINDOW_OPACITY,
  windowPosition: { x: 100, y: 100 },
  windowState: 'normal',
  isExpanded: false
}

const windowStates: AppConfig['windowState'][] = [
  'normal',
  'docked-left',
  'docked-right',
  'docked-top',
  'docked-bottom'
]

const appConfigSchema: Schema<AppConfig> = {
  providers: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        providerId: { type: 'string' },
        auth: {
          type: 'object',
          additionalProperties: { type: 'string' }
        },
        checkedDimensions: {
          type: 'array',
          items: { type: 'string' }
        },
        enabled: { type: 'boolean' }
      },
      required: ['providerId', 'auth', 'checkedDimensions', 'enabled'],
      additionalProperties: false
    }
  },
  refreshInterval: {
    type: 'number',
    minimum: 30,
    maximum: 300
  },
  windowOpacity: {
    type: 'number',
    minimum: 0.5,
    maximum: 1
  },
  windowPosition: {
    type: 'object',
    properties: {
      x: { type: 'number' },
      y: { type: 'number' }
    },
    required: ['x', 'y'],
    additionalProperties: false
  },
  windowState: {
    type: 'string',
    enum: windowStates
  },
  isExpanded: {
    type: 'boolean'
  }
}

const ElectronStore =
  (ElectronStoreModule as unknown as { default?: typeof ElectronStoreModule }).default ??
  ElectronStoreModule

const userDataOverride = process.env['CODING_PLAN_USAGE_TRACKER_USER_DATA_DIR']?.trim()

if (userDataOverride) {
  const resolvedUserDataPath = resolve(userDataOverride)

  mkdirSync(resolvedUserDataPath, { recursive: true })
  app.setPath('userData', resolvedUserDataPath)
}

const configStore = new ElectronStore<AppConfig>({
  schema: appConfigSchema,
  defaults: defaultConfig,
  encryptionKey: process.env['ENCRYPTION_KEY'] || 'coding-plan-tracker-default-key',
  clearInvalidConfig: true
})

export function getConfig(): AppConfig {
  return {
    ...configStore.store,
    windowOpacity: normalizeWindowOpacity(configStore.store.windowOpacity)
  }
}

export function setConfig(config: Partial<AppConfig>): void {
  if (Object.keys(config).length === 0) {
    return
  }

  const nextConfig: AppConfig = {
    ...configStore.store,
    ...config,
    windowOpacity:
      config.windowOpacity === undefined
        ? normalizeWindowOpacity(configStore.store.windowOpacity)
        : normalizeWindowOpacity(config.windowOpacity)
  }

  configStore.store = nextConfig
}

export function getProviders(): ProviderConfig[] {
  return configStore.get('providers')
}

export function setProviders(providers: ProviderConfig[]): void {
  configStore.set('providers', providers)
}
