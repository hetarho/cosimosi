import {create} from 'zustand';

import type {Neuron} from '@cosimosi/memory';

export interface NeuronState {
  byId: Readonly<Record<string, Neuron>>;
  ids: readonly string[];
  setAll: (neurons: readonly Neuron[]) => void;
}

// Data store (§3.2): the neuron collection keyed by id, populated once per GetUniverse
// fetch. Carries the per-neuron connectivity/degree the layout radius reads [V1].
export const useNeuronStore = create<NeuronState>()(set => ({
  byId: {},
  ids: [],
  setAll: neurons =>
    set({
      byId: Object.fromEntries(neurons.map(neuron => [neuron.id, neuron])),
      ids: neurons.map(neuron => neuron.id),
    }),
}));
