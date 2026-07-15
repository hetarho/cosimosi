import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { useTwinkleBalanceStore } from '../../../entities/twinkle/index.ts'
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
    expect(html).toContain(m.twinkle_balance_basic_label())
    expect(html).toContain(m.twinkle_balance_additional_label())
    // A placeholder, never a false zero, before GetBalance settles.
    expect(html).toContain('—')
  })

  it('exposes only Twinkle figures — no meaning-layer or placement word ([I11])', () => {
    const html = renderToString(createElement(TwinkleBalanceHud)).toLowerCase()
    for (const word of ['emotion', 'mood', 'position', 'strength', 'valence', 'arousal']) {
      expect(html).not.toContain(word)
    }
  })
})
