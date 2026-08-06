import {
  FORCE_SIM_COORDINATE_STRIDE,
  carryPreviousPositions,
  createForceSimNodeIndex,
  createForceSimulation,
  remapCoordinateBuffer,
  sameForceSimGraph,
  type ForceSimGraph,
  type ForceSimNodeIndex,
  type ForceSimulation,
} from '@cosimosi/force-sim'
import { VALUES } from '@cosimosi/config'

const PUBLICATION_EPSILON = VALUES.rendering.coordinatePublicationEpsilon

export interface MutableCoordinateBufferRef {
  current: Float32Array | null
  /**
   * Monotonic version of what `current` is SHOWING. It moves when the presented contents change —
   * on start/remap, and on a tick whose coordinates moved past the publication epsilon — and it
   * does not move merely because the sim produced another buffer. That is the whole contract the
   * renderer's per-frame skip rests on: an unchanged version means an unchanged picture, so the
   * instanced layers may leave last frame's matrices on the GPU.
   */
  version: number
}

// The widget's seam onto the force-sim host (its coordinate contract): start() hands
// the projected graph in, pump(dt) advances one frame, and layers READ `coordinates` per
// frame. Coordinates live only in this ref — never in a store and never persisted [I5].
export interface UniverseSimBridge {
  readonly coordinates: MutableCoordinateBufferRef
  start(graph: ForceSimGraph): void
  pump(dt: number): void
  dispose(): void
}

/**
 * Whether a candidate buffer has moved far enough from the presented one to be worth showing.
 * Compare against the last PRESENTED buffer rather than the last candidate, so a drift that stays
 * under the epsilon every tick still publishes once it accumulates past it.
 */
export function coordinatesMovedBeyond(
  presented: Float32Array | null,
  candidate: Float32Array,
  epsilon: number,
): boolean {
  if (!presented || presented.length !== candidate.length) return true
  for (let i = 0; i < candidate.length; i++) {
    if (Math.abs((candidate[i] as number) - (presented[i] as number)) > epsilon) return true
  }
  return false
}

// Narrow structural worker type so this file typechecks on hosts without DOM lib types;
// the web spawner supplies a real module Worker, other hosts supply none.
export type SimWorkerLike = {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void
  terminate(): void
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
}

export type SimWorkerSpawner = () => SimWorkerLike

export type SimWorkerRequest =
  | { readonly type: 'init'; readonly graph: ForceSimGraph }
  | { readonly type: 'tick'; readonly dt: number; readonly buffer: ArrayBuffer }

export type SimWorkerResponse =
  | { readonly type: 'coords'; readonly buffer: ArrayBuffer }
  | { readonly type: 'error'; readonly message: string; readonly buffer?: ArrayBuffer }

export function createUniverseSimBridge(spawner: SimWorkerSpawner | null): UniverseSimBridge {
  return spawner ? createWorkerSimBridge(spawner) : createInlineSimBridge()
}

function createWorkerSimBridge(spawner: SimWorkerSpawner): UniverseSimBridge {
  const coordinates: MutableCoordinateBufferRef = { current: null, version: 0 }
  let worker: SimWorkerLike | null = null
  let spareBuffers: ArrayBuffer[] = []
  let inFlight = false
  let pendingDt = 0
  // The node index that laid out the currently displayed buffer, so a refetch can carry existing
  // coordinates across a reorder/resize by stable node id rather than by slot.
  let displayedIndex: ForceSimNodeIndex | null = null
  // The graph the running worker was started from, so a refetch can recognize its own facts coming
  // back unchanged (see `sameForceSimGraph`) instead of respawning to reach the same layout.
  let runningGraph: ForceSimGraph | null = null

  const stop = (clearCoordinates: boolean) => {
    worker?.terminate()
    worker = null
    spareBuffers = []
    inFlight = false
    pendingDt = 0
    runningGraph = null
    if (clearCoordinates) {
      coordinates.current = null
      coordinates.version++
      displayedIndex = null
    }
  }

  return {
    coordinates,
    start(graph) {
      // Defense in depth beneath the store-level content bail: if the same facts arrive again, the
      // worker already on screen is producing the right layout, so leave it running. `worker` is
      // checked too — an errored sim cleared it, and that must still be rebuildable by a refetch.
      if (worker && runningGraph && sameForceSimGraph(runningGraph, graph)) return
      // Keep the previous buffer on screen through the swap — the new worker's first
      // coords replace it; only dispose() blanks the scene.
      stop(false)
      const nextIndex = createForceSimNodeIndex(graph)
      const floats = nextIndex.entries.length * FORCE_SIM_COORDINATE_STRIDE
      // On a refetch, carry surviving nodes' coordinates to their NEW slots BY ID (remap), so the
      // scene stays put through the worker swap even if the backend reordered the nodes; and seed
      // the next sim from those same positions so its first tick resumes where it left off.
      // Genuinely new nodes sit at the origin only until the first coords arrive a frame or two
      // later. On the FIRST load (no previous buffer) leave coordinates null so the layers stay
      // hidden until real coords — no origin-stacked flash.
      const previous = coordinates.current
      let seededGraph = graph
      if (previous && displayedIndex) {
        coordinates.current = remapCoordinateBuffer(nextIndex, previous, displayedIndex)
        seededGraph = carryPreviousPositions(graph, previous, displayedIndex)
      }
      // A start relaid the buffer even when the remap kept every surviving coordinate: slots moved,
      // so the layers' contiguous slot reads must recompose whatever the coordinates now say.
      coordinates.version++
      displayedIndex = nextIndex
      const spawned = spawner()
      spawned.onmessage = (event) => {
        const message = event.data as SimWorkerResponse | null
        if (spawned !== worker || !message) return
        if (message.type === 'error') {
          // A broken sim must read as an EMPTY universe, never a zero-stacked one;
          // terminate and let the next start() (refetch) rebuild.
          stop(true)
          return
        }
        if (message.type !== 'coords') return
        const presented = coordinates.current
        const candidate = new Float32Array(message.buffer)
        if (coordinatesMovedBeyond(presented, candidate, PUBLICATION_EPSILON)) {
          coordinates.current = candidate
          coordinates.version++
          if (presented) spareBuffers.push(presented.buffer as ArrayBuffer)
        } else {
          // A converged tick: keep the presented buffer on screen (so its version stays stable and
          // the layers skip) and hand the candidate straight back as the next tick's spare.
          spareBuffers.push(candidate.buffer as ArrayBuffer)
        }
        inFlight = false
      }
      spawned.onerror = () => {
        if (spawned === worker) stop(true)
      }
      worker = spawned
      // The graph as handed in, NOT the seeded copy — the next refetch's graph carries no position
      // hints either, so comparing against the seeded one would never match.
      runningGraph = graph
      // Two buffers ping-pong as transferables (zero-copy): one displayed, one in flight.
      spareBuffers = [new ArrayBuffer(floats * 4), new ArrayBuffer(floats * 4)]
      worker.postMessage({ type: 'init', graph: seededGraph } satisfies SimWorkerRequest)
    },
    pump(dt) {
      pendingDt += dt
      if (!worker || inFlight) return
      const buffer = spareBuffers.pop()
      if (!buffer) return
      inFlight = true
      worker.postMessage({ type: 'tick', dt: pendingDt, buffer } satisfies SimWorkerRequest, [
        buffer,
      ])
      pendingDt = 0
    },
    dispose: () => stop(true),
  }
}

// Same contract on the JS thread, for hosts without a worker primitive. It ping-pongs two OWNED
// output buffers through `tick(dt, output)` rather than presenting the simulation's own
// `sim.coordinates`: that array is rewritten in place by every tick, so presenting it would make
// the version claim ("unchanged version = unchanged picture") false — the version would hold still
// while the pixels underneath it moved.
function createInlineSimBridge(): UniverseSimBridge {
  const coordinates: MutableCoordinateBufferRef = { current: null, version: 0 }
  let sim: ForceSimulation | null = null
  // The buffer NOT currently presented, handed to the next tick as its output target.
  let spare: Float32Array | null = null
  // The node index of the currently displayed buffer, so a refetch carries coordinates by id —
  // the same continuity the worker branch gives, so web and mobile don't diverge on refetch.
  let displayedIndex: ForceSimNodeIndex | null = null
  let runningGraph: ForceSimGraph | null = null

  return {
    coordinates,
    start(graph) {
      // Same equivalence bail as the worker branch — cheaper here (no thread to respawn) but it
      // still discards a settled layout and restarts alpha decay from the top.
      if (sim && runningGraph && sameForceSimGraph(runningGraph, graph)) return
      const previous = coordinates.current
      const seededGraph =
        previous && displayedIndex ? carryPreviousPositions(graph, previous, displayedIndex) : graph
      sim = createForceSimulation(seededGraph)
      // Seeded from prior positions, the first frame already lands survivors where they were —
      // no async swap window here (the sim is synchronous), so no separate display remap is needed.
      coordinates.current = Float32Array.from(sim.coordinates)
      coordinates.version++
      spare = new Float32Array(sim.coordinates.length)
      displayedIndex = sim.nodeIndex
      runningGraph = graph
    },
    pump(dt) {
      const presented = coordinates.current
      if (!sim || !spare || !presented) return
      const candidate = sim.tick(dt, spare)
      if (!coordinatesMovedBeyond(presented, candidate, PUBLICATION_EPSILON)) return
      coordinates.current = candidate
      coordinates.version++
      spare = presented
    },
    dispose() {
      sim = null
      spare = null
      coordinates.current = null
      coordinates.version++
      displayedIndex = null
      runningGraph = null
    },
  }
}
