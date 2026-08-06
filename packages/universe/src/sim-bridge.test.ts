import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'
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

const richGraph = (): ForceSimGraph => ({
  neurons: [
    { id: 'A', connectivity: 2 },
    { id: 'B', connectivity: 1 },
  ],
  synapses: [{ sourceNeuronId: 'A', targetNeuronId: 'B', strength: 0.4 }],
  episodicMemories: [{ id: 'M1' }],
  activations: [{ episodicMemoryId: 'M1', neuronId: 'A', weight: 0.8 }],
})

describe('worker sim bridge — equivalent-graph no-op (R003)', () => {
  const startedBridge = () => {
    const workers: FakeWorker[] = []
    const bridge = createUniverseSimBridge(() => {
      const w = fakeWorker()
      workers.push(w)
      return w.worker
    })
    bridge.start(richGraph())
    return { bridge, workers }
  }

  it('keeps the running worker when a refetch brings the same facts back', () => {
    const { bridge, workers } = startedBridge()
    bridge.start(richGraph())
    expect(workers).toHaveLength(1)
  })

  it('respawns on a connectivity change', () => {
    const { bridge, workers } = startedBridge()
    const changed = richGraph()
    bridge.start({
      ...changed,
      neurons: [{ id: 'A', connectivity: 5 }, changed.neurons[1]!],
    })
    expect(workers).toHaveLength(2)
  })

  it('respawns on an activation-weight change', () => {
    const { bridge, workers } = startedBridge()
    const changed = richGraph()
    bridge.start({
      ...changed,
      activations: [{ episodicMemoryId: 'M1', neuronId: 'A', weight: 0.1 }],
    })
    expect(workers).toHaveLength(2)
  })

  it('respawns on a synapse-strength change', () => {
    const { bridge, workers } = startedBridge()
    const changed = richGraph()
    bridge.start({
      ...changed,
      synapses: [{ sourceNeuronId: 'A', targetNeuronId: 'B', strength: 0.9 }],
    })
    expect(workers).toHaveLength(2)
  })

  it('respawns on a node reorder — slot order is the buffer layout, not an incidental detail', () => {
    const { bridge, workers } = startedBridge()
    const changed = richGraph()
    bridge.start({ ...changed, neurons: [changed.neurons[1]!, changed.neurons[0]!] })
    expect(workers).toHaveLength(2)
  })

  it('rebuilds after a sim error even though the graph is unchanged', () => {
    const { bridge, workers } = startedBridge()
    // An errored sim reads as an empty universe and clears the worker; the next refetch must be
    // able to bring it back, so the equivalence bail cannot swallow that start().
    workers[0]!.worker.onmessage?.({ data: { type: 'error', message: 'boom' } })
    bridge.start(richGraph())
    expect(workers).toHaveLength(2)
  })
})

describe('inline sim bridge — equivalent-graph no-op (R003)', () => {
  it('keeps the settled layout instead of restarting alpha decay', () => {
    const bridge = createUniverseSimBridge(null)
    bridge.start(richGraph())
    for (let i = 0; i < 30; i++) bridge.pump(1 / 60)
    const settled = Array.from(bridge.coordinates.current!)

    bridge.start(richGraph())

    expect(Array.from(bridge.coordinates.current!)).toEqual(settled)
  })
})

const EPSILON = VALUES.rendering.coordinatePublicationEpsilon

describe('published-coordinate version (R009)', () => {
  describe('worker arm', () => {
    const startedBridge = () => {
      const workers: FakeWorker[] = []
      const bridge = createUniverseSimBridge(() => {
        const w = fakeWorker()
        workers.push(w)
        return w.worker
      })
      return { bridge, workers }
    }
    const deliver = (worker: SimWorkerLike, coords: number[]) =>
      worker.onmessage?.({ data: { type: 'coords', buffer: Float32Array.from(coords).buffer } })

    it('bumps on start and on a remap', () => {
      const { bridge, workers } = startedBridge()
      const atRest = bridge.coordinates.version

      bridge.start(graphOf(['A', 'B']))
      expect(bridge.coordinates.version).toBeGreaterThan(atRest)
      const started = bridge.coordinates.version

      deliver(workers[0]!.worker, [1, 1, 1, 2, 2, 2])
      const published = bridge.coordinates.version
      expect(published).toBeGreaterThan(started)

      // A refetch that inserts a node relays the buffer, so the version must move even though every
      // surviving coordinate was carried across unchanged.
      bridge.start(graphOf(['C', 'A', 'B']))
      expect(bridge.coordinates.version).toBeGreaterThan(published)
    })

    it('holds the version still — and the buffer identity with it — on a converged tick', () => {
      const { bridge, workers } = startedBridge()
      bridge.start(graphOf(['A', 'B']))
      deliver(workers[0]!.worker, [1, 1, 1, 2, 2, 2])
      const published = bridge.coordinates.version
      const presented = bridge.coordinates.current

      deliver(workers[0]!.worker, [1, 1, 1 + EPSILON / 2, 2, 2, 2])

      expect(bridge.coordinates.version).toBe(published)
      // Same array, not merely equal contents: the renderer's skip rests on the picture being the
      // one it already composed.
      expect(bridge.coordinates.current).toBe(presented)
      expect(Array.from(presented!)).toEqual([1, 1, 1, 2, 2, 2])
    })

    it('publishes once sub-epsilon drift accumulates past the epsilon', () => {
      const { bridge, workers } = startedBridge()
      bridge.start(graphOf(['A']))
      deliver(workers[0]!.worker, [0, 0, 0])
      const published = bridge.coordinates.version

      // Each candidate is a sub-epsilon step past the LAST ONE, but they are compared against the
      // presented buffer, so the drift keeps counting instead of resetting every tick.
      const drift = EPSILON * 0.6
      deliver(workers[0]!.worker, [drift, 0, 0])
      expect(bridge.coordinates.version).toBe(published)
      deliver(workers[0]!.worker, [drift * 2, 0, 0])

      expect(bridge.coordinates.version).toBeGreaterThan(published)
      expect(bridge.coordinates.current?.[0]).toBeCloseTo(drift * 2, 6)
    })

    it('keeps recycling buffers when it withholds one, so the ping-pong never starves', () => {
      const { bridge, workers } = startedBridge()
      bridge.start(graphOf(['A']))
      deliver(workers[0]!.worker, [0, 0, 0])
      for (let i = 0; i < 5; i++) {
        bridge.pump(1 / 60)
        deliver(workers[0]!.worker, [0, 0, 0])
      }

      // A withheld candidate goes back into the spare pool; had it been dropped, the pump would
      // have run out of buffers and stopped posting ticks.
      bridge.pump(1 / 60)
      expect(workers[0]!.posts.filter((post) => post.type === 'tick')).toHaveLength(6)
    })
  })

  describe('inline arm', () => {
    it('never presents the simulation’s own mutating buffer', () => {
      const bridge = createUniverseSimBridge(null)
      bridge.start(graphOf(['A', 'B']))
      const presented = bridge.coordinates.current!
      const snapshot = Array.from(presented)

      // Ticks that do not publish still run the sim. If the presented array were `sim.coordinates`,
      // those ticks would rewrite it in place and the version would be lying.
      for (let i = 0; i < 200; i++) {
        bridge.pump(1 / 60)
        if (bridge.coordinates.current !== presented) return
      }
      expect(Array.from(presented)).toEqual(snapshot)
    })

    it('bumps on start and swaps buffers when the layout is still moving', () => {
      const bridge = createUniverseSimBridge(null)
      const atRest = bridge.coordinates.version
      bridge.start(graphOf(['A', 'B', 'C']))
      const started = bridge.coordinates.version
      expect(started).toBeGreaterThan(atRest)

      const first = bridge.coordinates.current
      bridge.pump(1 / 60)

      expect(bridge.coordinates.version).toBeGreaterThan(started)
      expect(bridge.coordinates.current).not.toBe(first)
    })

    it('publishes on a minority of frames once the layout has settled', () => {
      const bridge = createUniverseSimBridge(null)
      bridge.start(richGraph())
      // Long enough for alpha to decay to its `min_alpha` floor. It does not reach zero — the floor
      // is deliberate, so a settled universe keeps breathing rather than freezing hard — which is
      // why this asserts a rate rather than silence.
      for (let i = 0; i < 4000; i++) bridge.pump(1 / 60)

      let published = 0
      let last = bridge.coordinates.version
      for (let i = 0; i < 600; i++) {
        bridge.pump(1 / 60)
        if (bridge.coordinates.version !== last) {
          published += 1
          last = bridge.coordinates.version
        }
      }

      expect(published).toBeLessThan(600 * 0.75)
    })

    it('withholds a tick that reproduces the presented buffer exactly', () => {
      // dt <= 0 is not a step, so the sim writes the same positions out again — the inline mirror
      // of the worker arm's in-flight frames, where several rendered frames see one buffer.
      const bridge = createUniverseSimBridge(null)
      bridge.start(richGraph())
      bridge.pump(1 / 60)
      const published = bridge.coordinates.version
      const presented = bridge.coordinates.current

      for (let i = 0; i < 10; i++) bridge.pump(0)

      expect(bridge.coordinates.version).toBe(published)
      expect(bridge.coordinates.current).toBe(presented)
    })
  })
})
