import type { KeyboardEvent } from 'react'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'

import ProgressBar from './ProgressBar'
import './ExpandedView.css'

export interface ExpandedViewProps {
  providers: ProviderUsageData[]
  configs: ProviderConfig[]
  onToggleExpand: () => void
  onToggleDimension: (providerId: string, dimensionId: string) => void
}

type ProviderMeta = {
  name: string
  icon: string
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  zhipu: {
    name: '智谱 CodeGeeX',
    icon: '🔸'
  },
  bailian: {
    name: '阿里云百炼',
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

function handleKeyboardToggle(event: KeyboardEvent<HTMLElement>, onToggleExpand: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  onToggleExpand()
}

function ExpandedView({
  providers,
  configs,
  onToggleExpand,
  onToggleDimension
}: ExpandedViewProps): React.JSX.Element | null {
  const configMap = new Map(
    configs.filter((config) => config.enabled).map((config) => [config.providerId, config])
  )

  const sections = providers.flatMap((provider) => {
    const config = configMap.get(provider.providerId)

    if (!config) {
      return []
    }

    return [
      {
        provider,
        config,
        providerMeta: getProviderMeta(provider.providerId)
      }
    ]
  })

  if (sections.length === 0) {
    return null
  }

  return (
    <div className="expanded-view">
      {sections.map(({ provider, config, providerMeta }, index) => (
        <section
          key={provider.providerId}
          className={`expanded-view__provider${
            index < sections.length - 1 ? ' expanded-view__provider--bordered' : ''
          }`}
        >
          <button
            type="button"
            className="expanded-view__header"
            onClick={onToggleExpand}
            aria-label={`折叠 ${providerMeta.name}`}
          >
            <span className="expanded-view__title">
              <span className="expanded-view__icon" aria-hidden="true">
                {isImageSource(providerMeta.icon) ? (
                  <img
                    className="expanded-view__icon-image"
                    src={providerMeta.icon}
                    alt=""
                    width="16"
                    height="16"
                  />
                ) : (
                  providerMeta.icon
                )}
              </span>
              <span className="expanded-view__name">{providerMeta.name}</span>
            </span>
            <span className="expanded-view__chevron" aria-hidden="true">
              ▼
            </span>
          </button>

          <div className="expanded-view__dimensions">
            {provider.dimensions.map((dimension) => {
              const isChecked = config.checkedDimensions.includes(dimension.id)

              return (
                <div
                  key={dimension.id}
                  className="expanded-view__dimension"
                  role="button"
                  tabIndex={0}
                  onClick={onToggleExpand}
                  onKeyDown={(event) => handleKeyboardToggle(event, onToggleExpand)}
                  aria-label={`折叠 ${providerMeta.name} 的 ${dimension.label}`}
                >
                  <label
                    className="expanded-view__checkbox-wrap"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      className="expanded-view__checkbox-input"
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleDimension(provider.providerId, dimension.id)}
                      aria-label={`在折叠态显示 ${providerMeta.name} 的 ${dimension.label}`}
                    />
                    <span className="expanded-view__checkbox" aria-hidden="true" />
                  </label>

                  <span className="expanded-view__label">{dimension.label}</span>
                  <span className="expanded-view__bar">
                    <ProgressBar percent={dimension.usedPercent} size="sm" />
                  </span>
                  <strong className="expanded-view__percent">
                    {Math.round(dimension.usedPercent)}%
                  </strong>
                  {dimension.resetTime ? (
                    <span className="expanded-view__reset">{dimension.resetTime}</span>
                  ) : (
                    <span className="expanded-view__reset expanded-view__reset--empty" />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export default ExpandedView
