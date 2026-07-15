import { describe, expect, it } from 'vitest'

import {
  MemoryService,
  createGetDiariesInfiniteQueryOptions,
  createGetDiariesQueryKey,
  createGetDiariesQueryOptions,
  createGetUniverseQueryKey,
  createGetUniverseQueryOptions,
  createMemoryClient,
  createMemoryMockTransport,
  createMemoryServiceQueryKey,
} from './memory.ts'

const universeFixture = () => ({
  memories: [
    {
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
        { neuronId: 'neuron-2', weight: 1 },
      ],
    },
  ],
  neurons: [
    { id: 'neuron-1', name: 'sea', neuronType: 'semantic', connectivity: 3 },
    { id: 'neuron-2', neuronType: 'spatial', connectivity: 1 },
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
  ],
  universeTime: '2026-07-01',
})

describe('memory transport facade', () => {
  it('calls MemoryService.GetUniverse through an in-memory transport', async () => {
    const transport = createMemoryMockTransport(universeFixture)
    const client = createMemoryClient(transport)

    const response = await client.getUniverse({})

    expect(response.memories).toHaveLength(1)
    expect(response.memories[0].activations.map((a) => a.neuronId)).toEqual([
      'neuron-1',
      'neuron-2',
    ])
    expect(response.neurons[1].name).toBeUndefined()
    expect(response.synapses[0].neuronAId).toBe('neuron-1')
    expect(response.universeTime).toBe('2026-07-01')
  })

  it('marks GetUniverse NO_SIDE_EFFECTS so Connect clients may use HTTP GET', () => {
    // 1 = google.protobuf.MethodOptions.NO_SIDE_EFFECTS (same constant client-cache's
    // policy interceptor checks before allowing a GET registration).
    expect(MemoryService.method.getUniverse.idempotency).toBe(1)
  })

  it('creates TanStack Query options for GetUniverse without React or app globals', () => {
    const transport = createMemoryMockTransport(universeFixture)
    const options = createGetUniverseQueryOptions(transport)

    expect(options.queryKey[0]).toBe('connect-query')
    expect(typeof options.queryFn).toBe('function')
    expect(options.queryKey).toEqual(createGetUniverseQueryKey(transport))
    expect(createMemoryServiceQueryKey()[1].serviceName).toContain('MemoryService')
  })

  it('creates paginated Query options for GetDiaries mirroring the universe read', () => {
    const transport = createMemoryMockTransport(universeFixture)
    const options = createGetDiariesQueryOptions({ pageSize: 20, pageToken: '' }, transport)

    expect(options.queryKey[0]).toBe('connect-query')
    expect(typeof options.queryFn).toBe('function')
    expect(createGetDiariesQueryKey()[1].serviceName).toContain('MemoryService')
  })

  it('drives GetDiaries pagination off next_page_token (empty = last page)', () => {
    const transport = createMemoryMockTransport(universeFixture)
    const infinite = createGetDiariesInfiniteQueryOptions(transport, 20)

    expect(infinite.initialPageParam).toBe('')
    const more = {
      $typeName: 'cosimosi.memory.v1.GetDiariesResponse' as const,
      diaries: [],
      nextPageToken: 'cursor-2',
    }
    const last = {
      $typeName: 'cosimosi.memory.v1.GetDiariesResponse' as const,
      diaries: [],
      nextPageToken: '',
    }
    expect(infinite.getNextPageParam(more, [more], 'cursor-1', [''])).toBe('cursor-2')
    expect(infinite.getNextPageParam(last, [last], 'cursor-2', [''])).toBeUndefined()
  })

  it('carries stored facts only on the universe read (no position or coordinate field)', async () => {
    const transport = createMemoryMockTransport(universeFixture)
    const client = createMemoryClient(transport)

    const response = await client.getUniverse({})

    const wireShapes = [...response.memories, ...response.neurons, ...response.synapses]
    for (const shape of wireShapes) {
      for (const key of Object.keys(shape)) {
        expect(key).not.toMatch(/^(x|y|z|position|coordinates?)$/i)
      }
    }
  })
})
