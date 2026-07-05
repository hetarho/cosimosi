import type { ForceSimGraph, ForceSimNodeIndex } from '@cosimosi/force-sim'
import type { UniverseSnapshot } from '@cosimosi/memory'

// Pure projection of the domain mirror onto the force-sim graph contract.
// Structural invariants live here:
//  - edges come from synapses ONLY (neuron↔neuron) — an episodic memory can never be an
//    edge endpoint, so no memory↔memory force or line can exist [I4][I6];
//  - memories enter as bodies anchored by their activation membership (centroid placement
//    is the sim's layout detail);
//  - only connectivity and weights cross into layout — emotion never does [I3].
// Rows referencing ids outside the snapshot are dropped, and out-of-range or non-finite
// magnitudes are coerced into the sim's valid domain (strength 0..1, non-negative finite
// weights/connectivity), rather than crashing the scene: the sim validates its input with a
// finite-check and a rejected graph inside the worker would kill the whole universe. The
// server owns the real caps; this is the last-line guard so one skewed row can't blank it.
export function buildUniverseGraph(universe: UniverseSnapshot): ForceSimGraph {
  const neuronIds = new Set(universe.neurons.map((neuron) => neuron.id))

  return {
    neurons: universe.neurons.map((neuron) => ({
      id: neuron.id,
      connectivity: nonNegative(neuron.connectivity),
    })),
    synapses: universe.synapses
      .filter((synapse) => neuronIds.has(synapse.neuronAId) && neuronIds.has(synapse.neuronBId))
      .map((synapse) => ({
        sourceNeuronId: synapse.neuronAId,
        targetNeuronId: synapse.neuronBId,
        strength: unitClamp(synapse.strength),
      })),
    episodicMemories: universe.memories.map((memory) => ({ id: memory.id })),
    activations: universe.memories.flatMap((memory) =>
      memory.activations
        .filter((activation) => neuronIds.has(activation.neuronId))
        .map((activation) => ({
          episodicMemoryId: memory.id,
          neuronId: activation.neuronId,
          weight: nonNegative(activation.weight),
        })),
    ),
  }
}

// A non-finite magnitude (NaN/±Infinity — a JSON float can carry these) would slip through a
// bare Math.max and trip the sim's assertFinite, so coerce it to 0 first.
function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function unitClamp(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

// Edge endpoints as node-index pairs into the coordinate buffer, for the edge layer.
// Indices come from the sim's node-index map, so they can only ever name neuron slots.
export function buildSynapseEndpointIndexPairs(graph: ForceSimGraph, nodeIndex: ForceSimNodeIndex): Uint32Array {
  const pairs = new Uint32Array(graph.synapses.length * 2)
  for (let i = 0; i < graph.synapses.length; i++) {
    const synapse = graph.synapses[i]
    pairs[i * 2] = nodeIndex.neurons[synapse.sourceNeuronId] ?? 0
    pairs[i * 2 + 1] = nodeIndex.neurons[synapse.targetNeuronId] ?? 0
  }
  return pairs
}
