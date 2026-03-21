import type { AuthField, IProvider, ProviderUsageData } from '../../shared/types'

const ZHIPU_AUTH_FIELDS: AuthField[] = [
  {
    key: 'authToken',
    label: 'API Token',
    type: 'password',
    placeholder: '输入智谱 API Token (sk-...)',
    required: true
  }
]

const zhipuProvider: IProvider = {
  id: 'zhipu',
  name: '智谱 CodeGeeX',
  icon: '🔸',
  getAuthFields(): AuthField[] {
    return ZHIPU_AUTH_FIELDS
  },
  async fetchUsage(authConfig: Record<string, string>): Promise<ProviderUsageData> {
    if (!authConfig.authToken?.trim()) {
      return {
        providerId: 'zhipu',
        dimensions: [],
        lastUpdated: Date.now(),
        error: '缺少智谱 API Token'
      }
    }

    return window.electronAPI.fetchUsage('zhipu')
  }
}

export default zhipuProvider
