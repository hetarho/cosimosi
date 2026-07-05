import { create } from 'zustand'

// The pre-split draft (§3.2 data, not machine context): the diary body and its date. The date
// defaults to today when the flow opens ([W5]) — the caller passes today's ISO date to `reset`
// so this store stays a pure (no `new Date()`) testable slice — and is user-editable thereafter.
export interface DiaryDraftState {
  body: string
  /** ISO DATE (YYYY-MM-DD). */
  diaryDate: string
  setBody: (body: string) => void
  setDiaryDate: (diaryDate: string) => void
  /** Seed a fresh draft: empty body + the given date (today, supplied by the opener). */
  reset: (diaryDate: string) => void
}

export const useDiaryDraftStore = create<DiaryDraftState>()((set) => ({
  body: '',
  diaryDate: '',
  setBody: (body) => set({ body }),
  setDiaryDate: (diaryDate) => set({ diaryDate }),
  reset: (diaryDate) => set({ body: '', diaryDate }),
}))
