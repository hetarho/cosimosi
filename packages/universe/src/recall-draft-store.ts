import { create } from 'zustand'
import type { DecayTextSpan } from './current-decay-text.ts'
import type { RecallOutcome } from './recall-flow.machine.ts'

export interface RecallPassagePart extends DecayTextSpan {
  readonly index: number
  readonly blankNumber: number
}
export interface RecallResultView {
  readonly outcome: RecallOutcome
  readonly currentText: string
}

// Only the displayed, already-eroded spans are used. A hidden word is never fetched from currentText.
export function assembleRecallText(
  spans: readonly DecayTextSpan[],
  answers: Readonly<Record<number, string>>,
): string | null {
  if (spans.length === 0) return null
  const parts: string[] = []
  for (let index = 0; index < spans.length; index += 1) {
    const span = spans[index]
    if (!span.lost) {
      parts.push(span.text)
      continue
    }
    const answer = answers[index]?.trim()
    if (!answer) return null
    parts.push(answer)
  }
  return parts.join('')
}

export interface RecallDraftState {
  rewrite: string
  parts: readonly RecallPassagePart[] | null
  answers: Readonly<Record<number, string>>
  result: RecallResultView | null
  prepare: (spans: readonly DecayTextSpan[]) => void
  setAnswer: (index: number, value: string) => void
  setResult: (result: RecallResultView) => void
  reset: () => void
}

export const useRecallDraftStore = create<RecallDraftState>()((set) => ({
  rewrite: '',
  parts: null,
  answers: {},
  result: null,
  prepare: (spans) => {
    let blankNumber = 0
    const parts = spans.map((span, index) => ({
      ...span,
      index,
      blankNumber: span.lost ? ++blankNumber : 0,
    }))
    set({ parts, answers: {}, rewrite: assembleRecallText(parts, {}) ?? '' })
  },
  setAnswer: (index, value) =>
    set((state) => {
      if (!state.parts?.[index]?.lost) return state
      const answers = { ...state.answers, [index]: value }
      return { answers, rewrite: assembleRecallText(state.parts, answers) ?? '' }
    }),
  setResult: (result) => set({ result }),
  reset: () => set({ rewrite: '', parts: null, answers: {}, result: null }),
}))
