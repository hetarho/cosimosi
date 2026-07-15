import { create } from 'zustand'

import type { LetGoCandidate } from '../../../features/let-go/index.ts'

// The deletion-flow's data (§3.2), kept out of the machine context ([I3][I11]): the typed
// letting-go phrase, the server-returned candidate list, and the toggled subset the diarist has
// chosen to seal. Reset when the flow opens or closes. The candidates arrive from SuggestLetGo;
// the default selection is all of them (the AI's suggestion), which the diarist then narrows — AI
// suggests, the user decides ([X6]).
export interface DeletionDraftState {
  phrase: string
  candidates: readonly LetGoCandidate[]
  selectedNeuronIds: readonly string[]
  heavyDetected: boolean
  setPhrase: (phrase: string) => void
  setSuggestion: (candidates: readonly LetGoCandidate[], heavyDetected: boolean) => void
  toggle: (neuronId: string) => void
  reset: () => void
}

export const useDeletionDraftStore = create<DeletionDraftState>()((set) => ({
  phrase: '',
  candidates: [],
  selectedNeuronIds: [],
  heavyDetected: false,
  setPhrase: (phrase) => set({ phrase }),
  setSuggestion: (candidates, heavyDetected) =>
    set({ candidates, heavyDetected, selectedNeuronIds: candidates.map((c) => c.neuronId) }),
  toggle: (neuronId) =>
    set((state) => ({
      selectedNeuronIds: state.selectedNeuronIds.includes(neuronId)
        ? state.selectedNeuronIds.filter((id) => id !== neuronId)
        : [...state.selectedNeuronIds, neuronId],
    })),
  reset: () => set({ phrase: '', candidates: [], selectedNeuronIds: [], heavyDetected: false }),
}))
