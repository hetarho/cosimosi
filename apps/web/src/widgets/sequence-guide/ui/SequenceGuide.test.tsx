// @vitest-environment jsdom

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render as mount } from '@testing-library/react'

import { CENTERED_CAPTION_MIDLINE } from '@cosimosi/sequence'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

import { SequenceGuide, type SequenceGuideProps } from './SequenceGuide.tsx'

function baseProps(): SequenceGuideProps {
  return {
    active: true,
    caption: () => 'Write one line about today.',
    // Mid-screen on a phone, so the `center` band and this control do not collide: the placement
    // rule under test is the breakpoint's, not the yielding one's (that one is pinned in
    // packages/sequence).
    anchorRect: { x: 40, y: 120, width: 200, height: 48 },
    progress: { current: 3, total: 10 },
    onSkip: () => {},
    onRemeasure: () => {},
  }
}

function render(overrides: Partial<SequenceGuideProps> = {}) {
  return renderToString(createElement(SequenceGuide, { ...baseProps(), ...overrides }))
}

// The widget reads the window size itself (its one platform concern), so a placement test has to
// move the window rather than pass a viewport in.
function resizeTo(width: number, height: number) {
  window.innerWidth = width
  window.innerHeight = height
  window.dispatchEvent(new Event('resize'))
}

describe('SequenceGuide (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  afterEach(() => {
    cleanup()
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

  it('puts every part of the chrome above the modal layer', () => {
    // The onboarding tour points three of its steps INTO the writing dialog, which is a portal at
    // `z-modal`. On the `z-50` this used to carry, the caption and the always-available skip rendered
    // behind the very panel they describe — so "the skip is visible on every step" was false for a third
    // of the run. `z-guide` sits between `z-modal` and `z-toast`: over the dialog, under an error.
    const html = render()
    expect(html.match(/z-\[var\(--z-guide\)\]/g)).toHaveLength(3)
    expect(html).not.toContain('z-50')
    expect(html).not.toContain('z-40')
  })

  it('renders no chrome at all when no run is active', () => {
    // Between runs the screen is the product's, untouched — the guide is not a persistent frame.
    expect(render({ active: false })).toBe('')
  })

  it('gives the caption the bottom band on a wide screen, whatever the host asked for', () => {
    // The complaint this answers: on a desktop the interrupting surfaces are CENTRED modals, so a
    // line floated mid-screen — or glued under a control inside one — landed on top of the panel it
    // was describing. Above `md` the bottom edge is free, so every host style goes there.
    resizeTo(1280, 800)
    for (const captionStyle of ['center', 'top', 'attached'] as const) {
      const { container } = mount(
        createElement(SequenceGuide, { ...baseProps(), captionStyle }) as never,
      )
      const band = container.querySelector('[aria-live="polite"]') as HTMLElement
      expect(band.className).toContain('bottom-0')
      expect(band.style.top).toBe('')
      cleanup()
    }
  })

  it('floats the caption above the middle on a narrow screen, clear of the bottom sheet', () => {
    resizeTo(390, 844)
    const { container } = mount(
      createElement(SequenceGuide, { ...baseProps(), captionStyle: 'center' }) as never,
    )
    const band = container.querySelector('[aria-live="polite"]') as HTMLElement
    expect(band.style.top).toBe(`${CENTERED_CAPTION_MIDLINE * 100}%`)
    expect(band.className).toContain('-translate-y-1/2')
  })

  it('resolves the caption through the accessor at render time, so a locale change re-reads it', () => {
    let locale = 'en'
    const html = render({ caption: () => (locale === 'en' ? 'first' : 'second') })
    expect(html).toContain('first')
    locale = 'ko'
    expect(render({ caption: () => (locale === 'en' ? 'first' : 'second') })).toContain('second')
  })
})
