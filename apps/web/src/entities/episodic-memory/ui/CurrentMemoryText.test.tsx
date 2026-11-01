import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'
import { CurrentMemoryText } from './CurrentMemoryText.tsx'

// A3: the forgotten current text is a pure read — the component takes resolved spans and renders
// them, with no transport/query/mutation anywhere (viewing is free and moves no clock, by construction).
describe('CurrentMemoryText', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders the supplied text', () => {
    const html = renderToString(
      createElement(CurrentMemoryText, {
        spans: [{ text: 'a quiet market morning', lost: false }],
      }),
    )
    expect(html).toContain('a quiet market morning')
    expect(html).not.toContain(m.star_detail_text_unavailable())
  })

  it('draws a lost run as a smear and leaves the surviving words plain', () => {
    const html = renderToString(
      createElement(CurrentMemoryText, {
        spans: [
          { text: 'a quiet ', lost: false },
          { text: 'xxxx', lost: true },
          { text: ' morning', lost: false },
        ],
      }),
    )
    expect(html).toContain('obscured-run')
    // The loss is shown, never announced: no warning, no label, nothing but the smear.
    expect(html).toContain('a quiet ')
    expect(html).toContain(' morning')
  })

  it('shows the unavailable note when no text source is wired yet', () => {
    const html = renderToString(createElement(CurrentMemoryText, { spans: null }))
    expect(html).toContain(m.star_detail_text_unavailable())
  })
})
