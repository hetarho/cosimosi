import { useMemo } from 'react'

import {
  DEFAULT_STAR_SHAPE,
  InstancedNodeLayer,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_TINT,
  createStarShapeBodySource,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'

import {
  SPOTLIGHT_STAR_LIFT,
  starChannels,
  useEpisodicMemoryStore,
  useSpotlightStore,
} from '@cosimosi/universe'

export interface StarLayerProps {
  readonly positions: CoordinateBufferRef
  /** The star-shape registry key this universe wears — a decoration choice, not a domain fact.
   *  Unknown keys resolve to the shipped body, so a retired shape never blanks the universe. */
  readonly shape?: string
  /** Memories occupy buffer slots [firstNodeIndex, firstNodeIndex + count) after the neurons. */
  readonly firstNodeIndex: number
  readonly universeTime: string | null
  /** Freezes the seed-derived living relief while preserving each star's static pose. */
  readonly reducedMotion?: boolean
  readonly onFocus?: (index: number) => void
  readonly onFly?: (index: number) => void
}

// The instanced R3F binding for the episodic-memory big star: it reads the domain mirror via
// @x, projects each memory to its four channels (model/), and feeds them as per-instance
// attributes to the shader body through the asset-source port. Channels recompute only when
// the read model / universe time changes — never per frame (§3.3); the coordinate buffer is
// read per frame inside the layer, never here.
export function StarLayer({
  positions,
  shape = DEFAULT_STAR_SHAPE,
  firstNodeIndex,
  universeTime,
  reducedMotion = false,
  onFocus,
  onFly,
}: StarLayerProps) {
  const bodySource = useMemo(
    () => createStarShapeBodySource(shape, { animate: !reducedMotion }),
    [shape, reducedMotion],
  )
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const ids = useEpisodicMemoryStore((state) => state.ids)
  const spotlitIds = useSpotlightStore((state) => state.memoryIds)

  const channels = useMemo<InstanceChannels>(() => {
    const count = ids.length
    const scales = new Float32Array(count)
    const tint = new Float32Array(count * 3)
    const brightness = new Float32Array(count)
    const seed = new Float32Array(count)
    // A spotlight is presentation, not a second reading of the memory: it lifts the brightness these
    // stars are DRAWN at so they out-run the scene dim (SpotlightDim), and touches nothing stored.
    // The lift lands on colour alone — `starLife` clamps at 1, so a lifted star keeps its own motion
    // and forgetting stays the only thing that can still a body.
    const spotlit = spotlitIds.length > 0 ? new Set(spotlitIds) : null
    for (let i = 0; i < count; i++) {
      const memory = byId[ids[i]]
      if (!memory) continue
      const channel = starChannels(memory, universeTime)
      scales[i] = channel.size
      tint[i * 3] = channel.color[0]
      tint[i * 3 + 1] = channel.color[1]
      tint[i * 3 + 2] = channel.color[2]
      brightness[i] = spotlit?.has(memory.id)
        ? channel.brightness * SPOTLIGHT_STAR_LIFT
        : channel.brightness
      seed[i] = channel.seed
    }
    return {
      scales,
      attributes: [
        { name: STAR_INSTANCE_TINT, array: tint, itemSize: 3 },
        { name: STAR_INSTANCE_BRIGHTNESS, array: brightness, itemSize: 1 },
        { name: STAR_INSTANCE_SEED, array: seed, itemSize: 1 },
      ],
      vertexScaleAttribute: STAR_INSTANCE_SCALE,
    }
  }, [byId, ids, universeTime, spotlitIds])

  return (
    <InstancedNodeLayer
      source={bodySource}
      bodyId="star"
      kind="shader"
      count={ids.length}
      positions={positions}
      firstNodeIndex={firstNodeIndex}
      channels={channels}
      onNodeClick={onFocus}
      onNodeDoubleClick={onFly}
    />
  )
}
