import {
  FORCE_SIM_COORDINATE_STRIDE,
  forceSimCoordinateOffset,
  type ForceSimCoordinate,
  type ForceSimGraph,
  type ForceSimNodeIndex,
  type ForceSimNodeId,
  type ForceSimValues,
} from './graph.ts'
import { createSeededRng, deriveForceSimSeed, type SeededRng } from './rng.ts'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function clampToHippocampusZ(z: number, values: ForceSimValues): number {
  return clamp(z, values.hippocampusZMin, values.hippocampusZMax)
}

export function hippocampusMidZ(values: ForceSimValues): number {
  return (values.hippocampusZMin + values.hippocampusZMax) / 2
}

export function seedInitialPositions(
  graph: ForceSimGraph,
  nodeIndex: ForceSimNodeIndex,
  values: ForceSimValues,
): Float64Array {
  const positions = new Float64Array(nodeIndex.entries.length * FORCE_SIM_COORDINATE_STRIDE)
  const firstClusterByNeuron = firstClusterIdsByNeuron(graph)
  const clusterCenters = new Map<ForceSimNodeId, ForceSimCoordinate>()

  for (const episodicMemory of graph.episodicMemories) {
    clusterCenters.set(
      episodicMemory.id,
      seededClusterCenter(values, rngFor(values, `cluster:${episodicMemory.id}`)),
    )
  }

  for (const neuron of graph.neurons) {
    const index = nodeIndex.neurons[neuron.id]
    if (index === undefined) continue

    const position = neuron.previousPosition
      ? nearCoordinate(
          neuron.previousPosition,
          values.linkDistance * 0.03,
          rngFor(values, `previous:${neuron.id}`),
        )
      : neuron.seedHint
        ? nearCoordinate(
            neuron.seedHint,
            values.linkDistance * 0.001,
            rngFor(values, `hint:${neuron.id}`),
          )
        : seedForNewNeuron(neuron.id, firstClusterByNeuron, clusterCenters, values)

    writePosition(positions, index, position, values)
  }

  placeEpisodicMemoriesAtCentroids(graph, nodeIndex, values, positions)
  return positions
}

export function placeEpisodicMemoriesAtCentroids(
  graph: ForceSimGraph,
  nodeIndex: ForceSimNodeIndex,
  values: ForceSimValues,
  positions: Float64Array,
): void {
  const activationsByMemory = new Map<ForceSimNodeId, { neuronIndex: number; weight: number }[]>()

  for (const activation of graph.activations) {
    const episodicMemoryIndex = nodeIndex.episodicMemories[activation.episodicMemoryId]
    const neuronIndex = nodeIndex.neurons[activation.neuronId]
    if (episodicMemoryIndex === undefined || neuronIndex === undefined) continue

    const links = activationsByMemory.get(activation.episodicMemoryId) ?? []
    links.push({ neuronIndex, weight: Math.max(0, activation.weight) })
    activationsByMemory.set(activation.episodicMemoryId, links)
  }

  for (const episodicMemory of graph.episodicMemories) {
    const index = nodeIndex.episodicMemories[episodicMemory.id]
    if (index === undefined) continue

    const links = activationsByMemory.get(episodicMemory.id)
    if (!links?.length) {
      const fallback = episodicMemory.seedHint
        ? sanitizeCoordinate(episodicMemory.seedHint, values)
        : seededClusterCenter(values, rngFor(values, `fallback:${episodicMemory.id}`))
      writePosition(positions, index, fallback, values)
      continue
    }

    let totalWeight = 0
    let x = 0
    let y = 0
    let z = 0
    for (const link of links) {
      const weight = link.weight
      if (weight === 0) continue
      const offset = forceSimCoordinateOffset(link.neuronIndex)
      x += positions[offset] * weight
      y += positions[offset + 1] * weight
      z += positions[offset + 2] * weight
      totalWeight += weight
    }

    if (totalWeight === 0) {
      const fallback = episodicMemory.seedHint
        ? sanitizeCoordinate(episodicMemory.seedHint, values)
        : seededClusterCenter(values, rngFor(values, `fallback:${episodicMemory.id}`))
      writePosition(positions, index, fallback, values)
      continue
    }

    writePosition(
      positions,
      index,
      {
        x: x / totalWeight,
        y: y / totalWeight,
        z: z / totalWeight,
      },
      values,
    )
  }
}

function firstClusterIdsByNeuron(graph: ForceSimGraph): Map<ForceSimNodeId, ForceSimNodeId> {
  const clusters = new Map<ForceSimNodeId, ForceSimNodeId>()
  for (const activation of graph.activations) {
    if (!clusters.has(activation.neuronId)) {
      clusters.set(activation.neuronId, activation.episodicMemoryId)
    }
  }
  return clusters
}

function seedForNewNeuron(
  neuronId: ForceSimNodeId,
  firstClusterByNeuron: ReadonlyMap<ForceSimNodeId, ForceSimNodeId>,
  clusterCenters: ReadonlyMap<ForceSimNodeId, ForceSimCoordinate>,
  values: ForceSimValues,
): ForceSimCoordinate {
  const clusterId = firstClusterByNeuron.get(neuronId)
  const center = clusterId ? clusterCenters.get(clusterId) : undefined
  if (!center) return seededClusterCenter(values, rngFor(values, `free:${neuronId}`))

  return nearCoordinate(
    center,
    values.linkDistance * 0.12,
    rngFor(values, `cluster-neuron:${clusterId}:${neuronId}`),
  )
}

function seededClusterCenter(values: ForceSimValues, rng: SeededRng): ForceSimCoordinate {
  const radius = values.linkDistance * rng.between(1.4, 2.2)
  const vector = rng.vector(radius)
  return {
    x: vector.x,
    y: vector.y,
    z: hippocampusMidZ(values) + vector.z * 0.25,
  }
}

function nearCoordinate(
  coordinate: ForceSimCoordinate,
  radius: number,
  rng: SeededRng,
): ForceSimCoordinate {
  const vector = rng.vector(radius)
  return {
    x: coordinate.x + vector.x,
    y: coordinate.y + vector.y,
    z: coordinate.z + vector.z,
  }
}

function sanitizeCoordinate(
  coordinate: ForceSimCoordinate,
  values: ForceSimValues,
): ForceSimCoordinate {
  return {
    x: coordinate.x,
    y: coordinate.y,
    z: clampToHippocampusZ(coordinate.z, values),
  }
}

function writePosition(
  positions: Float64Array,
  index: number,
  coordinate: ForceSimCoordinate,
  values: ForceSimValues,
): void {
  const offset = forceSimCoordinateOffset(index)
  positions[offset] = finiteOrZero(coordinate.x)
  positions[offset + 1] = finiteOrZero(coordinate.y)
  positions[offset + 2] = clampToHippocampusZ(finiteOrZero(coordinate.z), values)
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function rngFor(values: ForceSimValues, label: string): SeededRng {
  return createSeededRng(deriveForceSimSeed(values.seed, label))
}
