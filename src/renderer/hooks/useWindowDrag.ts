import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject
} from 'react'

import type { AppAction } from '../context/AppContext'
import {
  FLOATING_WINDOW_LAYOUT,
  clamp,
  resolveNativeDockState,
  resolvePreviewDockState,
  type DockState,
  type FloatingWindowSize,
  type PreviewPosition
} from '../components/floatingWindowLayout'
import type { AppConfig } from '../../shared/types'
import {
  constrainDockedWindowPosition,
  getNextLastNormalPosition,
  type DockedWindowBounds
} from './windowDragState'

type DragState = {
  active: boolean
  dockState: DockState | null
  startClientX: number
  startClientY: number
  pointerOffsetX: number
  pointerOffsetY: number
  previewStartX: number
  previewStartY: number
  originTarget: Element | null
}

type PointerSnapshot = {
  clientX: number
  clientY: number
  screenX: number
  screenY: number
}

type RuntimeSnapshot = {
  currentSize: FloatingWindowSize
  previewMode: boolean
}

type UseWindowDragOptions = {
  floatingRef: RefObject<HTMLDivElement | null>
  currentSize: FloatingWindowSize
  isDocked: boolean
  previewMode: boolean
  windowState: AppConfig['windowState']
  windowPosition: PreviewPosition
  dispatch: Dispatch<AppAction>
}

type UseWindowDragResult = {
  previewPosition: PreviewPosition
  handleMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void
  handleClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void
  handleRestore: () => void
}

function getPreviewArenaRect(element: HTMLDivElement | null): DOMRect | null {
  return element?.parentElement?.getBoundingClientRect() ?? null
}

function isEdgeHandleTarget(target: Element | null): boolean {
  return Boolean(target?.closest('.edge-handle'))
}

function isIgnoredDragTarget(target: Element | null, allowEdgeHandleDrag = false): boolean {
  if (allowEdgeHandleDrag && isEdgeHandleTarget(target)) {
    return false
  }

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

function getPreviewDragPosition(
  dragState: DragState,
  pointer: PointerSnapshot,
  arena: DOMRect,
  currentSize: FloatingWindowSize
): PreviewPosition {
  const deltaX = pointer.clientX - dragState.startClientX
  const deltaY = pointer.clientY - dragState.startClientY

  return {
    x: clamp(dragState.previewStartX + deltaX, 0, Math.max(0, arena.width - currentSize.width)),
    y: clamp(dragState.previewStartY + deltaY, 0, Math.max(0, arena.height - currentSize.height))
  }
}

function getNativeDragPosition(dragState: DragState, pointer: PointerSnapshot): PreviewPosition {
  return {
    x: Math.round(pointer.screenX - dragState.pointerOffsetX),
    y: Math.round(pointer.screenY - dragState.pointerOffsetY)
  }
}

function getPreviewBounds(arena: DOMRect): DockedWindowBounds {
  return {
    x: 0,
    y: 0,
    width: arena.width,
    height: arena.height
  }
}

function getNativeBounds(): DockedWindowBounds {
  return {
    x: 0,
    y: 0,
    width: screen.availWidth,
    height: screen.availHeight
  }
}

export function useWindowDrag({
  floatingRef,
  currentSize,
  isDocked,
  previewMode,
  windowState,
  windowPosition,
  dispatch
}: UseWindowDragOptions): UseWindowDragResult {
  const [previewPosition, setPreviewPosition] = useState<PreviewPosition>(windowPosition)
  const dragStateRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false)
  const electronClickHandledRef = useRef(false)
  const lastNormalPositionRef = useRef<PreviewPosition>(windowPosition)
  const latestRuntimeRef = useRef<RuntimeSnapshot>({
    currentSize,
    previewMode
  })
  const rafIdRef = useRef<number | null>(null)
  const queuedPointerRef = useRef<PointerSnapshot | null>(null)

  latestRuntimeRef.current = {
    currentSize,
    previewMode
  }

  useEffect(() => {
    if (previewMode) {
      setPreviewPosition(windowPosition)
    }

    lastNormalPositionRef.current = getNextLastNormalPosition(
      lastNormalPositionRef.current,
      windowState,
      windowPosition
    )
  }, [previewMode, windowPosition, windowState])

  useEffect(() => {
    if (previewMode) {
      return
    }

    window.electronAPI?.resizeWindow?.(currentSize.width, currentSize.height)
  }, [currentSize.height, currentSize.width, previewMode])

  useEffect(() => {
    const processQueuedMove = (): void => {
      rafIdRef.current = null

      const dragState = dragStateRef.current
      const pointer = queuedPointerRef.current

      if (!dragState || !pointer) {
        return
      }

      const { currentSize: activeSize, previewMode: activePreviewMode } = latestRuntimeRef.current
      const deltaX = pointer.clientX - dragState.startClientX
      const deltaY = pointer.clientY - dragState.startClientY

      if (
        !dragState.active &&
        Math.max(Math.abs(deltaX), Math.abs(deltaY)) < FLOATING_WINDOW_LAYOUT.dragThreshold
      ) {
        return
      }

      dragState.active = true
      didDragRef.current = true

      if (activePreviewMode) {
        const arena = getPreviewArenaRect(floatingRef.current)

        if (!arena) {
          return
        }

        const nextPreviewPosition = getPreviewDragPosition(dragState, pointer, arena, activeSize)

        setPreviewPosition(
          dragState.dockState
            ? constrainDockedWindowPosition(
                dragState.dockState,
                nextPreviewPosition,
                activeSize,
                getPreviewBounds(arena)
              )
            : nextPreviewPosition
        )
        return
      }

      const nextNativePosition = getNativeDragPosition(dragState, pointer)

      window.electronAPI?.setWindowPosition?.(
        dragState.dockState
          ? constrainDockedWindowPosition(
              dragState.dockState,
              nextNativePosition,
              activeSize,
              getNativeBounds()
            )
          : nextNativePosition
      )
    }

    const flushQueuedMove = (): void => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      processQueuedMove()
    }

    const handleMouseMove = (event: MouseEvent): void => {
      if (!dragStateRef.current) {
        return
      }

      queuedPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY
      }

      if (rafIdRef.current !== null) {
        return
      }

      rafIdRef.current = window.requestAnimationFrame(processQueuedMove)
    }

    const handleMouseUp = (event: MouseEvent): void => {
      const dragState = dragStateRef.current

      if (!dragState) {
        return
      }

      flushQueuedMove()

      const pointer = {
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY
      }
      const { currentSize: activeSize, previewMode: activePreviewMode } = latestRuntimeRef.current

      if (dragState.active) {
        if (activePreviewMode) {
          const arena = getPreviewArenaRect(floatingRef.current)

          if (arena) {
            const nextPosition = getPreviewDragPosition(dragState, pointer, arena, activeSize)
            const previewBounds = getPreviewBounds(arena)

            if (dragState.dockState) {
              const dockedPosition = constrainDockedWindowPosition(
                dragState.dockState,
                nextPosition,
                activeSize,
                previewBounds
              )

              setPreviewPosition(dockedPosition)
              dispatch({
                type: 'SET_CONFIG',
                payload: {
                  windowState: dragState.dockState,
                  windowPosition: dockedPosition
                }
              })
            } else {
              const nextDockState = resolvePreviewDockState(nextPosition, activeSize, arena)

              if (nextDockState) {
                lastNormalPositionRef.current = nextPosition

                const dockedSize =
                  nextDockState === 'docked-left' || nextDockState === 'docked-right'
                    ? {
                        width: FLOATING_WINDOW_LAYOUT.handleWidth,
                        height: activeSize.handleLength,
                        handleLength: activeSize.handleLength
                      }
                    : {
                        width: activeSize.handleLength,
                        height: FLOATING_WINDOW_LAYOUT.handleWidth,
                        handleLength: activeSize.handleLength
                      }
                const dockedPosition = constrainDockedWindowPosition(
                  nextDockState,
                  nextPosition,
                  dockedSize,
                  previewBounds
                )

                setPreviewPosition(dockedPosition)
                dispatch({
                  type: 'SET_CONFIG',
                  payload: {
                    windowState: nextDockState,
                    windowPosition: dockedPosition
                  }
                })
              } else {
                lastNormalPositionRef.current = nextPosition
                setPreviewPosition(nextPosition)
                dispatch({
                  type: 'SET_CONFIG',
                  payload: {
                    windowState: 'normal',
                    windowPosition: nextPosition
                  }
                })
              }
            }
          }
        } else {
          const nextPosition = getNativeDragPosition(dragState, pointer)

          if (dragState.dockState) {
            const dockedPosition = constrainDockedWindowPosition(
              dragState.dockState,
              nextPosition,
              activeSize,
              getNativeBounds()
            )

            window.electronAPI?.setWindowPosition?.(dockedPosition)
            dispatch({
              type: 'SET_CONFIG',
              payload: {
                windowState: dragState.dockState,
                windowPosition: dockedPosition
              }
            })
          } else {
            const nextDockState = resolveNativeDockState(nextPosition, activeSize)

            lastNormalPositionRef.current = nextPosition

            if (nextDockState) {
              window.electronAPI?.setWindowState?.({
                state: nextDockState,
                size: {
                  width: FLOATING_WINDOW_LAYOUT.handleWidth,
                  height: activeSize.handleLength
                }
              })
              dispatch({
                type: 'SET_CONFIG',
                payload: {
                  windowState: nextDockState,
                  windowPosition: nextPosition
                }
              })
            } else {
              dispatch({
                type: 'SET_CONFIG',
                payload: {
                  windowState: 'normal',
                  windowPosition: nextPosition
                }
              })
            }
          }
        }
      } else if (!activePreviewMode && shouldToggleExpandFromTarget(dragState.originTarget)) {
        electronClickHandledRef.current = true
        dispatch({ type: 'TOGGLE_EXPAND' })
      }

      dragStateRef.current = null
      queuedPointerRef.current = null

      window.setTimeout(() => {
        didDragRef.current = false
      }, 0)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }

      queuedPointerRef.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dispatch, floatingRef])

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return
    }

    const target = event.target instanceof Element ? event.target : null

    if (isIgnoredDragTarget(target, isDocked)) {
      return
    }

    dragStateRef.current = {
      active: false,
      dockState: windowState === 'normal' ? null : windowState,
      startClientX: event.clientX,
      startClientY: event.clientY,
      pointerOffsetX: event.screenX - window.screenX,
      pointerOffsetY: event.screenY - window.screenY,
      previewStartX: previewPosition.x,
      previewStartY: previewPosition.y,
      originTarget: target
    }
  }

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>): void => {
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

  return {
    previewPosition,
    handleMouseDown,
    handleClickCapture,
    handleRestore
  }
}
