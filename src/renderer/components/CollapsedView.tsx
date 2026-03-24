import type { ProviderConfig, ProviderUsageData } from '../../shared/types'

import { formatRefreshTimeLabel, getPrimaryDimension } from './collapsedViewModel'
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
        error: provider.error,
        refreshTimeLabel: formatRefreshTimeLabel(provider.lastUpdated)
      }
    ]
  })

  if (rows.length === 0) {
    return null
  }

  return (
    <div className="collapsed-view">
      {rows.map(({ providerId, providerMeta, primaryDimension, error, refreshTimeLabel }) => (
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

          <strong className="collapsed-view__metric">
            {Math.round(primaryDimension.usedPercent)}%
          </strong>

          <span className="collapsed-view__refresh">
            {error ? (
              <span className="collapsed-view__status-dot" aria-hidden="true" title={error} />
            ) : null}
            {refreshTimeLabel ? (
              <span className="collapsed-view__refresh-text">{refreshTimeLabel}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}

export default CollapsedView
