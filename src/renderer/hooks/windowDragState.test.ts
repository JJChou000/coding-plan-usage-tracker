import { describe, expect, it } from 'vitest'

import { constrainDockedWindowPosition, getNextLastNormalPosition } from './windowDragState'

describe('getNextLastNormalPosition', () => {
  it('preserves the pre-dock position for restore when window state becomes docked', () => {
    const lastNormalPosition = { x: 148, y: 92 }
    const dockedHandlePosition = { x: 0, y: 92 }

    expect(
      getNextLastNormalPosition(lastNormalPosition, 'docked-left', dockedHandlePosition)
    ).toEqual(lastNormalPosition)
  })

  it('tracks the latest position while the window remains normal', () => {
    const lastNormalPosition = { x: 148, y: 92 }
    const nextNormalPosition = { x: 220, y: 120 }

    expect(getNextLastNormalPosition(lastNormalPosition, 'normal', nextNormalPosition)).toEqual(
      nextNormalPosition
    )
  })
})

describe('constrainDockedWindowPosition', () => {
  const bounds = {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  }

  it('keeps left-docked dragging attached to the left edge while moving vertically', () => {
    expect(
      constrainDockedWindowPosition(
        'docked-left',
        { x: 320, y: 240 },
        { width: 24, height: 88, handleLength: 88 },
        bounds
      )
    ).toEqual({ x: 0, y: 240 })
  })

  it('keeps bottom-docked dragging attached to the bottom edge while moving horizontally', () => {
    expect(
      constrainDockedWindowPosition(
        'docked-bottom',
        { x: 640, y: 320 },
        { width: 88, height: 24, handleLength: 88 },
        bounds
      )
    ).toEqual({ x: 640, y: 1056 })
  })
})
