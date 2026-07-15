import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

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
})
