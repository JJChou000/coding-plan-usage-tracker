import { useRef, type CSSProperties } from 'react'

import { useAppContext } from '../context/AppContext'
import { useWindowDrag } from '../hooks/useWindowDrag'
import EdgeHandle from './EdgeHandle'
import FloatingWindowContent from './FloatingWindowContent'
import { getDockSide, getFloatingSize } from './floatingWindowLayout'
import { getEnabledProviders, getProviderErrors } from './floatingWindowState'
import './FloatingWindow.css'

function FloatingWindow(): React.JSX.Element {
  const { state, dispatch } = useAppContext()
  const floatingRef = useRef<HTMLDivElement | null>(null)

  const enabledConfigs = state.config.providers.filter((config) => config.enabled)
  const providerStates = getEnabledProviders(state.config.providers, state.usageData)
  const providers = providerStates.filter((provider) => provider.dimensions.length > 0)
  const hasVisibleProviders = providers.length > 0
  const providerErrors = getProviderErrors(state.config.providers, state.usageData)
  const currentSize = getFloatingSize(
    state.config.isExpanded,
    state.config.windowState,
    providers,
    hasVisibleProviders ? 0 : providerErrors.length
  )
  const isDocked = state.config.windowState !== 'normal'
  const dockSide = getDockSide(state.config.windowState)
  const previewMode = typeof window.electronAPI?.resizeWindow !== 'function'
  const hasConfiguredProviders = enabledConfigs.length > 0
  const primaryProviderError = providerErrors[0]
  const errorPlaceholderHint =
    providerErrors.length > 1
      ? `另有 ${providerErrors.length - 1} 个厂商也出现错误，请从托盘打开“设置”查看详情。`
      : '请从托盘打开“设置”检查认证信息，或稍后手动刷新一次。'

  const handleToggleExpand = (): void => {
    dispatch({ type: 'TOGGLE_EXPAND' })
  }

  const handleToggleDimension = (providerId: string, dimensionId: string): void => {
    dispatch({
      type: 'TOGGLE_DIMENSION',
      payload: { providerId, dimensionId }
    })
  }

  const { previewPosition, handleMouseDown, handleClickCapture, handleRestore } = useWindowDrag({
    floatingRef,
    currentSize,
    isDocked,
    previewMode,
    windowPosition: state.config.windowPosition,
    dispatch
  })

  const floatingStyle: CSSProperties = {
    width: `${currentSize.width}px`,
    height: `${currentSize.height}px`,
    ['--edge-handle-length' as string]: `${currentSize.handleLength}px`
  }

  if (previewMode) {
    floatingStyle.transform = `translate(${previewPosition.x}px, ${previewPosition.y}px)`
  }

  return (
    <div
      ref={floatingRef}
      className={`floating-window${isDocked ? ' floating-window--docked' : ''}`}
      style={floatingStyle}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
    >
      {dockSide ? (
        <div className="floating-window__handle">
          <EdgeHandle
            side={dockSide.replace('docked-', '') as 'left' | 'right' | 'top' | 'bottom'}
            onClick={handleRestore}
          />
        </div>
      ) : (
        <FloatingWindowContent
          configs={state.config.providers}
          providers={providers}
          hasConfiguredProviders={hasConfiguredProviders}
          hasVisibleProviders={hasVisibleProviders}
          isExpanded={state.config.isExpanded}
          isLoading={state.isLoading}
          primaryProviderError={primaryProviderError}
          errorPlaceholderHint={errorPlaceholderHint}
          onToggleExpand={handleToggleExpand}
          onToggleDimension={handleToggleDimension}
        />
      )}
    </div>
  )
}

export default FloatingWindow
