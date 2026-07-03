// @cosimosi/memory — the shared FE domain mirror of the universe read model (plan 23):
// episodic memory · neuron · synapse types + the GetUniverse proto→domain mappers.
// Pure (no three, no DOM, no visual vocabulary); web and mobile consume it verbatim.
export type { EpisodicMemory, NeuronActivation } from './episodic-memory.ts'
export { NEURON_TYPES, isNeuronType, type Neuron, type NeuronType } from './neuron.ts'
export type { Synapse } from './synapse.ts'
export {
  emotionFromDto,
  episodicMemoryFromDto,
  neuronFromDto,
  synapseFromDto,
  universeFromResponse,
  type UniverseSnapshot,
} from './mappers.ts'
