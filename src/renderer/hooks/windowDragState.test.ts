import { describe, expect, it } from 'vitest'

import { getNextLastNormalPosition } from './windowDragState'

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
