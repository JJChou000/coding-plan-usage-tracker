import type { ProviderConfig, ProviderUsageData } from '../../shared/types'

import { getProviderDisplayMeta } from '../providers/providerDisplay'
import ProviderIcon from './ProviderIcon'
import { formatRefreshTimeLabel, getPrimaryDimension } from './collapsedViewModel'
import './CollapsedView.css'

export interface CollapsedViewProps {
  providers: ProviderUsageData[]
  configs: ProviderConfig[]
  onToggleExpand: () => void
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
        providerMeta: getProviderDisplayMeta(provider.providerId),
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
          <span className="collapsed-view__summary">
            <span className="collapsed-view__identity">
              <ProviderIcon
                icon={providerMeta.icon}
                fallbackIcon={providerMeta.fallbackIcon}
                alt={providerMeta.name}
                className="collapsed-view__icon"
                imageClassName="collapsed-view__icon-image"
                size={16}
              />
              <span className="collapsed-view__name">{providerMeta.name}</span>
            </span>

            <strong className="collapsed-view__metric">
              {Math.round(primaryDimension.usedPercent)}%
            </strong>
          </span>

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
