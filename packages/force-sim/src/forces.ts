import {
  forceSimCoordinateOffset,
  type ForceSimGraph,
  type ForceSimNodeIndex,
  type ForceSimValues,
} from './graph.ts'
import { applyBarnesHutRepulsion } from './barnes-hut.ts'
import { hippocampusMidZ } from './seed.ts'

export interface ForceSimSynapseLink {
  readonly sourceIndex: number
  readonly targetIndex: number
  readonly strength: number
}

export interface ForceSimForceModel {
  readonly neuronNodeIndices: readonly number[]
  readonly connectivityByNodeIndex: Float64Array
  readonly synapseLinks: readonly ForceSimSynapseLink[]
}

export function createForceModel(graph: ForceSimGraph, nodeIndex: ForceSimNodeIndex): ForceSimForceModel {
  const connectivityByNodeIndex = new Float64Array(nodeIndex.entries.length)
  const neuronNodeIndices: number[] = []

  for (const neuron of graph.neurons) {
    const index = nodeIndex.neurons[neuron.id]
    if (index === undefined) continue
    neuronNodeIndices.push(index)
    connectivityByNodeIndex[index] = Math.max(0, neuron.connectivity)
  }

  const synapseLinks = graph.synapses.flatMap((synapse): ForceSimSynapseLink[] => {
    const sourceIndex = nodeIndex.neurons[synapse.sourceNeuronId]
    const targetIndex = nodeIndex.neurons[synapse.targetNeuronId]
    if (sourceIndex === undefined || targetIndex === undefined || sourceIndex === targetIndex) return []
    return [
      {
        sourceIndex,
        targetIndex,
        strength: clamp01(synapse.strength),
      },
    ]
  })

  return {
    neuronNodeIndices,
    connectivityByNodeIndex,
    synapseLinks,
  }
}

export function applyForceSimForces(
  model: ForceSimForceModel,
  values: ForceSimValues,
  positions: Float64Array,
  forces: Float64Array,
): void {
  forces.fill(0)
  applyCenterForces(model, values, positions, forces)
  applySynapseSprings(model, values, positions, forces)
  applyBarnesHutRepulsion(positions, model.neuronNodeIndices, forces, values.repulsion)
}

function applyCenterForces(
  model: ForceSimForceModel,
  values: ForceSimValues,
  positions: Float64Array,
  forces: Float64Array,
): void {
  const centerZ = hippocampusMidZ(values)

  for (const nodeIndex of model.neuronNodeIndices) {
    const offset = forceSimCoordinateOffset(nodeIndex)
    const connectivity = model.connectivityByNodeIndex[nodeIndex]
    const gain = values.centerStrength * (1 + connectivity / (1 + connectivity))

    forces[offset] += -positions[offset] * gain
    forces[offset + 1] += -positions[offset + 1] * gain
    forces[offset + 2] += (centerZ - positions[offset + 2]) * gain
  }
}

function applySynapseSprings(
  model: ForceSimForceModel,
  values: ForceSimValues,
  positions: Float64Array,
  forces: Float64Array,
): void {
  for (const link of model.synapseLinks) {
    const sourceOffset = forceSimCoordinateOffset(link.sourceIndex)
    const targetOffset = forceSimCoordinateOffset(link.targetIndex)
    const dx = positions[targetOffset] - positions[sourceOffset]
    const dy = positions[targetOffset + 1] - positions[sourceOffset + 1]
    const dz = positions[targetOffset + 2] - positions[sourceOffset + 2]
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
    const sourceConnectivity = model.connectivityByNodeIndex[link.sourceIndex]
    const targetConnectivity = model.connectivityByNodeIndex[link.targetIndex]
    const restDistance = values.linkDistance / Math.sqrt(1 + (sourceConnectivity + targetConnectivity) * 0.05)
    const magnitude = (distance - restDistance) * values.charge * link.strength
    const fx = (dx / distance) * magnitude
    const fy = (dy / distance) * magnitude
    const fz = (dz / distance) * magnitude

    forces[sourceOffset] += fx
    forces[sourceOffset + 1] += fy
    forces[sourceOffset + 2] += fz
    forces[targetOffset] -= fx
    forces[targetOffset + 1] -= fy
    forces[targetOffset + 2] -= fz
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
