export const FORCE_SIM_COORDINATE_STRIDE = 3

export type ForceSimNodeId = string

export interface ForceSimCoordinate {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ForceSimNeuron {
  readonly id: ForceSimNodeId
  readonly connectivity: number
  readonly previousPosition?: ForceSimCoordinate
  readonly seedHint?: ForceSimCoordinate
}

export interface ForceSimSynapse {
  readonly sourceNeuronId: ForceSimNodeId
  readonly targetNeuronId: ForceSimNodeId
  readonly strength: number
}

export interface ForceSimEpisodicMemory {
  readonly id: ForceSimNodeId
  readonly seedHint?: ForceSimCoordinate
}

export interface ForceSimActivation {
  readonly episodicMemoryId: ForceSimNodeId
  readonly neuronId: ForceSimNodeId
  readonly weight: number
}

export interface ForceSimGraph {
  readonly neurons: readonly ForceSimNeuron[]
  readonly synapses: readonly ForceSimSynapse[]
  readonly episodicMemories: readonly ForceSimEpisodicMemory[]
  readonly activations: readonly ForceSimActivation[]
}

export interface ForceSimValues {
  readonly charge: number
  readonly linkDistance: number
  readonly centerStrength: number
  readonly repulsion: number
  readonly tickAlphaDecay: number
  readonly velocityDamping: number
  readonly minAlpha: number
  readonly hippocampusZMin: number
  readonly hippocampusZMax: number
  readonly neocortexZMin: number
  readonly neocortexZMax: number
  readonly seed: number
}

export type ForceSimNodeKind = 'neuron' | 'episodicMemory'

export interface ForceSimNodeIndexEntry {
  readonly kind: ForceSimNodeKind
  readonly id: ForceSimNodeId
  readonly index: number
  readonly offset: number
}

export interface ForceSimNodeIndex {
  readonly stride: typeof FORCE_SIM_COORDINATE_STRIDE
  readonly entries: readonly ForceSimNodeIndexEntry[]
  readonly byKey: Readonly<Record<string, number>>
  readonly neurons: Readonly<Record<ForceSimNodeId, number>>
  readonly episodicMemories: Readonly<Record<ForceSimNodeId, number>>
}

export type ForceSimCoordinateBuffer = Float32Array

export function forceSimNodeKey(kind: ForceSimNodeKind, id: ForceSimNodeId): string {
  return `${kind}:${id}`
}

export function forceSimCoordinateOffset(index: number): number {
  return index * FORCE_SIM_COORDINATE_STRIDE
}

export function createForceSimNodeIndex(graph: ForceSimGraph): ForceSimNodeIndex {
  const entries: ForceSimNodeIndexEntry[] = []
  const byKey: Record<string, number> = {}
  const neurons: Record<ForceSimNodeId, number> = {}
  const episodicMemories: Record<ForceSimNodeId, number> = {}

  const add = (kind: ForceSimNodeKind, id: ForceSimNodeId, target: Record<string, number>) => {
    const index = entries.length
    target[id] = index
    byKey[forceSimNodeKey(kind, id)] = index
    entries.push({
      kind,
      id,
      index,
      offset: forceSimCoordinateOffset(index),
    })
  }

  for (const neuron of graph.neurons) add('neuron', neuron.id, neurons)
  for (const episodicMemory of graph.episodicMemories) {
    add('episodicMemory', episodicMemory.id, episodicMemories)
  }

  return {
    stride: FORCE_SIM_COORDINATE_STRIDE,
    entries,
    byKey,
    neurons,
    episodicMemories,
  }
}

export function readForceSimCoordinate(buffer: ArrayLike<number>, index: number): ForceSimCoordinate {
  const offset = forceSimCoordinateOffset(index)
  return {
    x: buffer[offset] ?? 0,
    y: buffer[offset + 1] ?? 0,
    z: buffer[offset + 2] ?? 0,
  }
}
