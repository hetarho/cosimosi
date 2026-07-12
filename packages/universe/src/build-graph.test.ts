import { describe, expect, it } from 'vitest'

import { createForceSimNodeIndex } from '@cosimosi/force-sim'
import type { UniverseSnapshot } from '@cosimosi/memory'

import { buildSynapseEndpointIndexPairs, buildUniverseGraph } from './build-graph.ts'

const emotion = { mood: 'JOY', valence: 0.82, arousal: 0.72, intensity: 0.7 } as const

const universeFixture = (): UniverseSnapshot => ({
  memories: [
    {
      id: 'memory-1',
      name: 'first swim in the cold sea',
      emotion,
      baseStrength: 0.61,
      recallCount: 2,
      createdUniverseTime: '2026-06-28',
      lastRecalledUniverseTime: null,
      seed: null,
      activations: [
        { neuronId: 'neuron-1', weight: 1 },
        { neuronId: 'neuron-ghost', weight: 1 },
      ],
      decayStages: [],
      forgettingOffsetDays: 0,
    },
  ],
  neurons: [
    { id: 'neuron-1', name: 'sea', neuronType: 'semantic', connectivity: 3 },
    { id: 'neuron-2', name: null, neuronType: 'spatial', connectivity: 1 },
  ],
  synapses: [
    {
      id: 'synapse-1',
      neuronAId: 'neuron-1',
      neuronBId: 'neuron-2',
      strength: 0.32,
      coActivationCount: 1,
      lastActivatedUniverseTime: '2026-06-28',
    },
    {
      // References an id the snapshot has no neuron for (e.g. a memory id) — must be
      // structurally impossible to project as an edge.
      id: 'synapse-bad',
      neuronAId: 'memory-1',
      neuronBId: 'neuron-2',
      strength: 0.2,
      coActivationCount: 1,
      lastActivatedUniverseTime: '2026-06-28',
    },
  ],
  universeTime: '2026-07-01',
})

describe('buildUniverseGraph', () => {
  it('projects neurons, synapses, memories, and activation membership onto the sim contract', () => {
    const graph = buildUniverseGraph(universeFixture())

    expect(graph.neurons).toEqual([
      { id: 'neuron-1', connectivity: 3 },
      { id: 'neuron-2', connectivity: 1 },
    ])
    expect(graph.synapses).toEqual([
      { sourceNeuronId: 'neuron-1', targetNeuronId: 'neuron-2', strength: 0.32 },
    ])
    expect(graph.episodicMemories).toEqual([{ id: 'memory-1' }])
    expect(graph.activations).toEqual([
      { episodicMemoryId: 'memory-1', neuronId: 'neuron-1', weight: 1 },
    ])
  })

  it('can structurally never produce a memory↔memory edge [I4][I6]', () => {
    const graph = buildUniverseGraph(universeFixture())
    const neuronIds = new Set(graph.neurons.map((neuron) => neuron.id))
    const memoryIds = new Set(graph.episodicMemories.map((memory) => memory.id))

    for (const synapse of graph.synapses) {
      expect(neuronIds.has(synapse.sourceNeuronId)).toBe(true)
      expect(neuronIds.has(synapse.targetNeuronId)).toBe(true)
      expect(memoryIds.has(synapse.sourceNeuronId)).toBe(false)
      expect(memoryIds.has(synapse.targetNeuronId)).toBe(false)
    }
    // Memories reach the graph only as anchored bodies + membership, never as edges.
    expect(
      graph.activations.every((activation) => memoryIds.has(activation.episodicMemoryId)),
    ).toBe(true)
  })

  it('feeds layout from connectivity only — no emotion term reaches the sim [I3]', () => {
    const graph = buildUniverseGraph(universeFixture())

    const layoutInputs = [
      ...graph.neurons,
      ...graph.synapses,
      ...graph.episodicMemories,
      ...graph.activations,
    ]
    for (const input of layoutInputs) {
      for (const key of Object.keys(input)) {
        expect(key).not.toMatch(/mood|valence|arousal|intensity|color|emotion/i)
      }
    }
  })

  it('carries no coordinates — positions stay emergent [I5]', () => {
    const graph = buildUniverseGraph(universeFixture())

    const bodies = [...graph.neurons, ...graph.episodicMemories]
    for (const body of bodies) {
      for (const key of Object.keys(body)) {
        expect(key).not.toMatch(/^(x|y|z|position|coordinates?)$/i)
      }
    }
  })

  it('clamps out-of-range magnitudes into the sim domain instead of letting the sim reject the graph', () => {
    const universe = universeFixture()
    const skewed: UniverseSnapshot = {
      ...universe,
      neurons: [{ ...universe.neurons[0], connectivity: -2 }, universe.neurons[1]],
      synapses: [{ ...universe.synapses[0], strength: 1.4 }],
      memories: [
        {
          ...universe.memories[0],
          activations: [{ neuronId: 'neuron-1', weight: -0.5 }],
        },
      ],
    }

    const graph = buildUniverseGraph(skewed)

    expect(graph.neurons[0].connectivity).toBe(0)
    expect(graph.synapses[0].strength).toBe(1)
    expect(graph.activations[0].weight).toBe(0)
  })

  it('coerces non-finite magnitudes to 0 so the sim never rejects the graph', () => {
    const universe = universeFixture()
    const corrupt: UniverseSnapshot = {
      ...universe,
      neurons: [{ ...universe.neurons[0], connectivity: Number.NaN }, universe.neurons[1]],
      synapses: [{ ...universe.synapses[0], strength: Number.POSITIVE_INFINITY }],
      memories: [
        {
          ...universe.memories[0],
          activations: [{ neuronId: 'neuron-1', weight: Number.NaN }],
        },
      ],
    }

    const graph = buildUniverseGraph(corrupt)

    // Every projected magnitude is finite — a non-finite input (NaN or ±Infinity) becomes 0.
    expect(Number.isFinite(graph.neurons[0].connectivity)).toBe(true)
    expect(graph.neurons[0].connectivity).toBe(0)
    expect(Number.isFinite(graph.synapses[0].strength)).toBe(true)
    expect(graph.synapses[0].strength).toBe(0)
    expect(graph.activations[0].weight).toBe(0)
  })

  it('maps edge endpoint pairs onto neuron slots of the coordinate buffer only', () => {
    const graph = buildUniverseGraph(universeFixture())
    const nodeIndex = createForceSimNodeIndex(graph)

    const pairs = buildSynapseEndpointIndexPairs(graph, nodeIndex)

    expect(pairs).toHaveLength(graph.synapses.length * 2)
    for (const index of pairs) {
      // Neuron nodes occupy the first slots of the buffer (neurons first, memories after).
      expect(index).toBeLessThan(graph.neurons.length)
      expect(nodeIndex.entries[index].kind).toBe('neuron')
    }
  })
})
