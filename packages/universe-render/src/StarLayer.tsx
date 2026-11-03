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
  starBrightnessChannel,
  starStaticChannels,
  useSpotlightStore,
  type StarStaticChannels,
} from '@cosimosi/universe/scene'
import { useEpisodicMemoryStore } from '@cosimosi/universe'

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

/**
 * One sweep step's channels: the memory set's static arrays as they are, and a brightness the
 * clock (and the spotlight) decided. Keeping `scales`, tint and seed by identity is what lets the
 * layer upload brightness alone and leave every matrix where it was composed.
 */
export function starLayerChannels(
  statics: StarStaticChannels,
  ids: readonly string[],
  universeTime: string | null,
  spotlitIds: readonly string[],
): InstanceChannels {
  const brightness = starBrightnessChannel(statics, universeTime)
  // A spotlight is presentation, not a second reading of the memory: it lifts the brightness these
  // stars are DRAWN at so they out-run the scene dim (SpotlightDim), and touches nothing stored.
  // The lift lands on colour alone — `starLife` clamps at 1, so a lifted star keeps its own motion
  // and forgetting stays the only thing that can still a body.
  if (spotlitIds.length > 0) {
    const spotlit = new Set(spotlitIds)
    for (let i = 0; i < ids.length; i++) {
      if (spotlit.has(ids[i] ?? '')) brightness[i] = (brightness[i] ?? 0) * SPOTLIGHT_STAR_LIFT
    }
  }
  return {
    scales: statics.scales,
    attributes: [
      { name: STAR_INSTANCE_TINT, array: statics.tint, itemSize: 3 },
      { name: STAR_INSTANCE_BRIGHTNESS, array: brightness, itemSize: 1 },
      { name: STAR_INSTANCE_SEED, array: statics.seed, itemSize: 1 },
    ],
    vertexScaleAttribute: STAR_INSTANCE_SCALE,
  }
}

// The instanced R3F binding for the episodic-memory big star: it reads the domain mirror via
// @x, projects each memory to its four channels (model/), and feeds them as per-instance
// attributes to the shader body through the asset-source port. The static channels recompute when
// the read model changes and brightness when universe time does — never per frame (§3.3); the
// coordinate buffer is read per frame inside the layer, never here.
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

  const statics = useMemo(() => starStaticChannels(ids.map((id) => byId[id])), [byId, ids])
  const channels = useMemo(
    () => starLayerChannels(statics, ids, universeTime, spotlitIds),
    [statics, ids, universeTime, spotlitIds],
  )

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
