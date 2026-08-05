import { create } from 'zustand'

import type { Synapse } from '@cosimosi/memory'

import { sameStoredCollection } from './entity-collection.ts'

export interface SynapseState {
  byId: Readonly<Record<string, Synapse>>
  ids: readonly string[]
  setAll: (synapses: readonly Synapse[]) => void
  clear: () => void
}

// Data store (§3.2): the synapse collection keyed by id, populated once per GetUniverse
// fetch. Synapses are the only edge kind in the universe graph [I4][I6].
export const useSynapseStore = create<SynapseState>()((set, get) => ({
  byId: {},
  ids: [],
  // A content-identical write keeps the previous `byId`/`ids` references — see
  // `sameStoredCollection` for why that matters more than the write it saves.
  setAll: (synapses) => {
    const { ids, byId } = get()
    if (sameStoredCollection(ids, byId, synapses)) return
    set({
      byId: Object.fromEntries(synapses.map((synapse) => [synapse.id, synapse])),
      ids: synapses.map((synapse) => synapse.id),
    })
  },
  clear: () => set({ byId: {}, ids: [] }),
}))
