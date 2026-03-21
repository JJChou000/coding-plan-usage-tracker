import type { ProviderConfig, ProviderUsageData, QuotaDimension } from '../../shared/types'

import ProgressBar from './ProgressBar'
import './CollapsedView.css'

export interface CollapsedViewProps {
  providers: ProviderUsageData[]
  configs: ProviderConfig[]
  onToggleExpand: () => void
}

type ProviderMeta = {
  name: string
  icon: string
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  zhipu: {
    name: '智谱',
    icon: '🔸'
  },
  bailian: {
    name: '百炼',
    icon: '🔹'
  }
}

function getProviderMeta(providerId: string): ProviderMeta {
  return (
    PROVIDER_META[providerId] ?? {
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      icon: '•'
    }
  )
}

function isImageSource(icon: string): boolean {
  return /^(data:image|https?:\/\/|\.{0,2}\/|\/)/.test(icon)
}

function getPrimaryDimension(
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

function CollapsedView({
  providers,
  configs,
  onToggleExpand
}: CollapsedViewProps): React.JSX.Element | null {
  const configMap = new Map(
    configs.filter((config) => config.enabled).map((config) => [config.providerId, config])
  )

  const rows = providers.flatMap((provider) => {
    const config = configMap.get(provider.providerId)

    if (!config) {
      return []
    }

    const primaryDimension = getPrimaryDimension(provider, config)

    if (!primaryDimension) {
      return []
    }

    return [
      {
        providerId: provider.providerId,
        providerMeta: getProviderMeta(provider.providerId),
        primaryDimension,
        error: provider.error
      }
    ]
  })

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="collapsed-view">
      {rows.map(({ providerId, providerMeta, primaryDimension, error }) => (
        <button
          key={providerId}
          type="button"
          className={`collapsed-view__row${error ? ' collapsed-view__row--error' : ''}`}
          onClick={onToggleExpand}
          aria-label={
            error
              ? `展开 ${providerMeta.name} 详情，当前错误：${error}`
              : `展开 ${providerMeta.name} 详情`
          }
        >
          <span className="collapsed-view__identity">
            <span className="collapsed-view__icon" aria-hidden="true">
              {isImageSource(providerMeta.icon) ? (
                <img
                  className="collapsed-view__icon-image"
                  src={providerMeta.icon}
                  alt=""
                  width="16"
                  height="16"
                />
              ) : (
                providerMeta.icon
              )}
            </span>
            <span className="collapsed-view__name">{providerMeta.name}</span>
          </span>

          <span className="collapsed-view__metric">
            <span className="collapsed-view__bar">
              <ProgressBar percent={primaryDimension.usedPercent} />
            </span>
            <strong className="collapsed-view__percent">
              {Math.round(primaryDimension.usedPercent)}%
            </strong>
          </span>

          {error ? (
            <span className="collapsed-view__status collapsed-view__status--error" title={error}>
              错误
            </span>
          ) : null}

          {primaryDimension.resetTime ? (
            <span className="collapsed-view__reset">⏱ {primaryDimension.resetTime}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export default CollapsedView
