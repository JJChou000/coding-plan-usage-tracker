import './EdgeHandle.css'

export type EdgeHandleSide = 'left' | 'right' | 'top' | 'bottom'

export interface EdgeHandleProps {
  side: EdgeHandleSide
  usageLabel?: string
  onClick: () => void
}

const ARROW_BY_SIDE: Record<EdgeHandleSide, string> = {
  left: '◀',
  right: '▶',
  top: '▲',
  bottom: '▼'
}

const SIDE_LABELS: Record<EdgeHandleSide, string> = {
  left: '左侧',
  right: '右侧',
  top: '上侧',
  bottom: '下侧'
}

function EdgeHandle({ side, usageLabel, onClick }: EdgeHandleProps): React.JSX.Element {
  const arrow = ARROW_BY_SIDE[side]
  const displayLabel = usageLabel?.trim()
  const shouldShowUsage = Boolean(displayLabel)
  const contentClassName = shouldShowUsage
    ? `edge-handle__content ${
        side === 'left' || side === 'right'
          ? 'edge-handle__content--vertical'
          : 'edge-handle__content--horizontal'
      }${displayLabel === '--' ? ' edge-handle__content--placeholder' : ''}`
    : 'edge-handle__arrow'

  return (
    <button
      type="button"
      className={`edge-handle edge-handle--${side}`}
      onClick={onClick}
      aria-label={`恢复${SIDE_LABELS[side]}浮窗${shouldShowUsage ? `，当前主用量 ${displayLabel}` : ''}`}
    >
      <span className={contentClassName} aria-hidden="true">
        {shouldShowUsage ? displayLabel : arrow}
      </span>
    </button>
  )
}

export default EdgeHandle
