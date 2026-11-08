// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DEMO_DIARY_SETS, resolveDemoDiarySet } from '@cosimosi/demo'

import { m, setActiveLocale, type Locale } from '../../../shared/i18n/index.ts'
import { DemoRecallSheet } from './DemoRecallSheet.tsx'

afterEach(() => {
  cleanup()
})

// DEMO-8: the demo renders no cost surface, and a sentence saying recall is free is one — it names a
// price by naming its absence. The patterns cover both halves, the charge and the waiver.
const COST_WORDING: Readonly<Record<Locale, RegExp>> = {
  en: /\b(free|costs?|price|pay|paid|charge[sd]?|stardust)\b/i,
  ko: /무료|유료|비용|가격|결제|별가루/,
}

const LOCALES: readonly Locale[] = ['en', 'ko']
const EPOCH = '2026-01-01'
// Far enough past every fixture diary that the target has lost words, as it has on the recall beat.
const LATER = '2026-06-01'

function recallTarget(setIndex: number, locale: Locale) {
  const set = DEMO_DIARY_SETS[setIndex]
  const resolved = resolveDemoDiarySet(set, locale, EPOCH)
  const memory = resolved.snapshot.memories.find((item) => item.id === set.scenario.recallMemoryId)
  if (!memory) throw new Error(`${set.structure.id}: no recall target`)
  return { memory, reconsolidatedText: resolved.reconsolidatedTexts[memory.id] ?? null }
}

function sheetText(): string {
  const dialog = screen.getByRole('dialog')
  const fields = [...dialog.querySelectorAll('textarea')].map((field) => field.value)
  return [dialog.textContent ?? '', ...fields].join('\n')
}

describe('the demo recall sheet', () => {
  for (const locale of LOCALES) {
    for (const [setIndex, set] of DEMO_DIARY_SETS.entries()) {
      it(`asks for the faded words with no cost or free wording (${set.structure.id}, ${locale})`, () => {
        setActiveLocale(locale)
        const { memory, reconsolidatedText } = recallTarget(setIndex, locale)
        const props = {
          open: true,
          memory,
          universeTime: LATER,
          reconsolidatedText,
          onConfirm: () => undefined,
          onClose: () => undefined,
        }

        const { rerender } = render(<DemoRecallSheet {...props} done={false} />)
        expect(screen.getByText(m.demo_recall_rewrite_prompt())).toBeTruthy()
        expect(screen.queryByText(m.recall_rewrite_prompt())).toBeNull()
        expect(sheetText()).not.toMatch(COST_WORDING[locale])

        rerender(<DemoRecallSheet {...props} done />)
        expect(
          screen.getByText(
            reconsolidatedText ? m.recall_result_reconsolidated() : m.recall_result_reinforced(),
          ),
        ).toBeTruthy()
        expect(sheetText()).not.toMatch(COST_WORDING[locale])
      })
    }
  }

  it('would catch a sentence that calls recall free', () => {
    // A guard nobody has seen fail is a guard nobody knows is wired.
    expect('Reconstructing a memory is free.').toMatch(COST_WORDING.en)
    expect('회고하기는 무료예요.').toMatch(COST_WORDING.ko)
  })
})
