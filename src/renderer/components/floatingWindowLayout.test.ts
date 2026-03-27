import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  resolveNativeDockState,
  resolvePreviewDockState,
  type FloatingWindowSize
} from './floatingWindowLayout'

const floatingSize: FloatingWindowSize = {
  width: 176,
  height: 52,
  handleLength: 52
}

const previewArena = {
  width: 800,
  height: 600
} as DOMRect

describe('resolvePreviewDockState', () => {
  it('keeps the successful right-edge docking behavior', () => {
    expect(resolvePreviewDockState({ x: 640, y: 160 }, floatingSize, previewArena)).toBe(
      'docked-right'
    )
  })

  it('no longer docks when dragged to the left edge', () => {
    expect(resolvePreviewDockState({ x: 8, y: 160 }, floatingSize, previewArena)).toBeNull()
  })

  it('no longer docks when dragged to the top edge', () => {
    expect(resolvePreviewDockState({ x: 220, y: 6 }, floatingSize, previewArena)).toBeNull()
  })

  it('no longer docks when dragged to the bottom edge', () => {
    expect(resolvePreviewDockState({ x: 220, y: 560 }, floatingSize, previewArena)).toBeNull()
  })
})

describe('resolveNativeDockState', () => {
  beforeEach(() => {
    vi.stubGlobal('screen', {
      availWidth: 1920,
      availHeight: 1080
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps right-edge docking in the native window flow', () => {
    expect(resolveNativeDockState({ x: 1728, y: 120 }, floatingSize)).toBe('docked-right')
  })

  it('ignores the historical top and left docking positions', () => {
    expect(resolveNativeDockState({ x: 6, y: 120 }, floatingSize)).toBeNull()
    expect(resolveNativeDockState({ x: 260, y: 8 }, floatingSize)).toBeNull()
  })

  it('ignores the historical bottom docking position', () => {
    expect(resolveNativeDockState({ x: 260, y: 1036 }, floatingSize)).toBeNull()
  })
})
