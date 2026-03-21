import { useEffect, useState } from 'react'

import type { AppState } from '../shared/types'
import FloatingWindow from './components/FloatingWindow'
import SettingsPanel from './components/SettingsPanel'
import { AppContextProvider, useAppContext } from './context/AppContext'
import { useAutoRefresh } from './hooks/useAutoRefresh'

const PREVIEW_STATE: AppState = {
  config: {
    providers: [
      {
        providerId: 'zhipu',
        auth: {
          authToken: 'sk-preview-001'
        },
        checkedDimensions: ['token_5h'],
        enabled: true
      }
    ],
    refreshInterval: 60,
    windowPosition: { x: 24, y: 24 },
    windowState: 'normal',
    isExpanded: false
  },
  usageData: new Map([
    [
      'zhipu',
      {
        providerId: 'zhipu',
        dimensions: [
          {
            id: 'token_5h',
            label: '每5小时 Token',
            usedPercent: 31,
            used: 62000,
            total: 200000,
            resetTime: '12:00',
            isChecked: true
          },
          {
            id: 'mcp_monthly',
            label: 'MCP 每月额度',
            usedPercent: 12,
            used: 240,
            total: 2000,
            resetTime: '03-27',
            isChecked: false
          }
        ],
        lastUpdated: Date.now()
      }
    ],
    [
      'bailian',
      {
        providerId: 'bailian',
        dimensions: [
          {
            id: 'usage_5h',
            label: '近5小时用量',
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
    ]
  ]),
  isLoading: false,
  settingsOpen: false
}

function FloatingStagePage(): React.JSX.Element {
  const { state } = useAppContext()

  return (
    <section className="stage-card stage-card--preview">
      <div className="stage-header">
        <span className="stage-badge">Stage 2.5</span>
        <span className="stage-status">
          {state.config.windowState} / {state.config.isExpanded ? 'expanded' : 'collapsed'}
        </span>
      </div>
      <div className="stage-preview-note">拖动浮窗到预览区边缘可吸附，点击内容切换折叠/展开。</div>
      <div className="stage-preview-arena">
        <FloatingWindow />
      </div>
    </section>
  )
}

function SettingsStagePreview(): React.JSX.Element {
  const { state } = useAppContext()

  return (
    <section className="settings-stage">
      <div className="settings-stage__panel">
        <div className="stage-header">
          <span className="stage-badge">Stage 2.6</span>
          <span className="stage-status">
            {state.config.providers.length} providers / {state.config.refreshInterval}s
          </span>
        </div>
        <div className="stage-preview-note">
          添加、编辑、删除厂商配置后，右侧浮窗预览会立即同步，便于当前阶段验收。
        </div>
        <SettingsPanel />
      </div>

      <aside className="stage-card stage-card--preview settings-stage__preview">
        <div className="stage-header">
          <span className="stage-badge">Live Preview</span>
          <span className="stage-status">
            {state.config.windowState} / {state.config.isExpanded ? 'expanded' : 'collapsed'}
          </span>
        </div>
        <div className="stage-preview-note">
          当前浮窗会复用同一份配置状态，用来验证“保存后立即反映变更”。
        </div>
        <div className="stage-preview-arena stage-preview-arena--tall">
          <FloatingWindow />
        </div>
      </aside>
    </section>
  )
}

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const handleHashChange = (): void => {
      setHash(window.location.hash)
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  return hash
}

interface AppContentProps {
  isSettingsRoute: boolean
  previewMode: boolean
}

function AppContent({ isSettingsRoute, previewMode }: AppContentProps): React.JSX.Element {
  if (isSettingsRoute) {
    return previewMode ? (
      <SettingsStagePreview />
    ) : (
      <section className="settings-page">
        <SettingsPanel />
      </section>
    )
  }

  return previewMode ? <FloatingStagePage /> : <FloatingWindow />
}

function AppRuntime({ isSettingsRoute, previewMode }: AppContentProps): React.JSX.Element {
  const { state } = useAppContext()
  const { refreshNow } = useAutoRefresh({
    enabled: !previewMode,
    intervalSeconds: state.config.refreshInterval
  })

  useEffect(() => {
    if (previewMode || typeof window.electronAPI?.onRefresh !== 'function') {
      return
    }

    return window.electronAPI.onRefresh(() => {
      void refreshNow()
    })
  }, [previewMode, refreshNow])

  return <AppContent isSettingsRoute={isSettingsRoute} previewMode={previewMode} />
}

function App(): React.JSX.Element {
  const previewMode = typeof window.electronAPI?.getConfig !== 'function'
  const hash = useHashRoute()
  const isSettingsRoute = hash === '#settings'
  const shellClassName = [
    'app-shell',
    isSettingsRoute ? 'app-shell--settings' : 'app-shell--floating',
    previewMode ? 'app-shell--preview' : ''
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    document.title = isSettingsRoute
      ? 'Coding Plan Usage Tracker - 设置'
      : 'Coding Plan Usage Tracker'
  }, [isSettingsRoute])

  return (
    <main className={shellClassName}>
      <AppContextProvider initialState={previewMode ? PREVIEW_STATE : undefined}>
        <AppRuntime isSettingsRoute={isSettingsRoute} previewMode={previewMode} />
      </AppContextProvider>
    </main>
  )
}

export default App
