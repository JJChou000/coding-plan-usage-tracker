import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WINDOW_OPACITY,
  buildFloatingWindowSurfaceVars,
  normalizeWindowOpacity
} from './floatingWindowOpacity'

describe('normalizeWindowOpacity', () => {
  it('falls back to the default opacity when the value is invalid', () => {
    expect(normalizeWindowOpacity(undefined)).toBe(DEFAULT_WINDOW_OPACITY)
    expect(normalizeWindowOpacity(Number.NaN)).toBe(DEFAULT_WINDOW_OPACITY)
  })

  it('clamps opacity to the supported range', () => {
    expect(normalizeWindowOpacity(0.05)).toBe(0.1)
    expect(normalizeWindowOpacity(0.1)).toBe(0.1)
    expect(normalizeWindowOpacity(0.75)).toBe(0.75)
    expect(normalizeWindowOpacity(1.4)).toBe(1)
  })
})

describe('buildFloatingWindowSurfaceVars', () => {
  it('keeps the current glass style when opacity is set to the default value', () => {
    expect(buildFloatingWindowSurfaceVars(1)).toEqual({
      '--floating-surface-base': 'rgb(15 20 29 / 0.78)',
      '--floating-surface-top': 'rgb(21 27 39 / 0.92)',
      '--floating-surface-bottom': 'rgb(11 15 24 / 0.86)',
      '--floating-surface-sheen': 'rgb(255 255 255 / 0.08)',
      '--floating-surface-highlight': 'rgba(255, 255, 255, 0.08)',
      '--floating-surface-glow': 'rgba(74, 222, 128, 0.12)',
      '--floating-surface-shadow': 'rgba(0, 0, 0, 0.42)'
    })
  })

  it('scales the glass surface variables down for lower opacity values', () => {
    expect(buildFloatingWindowSurfaceVars(0.5)).toEqual({
      '--floating-surface-base': 'rgb(15 20 29 / 0.39)',
      '--floating-surface-top': 'rgb(21 27 39 / 0.46)',
      '--floating-surface-bottom': 'rgb(11 15 24 / 0.43)',
      '--floating-surface-sheen': 'rgb(255 255 255 / 0.04)',
      '--floating-surface-highlight': 'rgba(255, 255, 255, 0.04)',
      '--floating-surface-glow': 'rgba(74, 222, 128, 0.06)',
      '--floating-surface-shadow': 'rgba(0, 0, 0, 0.21)'
    })
  })

  it('keeps the floating surface minimally visible at 10% opacity', () => {
    expect(buildFloatingWindowSurfaceVars(0.1)).toEqual({
      '--floating-surface-base': 'rgb(15 20 29 / 0.16)',
      '--floating-surface-top': 'rgb(21 27 39 / 0.18)',
      '--floating-surface-bottom': 'rgb(11 15 24 / 0.17)',
      '--floating-surface-sheen': 'rgb(255 255 255 / 0.02)',
      '--floating-surface-highlight': 'rgba(255, 255, 255, 0.02)',
      '--floating-surface-glow': 'rgba(74, 222, 128, 0.03)',
      '--floating-surface-shadow': 'rgba(0, 0, 0, 0.14)'
    })
  })
})
