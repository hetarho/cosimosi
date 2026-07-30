import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

import { SequenceGuide, type SequenceGuideProps } from './SequenceGuide.tsx'

function render(overrides: Partial<SequenceGuideProps> = {}) {
  return renderToString(
    createElement(SequenceGuide, {
      active: true,
      caption: () => 'Write one line about today.',
      anchorRect: { x: 40, y: 120, width: 200, height: 48 },
      progress: { current: 3, total: 10 },
      onSkip: () => {},
      onRemeasure: () => {},
      ...overrides,
    }),
  )
}

describe('SequenceGuide (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('shows a caption, a highlight and a skip while a run is active', () => {
    const html = render()
    expect(html).toContain('Write one line about today.')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain(m.sequence_skip_action())
    expect(html).toContain(m.sequence_progress({ current: 3, total: 10 }))
  })

  it('keeps the skip on a step with no highlight at all (A7/A10)', () => {
    // The degraded case has to stay escapable and followable: no anchor means no ring, and the caption
    // plus the skip carry the run on their own.
    const html = render({ anchorRect: null })
    expect(html).toContain('Write one line about today.')
    expect(html).toContain(m.sequence_skip_action())
    expect(html).not.toContain('animate-pulse')
  })

  it('renders no chrome at all when no run is active', () => {
    // Between runs the screen is the product's, untouched — the guide is not a persistent frame.
    expect(render({ active: false })).toBe('')
  })

  it('resolves the caption through the accessor at render time, so a locale change re-reads it', () => {
    let locale = 'en'
    const html = render({ caption: () => (locale === 'en' ? 'first' : 'second') })
    expect(html).toContain('first')
    locale = 'ko'
    expect(render({ caption: () => (locale === 'en' ? 'first' : 'second') })).toContain('second')
  })
})
