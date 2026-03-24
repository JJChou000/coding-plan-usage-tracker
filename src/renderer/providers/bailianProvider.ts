import type { AuthField, IProvider, ProviderUsageData } from '../../shared/types'
import bailianIcon from '../../../resources/icons/bailian.png'

const BAILIAN_AUTH_FIELDS: AuthField[] = [
  {
    key: 'cookie',
    label: 'Cookie',
    type: 'password',
    placeholder: '从浏览器复制百炼控制台的 Cookie',
    required: true
  }
]

const bailianProvider: IProvider = {
  id: 'bailian',
  name: '阿里云百炼',
  icon: bailianIcon,
  getAuthFields(): AuthField[] {
    return BAILIAN_AUTH_FIELDS
  },
  async fetchUsage(authConfig: Record<string, string>): Promise<ProviderUsageData> {
    if (!authConfig.cookie?.trim()) {
      return {
        providerId: 'bailian',
        dimensions: [],
        lastUpdated: Date.now(),
        error: '缺少百炼 Cookie'
      }
    }

    // TODO: 替换为真实 API 调用，待确认 API 端点和认证方式。
    return {
      providerId: 'bailian',
      dimensions: [
        {
          id: 'usage_5h',
          label: '近 5 小时用量',
          usedPercent: 6,
          used: 540,
          total: 9000,
          resetTime: '10:32:42',
          isChecked: true
        },
        {
          id: 'usage_7d',
          label: '近一周用量',
          usedPercent: 25,
          used: 4500,
          total: 18000,
          resetTime: '03-23',
          isChecked: false
        },
        {
          id: 'usage_30d',
          label: '近一月用量',
          usedPercent: 18,
          used: 3240,
          total: 18000,
          resetTime: '04-13',
          isChecked: false
        }
      ],
      lastUpdated: Date.now()
    }
  }
}

export default bailianProvider
