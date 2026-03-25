import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import EdgeHandle from './EdgeHandle'

describe('EdgeHandle', () => {
  it('renders the docked primary usage as plain digits when provided', () => {
    const markup = renderToStaticMarkup(
      <EdgeHandle side="left" usageLabel="31" onClick={() => undefined} />
    )

    expect(markup).toContain('31')
    expect(markup).not.toContain('%')
    expect(markup).not.toContain('◀')
  })

  it('falls back to the directional arrow when no usage label is available', () => {
    const markup = renderToStaticMarkup(<EdgeHandle side="right" onClick={() => undefined} />)

    expect(markup).toContain('▶')
  })
})
