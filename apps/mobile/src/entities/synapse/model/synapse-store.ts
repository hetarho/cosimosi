import {create} from 'zustand';

import type {Synapse} from '@cosimosi/memory';

export interface SynapseState {
  byId: Readonly<Record<string, Synapse>>;
  ids: readonly string[];
  setAll: (synapses: readonly Synapse[]) => void;
}

// Data store (§3.2): the synapse collection keyed by id, populated once per GetUniverse
// fetch. Synapses are the only edge kind in the universe graph [I4][I6].
export const useSynapseStore = create<SynapseState>()(set => ({
  byId: {},
  ids: [],
  setAll: synapses =>
    set({
      byId: Object.fromEntries(synapses.map(synapse => [synapse.id, synapse])),
      ids: synapses.map(synapse => synapse.id),
    }),
}));
