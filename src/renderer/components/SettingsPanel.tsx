import { useState } from 'react'

import type { AppConfig, AuthField, ProviderConfig, ProviderUsageData } from '../../shared/types'
import {
  DEFAULT_WINDOW_OPACITY,
  MAX_WINDOW_OPACITY,
  MIN_WINDOW_OPACITY,
  WINDOW_OPACITY_STEP,
  normalizeWindowOpacity
} from '../../shared/windowOpacity'
import { useAppContext } from '../context/AppContext'
import ProviderIcon from './ProviderIcon'
import { getProviderDisplayMeta } from '../providers/providerDisplay'
import { getAllProviders, getProvider } from '../providers/providerRegistry'
import './SettingsPanel.css'

type DialogMode = 'add' | 'edit'

type ProviderDialogState = {
  mode: DialogMode
  providerId: string
  auth: Record<string, string>
}

type DeleteDialogState = {
  providerId: string
}

type StatusTone = 'ok' | 'error' | 'empty'

const REFRESH_OPTIONS = [30, 60, 120, 300] as const
const HIDDEN_PROVIDER_IDS = new Set(['bailian'])
const RELEASE_VERSION = '0.2.2'
const RELEASE_HIGHLIGHTS = [
  '设置面板新增“重置浮窗位置”，可在浮窗异常时手动拉回可视区域。',
  '浮窗吸附能力已收敛为仅支持右侧吸附，避免历史上的异常吸附路径再次出现。'
]
const RELEASE_LIMITATIONS = [
  '当前版本仅支持右侧吸附；拖拽到上、左、下边缘时不会进入吸附态。',
  '若历史配置曾停留在上、左、下吸附，应用会在启动或托盘恢复时自动回退到可视区域。'
]

function getProviderFields(providerId: string): AuthField[] {
  return getProvider(providerId)?.getAuthFields() ?? []
}

function hasRequiredValues(providerId: string, auth: Record<string, string>): boolean {
  return getProviderFields(providerId).every((field) => {
    if (!field.required) {
      return true
    }

    return Boolean(auth[field.key]?.trim())
  })
}

function sanitizeAuth(auth: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(auth).map(([key, value]) => [key, value.trim()]))
}

function maskSecret(value: string): string {
  if (!value) {
    return '未填写'
  }

  if (value.length <= 6) {
    return `${value.slice(0, 1)}***`
  }

  return `${value.slice(0, 3)}...${value.slice(-3)}`
}

function getStatusMeta(
  providerId: string,
  config: ProviderConfig,
  usage?: ProviderUsageData
): { label: string; tone: StatusTone } {
  if (!hasRequiredValues(providerId, config.auth)) {
    return { label: '未配置', tone: 'empty' }
  }

  if (usage?.error) {
    return { label: '错误', tone: 'error' }
  }

  return { label: '正常', tone: 'ok' }
}

function buildAuthSummary(providerId: string, auth: Record<string, string>): string[] {
  return getProviderFields(providerId).map(
    (field) => `${field.label}: ${maskSecret(auth[field.key] ?? '')}`
  )
}

async function persistConfig(
  nextConfig: AppConfig,
  dispatch: ReturnType<typeof useAppContext>['dispatch']
): Promise<boolean> {
  dispatch({
    type: 'SET_CONFIG',
    payload: nextConfig
  })

  return true
}

export async function restoreFloatingWindowFromSettings(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof window.electronAPI?.restoreFloatingWindow !== 'function'
  ) {
    return false
  }

  await window.electronAPI.restoreFloatingWindow()

  return true
}

function SettingsPanel(): React.JSX.Element {
  const { state, dispatch } = useAppContext()
  const [dialog, setDialog] = useState<ProviderDialogState | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const allProviders = getAllProviders().filter((provider) => !HIDDEN_PROVIDER_IDS.has(provider.id))
  const configuredProviderIds = new Set(state.config.providers.map((config) => config.providerId))
  const availableProviders = allProviders.filter(
    (provider) => !configuredProviderIds.has(provider.id)
  )
  const activeProvider = dialog ? getProvider(dialog.providerId) : undefined
  const activeFields = dialog ? getProviderFields(dialog.providerId) : []
  const canSaveDialog = dialog ? hasRequiredValues(dialog.providerId, dialog.auth) : false
  const deleteProvider = deleteDialog ? getProvider(deleteDialog.providerId) : undefined
  const opacityPercent = Math.round(
    normalizeWindowOpacity(state.config.windowOpacity ?? DEFAULT_WINDOW_OPACITY) * 100
  )
  const canRestoreWindow =
    typeof window !== 'undefined' &&
    typeof window.electronAPI?.restoreFloatingWindow === 'function'

  const openAddDialog = (): void => {
    if (availableProviders.length === 0) {
      return
    }

    setSaveError(null)
    setDialog({
      mode: 'add',
      providerId: availableProviders[0].id,
      auth: {}
    })
  }

  const openEditDialog = (providerId: string): void => {
    const config = state.config.providers.find((item) => item.providerId === providerId)

    if (!config) {
      return
    }

    setSaveError(null)
    setDialog({
      mode: 'edit',
      providerId,
      auth: { ...config.auth }
    })
  }

  const closeDialog = (): void => {
    setDialog(null)
    setSaveError(null)
  }

  const closeDeleteDialog = (): void => {
    setDeleteDialog(null)
    setSaveError(null)
  }

  const handleDialogProviderChange = (providerId: string): void => {
    setDialog((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        providerId,
        auth: {}
      }
    })
    setSaveError(null)
  }

  const handleAuthChange = (key: string, value: string): void => {
    setDialog((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        auth: {
          ...current.auth,
          [key]: value
        }
      }
    })
    setSaveError(null)
  }

  const handleSaveDialog = async (): Promise<void> => {
    if (!dialog || !activeProvider) {
      return
    }

    const existingConfig = state.config.providers.find(
      (item) => item.providerId === dialog.providerId
    )
    const nextProviderConfig: ProviderConfig = {
      providerId: dialog.providerId,
      auth: sanitizeAuth(dialog.auth),
      checkedDimensions: existingConfig?.checkedDimensions ?? [],
      enabled: existingConfig?.enabled ?? true
    }

    const nextProviders =
      dialog.mode === 'edit'
        ? state.config.providers.map((item) =>
            item.providerId === dialog.providerId ? nextProviderConfig : item
          )
        : [...state.config.providers, nextProviderConfig]

    const nextConfig: AppConfig = {
      ...state.config,
      providers: nextProviders
    }

    const saved = await persistConfig(nextConfig, dispatch)

    if (!saved) {
      setSaveError('保存失败，请稍后再试。')
      return
    }

    closeDialog()
  }

  const handleDeleteProvider = async (providerId: string): Promise<void> => {
    const nextConfig: AppConfig = {
      ...state.config,
      providers: state.config.providers.filter((item) => item.providerId !== providerId)
    }

    const saved = await persistConfig(nextConfig, dispatch)

    if (!saved) {
      setSaveError('删除失败，请稍后再试。')
      return
    }

    if (dialog?.providerId === providerId) {
      closeDialog()
    }

    closeDeleteDialog()
  }

  const handleRefreshChange = async (refreshInterval: number): Promise<void> => {
    const nextConfig: AppConfig = {
      ...state.config,
      refreshInterval
    }

    const saved = await persistConfig(nextConfig, dispatch)

    if (!saved) {
      setSaveError('刷新频率保存失败，请稍后再试。')
    }
  }

  const handleWindowOpacityChange = async (windowOpacity: number): Promise<void> => {
    const nextConfig: AppConfig = {
      ...state.config,
      windowOpacity: normalizeWindowOpacity(windowOpacity)
    }

    const saved = await persistConfig(nextConfig, dispatch)

    if (!saved) {
      setSaveError('浮窗透明度保存失败，请稍后再试。')
    }
  }

  const handleRestoreWindow = async (): Promise<void> => {
    try {
      const restored = await restoreFloatingWindowFromSettings()

      if (!restored) {
        setSaveError('当前环境不支持重置浮窗位置。')
        return
      }

      setSaveError(null)
    } catch {
      setSaveError('重置浮窗位置失败，请稍后再试。')
    }
  }

  return (
    <section className="settings-panel">
      <div className="settings-panel__content">
        <header className="settings-panel__header">
          <p className="settings-panel__eyebrow">Configuration Center</p>
          <div className="settings-panel__header-row">
            <div>
              <h1 className="settings-panel__title">设置</h1>
              <p className="settings-panel__description">
                管理厂商认证信息、浮窗透明度与刷新频率，保存后会立即同步到当前打开的窗口。
              </p>
            </div>
            <button
              type="button"
              className="settings-panel__button settings-panel__button--primary"
              onClick={openAddDialog}
              disabled={availableProviders.length === 0}
            >
              添加厂商
            </button>
          </div>
        </header>

        {saveError ? <div className="settings-panel__alert">{saveError}</div> : null}

        <section className="settings-panel__section">
          <div className="settings-panel__section-head">
            <div>
              <h2 className="settings-panel__section-title">厂商列表</h2>
              <p className="settings-panel__section-copy">
                已配置 {state.config.providers.length} 个厂商
                {availableProviders.length === 0 ? '，当前可用厂商已全部添加。' : '。'}
              </p>
            </div>
          </div>

          {state.config.providers.length === 0 ? (
            <div className="settings-panel__empty">
              <strong>还没有厂商配置</strong>
              <span>点击右上角“添加厂商”开始录入认证信息。</span>
            </div>
          ) : (
            <div className="settings-panel__providers">
              {state.config.providers.map((config) => {
                const provider = getProvider(config.providerId)
                const providerMeta = getProviderDisplayMeta(config.providerId)
                const status = getStatusMeta(
                  config.providerId,
                  config,
                  state.usageData.get(config.providerId)
                )
                const authSummary = buildAuthSummary(config.providerId, config.auth)

                return (
                  <article key={config.providerId} className="settings-panel__card">
                    <div className="settings-panel__card-head">
                      <div className="settings-panel__provider">
                        <ProviderIcon
                          icon={providerMeta.icon}
                          fallbackIcon={providerMeta.fallbackIcon}
                          alt={providerMeta.name}
                          className="settings-panel__icon"
                          imageClassName="settings-panel__icon-image"
                          size={20}
                        />
                        <div className="settings-panel__provider-copy">
                          <strong className="settings-panel__provider-name">
                            {provider?.name ?? providerMeta.name}
                          </strong>
                          <span className="settings-panel__provider-id">{config.providerId}</span>
                        </div>
                      </div>

                      <span
                        className={`settings-panel__status settings-panel__status--${status.tone}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <ul className="settings-panel__meta">
                      {authSummary.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    {state.usageData.get(config.providerId)?.error ? (
                      <p className="settings-panel__error">
                        {state.usageData.get(config.providerId)?.error}
                      </p>
                    ) : null}

                    <div className="settings-panel__actions">
                      <button
                        type="button"
                        className="settings-panel__button settings-panel__button--ghost"
                        onClick={() => openEditDialog(config.providerId)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="settings-panel__button settings-panel__button--danger"
                        onClick={() => setDeleteDialog({ providerId: config.providerId })}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="settings-panel__section settings-panel__release">
          <div className="settings-panel__section-head">
            <div>
              <h2 className="settings-panel__section-title">v{RELEASE_VERSION} 版本更新</h2>
              <p className="settings-panel__section-copy">
                本次版本在保留恢复能力的同时，明确将吸附行为收敛为仅支持右侧吸附，避免继续触发历史异常路径。
              </p>
            </div>
            <span className="settings-panel__release-badge">Release {RELEASE_VERSION}</span>
          </div>

          <div className="settings-panel__release-grid">
            <article className="settings-panel__release-card">
              <h3 className="settings-panel__release-title">本次更新</h3>
              <ul className="settings-panel__release-list">
                {RELEASE_HIGHLIGHTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="settings-panel__release-card settings-panel__release-card--warning">
              <h3 className="settings-panel__release-title">当前限制</h3>
              <ul className="settings-panel__release-list">
                {RELEASE_LIMITATIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <footer className="settings-panel__footer">
          <div>
            <h2 className="settings-panel__section-title">显示与刷新</h2>
            <p className="settings-panel__section-copy">
              调整浮窗透明度后会立即作用到当前浮窗，刷新频率仍可单独配置。
            </p>
          </div>

          <div className="settings-panel__footer-controls">
            <button
              type="button"
              className="settings-panel__button settings-panel__button--ghost settings-panel__recovery-button"
              disabled={!canRestoreWindow}
              onClick={() => void handleRestoreWindow()}
            >
              重置浮窗位置
            </button>

            <div className="settings-panel__control-grid">
              <label className="settings-panel__range-wrap">
                <span className="settings-panel__range-head">
                  <span className="settings-panel__select-label">浮窗透明度</span>
                  <strong className="settings-panel__range-value">{opacityPercent}%</strong>
                </span>
                <input
                  className="settings-panel__range"
                  type="range"
                  min={MIN_WINDOW_OPACITY}
                  max={MAX_WINDOW_OPACITY}
                  step={WINDOW_OPACITY_STEP}
                  value={normalizeWindowOpacity(state.config.windowOpacity)}
                  onChange={(event) => void handleWindowOpacityChange(Number(event.target.value))}
                />
                <span className="settings-panel__range-hint">
                  支持 10% - 100%，低透明度下仍会保留基础轮廓和交互可见性。
                </span>
              </label>

              <label className="settings-panel__select-wrap">
                <span className="settings-panel__select-label">自动刷新</span>
                <select
                  className="settings-panel__select"
                  value={state.config.refreshInterval}
                  onChange={(event) => void handleRefreshChange(Number(event.target.value))}
                >
                  {REFRESH_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}s
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </footer>
      </div>

      {dialog ? (
        <div className="settings-panel__overlay" onClick={closeDialog}>
          <div
            className="settings-panel__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-panel-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-panel__modal-head">
              <div>
                <p className="settings-panel__eyebrow">
                  {dialog.mode === 'add' ? 'Add Provider' : 'Edit Credentials'}
                </p>
                <h2 id="settings-panel-dialog-title" className="settings-panel__modal-title">
                  {dialog.mode === 'add' ? '添加厂商' : '编辑厂商'}
                </h2>
              </div>
              <button
                type="button"
                className="settings-panel__button settings-panel__button--ghost"
                onClick={closeDialog}
              >
                取消
              </button>
            </div>

            {dialog.mode === 'add' ? (
              <label className="settings-panel__field">
                <span className="settings-panel__field-label">厂商</span>
                <select
                  className="settings-panel__select"
                  value={dialog.providerId}
                  onChange={(event) => handleDialogProviderChange(event.target.value)}
                >
                  {availableProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activeProvider ? (
              <div className="settings-panel__fields">
                {activeFields.map((field) => (
                  <label key={field.key} className="settings-panel__field">
                    <span className="settings-panel__field-label">
                      {field.label}
                      {field.required ? <em>*</em> : null}
                    </span>
                    <input
                      className="settings-panel__input"
                      type={field.type}
                      value={dialog.auth[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event) => handleAuthChange(field.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="settings-panel__empty settings-panel__empty--compact">
                <span>没有可用的厂商可供配置。</span>
              </div>
            )}

            <div className="settings-panel__modal-actions">
              <button
                type="button"
                className="settings-panel__button settings-panel__button--ghost"
                onClick={closeDialog}
              >
                取消
              </button>
              <button
                type="button"
                className="settings-panel__button settings-panel__button--primary"
                disabled={!activeProvider || !canSaveDialog}
                onClick={() => void handleSaveDialog()}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteDialog ? (
        <div className="settings-panel__overlay" onClick={closeDeleteDialog}>
          <div
            className="settings-panel__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-panel-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-panel__modal-head">
              <div>
                <p className="settings-panel__eyebrow">Delete Provider</p>
                <h2 id="settings-panel-delete-title" className="settings-panel__modal-title">
                  确认删除厂商
                </h2>
              </div>
              <button
                type="button"
                className="settings-panel__button settings-panel__button--ghost"
                onClick={closeDeleteDialog}
              >
                取消
              </button>
            </div>

            <p className="settings-panel__description">
              {`将删除 ${deleteProvider?.name ?? deleteDialog.providerId} 的本地认证信息和浮窗展示配置。`}
            </p>

            <div className="settings-panel__modal-actions">
              <button
                type="button"
                className="settings-panel__button settings-panel__button--ghost"
                onClick={closeDeleteDialog}
              >
                取消
              </button>
              <button
                type="button"
                className="settings-panel__button settings-panel__button--danger"
                onClick={() => void handleDeleteProvider(deleteDialog.providerId)}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default SettingsPanel
