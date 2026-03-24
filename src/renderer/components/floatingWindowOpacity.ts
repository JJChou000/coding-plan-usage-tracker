import { DEFAULT_WINDOW_OPACITY, normalizeWindowOpacity } from '../../shared/windowOpacity'

type FloatingWindowSurfaceVars = {
  '--floating-surface-base': string
  '--floating-surface-top': string
  '--floating-surface-bottom': string
  '--floating-surface-sheen': string
  '--floating-surface-highlight': string
  '--floating-surface-glow': string
  '--floating-surface-shadow': string
}

function withScaledAlpha(alpha: number, opacity: number, minimumAlpha = 0): number {
  return Number(Math.max(alpha * opacity, minimumAlpha).toFixed(2))
}

export { DEFAULT_WINDOW_OPACITY, normalizeWindowOpacity }

export function buildFloatingWindowSurfaceVars(
  windowOpacity = DEFAULT_WINDOW_OPACITY
): FloatingWindowSurfaceVars {
  const opacity = normalizeWindowOpacity(windowOpacity)

  return {
    '--floating-surface-base': `rgb(15 20 29 / ${withScaledAlpha(0.78, opacity, 0.16)})`,
    '--floating-surface-top': `rgb(21 27 39 / ${withScaledAlpha(0.92, opacity, 0.18)})`,
    '--floating-surface-bottom': `rgb(11 15 24 / ${withScaledAlpha(0.86, opacity, 0.17)})`,
    '--floating-surface-sheen': `rgb(255 255 255 / ${withScaledAlpha(0.08, opacity, 0.02)})`,
    '--floating-surface-highlight': `rgba(255, 255, 255, ${withScaledAlpha(0.08, opacity, 0.02)})`,
    '--floating-surface-glow': `rgba(74, 222, 128, ${withScaledAlpha(0.12, opacity, 0.03)})`,
    '--floating-surface-shadow': `rgba(0, 0, 0, ${withScaledAlpha(0.42, opacity, 0.14)})`
  }
}
