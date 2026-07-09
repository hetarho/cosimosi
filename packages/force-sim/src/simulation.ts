import { VALUES } from '@cosimosi/config'

import {
  FORCE_SIM_COORDINATE_STRIDE,
  createForceSimNodeIndex,
  forceSimCoordinateOffset,
  readForceSimCoordinate,
  type ForceSimCoordinate,
  type ForceSimCoordinateBuffer,
  type ForceSimGraph,
  type ForceSimNodeId,
  type ForceSimNodeIndex,
  type ForceSimValues,
} from './graph.ts'
import { applyForceSimForces, createForceModel, type ForceSimForceModel } from './forces.ts'
import {
  clampToHippocampusZ,
  placeEpisodicMemoriesAtCentroids,
  seedInitialPositions,
} from './seed.ts'

// Solver-internal integration constants (not layout tuning): the fixed-timestep reference
// rate and the clamp on how many sub-steps one slow frame may take.
const FRAME_RATE_NORMALIZER = 60
const MAX_FRAME_STEP = 4
const FORBIDDEN_INPUT_FIELDS = new Set([
  'mood',
  'valence',
  'arousal',
  'intensity',
  'color',
  'time',
  'timestamp',
  'date',
])

export const DEFAULT_FORCE_SIM_VALUES: ForceSimValues = VALUES.forceSim

export interface CreateForceSimulationOptions {
  readonly values?: ForceSimValues
}

export interface ForceSimulation {
  readonly nodeIndex: ForceSimNodeIndex
  readonly coordinates: ForceSimCoordinateBuffer
  tick(dt: number, output?: ForceSimCoordinateBuffer): ForceSimCoordinateBuffer
  getPosition(kind: 'neuron' | 'episodicMemory', id: ForceSimNodeId): ForceSimCoordinate | undefined
}

export function createForceSimulation(
  graph: ForceSimGraph,
  options: CreateForceSimulationOptions = {},
): ForceSimulation {
  const values = options.values ?? DEFAULT_FORCE_SIM_VALUES
  validateForceSimValues(values)
  validateGraph(graph)

  const nodeIndex = createForceSimNodeIndex(graph)
  const forceModel = createForceModel(graph, nodeIndex)
  const positions = seedInitialPositions(graph, nodeIndex, values)
  const velocities = new Float64Array(positions.length)
  const forces = new Float64Array(positions.length)
  const coordinates = new Float32Array(positions.length)
  let alpha = 1

  writeCoordinates(positions, coordinates)

  return {
    nodeIndex,
    coordinates,
    tick(dt, output) {
      const frameStep = normalizeFrameStep(dt)
      if (frameStep > 0) {
        applyForceSimForces(forceModel, values, positions, forces)
        integrateNeurons(forceModel, values, positions, velocities, forces, alpha, frameStep)
        placeEpisodicMemoriesAtCentroids(graph, nodeIndex, values, positions)
        alpha = Math.max(values.minAlpha, alpha * (1 - values.tickAlphaDecay))
        writeCoordinates(positions, coordinates)
      }
      if (output && output !== coordinates) {
        writeCoordinates(positions, output)
        return output
      }
      return coordinates
    },
    getPosition(kind, id) {
      const index = kind === 'neuron' ? nodeIndex.neurons[id] : nodeIndex.episodicMemories[id]
      return index === undefined ? undefined : readForceSimCoordinate(coordinates, index)
    },
  }
}

function integrateNeurons(
  model: ForceSimForceModel,
  values: ForceSimValues,
  positions: Float64Array,
  velocities: Float64Array,
  forces: Float64Array,
  alpha: number,
  frameStep: number,
): void {
  for (const nodeIndex of model.neuronNodeIndices) {
    const offset = forceSimCoordinateOffset(nodeIndex)

    velocities[offset] =
      (velocities[offset] + forces[offset] * alpha * frameStep) * values.velocityDamping
    velocities[offset + 1] =
      (velocities[offset + 1] + forces[offset + 1] * alpha * frameStep) * values.velocityDamping
    velocities[offset + 2] =
      (velocities[offset + 2] + forces[offset + 2] * alpha * frameStep) * values.velocityDamping

    positions[offset] += velocities[offset] * frameStep
    positions[offset + 1] += velocities[offset + 1] * frameStep
    positions[offset + 2] = clampToHippocampusZ(
      positions[offset + 2] + velocities[offset + 2] * frameStep,
      values,
    )
  }
}

function writeCoordinates(positions: Float64Array, coordinates: Float32Array): void {
  coordinates.set(positions)
}

function normalizeFrameStep(dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0
  return Math.min(MAX_FRAME_STEP, dt * FRAME_RATE_NORMALIZER)
}

function validateForceSimValues(values: ForceSimValues): void {
  const entries: Array<[keyof ForceSimValues, number]> = [
    ['charge', values.charge],
    ['linkDistance', values.linkDistance],
    ['centerStrength', values.centerStrength],
    ['repulsion', values.repulsion],
    ['tickAlphaDecay', values.tickAlphaDecay],
    ['hippocampusZMin', values.hippocampusZMin],
    ['hippocampusZMax', values.hippocampusZMax],
    ['neocortexZMin', values.neocortexZMin],
    ['neocortexZMax', values.neocortexZMax],
    ['seed', values.seed],
  ]

  for (const [key, value] of entries) {
    if (!Number.isFinite(value)) throw new Error(`force-sim value ${String(key)} must be finite`)
  }
  if (values.hippocampusZMin >= values.hippocampusZMax) {
    throw new Error('force-sim hippocampus z band must have ascending bounds')
  }
  if (values.neocortexZMin <= values.hippocampusZMax) {
    throw new Error('force-sim neocortex z band must sit above the hippocampus band')
  }
  if (values.tickAlphaDecay < 0 || values.tickAlphaDecay >= 1) {
    throw new Error('force-sim tickAlphaDecay must be in [0, 1)')
  }
}

function validateGraph(graph: ForceSimGraph): void {
  const neuronIds = new Set<string>()
  const episodicMemoryIds = new Set<string>()

  for (const neuron of graph.neurons) {
    rejectForbiddenFields('neuron', neuron)
    assertUniqueId('neuron', neuron.id, neuronIds)
    assertFinite('neuron.connectivity', neuron.connectivity)
    assertNonNegative('neuron.connectivity', neuron.connectivity)
  }

  for (const episodicMemory of graph.episodicMemories) {
    rejectForbiddenFields('episodicMemory', episodicMemory)
    assertUniqueId('episodicMemory', episodicMemory.id, episodicMemoryIds)
  }

  for (const synapse of graph.synapses) {
    rejectForbiddenFields('synapse', synapse)
    if (!neuronIds.has(synapse.sourceNeuronId)) {
      throw new Error(
        `force-sim synapse references unknown source neuron: ${synapse.sourceNeuronId}`,
      )
    }
    if (!neuronIds.has(synapse.targetNeuronId)) {
      throw new Error(
        `force-sim synapse references unknown target neuron: ${synapse.targetNeuronId}`,
      )
    }
    assertFinite('synapse.strength', synapse.strength)
    assertUnitInterval('synapse.strength', synapse.strength)
  }

  for (const activation of graph.activations) {
    rejectForbiddenFields('activation', activation)
    if (!episodicMemoryIds.has(activation.episodicMemoryId)) {
      throw new Error(
        `force-sim activation references unknown episodic memory: ${activation.episodicMemoryId}`,
      )
    }
    if (!neuronIds.has(activation.neuronId)) {
      throw new Error(`force-sim activation references unknown neuron: ${activation.neuronId}`)
    }
    assertFinite('activation.weight', activation.weight)
    assertNonNegative('activation.weight', activation.weight)
  }
}

function rejectForbiddenFields(kind: string, value: object): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_INPUT_FIELDS.has(key)) {
      throw new Error(`force-sim ${kind} input cannot include ${key}`)
    }
  }
}

function assertUniqueId(kind: string, id: string, seen: Set<string>): void {
  if (!id) throw new Error(`force-sim ${kind} id must not be empty`)
  if (seen.has(id)) throw new Error(`force-sim duplicate ${kind} id: ${id}`)
  seen.add(id)
}

function assertFinite(path: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`force-sim ${path} must be finite`)
}

function assertNonNegative(path: string, value: number): void {
  if (value < 0) throw new Error(`force-sim ${path} must be non-negative`)
}

function assertUnitInterval(path: string, value: number): void {
  if (value < 0 || value > 1) throw new Error(`force-sim ${path} must be within 0..1`)
}

export function createEmptyForceSimBuffer(nodeCount: number): ForceSimCoordinateBuffer {
  return new Float32Array(Math.trunc(Math.max(0, nodeCount)) * FORCE_SIM_COORDINATE_STRIDE)
}
