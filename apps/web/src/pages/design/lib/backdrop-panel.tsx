import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  BACKDROP_THEMES,
  CameraControls,
  DEFAULT_BACKDROP_THEME,
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
  backdropTriangleCost,
  createStarShapeBodySource,
  resolveActiveSkin,
  resolveBackdropTheme,
  useSkin,
  type BackdropThemeKey,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import type { EpisodicMemory } from '@cosimosi/memory'
import {
  SHOWCASE_UNIVERSE_TIME,
  UNIVERSE_CAMERA_ENVELOPE,
  starChannels,
  starFormsShowcaseScene,
  universeEmotionSlices,
} from '@cosimosi/universe'
import { Switch, cx, useReducedMotion } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'

/**
 * The backdrop bench: one themed field at a time, with a handful of real stars in front of it.
 *
 * The stars are the point of the frame. A backdrop is only judgeable against what it sits behind — a
 * field that looks gorgeous empty can still bury a memory's own light, or leave the scene so bare
 * that the universe reads as a diagram — so the specimen keeps the production star body, the emotion
 * sky and the shipped bloom around it, and only the field changes.
 *
 * The sky switch is here for the same reason: half of what a field does is decide how much of the sky
 * behind it survives, and that can only be seen by taking the sky away.
 */

/** Bench magnification: the stars are read at arm's length, not from the universe's own distance. */
const STAR_MAGNIFICATION = 2.6
const REFERENCE_SHAPE = 'facet'
/** How far the motes may be enlarged for inspection. A mote is a few pixels at the universe's own
 *  distance, so a form — a ring, a cross, a dash — can only be told from a dot by growing it. */
const MOTE_MAGNIFICATIONS = [1, 3, 6] as const

export function BackdropPanel() {
  const [themeKey, setThemeKey] = useState<BackdropThemeKey>(DEFAULT_BACKDROP_THEME)
  const [sky, setSky] = useState(true)
  const [animate, setAnimate] = useState(true)
  const [magnification, setMagnification] = useState<number>(1)
  const active = resolveBackdropTheme(themeKey)
  const cost = backdropTriangleCost(active, VALUES.rendering.starFieldCount)

  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {BACKDROP_THEMES.map((theme, index) => {
            const selected = theme.key === active.key
            return (
              <button
                key={theme.key}
                type="button"
                onClick={() => setThemeKey(theme.key)}
                aria-pressed={selected}
                title={theme.blurb}
                className={cx(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  selected
                    ? 'border-primary text-text'
                    : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
                )}
              >
                <span className="mr-1.5 tabular-nums opacity-60">{index + 1}</span>
                {theme.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Switch checked={sky} onCheckedChange={setSky} label={T.backdropSky} />
          <Switch checked={animate} onCheckedChange={setAnimate} label={T.statesMotionLabel} />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
              {T.backdropMoteSize}
            </span>
            {MOTE_MAGNIFICATIONS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMagnification(preset)}
                aria-pressed={preset === magnification}
                className={cx(
                  'inline-flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors',
                  preset === magnification
                    ? 'border-primary text-text'
                    : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
                )}
              >
                {preset}×
              </button>
            ))}
          </div>
        </div>

        <div className="aspect-4/3 overflow-hidden rounded-2xl border border-border bg-bg">
          <BackdropStage
            theme={active.key}
            sky={sky}
            animate={animate}
            magnification={magnification}
          />
        </div>

        <p className="text-sm text-text-muted">{active.blurb}</p>

        {/* The arrangement itself, spelled out: a row IS its four axes plus how much of it there is,
            so a reviewer can see which axis to move rather than asking for "something like that". */}
        <dl className="grid gap-2 text-xs text-text-subtle sm:grid-cols-3 lg:grid-cols-6">
          {[
            { term: T.backdropAxisScatter, detail: active.scatter },
            { term: T.backdropAxisMote, detail: active.mote },
            { term: T.backdropAxisLife, detail: active.life },
            { term: T.backdropAxisTone, detail: active.tone },
            { term: T.backdropAxisDensity, detail: `${active.density}×` },
            { term: T.backdropCost, detail: T.backdropCostValue(cost) },
          ].map(({ term, detail }) => (
            <div key={term}>
              <dt className="text-text-muted">{term}</dt>
              <dd className="tabular-nums">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SkinProvider>
  )
}

function BackdropStage({
  theme,
  sky,
  animate,
  magnification,
}: {
  theme: BackdropThemeKey
  sky: boolean
  animate: boolean
  magnification: number
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const moving = animate && !reducedMotion
  const scene = useMemo(() => starFormsShowcaseScene(), [])
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
      {sky ? <SkySphere stops={skyStops} effect={skin.sky.effect} reducedMotion={!moving} /> : null}
      <StarField theme={theme} sizeScale={magnification} reducedMotion={!moving} />
      <ReferenceStars memories={scene.memories} positions={positions} animate={moving} />
      <CameraControls {...UNIVERSE_CAMERA_ENVELOPE} />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

/** The production channels, unchanged — the field is judged against real stars or against nothing. */
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
      scales[i] = channel.size * STAR_MAGNIFICATION
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
