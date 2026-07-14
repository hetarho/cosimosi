import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
  COORDINATE_STRIDE,
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  InstancedNodeLayer,
  createGistStarBodySource,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'

import {
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
  /** Engram id → sim node slot (the node index's episodic map) — the x, y source per frame. */
  readonly memoryIndexById: Readonly<Record<string, number>>
  /** A gist pick: read-only, routes to the ViewSemantic surface ([R8]) — never 회고하기. */
  readonly onSelect?: (memoryId: string, stage: number) => void
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
type RiseEntry = { start: number | null; startZ: number } | typeof SETTLED

// Per-body rise state keyed by node id, plus whether the read model has hydrated once. `hydrated`
// gates on the episodic STORE being non-empty, not the gist projection: a universe with memories
// but no risen gists still counts as loaded, so its first-ever gist rise animates instead of
// being mistaken for an initial-load body.
type RiseState = { readonly seen: Map<string, RiseEntry>; hydrated: boolean }

// The instanced R3F binding for the neocortical gist body ([V9]): it projects each memory's
// risen stages to instances (model — gistStarInstances), feeds tint/softness as per-instance
// attributes, and derives positions per frame — x, y copied live from the memory's hippocampal
// sim slot, z the stage's gistCoordinate band position ([C6][I5]; the neocortex runs no sim).
// A newly risen stage plays a one-way ease from the memory's hippocampal z up into the band
// ([I10] — the rise never reverses); the bodies present at first hydration seed silently so a
// page load never mass-animates, and an empty advance adds no instance so nothing plays (A8).
export function GistStarLayer({
  positions,
  memoryIndexById,
  onSelect,
  onStageRise,
}: GistStarLayerProps) {
  const bodySource = useMemo(() => createGistStarBodySource(), [])
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const ids = useEpisodicMemoryStore((state) => state.ids)

  const instances = useMemo(() => {
    const memories = []
    for (const id of ids) {
      const memory = byId[id]
      if (memory) memories.push(memory)
    }
    return gistStarInstances(memories)
  }, [byId, ids])

  const instancesRef = useRef<readonly GistStarInstance[]>(instances)
  instancesRef.current = instances

  const riseRef = useRef<RiseState>({ seen: new Map(), hydrated: false })
  // Diff the projection against the seen set post-commit (it changes only when the read model
  // does): once the store has hydrated, a node id not seen before is a genuine rise — marked
  // pending + announced on the [V8] seam; the bodies present at hydration settle silently; a
  // vanished id (a deleted memory) drops its state. Running in an effect keeps the ref mutation
  // and the onStageRise call out of the render phase.
  useEffect(() => {
    const state = riseRef.current
    const alive = new Set<string>()
    const risen: GistRiseEvent[] = []
    for (const instance of instances) {
      alive.add(instance.nodeId)
      if (state.seen.has(instance.nodeId)) continue
      if (state.hydrated) {
        state.seen.set(instance.nodeId, { start: null, startZ: 0 })
        risen.push({ memoryId: instance.memoryId, stage: instance.stage })
      } else {
        state.seen.set(instance.nodeId, SETTLED)
      }
    }
    for (const key of state.seen.keys()) {
      if (!alive.has(key)) state.seen.delete(key)
    }
    // The store being non-empty is hydration — from here on a new gist body is a real rise.
    if (ids.length > 0) state.hydrated = true
    if (risen.length > 0) onStageRise?.(risen)
  }, [instances, ids, onStageRise])

  const getInstancePosition = useCallback(
    (index: number, buffer: Float32Array, out: Float32Array, elapsedSeconds: number): boolean => {
      const instance = instancesRef.current[index]
      if (!instance) return false
      const slot = memoryIndexById[instance.memoryId]
      if (slot === undefined) return false
      const offset = slot * COORDINATE_STRIDE
      if (offset < 0 || offset + 2 >= buffer.length) return false

      const entry = riseRef.current.seen.get(instance.nodeId)
      if (entry === undefined) return false // not diffed yet — hidden one frame
      out[0] = buffer[offset] ?? 0
      out[1] = buffer[offset + 1] ?? 0
      if (entry === SETTLED) {
        out[2] = instance.z
        return true
      }
      if (entry.start === null) {
        // Stamp the rise + capture the starting hippocampal z on its first rendered frame, so
        // the ease is one-way against a fixed origin ([I10]) even if the sim re-lays the memory
        // out mid-rise, and a body that appeared while the tab was hidden still plays in full.
        entry.start = elapsedSeconds
        entry.startZ = buffer[offset + 2] ?? 0
      }
      const progress = Math.min(
        1,
        Math.max(0, (elapsedSeconds - entry.start) / GIST_RISE_DURATION_SECONDS),
      )
      if (progress >= 1) {
        riseRef.current.seen.set(instance.nodeId, SETTLED)
        out[2] = instance.z
        return true
      }
      const eased = 1 - (1 - progress) ** 3
      out[2] = entry.startZ + (instance.z - entry.startZ) * eased
      return true
    },
    [memoryIndexById],
  )

  const channels = useMemo<InstanceChannels>(() => {
    const count = instances.length
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
    return {
      scales,
      attributes: [
        { name: GIST_INSTANCE_TINT, array: tint, itemSize: 3 },
        { name: GIST_INSTANCE_DIFFUSE, array: softness, itemSize: 1 },
      ],
    }
  }, [instances])

  const handleSelect = useCallback(
    (index: number) => {
      const instance = instancesRef.current[index]
      if (instance) onSelect?.(instance.memoryId, instance.stage)
    },
    [onSelect],
  )

  return (
    <InstancedNodeLayer
      source={bodySource}
      bodyId="gist-star"
      kind="shader"
      count={instances.length}
      positions={positions}
      channels={channels}
      getInstancePosition={getInstancePosition}
      onNodePointerDown={onSelect ? handleSelect : undefined}
    />
  )
}
