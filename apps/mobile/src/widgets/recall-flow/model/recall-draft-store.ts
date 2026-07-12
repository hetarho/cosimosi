import { create } from 'zustand'

import type { RecallOutcome } from '@cosimosi/universe'

// The recall flow's data (§3.2), kept out of the machine context (A10): the session-only rewrite
// text and the server-returned result. Shares its shape verbatim with the web fork.
export interface RecallResultView {
  readonly outcome: RecallOutcome
  readonly currentText: string
}

export interface RecallDraftState {
  rewrite: string
  result: RecallResultView | null
  setRewrite: (rewrite: string) => void
  setResult: (result: RecallResultView) => void
  reset: () => void
}

export const useRecallDraftStore = create<RecallDraftState>()((set) => ({
  rewrite: '',
  result: null,
  setRewrite: (rewrite) => set({ rewrite }),
  setResult: (result) => set({ result }),
  reset: () => set({ rewrite: '', result: null }),
}))
