import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FORCE_SIM_VALUES,
  createForceSimulation,
  readForceSimCoordinate,
  type ForceSimGraph,
  type ForceSimValues,
} from './index.ts'

const testValues: ForceSimValues = {
  ...DEFAULT_FORCE_SIM_VALUES,
  seed: 12345,
}

describe('force-sim layout rules', () => {
  it('settles highly connected neurons nearer the self center', () => {
    const graph: ForceSimGraph = {
      neurons: [
        { id: 'central', connectivity: 10, seedHint: { x: 40, y: 0, z: 5 } },
        { id: 'outer', connectivity: 0.1, seedHint: { x: -40, y: 0, z: 5 } },
      ],
      synapses: [],
      episodicMemories: [],
      activations: [],
    }

    const simulation = createForceSimulation(graph, { values: testValues })
    tick(simulation, 180)

    expect(radius(simulation.getPosition('neuron', 'central'))).toBeLessThan(
      radius(simulation.getPosition('neuron', 'outer')),
    )
  })

  it('places episodic memories at activation-weighted neuron centroids', () => {
    const graph: ForceSimGraph = {
      neurons: [
        { id: 'left', connectivity: 1, seedHint: { x: -12, y: 0, z: 4 } },
        { id: 'right', connectivity: 1, seedHint: { x: 12, y: 0, z: 6 } },
      ],
      synapses: [],
      episodicMemories: [{ id: 'left-heavy' }, { id: 'right-heavy' }],
      activations: [
        { episodicMemoryId: 'left-heavy', neuronId: 'left', weight: 5 },
        { episodicMemoryId: 'left-heavy', neuronId: 'right', weight: 1 },
        { episodicMemoryId: 'right-heavy', neuronId: 'left', weight: 1 },
        { episodicMemoryId: 'right-heavy', neuronId: 'right', weight: 5 },
      ],
    }

    const simulation = createForceSimulation(graph, { values: testValues })
    simulation.tick(1 / 60)

    const left = simulation.getPosition('neuron', 'left')
    const right = simulation.getPosition('neuron', 'right')
    const leftHeavy = simulation.getPosition('episodicMemory', 'left-heavy')
    const rightHeavy = simulation.getPosition('episodicMemory', 'right-heavy')

    expectCoordinateClose(leftHeavy, weightedCentroid(left, right, 5, 1))
    expectCoordinateClose(rightHeavy, weightedCentroid(left, right, 1, 5))
    expect(leftHeavy?.x).toBeLessThan(rightHeavy?.x ?? Number.NEGATIVE_INFINITY)
  })

  it('does not let disconnected episodic memories pull each other', () => {
    const baseGraph: ForceSimGraph = {
      neurons: [{ id: 'n1', connectivity: 1, seedHint: { x: 8, y: 0, z: 5 } }],
      synapses: [],
      episodicMemories: [{ id: 'm1' }],
      activations: [{ episodicMemoryId: 'm1', neuronId: 'n1', weight: 1 }],
    }
    const extraGraph: ForceSimGraph = {
      ...baseGraph,
      episodicMemories: [
        ...baseGraph.episodicMemories,
        { id: 'm2', seedHint: { x: 100, y: 0, z: 5 } },
      ],
    }

    const base = createForceSimulation(baseGraph, { values: testValues })
    const extra = createForceSimulation(extraGraph, { values: testValues })
    tick(base, 60)
    tick(extra, 60)

    expect(extra.getPosition('episodicMemory', 'm1')).toEqual(
      base.getPosition('episodicMemory', 'm1'),
    )
  })

  it('uses clustered and stable seed placement before forces settle', () => {
    const graph: ForceSimGraph = {
      neurons: [
        { id: 'new-a', connectivity: 1 },
        { id: 'new-b', connectivity: 1 },
        { id: 'reused', connectivity: 1, previousPosition: { x: 30, y: -10, z: 6 } },
      ],
      synapses: [],
      episodicMemories: [{ id: 'launch' }],
      activations: [
        { episodicMemoryId: 'launch', neuronId: 'new-a', weight: 1 },
        { episodicMemoryId: 'launch', neuronId: 'new-b', weight: 1 },
      ],
    }

    const simulation = createForceSimulation(graph, { values: testValues })
    const newA = simulation.getPosition('neuron', 'new-a')
    const newB = simulation.getPosition('neuron', 'new-b')
    const reused = simulation.getPosition('neuron', 'reused')

    expect(distance(newA, newB)).toBeLessThan(testValues.linkDistance * 0.35)
    expect(distance(reused, { x: 30, y: -10, z: 6 })).toBeLessThan(testValues.linkDistance * 0.08)
  })

  it('keeps distinct neurons separated and every coordinate inside the hippocampus band', () => {
    const graph: ForceSimGraph = {
      neurons: [
        { id: 'a', connectivity: 0.1, seedHint: { x: 0, y: 0, z: 5 } },
        { id: 'b', connectivity: 0.1, seedHint: { x: 0.2, y: 0, z: 5 } },
      ],
      synapses: [],
      episodicMemories: [],
      activations: [],
    }

    const simulation = createForceSimulation(graph, { values: testValues })
    tick(simulation, 90)

    expect(
      distance(simulation.getPosition('neuron', 'a'), simulation.getPosition('neuron', 'b')),
    ).toBeGreaterThan(1)
    for (const entry of simulation.nodeIndex.entries) {
      const coordinate = readForceSimCoordinate(simulation.coordinates, entry.index)
      expect(coordinate.z).toBeGreaterThanOrEqual(testValues.hippocampusZMin)
      expect(coordinate.z).toBeLessThanOrEqual(testValues.hippocampusZMax)
      expect(coordinate.z).toBeLessThan(testValues.neocortexZMin)
    }
  })

  it('separates neurons that receive the same seed hint', () => {
    const graph: ForceSimGraph = {
      neurons: [
        { id: 'a', connectivity: 0.1, seedHint: { x: 0, y: 0, z: 5 } },
        { id: 'b', connectivity: 0.1, seedHint: { x: 0, y: 0, z: 5 } },
      ],
      synapses: [],
      episodicMemories: [],
      activations: [],
    }

    const simulation = createForceSimulation(graph, { values: testValues })
    tick(simulation, 90)

    expect(
      distance(simulation.getPosition('neuron', 'a'), simulation.getPosition('neuron', 'b')),
    ).toBeGreaterThan(1)
  })

  it('rejects emotion and time fields at the runtime boundary', () => {
    const graph = {
      neurons: [{ id: 'n1', connectivity: 1, mood: 'joy' }],
      synapses: [],
      episodicMemories: [],
      activations: [],
    } as unknown as ForceSimGraph

    expect(() => createForceSimulation(graph, { values: testValues })).toThrow(
      /cannot include mood/,
    )
  })

  it('handles an empty universe without NaN or throwing (a brand-new account)', () => {
    const empty: ForceSimGraph = {
      neurons: [],
      synapses: [],
      episodicMemories: [],
      activations: [],
    }
    const simulation = createForceSimulation(empty, { values: testValues })
    expect(() => tick(simulation, 60)).not.toThrow()
    expect(simulation.coordinates.length).toBe(0)
    expect([...simulation.coordinates].every(Number.isFinite)).toBe(true)
  })

  it('handles a single unconnected neuron with a memory without divide-by-zero', () => {
    const graph: ForceSimGraph = {
      neurons: [{ id: 'lonely', connectivity: 0, seedHint: { x: 3, y: 0, z: 4 } }],
      synapses: [],
      episodicMemories: [{ id: 'first' }],
      activations: [{ episodicMemoryId: 'first', neuronId: 'lonely', weight: 1 }],
    }
    const simulation = createForceSimulation(graph, { values: testValues })
    expect(() => tick(simulation, 60)).not.toThrow()
    const neuron = simulation.getPosition('neuron', 'lonely')
    const memory = simulation.getPosition('episodicMemory', 'first')
    expect(
      neuron && Number.isFinite(neuron.x) && Number.isFinite(neuron.y) && Number.isFinite(neuron.z),
    ).toBe(true)
    // The lone memory settles onto its only neuron's centroid — no /0 from an empty weight sum.
    expect(
      memory && Number.isFinite(memory.x) && Number.isFinite(memory.y) && Number.isFinite(memory.z),
    ).toBe(true)
  })
})

function tick(simulation: ReturnType<typeof createForceSimulation>, count: number): void {
  for (let index = 0; index < count; index += 1) simulation.tick(1 / 60)
}

function radius(coordinate: { x: number; y: number } | undefined): number {
  if (!coordinate) return Number.POSITIVE_INFINITY
  return Math.hypot(coordinate.x, coordinate.y)
}

function distance(
  first: { x: number; y: number; z: number } | undefined,
  second: { x: number; y: number; z: number } | undefined,
): number {
  if (!first || !second) return Number.POSITIVE_INFINITY
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z)
}

function weightedCentroid(
  first: { x: number; y: number; z: number } | undefined,
  second: { x: number; y: number; z: number } | undefined,
  firstWeight: number,
  secondWeight: number,
) {
  if (!first || !second) return undefined
  const total = firstWeight + secondWeight
  return {
    x: (first.x * firstWeight + second.x * secondWeight) / total,
    y: (first.y * firstWeight + second.y * secondWeight) / total,
    z: (first.z * firstWeight + second.z * secondWeight) / total,
  }
}

function expectCoordinateClose(
  actual: { x: number; y: number; z: number } | undefined,
  expected: { x: number; y: number; z: number } | undefined,
): void {
  expect(actual).toBeDefined()
  expect(expected).toBeDefined()
  expect(actual?.x).toBeCloseTo(expected?.x ?? 0, 6)
  expect(actual?.y).toBeCloseTo(expected?.y ?? 0, 6)
  expect(actual?.z).toBeCloseTo(expected?.z ?? 0, 6)
}
