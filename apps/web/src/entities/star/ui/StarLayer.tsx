import { useMemo } from 'react'

import {
  InstancedNodeLayer,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  createStarBodySource,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'

import { useEpisodicMemoryStore } from '../../episodic-memory/@x/star.ts'
import { starChannels } from '../model/star-channels.ts'

export interface StarLayerProps {
  readonly positions: CoordinateBufferRef
  /** Memories occupy buffer slots [firstNodeIndex, firstNodeIndex + count) after the neurons. */
  readonly firstNodeIndex: number
  readonly universeTime: string | null
  readonly onFocus?: (index: number) => void
  readonly onFly?: (index: number) => void
}

// The instanced R3F binding for the episodic-memory big star: it reads the domain mirror via
// @x, projects each memory to its four channels (model/), and feeds them as per-instance
// attributes to the shader body through the asset-source port. Channels recompute only when
// the read model / universe time changes — never per frame (§3.3); the coordinate buffer is
// read per frame inside the layer, never here.
export function StarLayer({ positions, firstNodeIndex, universeTime, onFocus, onFly }: StarLayerProps) {
  const bodySource = useMemo(() => createStarBodySource(), [])
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const ids = useEpisodicMemoryStore((state) => state.ids)

  const channels = useMemo<InstanceChannels>(() => {
    const count = ids.length
    const scales = new Float32Array(count)
    const tint = new Float32Array(count * 3)
    const brightness = new Float32Array(count)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const memory = byId[ids[i]]
      if (!memory) continue
      const channel = starChannels(memory, universeTime)
      scales[i] = channel.size
      tint[i * 3] = channel.color[0]
      tint[i * 3 + 1] = channel.color[1]
      tint[i * 3 + 2] = channel.color[2]
      brightness[i] = channel.brightness
      seed[i] = channel.seed
    }
    return {
      scales,
      attributes: [
        { name: STAR_INSTANCE_TINT, array: tint, itemSize: 3 },
        { name: STAR_INSTANCE_BRIGHTNESS, array: brightness, itemSize: 1 },
        { name: STAR_INSTANCE_SEED, array: seed, itemSize: 1 },
      ],
    }
  }, [byId, ids, universeTime])

  return (
    <InstancedNodeLayer
      source={bodySource}
      bodyId="star"
      kind="shader"
      count={ids.length}
      positions={positions}
      firstNodeIndex={firstNodeIndex}
      channels={channels}
      onNodePointerDown={onFocus}
      onNodeDoubleClick={onFly}
    />
  )
}
