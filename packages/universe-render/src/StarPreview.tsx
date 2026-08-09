import { useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  DEFAULT_STAR_SHAPE,
  InstancedNodeLayer,
  PostFX,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  SkinProvider,
  SpinGroup,
  UniverseCanvas,
  createStarShapeBodySource,
  resolveActiveSkin,
  useSkin,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import type { EpisodicMemory } from '@cosimosi/memory'
import { starChannels } from '@cosimosi/universe'

/** One star, at the origin the canvas camera already looks at. Never written, so it is shared. */
const ORIGIN: CoordinateBufferRef = { current: new Float32Array([0, 0, 0]) }
/**
 * The instance scale the preview draws at, in place of the memory's own size channel.
 *
 * Size in the universe means strength, and it means it by COMPARISON — a star is big next to the
 * others. One star alone has nothing to be bigger than, so carrying the channel through would spend
 * the whole frame saying nothing, and a weak memory would arrive as a speck. The panel states
 * strength as a number instead; here the frame is filled, and tint, brightness and seed stay the
 * real ones. Sized against the canvas camera's fixed distance, not the frame's pixels.
 */
const PREVIEW_SCALE = 28
/** Seconds per turn — slow enough to read as drifting rather than spinning. */
const SPIN_SECONDS = 12

export interface StarPreviewProps {
  readonly memory: EpisodicMemory
  readonly universeTime: string | null
  /** The star-shape registry key; unknown keys resolve to the shipped body, as in the universe. */
  readonly shape?: string
  /** Freezes the drift and the body's living relief, leaving the pose it opened on. */
  readonly reducedMotion?: boolean
}

/**
 * One episodic memory's star, rendered on its own — the same body, channels and light the universe
 * gives it, in a frame small enough to sit inside a panel.
 *
 * It is the star, not a picture of one: the projection is the shared `starChannels`, the body comes
 * through the same asset-source port, and the bloom is the shipped skin's. What it is NOT is a
 * second universe — no emotion sky, no field, no navigation, and no read of the scene's stores. It
 * takes the one memory it is handed.
 *
 * The ground is the skin's bare night rather than a transparent canvas, because the bloom is what
 * makes a star a star and the post chain composites opaque. A panel hosting this should round and
 * clip it, so it reads as a window onto the sky rather than a rectangle cut out of the surface.
 */
export function StarPreview(props: StarPreviewProps) {
  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <PreviewScene {...props} />
    </SkinProvider>
  )
}

// Split from the export so the skin is read INSIDE its own provider. The canvas is a separate React
// root, so every value it needs is captured out here and passed in as props — nothing under it
// reaches back through context.
function PreviewScene({
  memory,
  universeTime,
  shape = DEFAULT_STAR_SHAPE,
  reducedMotion = false,
}: StarPreviewProps) {
  const { skin } = useSkin()
  const source = useMemo(
    () => createStarShapeBodySource(shape, { animate: !reducedMotion }),
    [shape, reducedMotion],
  )
  const channels = useMemo<InstanceChannels>(() => {
    const channel = starChannels(memory, universeTime)
    return {
      scales: new Float32Array([PREVIEW_SCALE]),
      attributes: [
        { name: STAR_INSTANCE_TINT, array: new Float32Array(channel.color), itemSize: 3 },
        {
          name: STAR_INSTANCE_BRIGHTNESS,
          array: new Float32Array([channel.brightness]),
          itemSize: 1,
        },
        { name: STAR_INSTANCE_SEED, array: new Float32Array([channel.seed]), itemSize: 1 },
      ],
      vertexScaleAttribute: STAR_INSTANCE_SCALE,
    }
  }, [memory, universeTime])

  return (
    <UniverseCanvas
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
      dpr={[1, VALUES.rendering.maxPixelRatio]}
    >
      <SpinGroup periodSeconds={SPIN_SECONDS} paused={reducedMotion}>
        <InstancedNodeLayer
          source={source}
          bodyId={shape}
          kind="shader"
          count={1}
          positions={ORIGIN}
          channels={channels}
        />
      </SpinGroup>
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}
