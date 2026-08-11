import { beforeEach, describe, expect, it } from 'vitest'

import type { EpisodicMemory } from '@cosimosi/memory'

import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { useNeuronStore } from './neuron-store.ts'
import { useSynapseStore } from './synapse-store.ts'

const memory = (id: string, overrides: Partial<EpisodicMemory> = {}): EpisodicMemory => ({
  id,
  diaryId: 'd',
  name: `star ${id}`,
  emotion: { mood: 'JOY', valence: 0.5, arousal: 0.4, intensity: 0.6 },
  baseStrength: 0.5,
  recallCount: 1,
  createdUniverseTime: '2026-07-01',
  lastRecalledUniverseTime: null,
  seed: 7n,
  activations: [{ neuronId: 'n1', weight: 1 }],
  decayStages: ['a', 'b'],
  forgettingOffsetDays: 0,
  currentText: 'the whole text',
  semanticStage: 0,
  ...overrides,
})

describe('entity stores — content-equality bail (R003)', () => {
  beforeEach(() => {
    useEpisodicMemoryStore.getState().clear()
    useNeuronStore.getState().clear()
    useSynapseStore.getState().clear()
  })

  it('keeps byId/ids references when a refetch brings identical memories back', () => {
    const store = useEpisodicMemoryStore
    store.getState().setAll([memory('a'), memory('b')])
    const { byId, ids } = store.getState()

    // A fresh mapping of the same facts — every record is a new object, as it is after a real fetch.
    store.getState().setAll([memory('a'), memory('b')])

    expect(store.getState().byId).toBe(byId)
    expect(store.getState().ids).toBe(ids)
  })

  it('replaces them when one nested field moves', () => {
    const store = useEpisodicMemoryStore
    store.getState().setAll([memory('a')])
    const { byId } = store.getState()

    // A recall bumps the count; the shallowest possible field change must still propagate.
    store.getState().setAll([memory('a', { recallCount: 2 })])
    expect(store.getState().byId).not.toBe(byId)

    // So must a change buried in a nested array.
    const nested = store.getState().byId
    store.getState().setAll([
      memory('a', {
        recallCount: 2,
        activations: [{ neuronId: 'n1', weight: 0.25 }],
      }),
    ])
    expect(store.getState().byId).not.toBe(nested)
  })

  it('replaces them on a reorder of the same rows', () => {
    const store = useEpisodicMemoryStore
    store.getState().setAll([memory('a'), memory('b')])
    const { ids } = store.getState()

    store.getState().setAll([memory('b'), memory('a')])

    // Slot order is what the coordinate buffer and every instance channel are laid out by.
    expect(store.getState().ids).not.toBe(ids)
    expect(store.getState().ids).toEqual(['b', 'a'])
  })

  it('replaces them when the collection shrinks or grows', () => {
    const store = useEpisodicMemoryStore
    store.getState().setAll([memory('a'), memory('b')])
    const { ids } = store.getState()

    store.getState().setAll([memory('a')])

    expect(store.getState().ids).not.toBe(ids)
    expect(store.getState().ids).toEqual(['a'])
  })

  it('bails the same way for neurons and synapses', () => {
    useNeuronStore
      .getState()
      .setAll([{ id: 'n1', name: 'sea', neuronType: 'semantic', connectivity: 3 }])
    const neuronIds = useNeuronStore.getState().ids
    useNeuronStore
      .getState()
      .setAll([{ id: 'n1', name: 'sea', neuronType: 'semantic', connectivity: 3 }])
    expect(useNeuronStore.getState().ids).toBe(neuronIds)

    useNeuronStore
      .getState()
      .setAll([{ id: 'n1', name: 'sea', neuronType: 'semantic', connectivity: 4 }])
    expect(useNeuronStore.getState().ids).not.toBe(neuronIds)

    const synapse = {
      id: 's1',
      neuronAId: 'n1',
      neuronBId: 'n2',
      strength: 0.4,
      coActivationCount: 2,
      lastActivatedUniverseTime: '2026-07-01',
    }
    useSynapseStore.getState().setAll([synapse])
    const synapseIds = useSynapseStore.getState().ids
    useSynapseStore.getState().setAll([{ ...synapse }])
    expect(useSynapseStore.getState().ids).toBe(synapseIds)

    useSynapseStore.getState().setAll([{ ...synapse, strength: 0.9 }])
    expect(useSynapseStore.getState().ids).not.toBe(synapseIds)
  })
})
