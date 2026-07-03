import { create } from '@bufbuild/protobuf'
import { describe, expect, it } from 'vitest'

import {
  EpisodicMemoryDtoSchema,
  GetUniverseResponseSchema,
  NeuronDtoSchema,
  SynapseDtoSchema,
} from '@cosimosi/api-client/gen/cosimosi/memory/v1/memory_pb.ts'

import { episodicMemoryFromDto, neuronFromDto, synapseFromDto, universeFromResponse } from './mappers.ts'

const memoryDtoFixture = (overrides: Record<string, unknown> = {}) =>
  create(EpisodicMemoryDtoSchema, {
    id: 'memory-1',
    name: 'first swim in the cold sea',
    emotion: { mood: 'JOY', valence: 0.82, arousal: 0.72, intensity: 0.7 },
    baseStrength: 0.61,
    recallCount: 2,
    createdUniverseTime: '2026-06-28',
    activations: [
      { neuronId: 'neuron-1', weight: 1 },
      { neuronId: 'neuron-2', weight: 0.5 },
    ],
    ...overrides,
  })

describe('GetUniverse proto→domain mappers', () => {
  it('maps the stored episodic-memory facts verbatim', () => {
    const memory = episodicMemoryFromDto(
      memoryDtoFixture({ lastRecalledUniverseTime: '2026-07-01', seed: 42n }),
    )

    expect(memory).toEqual({
      id: 'memory-1',
      name: 'first swim in the cold sea',
      emotion: { mood: 'JOY', valence: 0.82, arousal: 0.72, intensity: 0.7 },
      baseStrength: 0.61,
      recallCount: 2,
      createdUniverseTime: '2026-06-28',
      lastRecalledUniverseTime: '2026-07-01',
      seed: 42n,
      activations: [
        { neuronId: 'neuron-1', weight: 1 },
        { neuronId: 'neuron-2', weight: 0.5 },
      ],
    })
  })

  it('defaults absent optional facts to null', () => {
    const memory = episodicMemoryFromDto(memoryDtoFixture())

    expect(memory.lastRecalledUniverseTime).toBeNull()
    expect(memory.seed).toBeNull()
  })

  it('rejects an episodic memory without an emotion or with an unknown mood', () => {
    const noEmotion = create(EpisodicMemoryDtoSchema, { id: 'memory-x', name: 'x' })
    expect(() => episodicMemoryFromDto(noEmotion)).toThrow(/without an emotion/)
    expect(() =>
      episodicMemoryFromDto(memoryDtoFixture({ emotion: { mood: 'BLISSFUL', valence: 0, arousal: 0, intensity: 0 } })),
    ).toThrow(/unknown mood/)
  })

  it('maps neurons, keeping the layout radius input (connectivity) and nullable name', () => {
    const named = neuronFromDto(
      create(NeuronDtoSchema, { id: 'neuron-1', name: 'sea', neuronType: 'semantic', connectivity: 3 }),
    )
    const unnamed = neuronFromDto(create(NeuronDtoSchema, { id: 'neuron-2', neuronType: 'spatial', connectivity: 1 }))

    expect(named).toEqual({ id: 'neuron-1', name: 'sea', neuronType: 'semantic', connectivity: 3 })
    expect(unnamed.name).toBeNull()
    expect(() =>
      neuronFromDto(create(NeuronDtoSchema, { id: 'neuron-3', neuronType: 'cosmic', connectivity: 0 })),
    ).toThrow(/unknown neuron type/)
  })

  it('maps synapses and rejects a non-canonical neuron pair', () => {
    const synapse = synapseFromDto(
      create(SynapseDtoSchema, {
        id: 'synapse-1',
        neuronAId: 'neuron-1',
        neuronBId: 'neuron-2',
        strength: 0.32,
        coActivationCount: 1,
        lastActivatedUniverseTime: '2026-06-28',
      }),
    )

    expect(synapse.neuronAId).toBe('neuron-1')
    expect(synapse.strength).toBeCloseTo(0.32)
    expect(() =>
      synapseFromDto(create(SynapseDtoSchema, { id: 'synapse-2', neuronAId: 'neuron-2', neuronBId: 'neuron-1' })),
    ).toThrow(/not canonical/)
    expect(() =>
      synapseFromDto(create(SynapseDtoSchema, { id: 'synapse-3', neuronAId: 'neuron-1', neuronBId: 'neuron-1' })),
    ).toThrow(/not canonical/)
  })

  it('maps the whole universe response, with empty universe_time as null', () => {
    const universe = universeFromResponse(
      create(GetUniverseResponseSchema, {
        memories: [memoryDtoFixture()],
        neurons: [{ id: 'neuron-1', neuronType: 'semantic', connectivity: 1 }],
        synapses: [],
        universeTime: '',
      }),
    )

    expect(universe.memories).toHaveLength(1)
    expect(universe.neurons[0].neuronType).toBe('semantic')
    expect(universe.universeTime).toBeNull()

    const dated = universeFromResponse(create(GetUniverseResponseSchema, { universeTime: '2026-07-01' }))
    expect(dated.universeTime).toBe('2026-07-01')
  })

  it('never carries positions or read-time-derived values onto the domain mirror [I5]', () => {
    const memory = episodicMemoryFromDto(memoryDtoFixture())

    for (const key of Object.keys(memory)) {
      expect(key).not.toMatch(/^(x|y|z|position|coordinates?|effective\w*|brightness)$/i)
    }
  })
})
