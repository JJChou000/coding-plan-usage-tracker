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
    expect(markup).toContain('edge-handle__content')
  })

  it('renders left and right docked usage in a horizontal single line', () => {
    const markup = renderToStaticMarkup(
      <EdgeHandle side="right" usageLabel="57" onClick={() => undefined} />
    )

    expect(markup).toContain('edge-handle__content--horizontal')
    expect(markup).not.toContain('edge-handle__content--vertical')
  })

  it('falls back to the directional arrow when no usage label is available', () => {
    const markup = renderToStaticMarkup(<EdgeHandle side="right" onClick={() => undefined} />)

    expect(markup).toContain('edge-handle__arrow')
  })
})
