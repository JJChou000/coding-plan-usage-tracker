export const MIN_WINDOW_OPACITY = 0.5
export const MAX_WINDOW_OPACITY = 1
export const DEFAULT_WINDOW_OPACITY = 1
export const WINDOW_OPACITY_STEP = 0.05

function roundOpacity(value: number): number {
  return Number(value.toFixed(2))
}

export function normalizeWindowOpacity(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WINDOW_OPACITY
  }

  if (value <= MIN_WINDOW_OPACITY) {
    return MIN_WINDOW_OPACITY
  }

  if (value >= MAX_WINDOW_OPACITY) {
    return MAX_WINDOW_OPACITY
  }

  return roundOpacity(value)
}
