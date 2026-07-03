import type { Emotion } from '@cosimosi/emotion'

// The memory↔neuron membership join carried on the episodic-memory mirror — never a
// memory↔memory edge [I4][I6]; the graph builder anchors a memory to these neurons.
export interface NeuronActivation {
  readonly neuronId: string
  readonly weight: number
}

// FE domain mirror of the stored episodic-memory facts (GetUniverse contract, plan 23).
// Stored facts only: read-time derived values (effective strength/brightness) come from
// @cosimosi/memory-logic, and positions are emergent force-sim output, never fields [I5].
export interface EpisodicMemory {
  readonly id: string
  readonly name: string
  readonly emotion: Emotion
  readonly baseStrength: number
  readonly recallCount: number
  /** ISO DATE in universe time. */
  readonly createdUniverseTime: string
  readonly lastRecalledUniverseTime: string | null
  /** Visual form/anchor hint [E7] — never a stored coordinate [I5]. */
  readonly seed: bigint | null
  readonly activations: readonly NeuronActivation[]
}
