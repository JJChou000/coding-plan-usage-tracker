import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { AppConfig, ProviderUsageData } from '../../shared/types'
import { useAppContext } from '../context/AppContext'
import CollapsedView from './CollapsedView'
import EdgeHandle from './EdgeHandle'
import ExpandedView from './ExpandedView'
import './FloatingWindow.css'

type DockState = Exclude<AppConfig['windowState'], 'normal'>

type PreviewPosition = {
  x: number
  y: number
}

type DragState = {
  active: boolean
  startClientX: number
  startClientY: number
  pointerOffsetX: number
  pointerOffsetY: number
  previewStartX: number
  previewStartY: number
  originTarget: Element | null
}

const WINDOW_WIDTH = 320
const COLLAPSED_ROW_HEIGHT = 36
const EXPANDED_HEADER_HEIGHT = 36
const EXPANDED_DIMENSION_HEIGHT = 30
const WINDOW_PADDING = 16
const WINDOW_GAP = 8
const SECTION_DIVIDER_HEIGHT = 1
const DOCK_THRESHOLD = 20
const HANDLE_WIDTH = 24
const DRAG_THRESHOLD = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getEnabledProviders(
  configs: AppConfig['providers'],
  usageData: Map<string, ProviderUsageData>
): ProviderUsageData[] {
  return configs
    .filter((config) => config.enabled)
    .map((config) => usageData.get(config.providerId))
    .filter((provider): provider is ProviderUsageData => Boolean(provider))
}

function getCollapsedHeight(providerCount: number): number {
  return Math.max(COLLAPSED_ROW_HEIGHT, providerCount * COLLAPSED_ROW_HEIGHT) + WINDOW_PADDING
}

function getExpandedHeight(providers: ProviderUsageData[]): number {
  if (providers.length === 0) {
    return getCollapsedHeight(1)
  }

  const contentHeight = providers.reduce((total, provider, index) => {
    const providerHeight =
      EXPANDED_HEADER_HEIGHT + provider.dimensions.length * EXPANDED_DIMENSION_HEIGHT + WINDOW_GAP

    return total + providerHeight + (index < providers.length - 1 ? SECTION_DIVIDER_HEIGHT : 0)
  }, 0)

  return contentHeight + WINDOW_PADDING
}

function getDockSide(windowState: AppConfig['windowState']): DockState | null {
  if (windowState === 'normal') {
    return null
  }

  return windowState
}

function getFloatingSize(
  isExpanded: boolean,
  windowState: AppConfig['windowState'],
  providers: ProviderUsageData[]
): { width: number; height: number; handleLength: number } {
  const collapsedHeight = getCollapsedHeight(providers.length || 1)
  const expandedHeight = getExpandedHeight(providers)
  const handleLength = collapsedHeight

  if (windowState === 'docked-left' || windowState === 'docked-right') {
    return {
      width: HANDLE_WIDTH,
      height: handleLength,
      handleLength
    }
  }

  if (windowState === 'docked-top' || windowState === 'docked-bottom') {
    return {
      width: handleLength,
      height: HANDLE_WIDTH,
      handleLength
    }
  }

  return {
    width: WINDOW_WIDTH,
    height: isExpanded ? expandedHeight : collapsedHeight,
    handleLength
  }
}

function getPreviewArenaRect(element: HTMLDivElement | null): DOMRect | null {
  return element?.parentElement?.getBoundingClientRect() ?? null
}

function isIgnoredDragTarget(target: Element | null): boolean {
  return Boolean(
    target?.closest(
      'input[type="checkbox"], label, .expanded-view__checkbox-wrap, .edge-handle, [data-no-drag="true"]'
    )
  )
}

function shouldToggleExpandFromTarget(target: Element | null): boolean {
  if (!target || isIgnoredDragTarget(target)) {
    return false
  }

  return Boolean(
    target.closest('.collapsed-view__row, .expanded-view__header, .expanded-view__dimension')
  )
}

function getDockedPreviewPosition(
  dockState: DockState,
  arena: DOMRect,
  size: { width: number; height: number }
): PreviewPosition {
  switch (dockState) {
    case 'docked-left':
      return {
        x: 0,
        y: clamp(0, 0, Math.max(0, arena.height - size.height))
      }
    case 'docked-right':
      return {
        x: Math.max(0, arena.width - size.width),
        y: clamp(0, 0, Math.max(0, arena.height - size.height))
      }
    case 'docked-top':
      return {
        x: clamp((arena.width - size.width) / 2, 0, Math.max(0, arena.width - size.width)),
        y: 0
      }
    case 'docked-bottom':
      return {
        x: clamp((arena.width - size.width) / 2, 0, Math.max(0, arena.width - size.width)),
        y: Math.max(0, arena.height - size.height)
      }
  }
}

function resolvePreviewDockState(
  position: PreviewPosition,
  size: { width: number; height: number },
  arena: DOMRect
): DockState | null {
  if (position.x <= DOCK_THRESHOLD) {
    return 'docked-left'
  }

  if (position.x + size.width >= arena.width - DOCK_THRESHOLD) {
    return 'docked-right'
  }

  if (position.y <= DOCK_THRESHOLD) {
    return 'docked-top'
  }

  if (position.y + size.height >= arena.height - DOCK_THRESHOLD) {
    return 'docked-bottom'
  }

  return null
}

function resolveNativeDockState(
  position: PreviewPosition,
  size: { width: number; height: number }
): DockState | null {
  const maxWidth = screen.availWidth
  const maxHeight = screen.availHeight

  if (position.x <= DOCK_THRESHOLD) {
    return 'docked-left'
  }

  if (position.x + size.width >= maxWidth - DOCK_THRESHOLD) {
    return 'docked-right'
  }

  if (position.y <= DOCK_THRESHOLD) {
    return 'docked-top'
  }

  if (position.y + size.height >= maxHeight - DOCK_THRESHOLD) {
    return 'docked-bottom'
  }

  return null
}

function FloatingWindow(): React.JSX.Element {
  const { state, dispatch } = useAppContext()
  const floatingRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false)
  const electronClickHandledRef = useRef(false)
  const lastNormalPositionRef = useRef<PreviewPosition>(state.config.windowPosition)
  const [previewPosition, setPreviewPosition] = useState<PreviewPosition>(
    state.config.windowPosition
  )

  const enabledConfigs = state.config.providers.filter((config) => config.enabled)
  const providers = getEnabledProviders(state.config.providers, state.usageData)
  const currentSize = getFloatingSize(state.config.isExpanded, state.config.windowState, providers)
  const isDocked = state.config.windowState !== 'normal'
  const dockSide = getDockSide(state.config.windowState)
  const previewMode = typeof window.electronAPI?.resizeWindow !== 'function'
  const hasConfiguredProviders = enabledConfigs.length > 0
  const hasVisibleProviders = providers.length > 0

  useEffect(() => {
    if (previewMode) {
      return
    }

    window.electronAPI?.resizeWindow?.(currentSize.width, currentSize.height)
  }, [currentSize.height, currentSize.width, previewMode])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent): void => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      const deltaX = event.clientX - dragState.startClientX
      const deltaY = event.clientY - dragState.startClientY

      if (!dragState.active && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DRAG_THRESHOLD) {
        return
      }

      dragState.active = true
      didDragRef.current = true

      if (previewMode) {
        const arena = getPreviewArenaRect(floatingRef.current)

        if (!arena) {
          return
        }

        const nextPosition = {
          x: clamp(
            dragState.previewStartX + deltaX,
            0,
            Math.max(0, arena.width - currentSize.width)
          ),
          y: clamp(
            dragState.previewStartY + deltaY,
            0,
            Math.max(0, arena.height - currentSize.height)
          )
        }

        setPreviewPosition(nextPosition)
        return
      }

      const nextPosition = {
        x: Math.round(event.screenX - dragState.pointerOffsetX),
        y: Math.round(event.screenY - dragState.pointerOffsetY)
      }

      window.electronAPI?.setWindowPosition?.(nextPosition)
    }

    const handleMouseUp = (event: MouseEvent): void => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      if (dragState.active) {
        if (previewMode) {
          const arena = getPreviewArenaRect(floatingRef.current)

          if (arena) {
            const nextDockState = resolvePreviewDockState(previewPosition, currentSize, arena)

            if (nextDockState) {
              lastNormalPositionRef.current = previewPosition

              const dockedSize = getFloatingSize(state.config.isExpanded, nextDockState, providers)
              const dockedPosition = getDockedPreviewPosition(nextDockState, arena, dockedSize)

              setPreviewPosition(dockedPosition)
              dispatch({
                type: 'SET_CONFIG',
                payload: {
                  windowState: nextDockState,
                  windowPosition: dockedPosition
                }
              })
            } else {
              lastNormalPositionRef.current = previewPosition
              dispatch({
                type: 'SET_CONFIG',
                payload: {
                  windowState: 'normal',
                  windowPosition: previewPosition
                }
              })
            }
          }
        } else {
          const nextPosition = {
            x: Math.round(event.screenX - dragState.pointerOffsetX),
            y: Math.round(event.screenY - dragState.pointerOffsetY)
          }
          const nextDockState = resolveNativeDockState(nextPosition, currentSize)

          if (nextDockState) {
            lastNormalPositionRef.current = nextPosition
            window.electronAPI?.setWindowState?.(nextDockState)
            dispatch({
              type: 'SET_CONFIG',
              payload: {
                windowState: nextDockState,
                windowPosition: nextPosition
              }
            })
          } else {
            lastNormalPositionRef.current = nextPosition
            dispatch({
              type: 'SET_CONFIG',
              payload: {
                windowState: 'normal',
                windowPosition: nextPosition
              }
            })
          }
        }
      } else if (!previewMode && shouldToggleExpandFromTarget(dragState.originTarget)) {
        electronClickHandledRef.current = true
        dispatch({ type: 'TOGGLE_EXPAND' })
      }

      dragStateRef.current = null
      window.setTimeout(() => {
        didDragRef.current = false
      }, 0)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [
    currentSize,
    dispatch,
    previewMode,
    previewPosition,
    providers,
    state.config.isExpanded,
    state.config.windowState
  ])

  const handleToggleExpand = (): void => {
    dispatch({ type: 'TOGGLE_EXPAND' })
  }

  const handleToggleDimension = (providerId: string, dimensionId: string): void => {
    dispatch({
      type: 'TOGGLE_DIMENSION',
      payload: { providerId, dimensionId }
    })
  }

  const handleRestore = (): void => {
    const restoredPosition = lastNormalPositionRef.current

    if (previewMode) {
      setPreviewPosition(restoredPosition)
    } else {
      window.electronAPI?.setWindowPosition?.(restoredPosition)
      window.electronAPI?.setWindowState?.('normal')
    }

    dispatch({
      type: 'SET_CONFIG',
      payload: {
        windowState: 'normal',
        windowPosition: restoredPosition
      }
    })
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || isDocked) {
      return
    }

    const target = event.target instanceof Element ? event.target : null

    if (isIgnoredDragTarget(target)) {
      return
    }

    dragStateRef.current = {
      active: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerOffsetX: event.screenX - window.screenX,
      pointerOffsetY: event.screenY - window.screenY,
      previewStartX: previewPosition.x,
      previewStartY: previewPosition.y,
      originTarget: target
    }
  }

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (electronClickHandledRef.current) {
      event.preventDefault()
      event.stopPropagation()
      electronClickHandledRef.current = false
      return
    }

    if (!didDragRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    didDragRef.current = false
  }

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
        <div className="floating-window__surface">
          {!hasConfiguredProviders ? (
            <div className="floating-window__placeholder">
              <strong>请先添加厂商</strong>
              <span>从系统托盘打开“设置”，添加一个已启用的厂商配置。</span>
            </div>
          ) : !hasVisibleProviders ? (
            <div className="floating-window__placeholder">
              <strong>{state.isLoading ? '正在加载额度数据…' : '暂时没有可显示的数据'}</strong>
              <span>
                {state.isLoading
                  ? '稍等几秒，浮窗会自动刷新。'
                  : '请检查认证信息是否已填写，或从托盘手动刷新一次。'}
              </span>
            </div>
          ) : (
            <>
              {state.config.isExpanded ? (
                <ExpandedView
                  providers={providers}
                  configs={state.config.providers}
                  onToggleExpand={handleToggleExpand}
                  onToggleDimension={handleToggleDimension}
                />
              ) : (
                <CollapsedView
                  providers={providers}
                  configs={state.config.providers}
                  onToggleExpand={handleToggleExpand}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default FloatingWindow
