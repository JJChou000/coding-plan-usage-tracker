import type { ProviderConfig, ProviderUsageData } from '../../shared/types'

import type { ProviderErrorSummary } from './floatingWindowState'
import CollapsedView from './CollapsedView'
import ExpandedView from './ExpandedView'

export interface FloatingWindowContentProps {
  configs: ProviderConfig[]
  providers: ProviderUsageData[]
  hasConfiguredProviders: boolean
  hasVisibleProviders: boolean
  isExpanded: boolean
  isLoading: boolean
  primaryProviderError?: ProviderErrorSummary
  errorPlaceholderHint: string
  onToggleExpand: () => void
  onToggleDimension: (providerId: string, dimensionId: string) => void
}

function FloatingWindowContent({
  configs,
  providers,
  hasConfiguredProviders,
  hasVisibleProviders,
  isExpanded,
  isLoading,
  primaryProviderError,
  errorPlaceholderHint,
  onToggleExpand,
  onToggleDimension
}: FloatingWindowContentProps): React.JSX.Element {
  return (
    <div className="floating-window__surface">
      {!hasConfiguredProviders ? (
        <div className="floating-window__placeholder">
          <strong>请配置厂商</strong>
          <span>从系统托盘打开“设置”，添加一个已启用的厂商配置。</span>
        </div>
      ) : !hasVisibleProviders ? (
        <div
          className={`floating-window__placeholder${
            primaryProviderError ? ' floating-window__placeholder--error' : ''
          }`}
          role={primaryProviderError ? 'status' : undefined}
        >
          <strong>
            {primaryProviderError
              ? '额度刷新失败'
              : isLoading
                ? '正在加载额度数据...'
                : '暂时没有可显示的数据'}
          </strong>
          <span>
            {primaryProviderError
              ? `${primaryProviderError.providerName}：${primaryProviderError.message}`
              : isLoading
                ? '稍等几秒，浮窗会自动刷新。'
                : '请检查认证信息是否已填写，或从托盘手动刷新一次。'}
          </span>
          {primaryProviderError ? <span>{errorPlaceholderHint}</span> : null}
        </div>
      ) : isExpanded ? (
        <ExpandedView
          providers={providers}
          configs={configs}
          onToggleExpand={onToggleExpand}
          onToggleDimension={onToggleDimension}
        />
      ) : (
        <CollapsedView providers={providers} configs={configs} onToggleExpand={onToggleExpand} />
      )}
    </div>
  )
}

export default FloatingWindowContent
