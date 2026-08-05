import { create } from 'zustand'

import type { Neuron } from '@cosimosi/memory'

import { sameStoredCollection } from './entity-collection.ts'

export interface NeuronState {
  byId: Readonly<Record<string, Neuron>>
  ids: readonly string[]
  setAll: (neurons: readonly Neuron[]) => void
  clear: () => void
}

// Data store (§3.2): the neuron collection keyed by id, populated once per GetUniverse
// fetch. Carries the per-neuron connectivity/degree the layout radius reads [V1].
export const useNeuronStore = create<NeuronState>()((set, get) => ({
  byId: {},
  ids: [],
  // A content-identical write keeps the previous `byId`/`ids` references — see
  // `sameStoredCollection` for why that matters more than the write it saves.
  setAll: (neurons) => {
    const { ids, byId } = get()
    if (sameStoredCollection(ids, byId, neurons)) return
    set({
      byId: Object.fromEntries(neurons.map((neuron) => [neuron.id, neuron])),
      ids: neurons.map((neuron) => neuron.id),
    })
  },
  clear: () => set({ byId: {}, ids: [] }),
}))
