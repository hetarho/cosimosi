import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VALUES } from '@cosimosi/config'
import { useReducedMotion } from '@cosimosi/ui'

import { SequenceSpotlight } from './SequenceSpotlight.tsx'

// Only the motion preference is stubbed; `cx` stays real so the rendered class list is the real one.
vi.mock('@cosimosi/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cosimosi/ui')>()),
  useReducedMotion: vi.fn(),
}))

const mockUseReducedMotion = vi.mocked(useReducedMotion)
const RECT = { x: 40, y: 120, width: 200, height: 48 }

function render(rect: typeof RECT | null) {
  return renderToString(createElement(SequenceSpotlight, { rect }))
}

describe('SequenceSpotlight (web)', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReset()
    mockUseReducedMotion.mockReturnValue(false)
  })

  it('is decorative and never takes over the screen (A9)', () => {
    const html = render(RECT)
    // The three properties that make the chrome non-modal: it cannot be hit, it is not announced, and
    // it draws no backdrop. Nothing here can disable or defocus the control it circles.
    expect(html).toContain('pointer-events-none')
    expect(html).toContain('aria-hidden')
    expect(html).not.toContain('disabled')
  })

  it('pulses at the tuned period', () => {
    expect(render(RECT)).toContain(`animation-duration:${VALUES.sequence.highlightPulseMs}ms`)
    expect(render(RECT)).toContain('animate-pulse')
  })

  it('collapses to a static ring under reduced motion (A9)', () => {
    mockUseReducedMotion.mockReturnValue(true)
    const html = render(RECT)
    expect(html).not.toContain('animate-pulse')
    expect(html).not.toContain('animation-duration')
    // The ring itself stays — the pulse draws the eye, but the ring is what says "here".
    expect(html).toContain('border-primary')
  })

  it('renders nothing at all when the anchor could not be measured (A10)', () => {
    // Not an error state, and no timeout: the caption is the guaranteed channel, so an unresolvable
    // anchor simply leaves the highlight out and the run stays completable.
    expect(render(null)).toBe('')
  })
})
