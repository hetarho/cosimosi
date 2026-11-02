// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { EpisodicMemory, UniverseSnapshot } from '@cosimosi/memory'

import { useSceneAssembly } from './use-scene-assembly.ts'

const memory = (id: string, mood: string, neuronId: string): EpisodicMemory => ({
  id,
  name: id,
  diaryId: `${id}-diary`,
  emotion: { mood, valence: 0.5, arousal: 0.4, intensity: 0.6 } as EpisodicMemory['emotion'],
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-07-01',
  lastRecalledUniverseTime: null,
  seed: null,
  activations: [{ neuronId, weight: 0.7 }],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: id,
  semanticStage: 0,
})

// A fresh object every call: identical inputs, never the same references.
const universe = (): UniverseSnapshot => ({
  memories: [memory('memory-a', 'JOY', 'neuron-1'), memory('memory-b', 'CALM', 'neuron-2')],
  neurons: [
    { id: 'neuron-1', name: 'sea', neuronType: 'semantic', connectivity: 1 },
    { id: 'neuron-2', name: 'harbor', neuronType: 'spatial', connectivity: 1 },
  ],
  synapses: [
    {
      id: 'synapse-1',
      neuronAId: 'neuron-1',
      neuronBId: 'neuron-2',
      strength: 0.4,
      coActivationCount: 2,
      lastActivatedUniverseTime: '2026-07-01',
    },
  ],
  universeTime: '2026-07-01',
})

function assemble(snapshot: UniverseSnapshot | null) {
  return renderHook(() =>
    useSceneAssembly({ universe: snapshot, simSpawner: null, latentStarCount: 12 }),
  ).result.current
}

describe('useSceneAssembly', () => {
  afterEach(cleanup)

  it('assembles identical inputs into identical node ids, edges and channels', () => {
    const first = assemble(universe())
    const second = assemble(universe())

    const ids = (scene: typeof first) => ({
      neurons: scene.graph?.neurons.map((node) => node.id),
      memories: scene.graph?.episodicMemories.map((node) => node.id),
      synapses: scene.graph?.synapses,
      activations: scene.graph?.activations,
    })
    expect(ids(second)).toEqual(ids(first))
    expect(first.graph?.neurons.map((node) => node.id)).toEqual(['neuron-1', 'neuron-2'])
    expect(second.nodeIndex).toEqual(first.nodeIndex)
    expect(second.neuronCount).toBe(2)
    expect(second.skyStops).toEqual(first.skyStops)
    expect(first.skyStops.length).toBeGreaterThan(0)
    expect(second.latentField).toEqual(first.latentField)
  })

  it('lays out nothing and leaves the sky bare until there is a universe', () => {
    const empty = assemble(null)

    expect(empty.graph).toBeNull()
    expect(empty.nodeIndex).toBeNull()
    expect(empty.neuronCount).toBe(0)
    expect(empty.skyStops).toEqual([])
  })
})
