// FE domain mirror of the stored synapse facts (GetUniverse contract).
// Undirected neuron↔neuron link, canonical neuronAId < neuronBId — synapses are the only
// edge kind in the universe graph [I4][I6].
export interface Synapse {
  readonly id: string
  readonly neuronAId: string
  readonly neuronBId: string
  readonly strength: number
  readonly coActivationCount: number
  /** ISO DATE in universe time. */
  readonly lastActivatedUniverseTime: string
}
