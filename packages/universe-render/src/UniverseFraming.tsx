import { useMemo, useRef } from 'react'
import { VALUES } from '@cosimosi/config'
import {
  SceneFraming,
  type SceneBounds,
  type FrameInsets,
  type CoordinateBufferRef,
} from '@cosimosi/3d-renderer'
import { useEpisodicMemoryStore } from '@cosimosi/universe'
import {
  gistStageOffset,
  UNIVERSE_ARRIVAL_CAMERA_POSITION,
  UNIVERSE_CAMERA_ENVELOPE,
} from '@cosimosi/universe/scene'

export interface UniverseFramingProps {
  readonly positions: CoordinateBufferRef
  readonly memoryIndexById: Readonly<Record<string, number>>
  readonly insets: FrameInsets
  readonly enabled: boolean
  readonly reducedMotion: boolean
  readonly targetRef: { current: [number, number, number] }
  readonly focusMemoryId?: string | null
  readonly onFocusReady?: () => void
}

/** Both memory stores belong in the overview, including the destination of a gist still rising. */
export function UniverseFraming({
  positions,
  memoryIndexById,
  insets,
  enabled,
  reducedMotion,
  targetRef,
  focusMemoryId = null,
  onFocusReady,
}: UniverseFramingProps) {
  const ids = useEpisodicMemoryStore((state) => state.ids)
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const gists = useMemo(
    () =>
      ids.flatMap((id) => {
        const memory = byId[id]
        const index = memoryIndexById[id]
        return memory && memory.semanticStage > 0 && index !== undefined
          ? [
              {
                index,
                lift: Math.max(
                  gistStageOffset(memory.semanticStage),
                  VALUES.forceSim.gistZOffsetMax,
                ),
              },
            ]
          : []
      }),
    [ids, byId, memoryIndexById],
  )
  const bounds = useMemo(
    () => ({
      min: [0, 0, 0] as [number, number, number],
      max: [0, 0, 0] as [number, number, number],
    }),
    [],
  )
  const revision = useRef<{
    buffer: Float32Array | null
    version: number | undefined
    gists: typeof gists | null
  }>({ buffer: null, version: -1, gists: null })
  const getBounds = (): SceneBounds | null => {
    const buffer = positions.current
    if (!buffer || buffer.length === 0) return null
    const focusSlot = focusMemoryId ? memoryIndexById[focusMemoryId] : undefined
    if (focusSlot !== undefined && focusSlot * 3 + 2 < buffer.length) {
      const padding = VALUES.rendering.starSizeMax * 1.75
      for (let axis = 0; axis < 3; axis++) {
        bounds.min[axis] = buffer[focusSlot * 3 + axis]! - padding
        bounds.max[axis] = buffer[focusSlot * 3 + axis]! + padding
      }
      // The same scratch bounds also serves the overview; invalidate its cached projection.
      revision.current.buffer = null
      return bounds
    }
    if (
      revision.current.buffer === buffer &&
      revision.current.version === positions.version &&
      revision.current.gists === gists
    )
      return bounds
    bounds.min.fill(Number.POSITIVE_INFINITY)
    bounds.max.fill(Number.NEGATIVE_INFINITY)
    for (let i = 0; i + 2 < buffer.length; i += 3) {
      for (let axis = 0; axis < 3; axis++) {
        bounds.min[axis] = Math.min(bounds.min[axis]!, buffer[i + axis]!)
        bounds.max[axis] = Math.max(bounds.max[axis]!, buffer[i + axis]!)
      }
    }
    for (const gist of gists) {
      const z = buffer[gist.index * 3 + 2]
      if (z !== undefined) bounds.max[2] = Math.max(bounds.max[2], z + gist.lift)
    }
    const padding = Math.max(VALUES.rendering.starSizeMax, VALUES.rendering.gistStarSizeMax) * 2
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] -= padding
      bounds.max[axis] += padding
    }
    revision.current.buffer = buffer
    revision.current.version = positions.version
    revision.current.gists = gists
    return bounds
  }
  return (
    <SceneFraming
      getBounds={getBounds}
      direction={UNIVERSE_ARRIVAL_CAMERA_POSITION}
      minDistance={focusMemoryId ? 18 : Math.hypot(...UNIVERSE_ARRIVAL_CAMERA_POSITION)}
      maxDistance={UNIVERSE_CAMERA_ENVELOPE.maxDistance}
      insets={insets}
      enabled={enabled}
      reducedMotion={reducedMotion}
      targetRef={targetRef}
      settleKey={focusMemoryId}
      onSettled={focusMemoryId ? onFocusReady : undefined}
    />
  )
}
