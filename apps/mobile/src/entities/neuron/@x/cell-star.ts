// Cross-import surface (§3.1 @x): the domain facts a rendering entity may read from this
// mirror slice. Domain re-exports only — the projection is one-way [A2].
export { useNeuronStore, type NeuronState } from '../model/neuron-store.ts'
export type { Neuron } from '@cosimosi/memory'
