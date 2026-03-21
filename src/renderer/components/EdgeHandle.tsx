import './EdgeHandle.css'

export type EdgeHandleSide = 'left' | 'right' | 'top' | 'bottom'

export interface EdgeHandleProps {
  side: EdgeHandleSide
  onClick: () => void
}

const ARROW_BY_SIDE: Record<EdgeHandleSide, string> = {
  left: '◀',
  right: '▶',
  top: '▲',
  bottom: '▼'
}

function EdgeHandle({ side, onClick }: EdgeHandleProps): React.JSX.Element {
  const arrow = ARROW_BY_SIDE[side]

  return (
    <button
      type="button"
      className={`edge-handle edge-handle--${side}`}
      onClick={onClick}
      aria-label={`恢复 ${side} 边缘浮窗`}
    >
      <span className="edge-handle__arrow" aria-hidden="true">
        {arrow}
      </span>
    </button>
  )
}

export default EdgeHandle
