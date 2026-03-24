import type { AppConfig } from '../../shared/types'
import {
  clamp,
  type DockState,
  type FloatingWindowSize,
  type PreviewPosition
} from '../components/floatingWindowLayout'

export type DockedWindowBounds = {
  x: number
  y: number
  width: number
  height: number
}

export function getNextLastNormalPosition(
  currentLastNormalPosition: PreviewPosition,
  windowState: AppConfig['windowState'],
  windowPosition: PreviewPosition
): PreviewPosition {
  return windowState === 'normal' ? windowPosition : currentLastNormalPosition
}

export function constrainDockedWindowPosition(
  dockState: DockState,
  desiredPosition: PreviewPosition,
  size: FloatingWindowSize,
  bounds: DockedWindowBounds
): PreviewPosition {
  const maxX = bounds.x + bounds.width - size.width
  const maxY = bounds.y + bounds.height - size.height

  switch (dockState) {
    case 'docked-left':
      return {
        x: bounds.x,
        y: clamp(desiredPosition.y, bounds.y, maxY)
      }
    case 'docked-right':
      return {
        x: maxX,
        y: clamp(desiredPosition.y, bounds.y, maxY)
      }
    case 'docked-top':
      return {
        x: clamp(desiredPosition.x, bounds.x, maxX),
        y: bounds.y
      }
    case 'docked-bottom':
      return {
        x: clamp(desiredPosition.x, bounds.x, maxX),
        y: maxY
      }
  }
}
