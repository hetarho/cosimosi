import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  Background,
  CameraControls,
  ColorField,
  InstancedNodeLayer,
  PostFX,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  STAR_SHAPES,
  STAR_SHAPE_INSTANCE_SCALE,
  SkinProvider,
  StarField,
  UniverseCanvas,
  createStarShapeBodySource,
  resolveActiveSkin,
  resolveBackgroundNode,
  resolveStarShape,
  useSkin,
  type CoordinateBufferRef,
  type InstanceChannels,
  type StarShapeKey,
} from '@cosimosi/3d-renderer'
import { MOODS, createEmotion, moodColor } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { buildContributors, starChannels } from '@cosimosi/universe'
import { Switch, cx, useReducedMotion } from '@cosimosi/ui'

/**
 * The star-shape bench: a mock universe holding one star per emotion, and a button per candidate
 * look. Picking a look re-resolves the body under the same instanced layer, so all thirteen stars
 * change shape at once while their emotions stay put — the only way to judge whether a form still
 * reads as *that* feeling, and whether thirteen of them together read as a sky rather than a chart.
 *
 * Every star carries the same strength and the same last-recall day on purpose: size and brightness
 * are held equal so shape and emotion are the only variables in the frame. The size buttons scale
 * the whole field at once when a form needs inspecting up close (the camera also flies in — drag to
 * tumble, wheel to zoom).
 *
 * Captions here are demo data, deliberately outside the product i18n catalogue (a dev-only surface).
 */

const T = {
  shapeTitle: 'Star shape',
  sizeTitle: 'Size',
  nebula: 'Emotion nebula',
  emotionsTitle: 'One star per emotion',
}

// Thirteen stars on one ring at z=0: equal distance from the camera, so no star gets a free pass
// from perspective. Wide enough that the largest size preset still leaves space between neighbours.
const RING_RADIUS = 30
const UNIVERSE_TIME = '2026-01-28'
// Held equal across the field — see the panel note. Mid-range strength, recalled today.
const BASE_STRENGTH = 0.7
const SIZE_PRESETS = [1, 2, 3] as const

interface StarShapeScene {
  readonly memories: readonly EpisodicMemory[]
  readonly positions: Float32Array
}

function buildStarShapeScene(): StarShapeScene {
  const positions = new Float32Array(MOODS.length * 3)
  const memories = MOODS.map((mood, i) => {
    const angle = (i / MOODS.length) * Math.PI * 2
    positions[i * 3] = Math.cos(angle) * RING_RADIUS
    positions[i * 3 + 1] = Math.sin(angle) * RING_RADIUS
    positions[i * 3 + 2] = 0
    return {
      id: `shape-${mood.toLowerCase()}`,
      name: mood,
      emotion: createEmotion(mood),
      baseStrength: BASE_STRENGTH,
      recallCount: 0,
      createdUniverseTime: UNIVERSE_TIME,
      lastRecalledUniverseTime: UNIVERSE_TIME,
      // Distinct seeds so the seed-driven looks (relief, veins, needles, per-instance orientation)
      // show their variation instead of thirteen identical copies.
      seed: BigInt(1_000_003 - i * 7_919),
      activations: [],
      decayStages: [],
      forgettingOffsetDays: 0,
      currentText: mood,
      semanticStage: 0,
    } satisfies EpisodicMemory
  })
  return { memories, positions }
}

export function StarShapePanel() {
  const [shape, setShape] = useState<StarShapeKey>('orb')
  const [sizeScale, setSizeScale] = useState<number>(2)
  const [nebula, setNebula] = useState(false)
  const active = resolveStarShape(shape)

  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
            {T.shapeTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            {STAR_SHAPES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setShape(entry.key)}
                aria-pressed={entry.key === active.key}
                title={entry.blurb}
                className={cx(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  entry.key === active.key
                    ? 'border-primary text-text'
                    : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-subtle">{active.blurb}</p>
        </section>

        <section className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
              {T.sizeTitle}
            </span>
            {SIZE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSizeScale(preset)}
                aria-pressed={preset === sizeScale}
                className={cx(
                  'inline-flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors',
                  preset === sizeScale
                    ? 'border-primary text-text'
                    : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
                )}
              >
                {preset}×
              </button>
            ))}
          </div>
          <Switch label={T.nebula} checked={nebula} onCheckedChange={setNebula} />
        </section>

        <div className="aspect-4/3 overflow-hidden rounded-2xl border border-border bg-bg">
          <StarShapeCanvas shape={active.key} sizeScale={sizeScale} nebula={nebula} />
        </div>

        <MoodLegend />
      </div>
    </SkinProvider>
  )
}

// The mock universe itself: a static coordinate buffer (no force-sim here) read per frame by the
// instanced layer exactly like production, with the shipped backdrop and bloom around it so a look
// is judged in the light it will actually ship in.
function StarShapeCanvas({
  shape,
  sizeScale,
  nebula,
}: {
  shape: StarShapeKey
  sizeScale: number
  nebula: boolean
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const backgroundNode = useMemo(() => resolveBackgroundNode(skin.background), [skin.background])
  const scene = useMemo(() => buildStarShapeScene(), [])
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])
  const contributors = useMemo(
    () => buildContributors(scene.memories, { firstNodeIndex: 0 }),
    [scene],
  )

  return (
    <UniverseCanvas dpr={[1, VALUES.rendering.maxPixelRatio]} fov={skin.camera.fov}>
      <Background node={backgroundNode} />
      <StarField reducedMotion={reducedMotion} />
      {nebula ? (
        <ColorField
          positions={positions}
          count={contributors.count}
          nodeIndices={contributors.nodeIndices}
          tints={contributors.tints}
          radii={contributors.radii}
          falloffExponent={VALUES.nebula.falloffExponent}
          baseIntensity={VALUES.nebula.baseIntensity}
          resolution={VALUES.nebula.fieldResolutionWeb}
        />
      ) : null}
      <StarShapeLayer
        shape={shape}
        memories={scene.memories}
        positions={positions}
        sizeScale={sizeScale}
        animate={!reducedMotion}
      />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

// One instanced layer for the whole field, fed the production star channels: the look swaps by
// re-resolving the body, so nothing about how a memory projects onto its star changes with it.
function StarShapeLayer({
  shape,
  memories,
  positions,
  sizeScale,
  animate,
}: {
  shape: StarShapeKey
  memories: readonly EpisodicMemory[]
  positions: CoordinateBufferRef
  sizeScale: number
  animate: boolean
}) {
  const source = useMemo(() => createStarShapeBodySource(shape, { animate }), [shape, animate])
  const channels = useMemo<InstanceChannels>(() => {
    const count = memories.length
    const scales = new Float32Array(count)
    const tint = new Float32Array(count * 3)
    const brightness = new Float32Array(count)
    const seed = new Float32Array(count)
    memories.forEach((memory, i) => {
      const channel = starChannels(memory, UNIVERSE_TIME)
      scales[i] = channel.size * sizeScale
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
        // The shapes displace and turn themselves in body units, so they need the world size the
        // instance matrix applies — the same array, handed over as a readable channel.
        { name: STAR_SHAPE_INSTANCE_SCALE, array: scales, itemSize: 1 },
      ],
    }
  }, [memories, sizeScale])

  return (
    <InstancedNodeLayer
      source={source}
      bodyId={shape}
      kind="shader"
      count={memories.length}
      positions={positions}
      channels={channels}
    />
  )
}

// Which colour is which feeling — the field is only readable as emotions if you can name them.
function MoodLegend() {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
        {T.emotionsTitle}
      </h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {MOODS.map((mood) => (
          <li key={mood} className="flex items-center gap-1.5 text-xs capitalize text-text-muted">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: moodColor(mood) }}
            />
            {mood.toLowerCase()}
          </li>
        ))}
      </ul>
    </section>
  )
}
