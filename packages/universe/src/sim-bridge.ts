import {
  FORCE_SIM_COORDINATE_STRIDE,
  createForceSimulation,
  type ForceSimGraph,
  type ForceSimulation,
} from '@cosimosi/force-sim'

export interface MutableCoordinateBufferRef {
  current: Float32Array | null
}

// The widget's seam onto the force-sim host (plan 19's coordinate contract): start() hands
// the projected graph in, pump(dt) advances one frame, and layers READ `coordinates` per
// frame. Coordinates live only in this ref — never in a store and never persisted [I5].
export interface UniverseSimBridge {
  readonly coordinates: MutableCoordinateBufferRef
  start(graph: ForceSimGraph): void
  pump(dt: number): void
  dispose(): void
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
  const coordinates: MutableCoordinateBufferRef = { current: null }
  let worker: SimWorkerLike | null = null
  let spareBuffers: ArrayBuffer[] = []
  let inFlight = false
  let pendingDt = 0

  const stop = (clearCoordinates: boolean) => {
    worker?.terminate()
    worker = null
    spareBuffers = []
    inFlight = false
    pendingDt = 0
    if (clearCoordinates) coordinates.current = null
  }

  return {
    coordinates,
    start(graph) {
      // Keep the previous buffer on screen through the swap — the new worker's first
      // coords replace it; only dispose() blanks the scene.
      stop(false)
      const floats = (graph.neurons.length + graph.episodicMemories.length) * FORCE_SIM_COORDINATE_STRIDE
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
        const previous = coordinates.current
        coordinates.current = new Float32Array(message.buffer)
        if (previous) spareBuffers.push(previous.buffer as ArrayBuffer)
        inFlight = false
      }
      spawned.onerror = () => {
        if (spawned === worker) stop(true)
      }
      worker = spawned
      // Two buffers ping-pong as transferables (zero-copy): one displayed, one in flight.
      spareBuffers = [new ArrayBuffer(floats * 4), new ArrayBuffer(floats * 4)]
      worker.postMessage({ type: 'init', graph } satisfies SimWorkerRequest)
    },
    pump(dt) {
      pendingDt += dt
      if (!worker || inFlight) return
      const buffer = spareBuffers.pop()
      if (!buffer) return
      inFlight = true
      worker.postMessage({ type: 'tick', dt: pendingDt, buffer } satisfies SimWorkerRequest, [buffer])
      pendingDt = 0
    },
    dispose: () => stop(true),
  }
}

// Same contract on the JS thread, for hosts without a worker primitive. tick(dt) without
// an output buffer returns the module-owned snapshot, sanctioned for direct reads.
function createInlineSimBridge(): UniverseSimBridge {
  const coordinates: MutableCoordinateBufferRef = { current: null }
  let sim: ForceSimulation | null = null

  return {
    coordinates,
    start(graph) {
      sim = createForceSimulation(graph)
      coordinates.current = sim.coordinates
    },
    pump(dt) {
      if (!sim) return
      coordinates.current = sim.tick(dt)
    },
    dispose() {
      sim = null
      coordinates.current = null
    },
  }
}
