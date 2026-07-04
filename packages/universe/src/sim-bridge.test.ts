import { describe, expect, it } from 'vitest'

import { DEFAULT_FORCE_SIM_VALUES, type ForceSimGraph } from '@cosimosi/force-sim'

import { createUniverseSimBridge, type SimWorkerLike, type SimWorkerRequest } from './index.ts'

const neuron = (id: string) => ({ id, connectivity: 1 })
const graphOf = (ids: string[]): ForceSimGraph => ({
  neurons: ids.map(neuron),
  synapses: [],
  episodicMemories: [],
  activations: [],
})

interface FakeWorker {
  worker: SimWorkerLike
  posts: SimWorkerRequest[]
}

function fakeWorker(): FakeWorker {
  const posts: SimWorkerRequest[] = []
  const worker: SimWorkerLike = {
    postMessage: (message) => posts.push(message as SimWorkerRequest),
    terminate: () => {},
    onmessage: null,
    onerror: null,
  }
  return { worker, posts }
}

function initGraph(post: SimWorkerRequest | undefined): ForceSimGraph {
  if (!post || post.type !== 'init') throw new Error('expected an init post')
  return post.graph
}

describe('worker sim bridge — id-keyed refetch carry-over (R001)', () => {
  it('remaps surviving coordinates to their new slots and seeds the worker by id, not by slot', () => {
    const workers: FakeWorker[] = []
    const bridge = createUniverseSimBridge(() => {
      const w = fakeWorker()
      workers.push(w)
      return w.worker
    })

    // First load [A, B]: no previous buffer, so nothing shows until the worker's first tick.
    bridge.start(graphOf(['A', 'B']))
    expect(bridge.coordinates.current).toBeNull()

    // Worker returns coordinates A=(1,1,1), B=(2,2,2).
    const coords = Float32Array.from([1, 1, 1, 2, 2, 2])
    workers[0].worker.onmessage?.({ data: { type: 'coords', buffer: coords.buffer } })
    expect(Array.from(bridge.coordinates.current!)).toEqual([1, 1, 1, 2, 2, 2])

    // Refetch inserts C, whose id sorts before the survivors: [C, A, B].
    bridge.start(graphOf(['C', 'A', 'B']))

    // Display buffer through the swap: A/B keep their coordinates at their NEW slots; C at origin.
    // (A slot-based copy would have handed A's (1,1,1) to C.)
    expect(Array.from(bridge.coordinates.current!)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2])

    // The next worker is seeded from prior positions by id; C is a genuinely new, unseeded node.
    const seeded = initGraph(workers[1].posts.at(-1))
    const byId = Object.fromEntries(seeded.neurons.map((n) => [n.id, n.previousPosition]))
    expect(byId.A).toEqual({ x: 1, y: 1, z: 1 })
    expect(byId.B).toEqual({ x: 2, y: 2, z: 2 })
    expect(byId.C).toBeUndefined()
  })
})

describe('inline sim bridge — refetch continuity (R002 web/mobile parity)', () => {
  it('seeds a surviving neuron from its prior position instead of reseeding on refetch', () => {
    const bridge = createUniverseSimBridge(null)

    bridge.start(graphOf(['A', 'B']))
    for (let i = 0; i < 30; i++) bridge.pump(1 / 60)
    const before = bridge.coordinates.current!
    const posA = { x: before[0], y: before[1], z: before[2] } // A is slot 0 in [A, B].

    // Refetch inserts C first: [C, A, B] — A moves to slot 1.
    bridge.start(graphOf(['C', 'A', 'B']))
    const after = bridge.coordinates.current!
    const seededA = { x: after[3], y: after[4], z: after[5] }

    const distance = Math.hypot(seededA.x - posA.x, seededA.y - posA.y, seededA.z - posA.z)
    // Seeded within the previous-position jitter (≈ linkDistance * 0.03), not reseeded to a fresh
    // cluster center — the same continuity the worker branch preserves.
    expect(distance).toBeLessThan(DEFAULT_FORCE_SIM_VALUES.linkDistance * 0.1)
  })
})
