// @vitest-environment jsdom

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render as mount, waitFor } from '@testing-library/react'

import { CAPTION_EDGE_INSET_PX, CAPTION_EYELINE, CAPTION_SURFACE_GAP_PX } from '@cosimosi/sequence'
import { SURFACE_PANEL_ATTR } from '@cosimosi/ui'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

import { SequenceGuide, type SequenceGuideProps } from './SequenceGuide.tsx'

function baseProps(): SequenceGuideProps {
  return {
    active: true,
    caption: () => 'Write one line about today.',
    // Mid-screen on a phone, so the `eyeline` band and this control do not collide: the placement
    // rule under test is the chrome's own, not the yielding one's (that one is pinned in
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

// The widget reads the window size itself (one of its two platform concerns), so a placement test
// has to move the window rather than pass a viewport in.
function resizeTo(width: number, height: number) {
  window.innerWidth = width
  window.innerHeight = height
  window.dispatchEvent(new Event('resize'))
}

// A bottom sheet, in the one shape the chrome recognizes: a marked panel flush with the bottom edge
// and spanning the full width. jsdom measures nothing, so the rect is stubbed on the node — which is
// also what keeps this test about the RULE rather than about the CSS.
function openBottomSheet(top: number, width = window.innerWidth) {
  const panel = document.createElement('div')
  panel.setAttribute(SURFACE_PANEL_ATTR, '')
  panel.getBoundingClientRect = () =>
    ({
      x: 0,
      y: top,
      width,
      height: window.innerHeight - top,
    }) as DOMRect
  document.body.append(panel)
  return panel
}

async function mountGuide(overrides: Partial<SequenceGuideProps> = {}) {
  const { container } = mount(
    createElement(SequenceGuide, { ...baseProps(), ...overrides }) as never,
  )
  const band = () => container.querySelector('[aria-live="polite"]') as HTMLElement
  // The surface read is deferred to a frame, so the first paint may still be the no-surface answer.
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve))
  })
  return band
}

describe('SequenceGuide (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    resizeTo(390, 844)
  })

  afterEach(() => {
    cleanup()
    document.body.replaceChildren()
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
    // `z-modal`. On a `z-50` the caption and the always-available skip would render behind the very
    // panel they describe — so "the skip is visible on every step" would be false for a third of the
    // run. `z-guide` sits between `z-modal` and `z-toast`: over the dialog, under an error.
    const html = render()
    expect(html.match(/z-\[var\(--z-guide\)\]/g)).toHaveLength(3)
    expect(html).not.toContain('z-50')
    expect(html).not.toContain('z-40')
  })

  it('renders no chrome at all when no run is active', () => {
    // Between runs the screen is the product's, untouched — the guide is not a persistent frame.
    expect(render({ active: false })).toBe('')
  })

  it('gives the caption the bottom band on a wide screen with nothing in the way', async () => {
    // A desktop's interrupting surfaces are CENTRED modals, so the bottom edge is the one region
    // nothing will claim — better than floating the line into the space a modal will want.
    resizeTo(1280, 800)
    const band = await mountGuide()
    expect(band().style.bottom).toBe(`${CAPTION_EDGE_INSET_PX}px`)
  })

  it('floats the caption in the eyeline on a narrow screen with nothing in the way', async () => {
    const band = await mountGuide()
    expect(band().style.top).toBe(`${CAPTION_EYELINE * 100}%`)
    expect(band().className).toContain('-translate-y-1/2')
  })

  it('lifts the caption just above an open bottom sheet, without being told there is one', async () => {
    // The point of the rule: no host names the sheet, and no host carries a band per surface. The
    // chrome finds the panel that owns the bottom edge and clears its top edge by one gap.
    const band = await mountGuide()
    act(() => {
      openBottomSheet(500)
    })
    await waitFor(() => expect(band().style.bottom).toBe(`${844 - 500 + CAPTION_SURFACE_GAP_PX}px`))
  })

  it('ignores a panel that leaves the caption band free', async () => {
    // A wide screen's right-edge panel reaches the bottom but not across it, so the centred line has
    // its usual room and the sheet rule does not apply.
    resizeTo(1280, 800)
    const band = await mountGuide()
    act(() => {
      openBottomSheet(0, 350)
    })
    await waitFor(() => expect(band().style.bottom).toBe(`${CAPTION_EDGE_INSET_PX}px`))
  })

  it('lets a host override the slot when the default cannot see its surface', async () => {
    const band = await mountGuide({ captionSlot: 'edge' })
    expect(band().style.bottom).toBe(`${CAPTION_EDGE_INSET_PX}px`)
    expect(band().style.top).toBe('')
  })

  it('resolves the caption through the accessor at render time, so a locale change re-reads it', () => {
    let locale = 'en'
    const html = render({ caption: () => (locale === 'en' ? 'first' : 'second') })
    expect(html).toContain('first')
    locale = 'ko'
    expect(render({ caption: () => (locale === 'en' ? 'first' : 'second') })).toContain('second')
  })
})
