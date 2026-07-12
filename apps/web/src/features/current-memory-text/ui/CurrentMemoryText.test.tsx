import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { CurrentMemoryText } from './CurrentMemoryText.tsx'

// A3: the forgotten current text is a pure read — the component takes a plain string and renders
// it, with no transport/query/mutation anywhere (viewing is free and moves no clock, by construction).
describe('CurrentMemoryText', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders the supplied text', () => {
    const html = renderToString(
      createElement(CurrentMemoryText, { text: 'a quiet market morning' }),
    )
    expect(html).toContain('a quiet market morning')
    expect(html).not.toContain(m.star_detail_text_unavailable())
  })

  it('shows the unavailable note when no text source is wired yet', () => {
    const html = renderToString(createElement(CurrentMemoryText, { text: null }))
    expect(html).toContain(m.star_detail_text_unavailable())
  })
})
