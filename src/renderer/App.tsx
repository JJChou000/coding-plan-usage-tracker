function App(): React.JSX.Element {
  return (
    <main className="app-shell">
      <section className="stage-card">
        <span className="stage-badge">Stage 0</span>
        <h1>Coding Plan Usage Tracker</h1>
        <p className="stage-copy">Electron + React + TypeScript scaffolding is ready for the next stage.</p>
        <div className="stage-grid">
          <article className="stage-panel">
            <strong>Project</strong>
            <span>electron-vite / React 19 / TypeScript</span>
          </article>
          <article className="stage-panel">
            <strong>Focus</strong>
            <span>shared types, styles, and folder structure</span>
          </article>
        </div>
      </section>
    </main>
  )
}

export default App
