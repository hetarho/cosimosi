import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'

import {
  COORDINATE_STRIDE,
  DEFAULT_GIST_SHAPE,
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  InstancedNodeLayer,
  createGistShapeBodySource,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'

import {
  gistStageZ,
  gistStarInstances,
  useEpisodicMemoryStore,
  type GistStarInstance,
} from '@cosimosi/universe'

// One stage-rise event on the choreography seam when a gist body newly rises — the reserved
// [V8] hook the consolidation-replay choreography ([C2][C8]) consumes. This layer emits the
// events and plays only the neutral one-way rise.
export interface GistRiseEvent {
  readonly memoryId: string
  readonly stage: number
}

export interface GistStarLayerProps {
  readonly positions: CoordinateBufferRef
  /** The gist-shape registry key this universe wears — a decoration choice, not a domain fact, and
   *  ONE choice for the whole layer rather than one per memory ([V5]). Unknown keys resolve to the
   *  shipped body, so a retired shape never blanks the neocortex. */
  readonly shape?: string
  /** Engram id → sim node slot (the node index's episodic map) — the x, y source per frame. */
  readonly memoryIndexById: Readonly<Record<string, number>>
  /** A gist pick: read-only, routes to the ViewSemantic surface ([R8]) — never 회고하기. It names
   *  the memory alone; the server decides which rung that read reaches and what it costs. */
  readonly onSelect?: (memoryId: string) => void
  /** The reserved [V8] hook: newly risen stages, one event per body. */
  readonly onStageRise?: (events: readonly GistRiseEvent[]) => void
}

// The neutral rise's length. A presentation constant shaping one motion — a values.yaml key
// only earns its place once a scalar needs cross-surface tuning (the camera-rig precedent).
const GIST_RISE_DURATION_SECONDS = 1.4

// A settled body: risen (or seeded already-up) and sitting at its band z, so the frame loop
// skips the ease math. A frozen shared sentinel, distinct from the {start, startZ} of a body
// still animating.
const SETTLED = Object.freeze({ start: 0, startZ: 0 })
type RiseEntry = { start: number | null; startZ: number | null } | typeof SETTLED

// Per-body rise state keyed by node id, plus whether the read model has hydrated once. `hydrated`
// gates on the episodic STORE being non-empty, not the gist projection: a universe with memories
// but no risen gists still counts as loaded, so its first-ever gist rise animates instead of
// being mistaken for an initial-load body.
//
// `byInstance` is the same entries laid out in one snapshot's committed instance order, so the
// per-frame mapper indexes an array instead of hashing a node-id string per instance per frame.
// It is a cache, not a second source of truth: `indexed` names the snapshot it was built for, and
// a mapper call against any other snapshot falls back to `seen`. The layout-phase reconcile keeps
// committed frames indexed; the fallback keeps direct/future callers fail-safe if that ordering is
// ever bypassed.
export type GistRiseState = {
  readonly seen: Map<string, RiseEntry>
  /**
   * The stage each live body was last seen at. A body's node id is now stable across its whole
   * life (one id per memory), so a rise is a STAGE CHANGE, not a new id — without this the one
   * transforming body would silently teleport to each new band instead of easing up to it.
   */
  readonly stageSeen: Map<string, number>
  hydrated: boolean
  byInstance: RiseEntry[]
  indexed: GistRenderSnapshot | null
}

export interface GistRenderSnapshot {
  readonly count: number
  readonly instances: readonly GistStarInstance[]
  readonly positionSlots: readonly (number | undefined)[]
  readonly channels: InstanceChannels
}

// One immutable ordering owns count, channel arrays, sim-slot sources, frame lookup, and pick
// lookup. React publishes the object and every callback that closes over it in one commit, so a
// work-in-progress render cannot expose its ordering to the previously committed mesh.
export function createGistRenderSnapshot(
  sourceInstances: readonly GistStarInstance[],
  memoryIndexById: Readonly<Record<string, number>>,
): GistRenderSnapshot {
  const instances = Object.freeze([...sourceInstances])
  const count = instances.length
  const positionSlots = Object.freeze(
    instances.map((instance) => memoryIndexById[instance.memoryId]),
  )
  const scales = new Float32Array(count)
  const tint = new Float32Array(count * 3)
  const softness = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const instance = instances[i]
    scales[i] = instance.size
    tint[i * 3] = instance.color[0]
    tint[i * 3 + 1] = instance.color[1]
    tint[i * 3 + 2] = instance.color[2]
    softness[i] = instance.softness
  }
  return Object.freeze({
    count,
    instances,
    positionSlots,
    channels: Object.freeze({
      scales,
      attributes: Object.freeze([
        Object.freeze({ name: GIST_INSTANCE_TINT, array: tint, itemSize: 3 }),
        Object.freeze({ name: GIST_INSTANCE_DIFFUSE, array: softness, itemSize: 1 }),
      ]),
    }),
  })
}

export function createGistRiseState(): GistRiseState {
  return { seen: new Map(), stageSeen: new Map(), hydrated: false, byInstance: [], indexed: null }
}

export function reconcileGistRiseState(
  state: GistRiseState,
  snapshot: GistRenderSnapshot,
  hasMemories: boolean,
): readonly GistRiseEvent[] {
  const alive = new Set<string>()
  const risen: GistRiseEvent[] = []
  for (const instance of snapshot.instances) {
    alive.add(instance.nodeId)
    const previousStage = state.stageSeen.get(instance.nodeId)
    state.stageSeen.set(instance.nodeId, instance.stage)
    // Two ways a rise happens now: a memory's first gist appears, or the body already on screen
    // moves to a deeper rung. Both re-arm the ease; a stage that did not move leaves the body
    // wherever it already is (settled or mid-rise), so nothing replays on an ordinary refetch.
    const isNew = previousStage === undefined
    const rose = !isNew && instance.stage > previousStage
    if (!isNew && !rose) continue
    if (state.hydrated) {
      state.seen.set(instance.nodeId, {
        start: null,
        startZ: previousStage === undefined ? null : gistStageZ(previousStage),
      })
      risen.push({ memoryId: instance.memoryId, stage: instance.stage })
    } else {
      state.seen.set(instance.nodeId, SETTLED)
    }
  }
  for (const key of state.seen.keys()) {
    if (!alive.has(key)) state.seen.delete(key)
  }
  for (const key of state.stageSeen.keys()) {
    if (!alive.has(key)) state.stageSeen.delete(key)
  }
  if (hasMemories) state.hydrated = true
  state.byInstance = snapshot.instances.map(
    (instance) => state.seen.get(instance.nodeId) ?? SETTLED,
  )
  state.indexed = snapshot
  return risen
}

export function mapGistInstancePosition(
  snapshot: GistRenderSnapshot,
  riseState: GistRiseState,
  index: number,
  buffer: Float32Array,
  out: Float32Array,
  elapsedSeconds: number,
): boolean {
  const instance = snapshot.instances[index]
  if (!instance) return false
  const slot = snapshot.positionSlots[index]
  if (slot === undefined) return false
  const offset = slot * COORDINATE_STRIDE
  if (offset < 0 || offset + 2 >= buffer.length) return false

  const indexed = riseState.indexed === snapshot
  const entry = indexed ? riseState.byInstance[index] : riseState.seen.get(instance.nodeId)
  if (entry === undefined) return false
  out[0] = buffer[offset] ?? 0
  out[1] = buffer[offset + 1] ?? 0
  if (entry === SETTLED) {
    out[2] = instance.z
    return true
  }
  if (entry.start === null) {
    // A first appearance starts at the hippocampal body. A stage deepening was pre-seeded with
    // its previous band z, so neither origin can reverse if the sim moves mid-rise.
    entry.start = elapsedSeconds
    if (entry.startZ === null) entry.startZ = buffer[offset + 2] ?? 0
  }
  const startZ = entry.startZ
  if (startZ === null) return false
  const progress = Math.min(
    1,
    Math.max(0, (elapsedSeconds - entry.start) / GIST_RISE_DURATION_SECONDS),
  )
  if (progress >= 1) {
    riseState.seen.set(instance.nodeId, SETTLED)
    // The index is a projection of `seen`, so it settles with it — otherwise every later frame
    // would keep re-reading the finished {start, startZ} record and redo the ease math forever.
    if (indexed) riseState.byInstance[index] = SETTLED
    out[2] = instance.z
    return true
  }
  const eased = 1 - (1 - progress) ** 3
  out[2] = startZ + (instance.z - startZ) * eased
  return true
}

export function gistSelectionAt(snapshot: GistRenderSnapshot, index: number): GistRiseEvent | null {
  const instance = snapshot.instances[index]
  return instance ? { memoryId: instance.memoryId, stage: instance.stage } : null
}

// The instanced R3F binding for the neocortical gist body ([V9]): it projects each risen memory to
// ONE instance (model — gistStarInstances), feeds tint/softness as per-instance attributes, and
// derives positions per frame — x, y copied live from the memory's hippocampal sim slot, z the
// current stage's gistCoordinate band position ([C6][I5]; the neocortex runs no sim). A stage rise
// moves that one body upward on a one-way ease ([I10] — the rise never reverses); the bodies
// present at first hydration seed silently so a page load never mass-animates, and an empty advance
// moves no instance so nothing plays (A8).
export function GistStarLayer({
  positions,
  shape = DEFAULT_GIST_SHAPE,
  memoryIndexById,
  onSelect,
  onStageRise,
}: GistStarLayerProps) {
  // The look the whole neocortical layer wears — one key out of the gist catalogue, never per
  // memory ([V5]). Whichever row the worn ornament names reads the same two channels below, so a
  // live swap rebuilds this source and nothing else.
  const bodySource = useMemo(() => createGistShapeBodySource(shape), [shape])
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const ids = useEpisodicMemoryStore((state) => state.ids)

  const snapshot = useMemo(() => {
    const memories = []
    for (const id of ids) {
      const memory = byId[id]
      if (memory) memories.push(memory)
    }
    return createGistRenderSnapshot(gistStarInstances(memories), memoryIndexById)
  }, [byId, ids, memoryIndexById])

  const riseRef = useRef<GistRiseState>(createGistRiseState())
  // Diff the projection against the seen set after commit (it changes only when the read model
  // does): once the store has hydrated, a node id not seen before is a genuine rise — marked
  // pending + announced on the [V8] seam; the bodies present at hydration settle silently; a
  // vanished id (a deleted memory) drops its state. Layout timing is load-bearing: a frame drawn
  // before a passive effect would show the new target z, then snap back to the rise origin.
  useLayoutEffect(() => {
    // The store being non-empty is hydration — a loaded universe with no risen gist still
    // treats its next stage as a real rise.
    const risen = reconcileGistRiseState(riseRef.current, snapshot, ids.length > 0)
    if (risen.length > 0) onStageRise?.(risen)
  }, [snapshot, ids.length, onStageRise])

  const getInstancePosition = useCallback(
    (index: number, buffer: Float32Array, out: Float32Array, elapsedSeconds: number): boolean => {
      return mapGistInstancePosition(snapshot, riseRef.current, index, buffer, out, elapsedSeconds)
    },
    [snapshot],
  )

  const handleSelect = useCallback(
    (index: number) => {
      const selection = gistSelectionAt(snapshot, index)
      if (selection) onSelect?.(selection.memoryId)
    },
    [snapshot, onSelect],
  )

  return (
    <InstancedNodeLayer
      source={bodySource}
      bodyId="gist-star"
      kind="shader"
      count={snapshot.count}
      positions={positions}
      channels={snapshot.channels}
      getInstancePosition={getInstancePosition}
      onNodeClick={onSelect ? handleSelect : undefined}
    />
  )
}
