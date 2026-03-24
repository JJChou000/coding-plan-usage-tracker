import type { AppConfig } from '../../shared/types'
import type { PreviewPosition } from '../components/floatingWindowLayout'

export function getNextLastNormalPosition(
  currentLastNormalPosition: PreviewPosition,
  windowState: AppConfig['windowState'],
  windowPosition: PreviewPosition
): PreviewPosition {
  return windowState === 'normal' ? windowPosition : currentLastNormalPosition
}
