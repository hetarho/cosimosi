import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  BACKDROP_FIELDS,
  BACKDROP_MOTES,
  BACKDROP_THEMES,
  BACKDROP_TRIANGLE_CEILING,
  CameraControls,
  DEFAULT_BACKDROP_FIELD,
  DEFAULT_BACKDROP_MOTE,
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
  resolveBackdropField,
  resolveBackdropMote,
  useSkin,
  type BackdropFieldKey,
  type BackdropMoteKey,
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
 * The backdrop bench: one mote poured into one field, with a handful of real stars in front of it.
 *
 * Two pickers rather than one, because a backdrop is two independent choices. The mote row answers
 * what a single particle is — form, size, colour — and the field row answers what space they fill:
 * where they sit, how many, how their light moves. Every pair is a backdrop, so the bench is the
 * product of the two catalogues rather than a list, and the named pairs are shortcuts into it.
 *
 * The stars are the point of the frame. A backdrop is only judgeable against what it sits behind — a
 * field that looks gorgeous empty can still bury a memory's own light, or leave the scene so bare
 * that the universe reads as a diagram — so the specimen keeps the production star body, the emotion
 * sky and the shipped bloom around it, and only the backdrop changes.
 *
 * The sky switch is here for the same reason: half of what a field does is decide how much of the sky
 * behind it survives, and that can only be seen by taking the sky away.
 *
 * Free combination means the bench can build a pair no product surface may wear: the triangle ceiling
 * binds the named pairs, and here it is REPORTED instead — a mote of four times the topology in the
 * densest field is a real answer to "why not both", and the number is how that answer arrives.
 */

/** Bench magnification: the stars are read at arm's length, not from the universe's own distance. */
const STAR_MAGNIFICATION = 2.6
const REFERENCE_SHAPE = 'facet'
/** How far the motes may be enlarged for inspection. A mote is a few pixels at the universe's own
 *  distance, so a form — a ring, a cross, a dash — can only be told from a dot by growing it. */
const MOTE_MAGNIFICATIONS = [1, 3, 6] as const

/** One bench row: the numbered candidates of a catalogue, so a look can be named by its place. */
function BenchRow<Item extends { readonly key: string; readonly label: string }>({
  title,
  items,
  activeKey,
  onPick,
  blurbOf,
}: {
  title: string
  items: readonly Item[]
  activeKey: string
  onPick: (key: string) => void
  blurbOf: (item: Item) => string
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subtle">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => {
          const selected = item.key === activeKey
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onPick(item.key)}
              aria-pressed={selected}
              title={blurbOf(item)}
              className={cx(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'border-primary text-text'
                  : 'border-border text-text-subtle hover:border-text-subtle hover:text-text',
              )}
            >
              <span className="mr-1.5 tabular-nums opacity-60">{index + 1}</span>
              {item.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function BackdropPanel() {
  const [moteKey, setMoteKey] = useState<BackdropMoteKey>(DEFAULT_BACKDROP_MOTE)
  const [fieldKey, setFieldKey] = useState<BackdropFieldKey>(DEFAULT_BACKDROP_FIELD)
  const [sky, setSky] = useState(true)
  const [animate, setAnimate] = useState(true)
  const [magnification, setMagnification] = useState<number>(1)
  const mote = resolveBackdropMote(moteKey)
  const field = resolveBackdropField(fieldKey)
  const cost = backdropTriangleCost(mote, field, VALUES.rendering.starFieldCount)
  const overCeiling = cost > BACKDROP_TRIANGLE_CEILING

  return (
    <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
      <div className="flex flex-col gap-4">
        <BenchRow
          title={T.backdropMoteBench}
          items={BACKDROP_MOTES}
          activeKey={mote.key}
          onPick={(key) => setMoteKey(key as BackdropMoteKey)}
          blurbOf={(item) => item.blurb}
        />
        <BenchRow
          title={T.backdropFieldBench}
          items={BACKDROP_FIELDS}
          activeKey={field.key}
          onPick={(key) => setFieldKey(key as BackdropFieldKey)}
          blurbOf={(item) => item.blurb}
        />

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
            mote={mote.key}
            field={field.key}
            sky={sky}
            animate={animate}
            magnification={magnification}
          />
        </div>

        <p className="text-sm text-text-muted">{mote.blurb}</p>
        <p className="text-sm text-text-muted">{field.blurb}</p>

        {/* Both halves spelled out, so a reviewer can name the property to move rather than asking for
            "something like that" — and see which of the two catalogues owns it. */}
        <dl className="grid gap-2 text-xs text-text-subtle sm:grid-cols-4">
          {[
            { term: T.backdropAxisForm, detail: mote.form },
            { term: T.backdropAxisSize, detail: `${mote.size}×` },
            { term: T.backdropAxisTone, detail: mote.tone },
            { term: T.backdropCost, detail: T.backdropCostValue(cost) },
            { term: T.backdropAxisScatter, detail: field.scatter },
            { term: T.backdropAxisDensity, detail: `${field.density}×` },
            { term: T.backdropAxisLife, detail: field.life },
            {
              term: T.backdropAxisTwinkle,
              detail: T.backdropTwinkleValue(field.twinkleRate, field.twinkleDepth),
            },
          ].map(({ term, detail }) => (
            <div key={term}>
              <dt className="text-text-muted">{term}</dt>
              <dd className="tabular-nums">{detail}</dd>
            </div>
          ))}
        </dl>

        {overCeiling ? (
          <p className="text-xs text-warning">{T.backdropCostOver(BACKDROP_TRIANGLE_CEILING)}</p>
        ) : null}

        {/* The named pairs, last: they are shortcuts into the product above rather than a third axis,
            so the two catalogues stay the thing being reviewed. */}
        <BenchRow
          title={T.backdropPresets}
          items={BACKDROP_THEMES}
          activeKey={
            BACKDROP_THEMES.find((theme) => theme.mote === mote.key && theme.field === field.key)
              ?.key ?? ''
          }
          onPick={(key) => {
            const preset = BACKDROP_THEMES.find((theme) => theme.key === key)
            if (!preset) return
            setMoteKey(preset.mote)
            setFieldKey(preset.field)
          }}
          blurbOf={(item) => item.blurb}
        />
      </div>
    </SkinProvider>
  )
}

function BackdropStage({
  mote,
  field,
  sky,
  animate,
  magnification,
}: {
  mote: BackdropMoteKey
  field: BackdropFieldKey
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
      <StarField mote={mote} field={field} sizeScale={magnification} reducedMotion={!moving} />
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
