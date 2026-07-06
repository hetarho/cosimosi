import { create } from 'zustand'

import type { SplitDiaryResponse } from '@cosimosi/api-client'

import {
  draftsFromResponse,
  mergeMemory,
  renameMemory,
  setMemoryMood,
  splitMemory,
  type ProposedMemoryDraft,
} from '@cosimosi/universe'

// Data store (§3.2): the editable proposal. The machine holds the phase; the proposal lives here,
// mutated by the pure edit helpers. NL revises replace it wholesale (setFromResponse); hand-edits
// apply locally — both leave the same representation for LaunchStars.
export interface ProposalState {
  memories: readonly ProposedMemoryDraft[]
  setFromResponse: (response: SplitDiaryResponse) => void
  rename: (index: number, name: string) => void
  setMood: (index: number, mood: string) => void
  merge: (index: number) => void
  split: (index: number) => void
  reset: () => void
}

export const useProposalStore = create<ProposalState>()((set) => ({
  memories: [],
  setFromResponse: (response) => set({ memories: draftsFromResponse(response) }),
  rename: (index, name) => set((state) => ({ memories: renameMemory(state.memories, index, name) })),
  setMood: (index, mood) => set((state) => ({ memories: setMemoryMood(state.memories, index, mood) })),
  merge: (index) => set((state) => ({ memories: mergeMemory(state.memories, index) })),
  split: (index) => set((state) => ({ memories: splitMemory(state.memories, index) })),
  reset: () => set({ memories: [] }),
}))
