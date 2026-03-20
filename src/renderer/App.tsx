import { useEffect, useRef } from 'react'

type DragState = {
  mouseX: number
  mouseY: number
  windowX: number
  windowY: number
}

function App(): React.JSX.Element {
  const dragStateRef = useRef<DragState | null>(null)

  useEffect(() => {
    document.title = window.location.hash === '#settings' ? 'Coding Plan Usage Tracker - 设置' : 'Coding Plan Usage Tracker'

    const handleMouseMove = (event: MouseEvent): void => {
      if (!dragStateRef.current) {
        return
      }

      const deltaX = event.screenX - dragStateRef.current.mouseX
      const deltaY = event.screenY - dragStateRef.current.mouseY

      window.electronAPI.setWindowPosition({
        x: Math.round(dragStateRef.current.windowX + deltaX),
        y: Math.round(dragStateRef.current.windowY + deltaY)
      })
    }

    const stopDragging = (): void => {
      dragStateRef.current = null
      document.body.classList.remove('is-dragging')
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDragging)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDragging)
    }
  }, [])

  const startDragging = (event: React.MouseEvent<HTMLElement>): void => {
    if (event.button !== 0) {
      return
    }

    dragStateRef.current = {
      mouseX: event.screenX,
      mouseY: event.screenY,
      windowX: window.screenX,
      windowY: window.screenY
    }

    document.body.classList.add('is-dragging')
  }

  return (
    <main className="app-shell" onMouseDown={startDragging}>
      <section className="stage-card">
        <span className="stage-badge">Stage 1.2</span>
        <h1>Coding Plan Usage Tracker</h1>
        <p className="stage-copy">当前浮窗已切换到透明无边框窗口，可直接按住任意空白区域拖拽移动。</p>
        <div className="stage-grid">
          <article className="stage-panel">
            <strong>Window</strong>
            <span>320 x 120 / frameless / transparent / always on top</span>
          </article>
          <article className="stage-panel">
            <strong>Interaction</strong>
            <span>IPC drag, edge docking hooks, and runtime resize support are now wired in.</span>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
