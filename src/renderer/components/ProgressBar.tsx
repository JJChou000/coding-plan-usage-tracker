import './ProgressBar.css'

export interface ProgressBarProps {
  percent: number
  size?: 'sm' | 'md'
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) {
    return 0
  }

  return Math.min(100, Math.max(0, percent))
}

function getProgressColor(percent: number): string {
  if (percent <= 60) {
    return 'var(--progress-green)'
  }

  if (percent <= 80) {
    return 'var(--progress-yellow)'
  }

  return 'var(--progress-red)'
}

function ProgressBar({ percent, size = 'md' }: ProgressBarProps): React.JSX.Element {
  const safePercent = clampPercent(percent)
  const progressColor = getProgressColor(safePercent)

  return (
    <div
      className={`progress-bar progress-bar--${size}`}
      role="progressbar"
      aria-label={`使用率 ${Math.round(safePercent)}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safePercent)}
    >
      <div
        className="progress-bar__fill"
        style={{
          width: `${safePercent}%`,
          color: progressColor,
          background: progressColor
        }}
      />
    </div>
  )
}

export default ProgressBar
