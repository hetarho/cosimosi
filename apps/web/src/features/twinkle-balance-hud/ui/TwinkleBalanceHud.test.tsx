import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

import { useTwinkleBalanceStore } from '@cosimosi/twinkle'
import { TwinkleBalanceHud } from './TwinkleBalanceHud.tsx'

// The SSR-string harness runs the render but reads zustand's *initial* snapshot (no effects,
// no store subscription updates), so it pins what the HUD draws before the first read: both
// tiers distinct, a placeholder rather than a false zero, and no meaning-layer word ([I11]).
// The populated render + refetch update (A1) are the live behaviour, pinned by the mobile
// TwinkleBalanceHud test (jest + @testing-library/react-native).
describe('TwinkleBalanceHud (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
    useTwinkleBalanceStore.getState().clear()
  })

  it('renders both tiers distinctly, with a placeholder until the first read resolves', () => {
    const html = renderToString(createElement(TwinkleBalanceHud))
    expect(html).toContain(m.twinkle_balance_small_label())
    expect(html).toContain(m.twinkle_balance_general_label())
    // A placeholder, never a false zero, before GetBalance settles.
    expect(html).toContain('—')
  })

  it('exposes only Twinkle figures — no meaning-layer or placement word ([I11])', () => {
    const html = renderToString(createElement(TwinkleBalanceHud)).toLowerCase()
    for (const word of ['emotion', 'mood', 'position', 'strength', 'valence', 'arousal']) {
      expect(html).not.toContain(word)
    }
  })

  it('is itself the way into what the figures are about when the detail surface is wired', () => {
    const html = renderToString(createElement(TwinkleBalanceHud, { onOpenDetail: () => undefined }))
    // Two forms, one for each width, and BOTH are the press — there is no separate mark beside the
    // numbers to aim at, and no form of this reading that only looks back at the reader.
    const openers = html.match(/aria-haspopup="dialog"/g) ?? []
    expect(openers).toHaveLength(2)
    expect(html).toContain(`aria-label="${m.twinkle_balance_title()}"`)
  })

  it('renders readings without false button or popup semantics when no detail surface is wired', () => {
    const html = renderToString(createElement(TwinkleBalanceHud))
    expect(html).not.toContain('<button')
    expect(html).not.toContain('aria-haspopup')
  })
})
