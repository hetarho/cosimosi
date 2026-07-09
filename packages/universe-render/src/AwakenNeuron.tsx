import { useCallback, useEffect, useMemo, useRef } from 'react'

import { FrameTick, InstancedNodeLayer, createPrimitiveBodySource } from '@cosimosi/3d-renderer'
import { VALUES } from '@cosimosi/config'

import {
  pickAwakenSeeds,
  useAwakenRegistryStore,
  useLatentConsumedStore,
  type AwakenAnchor,
  type LatentField,
} from '@cosimosi/universe'

// Awaken animation vocabulary — motion/look is code, never values.yaml [E7a]. A fixed pool of
// concurrent flares (one launch rarely births more than a few new neurons); each flares in place
// with a sin(πp) grow-then-hand-off envelope and is gone as the real cell-star takes over. The pool
// ceiling is the one tunable here (a resource cap, so it lives in config).
const AWAKEN_BODY_ID = 'awaken-pulse'
const AWAKEN_CAPACITY = VALUES.rendering.awakenCapacity
const AWAKEN_DURATION_S = 1.1
const AWAKEN_PEAK_SIZE = 0.9
const AWAKEN_PULSE_COLOR = '#fff1d6'
// Cap the per-frame step so a large delta (a backgrounded tab resuming) can't skip a whole flare.
const AWAKEN_MAX_STEP_S = 0.05

export interface AwakenNeuronProps {
  /** The latent field the flare picks its seed from (from entities/latent-star). */
  readonly field: LatentField
  /** Genuinely-created neuron ids (LaunchStars `new_neuron_ids`) — deduped-onto ids never appear. */
  readonly newNeuronIds: readonly string[]
  /** Widget-supplied: positions of recently-active neurons, minus the just-born ones. */
  readonly resolveAnchors: (excludeIds: ReadonlySet<string>) => readonly AwakenAnchor[]
}

// features/awaken-neuron ui: the activation choreography. On each genuinely-new neuron it picks a
// distinct gray latent star (near a recently-active neuron, else random — the [E7a] entry
// choreography), marks it consumed, and flares a bright point in its place. Per-frame work stays
// in refs/arrays (no React state, no store reads); the flare position is the seed only — the real
// neuron settles wherever the force-sim pulls it, never a stored coordinate [I5][A6].
export function AwakenNeuron({ field, newNeuronIds, resolveAnchors }: AwakenNeuronProps) {
  const bodySource = useMemo(
    () => createPrimitiveBodySource({ [AWAKEN_BODY_ID]: { color: AWAKEN_PULSE_COLOR, radius: 1 } }),
    [],
  )
  const consume = useLatentConsumedStore((state) => state.consume)

  // Fixed-capacity flare pool: a slot's seed lives in `positions`, its 0→1 life in `progress`,
  // its rendered size in `scales` (mutated in place, read by the layer each frame).
  const positions = useRef<Float32Array>(new Float32Array(AWAKEN_CAPACITY * 3))
  const scales = useMemo(() => new Float32Array(AWAKEN_CAPACITY), [])
  const channels = useMemo(() => ({ scales }), [scales])
  const progress = useRef<Float32Array>(new Float32Array(AWAKEN_CAPACITY))
  const active = useRef<boolean[]>(Array.from({ length: AWAKEN_CAPACITY }, () => false))

  useEffect(() => {
    // Idempotency comes from the module-level registry (survives remounts), never a component ref.
    const registry = useAwakenRegistryStore.getState()
    const fresh = newNeuronIds.filter((id) => !registry.claimed.has(id))
    if (fresh.length === 0) return
    // Only take what the pool can flare THIS pass — a star is consumed only if it also flares, and
    // an id is claimed only once handled, so an overflowing burst is not lost (the rest retry).
    const freeSlots = active.current.reduce((total, slot) => (slot ? total : total + 1), 0)
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
    if (picks.length === 0) return
    consume(picks)
    for (const index of picks) {
      const slot = active.current.indexOf(false)
      active.current[slot] = true
      progress.current[slot] = 0
      positions.current[slot * 3] = field.positions[index * 3] ?? 0
      positions.current[slot * 3 + 1] = field.positions[index * 3 + 1] ?? 0
      positions.current[slot * 3 + 2] = field.positions[index * 3 + 2] ?? 0
      scales[slot] = 0
    }
    registry.claim(batch)
  }, [newNeuronIds, field, resolveAnchors, consume, scales])

  const onFrame = useCallback(
    (dt: number) => {
      const step = Math.min(dt, AWAKEN_MAX_STEP_S) / AWAKEN_DURATION_S
      for (let slot = 0; slot < AWAKEN_CAPACITY; slot++) {
        if (!active.current[slot]) {
          scales[slot] = 0
          continue
        }
        const next = progress.current[slot] + step
        if (next >= 1) {
          active.current[slot] = false
          progress.current[slot] = 0
          scales[slot] = 0
          continue
        }
        progress.current[slot] = next
        scales[slot] = Math.sin(next * Math.PI) * AWAKEN_PEAK_SIZE
      }
    },
    [scales],
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
      />
    </>
  )
}
