import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '../../../shared/i18n/index.ts'

import { RecallDiaryStarsAction } from './RecallDiaryStarsAction.tsx'

// The action offers the jump whenever the diary has a still-live star and blocks it otherwise (a
// live memory is always priced above zero, so membership alone decides — no per-row quote). The
// disabled button renders `disabled=""`, distinct from the always-present `disabled:` utility class.
function render(liveCount: number) {
  return renderToString(createElement(RecallDiaryStarsAction, { liveCount, onInitiate: () => {} }))
}

describe('RecallDiaryStarsAction (web)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('offers the jump when the diary has a live star', () => {
    const html = render(2)
    expect(html).toContain(m.diary_reader_recall_action())
    expect(html).not.toMatch(/disabled=""/)
  })

  it('is disabled when the diary has no live star', () => {
    expect(render(0)).toMatch(/disabled=""/)
  })

  it('marks itself as the one door that spends, and still quotes no amount ([D11])', () => {
    const html = render(2)
    expect(html).toContain(m.diary_reader_paid_hint())
    expect(html).toContain(m.twinkle_balance_general_label())
    // No price: the quote belongs to the jump dialog, never to a row.
    expect(html.replace(/<[^>]*>/g, '')).not.toMatch(/\d/)
  })
})
