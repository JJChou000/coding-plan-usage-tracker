import type { AppConfig, ProviderUsageData } from '../../shared/types'

export type DockState = Exclude<AppConfig['windowState'], 'normal'>

export type PreviewPosition = {
  x: number
  y: number
}

export type FloatingWindowSize = {
  width: number
  height: number
  handleLength: number
}

export const FLOATING_WINDOW_LAYOUT = {
  windowWidth: 320,
  collapsedRowHeight: 36,
  expandedHeaderHeight: 36,
  expandedDimensionHeight: 30,
  expandedSectionPaddingTop: 6,
  expandedSectionPaddingBottom: 8,
  expandedSectionGap: 6,
  expandedDimensionGap: 4,
  windowPadding: 16,
  sectionDividerHeight: 1,
  dockThreshold: 20,
  handleWidth: 24,
  dragThreshold: 4,
  errorPlaceholderMinHeight: 104
} as const

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getCollapsedHeight(providerCount: number, errorSummaryCount = 0): number {
  const baseHeight =
    Math.max(
      FLOATING_WINDOW_LAYOUT.collapsedRowHeight,
      providerCount * FLOATING_WINDOW_LAYOUT.collapsedRowHeight
    ) + FLOATING_WINDOW_LAYOUT.windowPadding

  if (errorSummaryCount === 0) {
    return baseHeight
  }

  return Math.max(baseHeight, FLOATING_WINDOW_LAYOUT.errorPlaceholderMinHeight)
}

export function getExpandedHeight(providers: ProviderUsageData[]): number {
  if (providers.length === 0) {
    return getCollapsedHeight(1)
  }

  const contentHeight = providers.reduce((total, provider, index) => {
    const dimensionCount = provider.dimensions.length
    const dimensionsHeight =
      dimensionCount * FLOATING_WINDOW_LAYOUT.expandedDimensionHeight +
      Math.max(0, dimensionCount - 1) * FLOATING_WINDOW_LAYOUT.expandedDimensionGap
    const providerHeight =
      FLOATING_WINDOW_LAYOUT.expandedSectionPaddingTop +
      FLOATING_WINDOW_LAYOUT.expandedHeaderHeight +
      FLOATING_WINDOW_LAYOUT.expandedSectionGap +
      dimensionsHeight +
      FLOATING_WINDOW_LAYOUT.expandedSectionPaddingBottom

    return (
      total +
      providerHeight +
      (index < providers.length - 1 ? FLOATING_WINDOW_LAYOUT.sectionDividerHeight : 0)
    )
  }, 0)

  return contentHeight + FLOATING_WINDOW_LAYOUT.windowPadding
}

export function getDockSide(windowState: AppConfig['windowState']): DockState | null {
  return windowState === 'normal' ? null : windowState
}

export function getFloatingSize(
  isExpanded: boolean,
  windowState: AppConfig['windowState'],
  providers: ProviderUsageData[],
  placeholderErrorCount = 0
): FloatingWindowSize {
  const collapsedHeight = getCollapsedHeight(providers.length || 1, placeholderErrorCount)
  const expandedHeight = getExpandedHeight(providers)
  const handleLength = collapsedHeight

  if (windowState === 'docked-left' || windowState === 'docked-right') {
    return {
      width: FLOATING_WINDOW_LAYOUT.handleWidth,
      height: handleLength,
      handleLength
    }
  }

  if (windowState === 'docked-top' || windowState === 'docked-bottom') {
    return {
      width: handleLength,
      height: FLOATING_WINDOW_LAYOUT.handleWidth,
      handleLength
    }
  }

  return {
    width: FLOATING_WINDOW_LAYOUT.windowWidth,
    height: isExpanded ? expandedHeight : collapsedHeight,
    handleLength
  }
}

export function getDockedPreviewPosition(
  dockState: DockState,
  arena: DOMRect,
  size: FloatingWindowSize
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

export function resolvePreviewDockState(
  position: PreviewPosition,
  size: FloatingWindowSize,
  arena: DOMRect
): DockState | null {
  if (position.x <= FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-left'
  }

  if (position.x + size.width >= arena.width - FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-right'
  }

  if (position.y <= FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-top'
  }

  if (position.y + size.height >= arena.height - FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-bottom'
  }

  return null
}

export function resolveNativeDockState(
  position: PreviewPosition,
  size: FloatingWindowSize
): DockState | null {
  const maxWidth = screen.availWidth
  const maxHeight = screen.availHeight

  if (position.x <= FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-left'
  }

  if (position.x + size.width >= maxWidth - FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-right'
  }

  if (position.y <= FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-top'
  }

  if (position.y + size.height >= maxHeight - FLOATING_WINDOW_LAYOUT.dockThreshold) {
    return 'docked-bottom'
  }

  return null
}
