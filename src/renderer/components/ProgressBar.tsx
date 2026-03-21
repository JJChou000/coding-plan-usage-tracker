import './ProgressBar.css'

export interface ProgressBarProps {
  percent: number
  size?: 'sm' | 'md'
}

type ProgressPalette = {
  start: string
  end: string
  glow: string
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

function getProgressPalette(percent: number): ProgressPalette {
  if (percent <= 60) {
    return {
      start: 'var(--progress-green-soft)',
      end: 'var(--progress-green)',
      glow: 'rgba(69, 212, 131, 0.42)'
    }
  }

  if (percent <= 80) {
    return {
      start: 'var(--progress-yellow-soft)',
      end: 'var(--progress-yellow)',
      glow: 'rgba(244, 201, 75, 0.38)'
    }
  }

  return {
    start: 'var(--progress-red-soft)',
    end: 'var(--progress-red)',
    glow: 'rgba(240, 108, 120, 0.42)'
  }
}

function ProgressBar({ percent, size = 'md' }: ProgressBarProps): React.JSX.Element {
  const safePercent = clampPercent(percent)
  const progressPalette = getProgressPalette(safePercent)

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
          color: getProgressColor(safePercent),
          ['--progress-fill-start' as string]: progressPalette.start,
          ['--progress-fill-end' as string]: progressPalette.end,
          ['--progress-glow' as string]: progressPalette.glow
        }}
      />
    </div>
  )
}

export default ProgressBar
