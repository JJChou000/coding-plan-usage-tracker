import type { KeyboardEvent, MouseEvent } from 'react'

import type { ProviderConfig, ProviderUsageData } from '../../shared/types'

import { getProviderDisplayMeta } from '../providers/providerDisplay'
import ProgressBar from './ProgressBar'
import ProviderIcon from './ProviderIcon'
import './ExpandedView.css'

export interface ExpandedViewProps {
  providers: ProviderUsageData[]
  configs: ProviderConfig[]
  onToggleExpand: () => void
  onToggleDimension: (providerId: string, dimensionId: string) => void
}

function handleKeyboardToggle(event: KeyboardEvent<HTMLElement>, onToggleExpand: () => void): void {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  onToggleExpand()
}

function stopInteractionPropagation(event: MouseEvent<HTMLElement>): void {
  event.stopPropagation()
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
        providerMeta: getProviderDisplayMeta(provider.providerId)
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
            aria-label={
              provider.error
                ? `折叠 ${providerMeta.name}，当前错误：${provider.error}`
                : `折叠 ${providerMeta.name}`
            }
          >
            <span className="expanded-view__title">
              <ProviderIcon
                icon={providerMeta.icon}
                fallbackIcon={providerMeta.fallbackIcon}
                alt={providerMeta.name}
                className="expanded-view__icon"
                imageClassName="expanded-view__icon-image"
                size={16}
              />
              <span className="expanded-view__name">{providerMeta.name}</span>
            </span>
            <span className="expanded-view__header-meta">
              {provider.error ? (
                <span
                  className="expanded-view__status expanded-view__status--error"
                  title={provider.error}
                >
                  错误
                </span>
              ) : null}
              <span className="expanded-view__chevron" aria-hidden="true">
                ▼
              </span>
            </span>
          </button>

          <div
            className="expanded-view__dimensions"
            role="radiogroup"
            aria-label={`${providerMeta.name} 折叠态展示维度`}
          >
            {provider.dimensions.map((dimension) => {
              const isChecked = config.checkedDimensions[0] === dimension.id

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
                  <span
                    className="expanded-view__checkbox-shell"
                    onMouseDown={stopInteractionPropagation}
                    onClick={stopInteractionPropagation}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isChecked}
                      aria-label={`将 ${providerMeta.name} 的 ${dimension.label} 设为折叠态展示项`}
                      className={`expanded-view__checkbox-wrap${
                        isChecked ? ' expanded-view__checkbox-wrap--checked' : ''
                      }`}
                      data-no-drag="true"
                      onMouseDown={stopInteractionPropagation}
                      onClick={(event) => {
                        event.stopPropagation()
                        onToggleDimension(provider.providerId, dimension.id)
                      }}
                    >
                      <span className="expanded-view__checkbox" aria-hidden="true" />
                    </button>
                  </span>

                  <span className="expanded-view__label">{dimension.label}</span>
                  <span className="expanded-view__bar">
                    <ProgressBar percent={dimension.usedPercent} size="sm" />
                  </span>
                  <strong className="expanded-view__percent floating-window__data-emphasis">
                    {Math.round(dimension.usedPercent)}%
                  </strong>
                  {dimension.resetTime ? (
                    <span className="expanded-view__reset floating-window__data-emphasis">
                      {dimension.resetTime}
                    </span>
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
