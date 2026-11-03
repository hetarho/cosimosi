import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
  FrameTick,
  InstancedNodeLayer,
  createPrimitiveBodySource,
  type CoordinateBufferRef,
} from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'

import { pickAwakenSeeds, type AwakenAnchor, type LatentField } from '@cosimosi/universe/scene'
import { useAwakenRegistryStore, useLatentConsumedStore } from '@cosimosi/universe'

import {
  advanceAwakenFlares,
  createAwakenFlarePool,
  freeAwakenSlot,
  igniteAwakenFlare,
  moveAwakenFlares,
} from './awaken-flare-pool.ts'

// A fixed pool of concurrent flares (one launch rarely births more than a few new neurons); each
// hands a latent seed to its live cell-star as the light fades. The pool ceiling is the one tunable
// here (a resource cap, so it lives in config); the motion itself is code [E7a], in the pool module.
const AWAKEN_BODY_ID = 'awaken-pulse'
const AWAKEN_CAPACITY = VALUES.rendering.awakenCapacity
const AWAKEN_PULSE_COLOR = '#fff1d6'

export interface AwakenNeuronProps {
  /** The latent field the flare picks its seed from (from entities/latent-star). */
  readonly field: LatentField
  /** Genuinely-created neuron ids (LaunchStars `new_neuron_ids`) — deduped-onto ids never appear. */
  readonly newNeuronIds: readonly string[]
  /** Widget-supplied: positions of recently-active neurons, minus the just-born ones. */
  readonly resolveAnchors: (excludeIds: ReadonlySet<string>) => readonly AwakenAnchor[]
  readonly positions?: CoordinateBufferRef
  readonly neuronIndexById?: Readonly<Record<string, number>>
  readonly reducedMotion?: boolean
}

// features/awaken-neuron ui: the activation choreography. On each genuinely-new neuron it picks a
// distinct gray latent star (near a recently-active neuron, else random — the [E7a] entry
// choreography), marks it consumed, and carries the light toward its live neuron. Per-frame work
// stays in refs/arrays (no React state, no store reads); the destination follows the force sim,
// never a stored coordinate [I5][A6].
export function AwakenNeuron({
  field,
  newNeuronIds,
  resolveAnchors,
  positions: livePositions,
  neuronIndexById,
  reducedMotion = false,
}: AwakenNeuronProps) {
  const bodySource = useMemo(
    () => createPrimitiveBodySource({ [AWAKEN_BODY_ID]: { color: AWAKEN_PULSE_COLOR, radius: 1 } }),
    [],
  )
  const consume = useLatentConsumedStore((state) => state.consume)

  const pool = useMemo(() => createAwakenFlarePool(AWAKEN_CAPACITY), [])
  const channels = useMemo(() => ({ scales: pool.scales }), [pool])
  // A slot's seed position. It carries its own version because the layer's clean-frame skip reads
  // one off the buffer seam, and this pool is not the sim's buffer.
  const positions = useMemo(
    () => ({ current: new Float32Array(AWAKEN_CAPACITY * 3), version: 0 }),
    [],
  )
  // Bumped only by a frame that actually moved a scale, so an idle pool leaves the layer's matrices
  // exactly as composed instead of re-uploading its full capacity in zeroes.
  const animationRevision = useRef(0)
  const origins = useMemo(() => new Float32Array(AWAKEN_CAPACITY * 3), [])
  const destinations = useMemo(() => new Int32Array(AWAKEN_CAPACITY).fill(-1), [])

  useEffect(() => {
    // Idempotency comes from the module-level registry (survives remounts), never a component ref.
    const registry = useAwakenRegistryStore.getState()
    const fresh = newNeuronIds.filter((id) => !registry.claimed.has(id))
    if (fresh.length === 0) return
    // Only take what the pool can attempt this pass. Births outside this batch stay eligible for a
    // later effect run; the attempted batch follows the exhausted-field stop documented below.
    const freeSlots = pool.active.length - pool.activeCount
    if (freeSlots === 0) return
    const batch = fresh.slice(0, freeSlots)

    const anchors = resolveAnchors(new Set(newNeuronIds))
    // Read consumed without subscribing — this runs on new births, not per frame.
    const consumed = useLatentConsumedStore.getState().consumed
    const picks = pickAwakenSeeds({
      positions: field.positions,
      count: field.count,
      consumed,
      anchors,
      births: batch.length,
      random: Math.random,
    })
    // The attempted batch is claimed even when the latent field cannot represent every birth.
    // Retrying an exhausted field on each dependency change cannot create a distinct flare; ids
    // beyond the pool-sized batch remain unclaimed rather than being stopped without an attempt.
    if (picks.length === 0) {
      registry.claim(batch)
      return
    }
    consume(picks)
    for (const [pickIndex, index] of picks.entries()) {
      const slot = freeAwakenSlot(pool)
      if (!reducedMotion) igniteAwakenFlare(pool, slot)
      positions.current[slot * 3] = field.positions[index * 3] ?? 0
      positions.current[slot * 3 + 1] = field.positions[index * 3 + 1] ?? 0
      positions.current[slot * 3 + 2] = field.positions[index * 3 + 2] ?? 0
      origins.set(positions.current.subarray(slot * 3, slot * 3 + 3), slot * 3)
      destinations[slot] = neuronIndexById?.[batch[pickIndex]!] ?? -1
    }
    positions.version++
    registry.claim(batch)
  }, [
    newNeuronIds,
    field,
    resolveAnchors,
    consume,
    pool,
    positions,
    destinations,
    neuronIndexById,
    origins,
    reducedMotion,
  ])

  const onFrame = useCallback(
    (dt: number) => {
      if (reducedMotion) {
        if (pool.activeCount === 0) return
        pool.active.fill(false)
        pool.activeCount = 0
        pool.scales.fill(0)
        animationRevision.current++
        return
      }
      if (advanceAwakenFlares(pool, dt)) {
        if (livePositions?.current) {
          moveAwakenFlares(pool, origins, destinations, livePositions.current, positions.current)
          positions.version++
        }
        animationRevision.current++
      }
    },
    [pool, livePositions, origins, destinations, positions, reducedMotion],
  )

  return (
    // FrameTick must precede InstancedNodeLayer: same-priority useFrame callbacks run in mount
    // order, so the flare sizes are written before the layer reads them into instance matrices.
    <>
      <FrameTick onFrame={onFrame} />
      <InstancedNodeLayer
        source={bodySource}
        bodyId={AWAKEN_BODY_ID}
        kind="primitive"
        count={AWAKEN_CAPACITY}
        positions={positions}
        channels={channels}
        animationRevision={animationRevision}
      />
    </>
  )
}
