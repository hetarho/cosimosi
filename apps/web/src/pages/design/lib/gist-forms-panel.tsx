import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  GIST_SHAPES,
  InstancedNodeLayer,
  PostFX,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  createGistShapeBodySource,
  createStarShapeBodySource,
  resolveActiveSkin,
  resolveGistShape,
  useSkin,
  type CoordinateBufferRef,
  type GistShapeKey,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import type { EpisodicMemory } from '@cosimosi/memory'
import {
  GIST_SHAPE_STAR_MAGNIFICATION,
  SHOWCASE_UNIVERSE_TIME,
  UNIVERSE_CAMERA_ENVELOPE,
  gistShapesShowcaseScene,
  starChannels,
  universeEmotionSlices,
  type GistShowcaseScene,
} from '@cosimosi/universe'
import { Switch, cx, useReducedMotion } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'

/**
 * The gist-shape bench: one look worn by a whole ladder at once, with the episodic memories it
 * summarises sitting below it.
 *
 * Two questions, one frame. Left to right the gist deepens, so the row answers whether a look still
 * reads as the same body losing definition rather than as four different bodies. Top to bottom is the
 * pair, so it answers the harder one: a gist has to read as SIMPLER than the star under it. A look
 * that wins on its own and then out-detais the memory it came from has failed, and that failure is
 * invisible in any frame that shows only gists.
 *
 * The reference stars keep the production body and the real size ratio; nothing here flatters the
 * gist by shrinking the star.
 */

const REFERENCE_SHAPE = 'facet'

export function GistShapePanel() {
  const [shapeKey, setShapeKey] = useState<GistShapeKey>('halo')
  const [stars, setStars] = useState(true)
  const [animate, setAnimate] = useState(true)
  const active = resolveGistShape(shapeKey)

  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {GIST_SHAPES.map((shape, index) => {
            const selected = shape.key === active.key
            return (
              <button
                key={shape.key}
                type="button"
                onClick={() => setShapeKey(shape.key)}
                aria-pressed={selected}
                title={T.gistForms[shape.key].detail}
                className={cx(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  selected
                    ? 'border-primary text-text'
                    : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
                )}
              >
                <span className="mr-1.5 tabular-nums opacity-60">{index + 1}</span>
                {T.gistForms[shape.key].name}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Switch checked={stars} onCheckedChange={setStars} label={T.gistFormsStars} />
          <Switch checked={animate} onCheckedChange={setAnimate} label={T.statesMotionLabel} />
        </div>

        <div className="aspect-4/3 overflow-hidden rounded-2xl border border-border bg-bg">
          <GistShapeStage shape={active.key} stars={stars} animate={animate} />
        </div>

        <p className="text-sm text-text-muted">{T.gistForms[active.key].detail}</p>
        <p className="text-xs text-text-subtle">{T.gistFormsLadder}</p>
      </div>
    </SkinProvider>
  )
}

function GistShapeStage({
  shape,
  stars,
  animate,
}: {
  shape: GistShapeKey
  stars: boolean
  animate: boolean
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const moving = animate && !reducedMotion
  const scene = useMemo(() => gistShapesShowcaseScene(), [])
  const positions = useMemo<CoordinateBufferRef>(
    () => ({ current: scene.positions }),
    [scene.positions],
  )
  const skyStops = useMemo(() => universeEmotionSlices(scene.memories), [scene.memories])

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={skyStops} effect={skin.sky.effect} reducedMotion={!moving} />
      <StarField reducedMotion={!moving} />
      {stars ? (
        <ReferenceStars memories={scene.memories} positions={positions} animate={moving} />
      ) : null}
      <GistShapeLayer shape={shape} scene={scene} animate={moving} />
      <CameraControls {...UNIVERSE_CAMERA_ENVELOPE} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

// One instanced layer for the whole ladder, fed the production gist channels: the look swaps by
// re-resolving the body, so nothing about how a stage projects onto its gist changes with it.
function GistShapeLayer({
  shape,
  scene,
  animate,
}: {
  shape: GistShapeKey
  scene: GistShowcaseScene
  animate: boolean
}) {
  const source = useMemo(() => createGistShapeBodySource(shape, { animate }), [shape, animate])
  const positions = useMemo<CoordinateBufferRef>(
    () => ({ current: scene.gistPositions }),
    [scene.gistPositions],
  )
  const channels = useMemo<InstanceChannels>(
    () => ({
      scales: scene.gistScales,
      attributes: [
        { name: GIST_INSTANCE_TINT, array: scene.gistTints, itemSize: 3 },
        { name: GIST_INSTANCE_DIFFUSE, array: scene.gistSoftness, itemSize: 1 },
      ],
    }),
    [scene],
  )

  return (
    <InstancedNodeLayer
      source={source}
      bodyId={shape}
      kind="shader"
      count={scene.gistCount}
      positions={positions}
      channels={channels}
    />
  )
}

/** The production star channels, unchanged — the gist is judged against a real memory's body. */
function ReferenceStars({
  memories,
  positions,
  animate,
}: {
  memories: readonly EpisodicMemory[]
  positions: CoordinateBufferRef
  animate: boolean
}) {
  const source = useMemo(() => createStarShapeBodySource(REFERENCE_SHAPE, { animate }), [animate])
  const channels = useMemo<InstanceChannels>(() => {
    const count = memories.length
    const scales = new Float32Array(count)
    const tint = new Float32Array(count * 3)
    const brightness = new Float32Array(count)
    const seed = new Float32Array(count)
    memories.forEach((memory, i) => {
      const channel = starChannels(memory, SHOWCASE_UNIVERSE_TIME)
      scales[i] = channel.size * GIST_SHAPE_STAR_MAGNIFICATION
      tint[i * 3] = channel.color[0]
      tint[i * 3 + 1] = channel.color[1]
      tint[i * 3 + 2] = channel.color[2]
      brightness[i] = channel.brightness
      seed[i] = channel.seed
    })
    return {
      scales,
      attributes: [
        { name: STAR_INSTANCE_TINT, array: tint, itemSize: 3 },
        { name: STAR_INSTANCE_BRIGHTNESS, array: brightness, itemSize: 1 },
        { name: STAR_INSTANCE_SEED, array: seed, itemSize: 1 },
      ],
      vertexScaleAttribute: STAR_INSTANCE_SCALE,
    }
  }, [memories])

  return (
    <InstancedNodeLayer
      source={source}
      bodyId={REFERENCE_SHAPE}
      kind="shader"
      count={memories.length}
      positions={positions}
      channels={channels}
    />
  )
}
