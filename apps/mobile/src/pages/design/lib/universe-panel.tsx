import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import {
  ColorField,
  FatLineLayer,
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  InstancedNodeLayer,
  LATENT_FIELD_SEGMENTS,
  PostFX,
  SKY_EFFECTS,
  STAR_FIELD_PROFILE,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  STAR_SHAPES,
  SkinProvider,
  SkySphere,
  StarField,
  UniverseCanvas,
  createCellStarBodySource,
  createFilamentBodySource,
  createGistStarBodySource,
  createStarShapeBodySource,
  resolveActiveSkin,
  resolveSkyEffect,
  useSkin,
  type CoordinateBufferRef,
  type InstanceChannels,
  type SkyEffectKey,
  type StarShapeKey,
} from '@cosimosi/3d-renderer'
import { MAX_SHOWCASE_EMOTIONS, showcaseEmotions } from '@cosimosi/emotion'
import { AwakenNeuron, LatentStarField } from '@cosimosi/universe-render'
import {
  SHOWCASE_ELAPSED_DAYS,
  SHOWCASE_UNIVERSE_TIME,
  ambientShowcaseScene,
  awakenShowcaseField,
  cellStarChannels,
  forgettingShowcaseScene,
  gistShowcaseScene,
  moodRingShowcaseScene,
  starFormsShowcaseScene,
  starChannels,
  universeEmotionSlices,
  useLatentConsumedStore,
} from '@cosimosi/universe'
import { tokens, useReducedMotion } from '@cosimosi/ui'

import { Section, Specimen } from './showcase-shell.tsx'
import { T } from './showcase-copy.ts'

/**
 * The 3D half of the language, on the native showcase.
 *
 * It mirrors the web group rather than reimplementing it: the same recipes, the same bodies and the
 * same fixture scenes off the one TSL source, so a difference between the two surfaces is a real
 * parity finding and not two authors' idea of the same sky. The frame budget is only real on a
 * device, which is why this group exists at all — and the nebula's cloud is the specimen to watch.
 */
export function UniversePanel() {
  return (
    <Section title={T.universeTitle}>
      <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
        <Specimen label={T.starFormsLabel} note={T.starFormsNote}>
          <StarFormsStage />
        </Specimen>
        <Specimen label={T.skyLabel} note={T.skyNote}>
          <SkyStage />
        </Specimen>
        <Specimen label={T.ambientLabel} note={T.ambientNote}>
          <AmbientStage />
        </Specimen>
        <Specimen label={T.nebulaLabel} note={T.nebulaNote}>
          <NebulaStage />
        </Specimen>
        <Specimen label={T.forgettingLabel} note={T.forgettingNote}>
          <ForgettingStage />
        </Specimen>
        <Specimen label={T.gistLabel} note={T.gistNote}>
          <GistStage />
        </Specimen>
        <Specimen label={T.awakenLabel} note={T.awakenNote}>
          <AwakenStage />
        </Specimen>
      </SkinProvider>
    </Section>
  )
}

/** A bench shows all of its dust: consumption belongs to the universe's own field, not this one. */
const NO_CONSUMED_MOTES: ReadonlySet<number> = new Set()

/** The count the sky opens on — a review convenience, not a property of any sky. */
const OPENING_EMOTIONS = 5
/** One quiet feeling behind the body specimens: there, the sky is context rather than subject. */
const BODY_SKY_EMOTIONS = 1

// Bench magnifications, the same ones the web group reads at — a phone is held closer than a
// monitor, but the specimen has to be the same specimen or the parity check means nothing.
const STAR_MAGNIFICATION = 2.4
const NEURON_MAGNIFICATION = 8
const STRAND_MAGNIFICATION = 6
const DUST_MAGNIFICATION = 7

function Canvas({ children }: { children: React.ReactNode }) {
  const { skin } = useSkin()
  return (
    <View style={styles.canvas}>
      <UniverseCanvas
        dpr={[1, VALUES.rendering.maxPixelRatio]}
        fov={skin.camera.fov}
        clearColor={skin.sky.night}
      >
        {children}
      </UniverseCanvas>
    </View>
  )
}

function ChipRow<Value extends string | number>({
  items,
  selected,
  onSelect,
  label,
}: {
  items: readonly { readonly value: Value; readonly label: string }[]
  selected: Value
  onSelect: (value: Value) => void
  label?: string
}) {
  return (
    <View style={styles.chipStack}>
      {label ? <Text style={styles.countLabel}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {items.map((item) => {
            const active = item.value === selected
            return (
              <Pressable
                key={String(item.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect(item.value)}
                style={[styles.chip, active && styles.chipSelected]}
              >
                <Text style={active ? styles.chipTextSelected : styles.chipText}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

/** One candidate body at a time, at the row's own strength — form is the only variable. */
function StarFormsStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const [shape, setShape] = useState<StarShapeKey>(STAR_SHAPES[0].key)
  const scene = useMemo(starFormsShowcaseScene, [])
  const stops = useMemo(() => showcaseEmotions(BODY_SKY_EMOTIONS), [])
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])

  return (
    <View style={styles.stack}>
      <Canvas>
        <SkySphere stops={stops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
        <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
        <EpisodicLayer
          shape={shape}
          memories={scene.memories}
          positions={positions}
          reducedMotion={reducedMotion}
        />
        <PostFX bloom={skin.bloom} />
      </Canvas>
      <ChipRow
        items={STAR_SHAPES.map((entry) => ({ value: entry.key, label: entry.key }))}
        selected={shape}
        onSelect={setShape}
      />
    </View>
  )
}

function SkyStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const [effectKey, setEffectKey] = useState<SkyEffectKey>(skin.sky.effect)
  const [count, setCount] = useState(OPENING_EMOTIONS)
  const active = resolveSkyEffect(effectKey)
  const emotions = useMemo(() => showcaseEmotions(count), [count])

  return (
    <View style={styles.stack}>
      <Canvas>
        <SkySphere stops={emotions} effect={effectKey} reducedMotion={reducedMotion} />
        <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
        <PostFX bloom={skin.bloom} />
      </Canvas>
      <ChipRow
        items={SKY_EFFECTS.map((entry) => ({ value: entry.key, label: entry.label }))}
        selected={effectKey}
        onSelect={setEffectKey}
      />
      <Text style={styles.blurb}>{active.blurb}</Text>
      <ChipRow
        items={Array.from({ length: MAX_SHOWCASE_EMOTIONS }, (_, i) => ({
          value: i + 1,
          label: String(i + 1),
        }))}
        selected={count}
        onSelect={setCount}
        label={T.skyCountLabel}
      />
    </View>
  )
}

/** The three bodies that carry no feeling: the neuron, the strands between them, and the dust. */
function AmbientStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const scene = useMemo(ambientShowcaseScene, [])
  const stops = useMemo(() => showcaseEmotions(BODY_SKY_EMOTIONS), [])
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])
  const cellStarSource = useMemo(() => createCellStarBodySource(), [])
  const filamentSource = useMemo(
    () => createFilamentBodySource({ animate: !reducedMotion }),
    [reducedMotion],
  )
  const widths = useMemo(
    () => Float32Array.from(scene.filaments.widths, (width) => width * STRAND_MAGNIFICATION),
    [scene],
  )

  return (
    <Canvas>
      <SkySphere stops={stops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
      <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
      <LatentStarField
        field={scene.latent}
        reducedMotion={reducedMotion}
        sizeScale={DUST_MAGNIFICATION}
        consumed={NO_CONSUMED_MOTES}
        segments={LATENT_FIELD_SEGMENTS.mobile}
      />
      <InstancedNodeLayer
        source={cellStarSource}
        bodyId="cell-star"
        kind="primitive"
        count={scene.neuronCount}
        positions={positions}
        scale={cellStarChannels().size * NEURON_MAGNIFICATION}
      />
      <FatLineLayer
        source={filamentSource}
        bodyId="filament"
        kind="shader"
        endpointPairs={scene.filaments.endpointPairs}
        count={scene.filaments.count}
        positions={positions}
        widths={widths}
        colors={scene.filaments.colors}
      />
      <PostFX bloom={skin.bloom} />
    </Canvas>
  )
}

/** The mobile tessellation of the colour field — the two-octave cloud on a real GPU budget. */
function NebulaStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const scene = useMemo(moodRingShowcaseScene, [])
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])

  return (
    <Canvas>
      <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
      <ColorField
        positions={positions}
        count={scene.contributors.count}
        nodeIndices={scene.contributors.nodeIndices}
        tints={scene.contributors.tints}
        radii={scene.contributors.radii}
        falloffExponent={VALUES.nebula.falloffExponent}
        baseIntensity={VALUES.nebula.baseIntensity}
        resolution={VALUES.nebula.fieldResolutionMobile}
      />
      <PostFX bloom={skin.bloom} />
    </Canvas>
  )
}

/** One memory at five ages: what differs is light and movement, never size and never hue. */
function ForgettingStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const scene = useMemo(forgettingShowcaseScene, [])
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])
  const stops = useMemo(() => universeEmotionSlices(scene.memories), [scene])

  return (
    <View style={styles.stack}>
      <Canvas>
        <SkySphere stops={stops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
        <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
        <EpisodicLayer
          shape={DEFAULT_SHOWCASE_SHAPE}
          memories={scene.memories}
          positions={positions}
          reducedMotion={reducedMotion}
        />
        <PostFX bloom={skin.bloom} />
      </Canvas>
      <View style={styles.elapsedRow}>
        {SHOWCASE_ELAPSED_DAYS.map((days) => (
          <Text key={days} style={styles.countLabel}>
            {days === 0 ? T.forgettingToday : `${days}d`}
          </Text>
        ))}
      </View>
    </View>
  )
}

const DEFAULT_SHOWCASE_SHAPE: StarShapeKey = 'facet'

/** The pair: one memory remembered, one risen. Height is the statement; the original keeps its light. */
function GistStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const scene = useMemo(gistShowcaseScene, [])
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: scene.positions }), [scene])
  const gistPositions = useMemo<CoordinateBufferRef>(
    () => ({ current: scene.gistPositions }),
    [scene],
  )
  const stops = useMemo(() => universeEmotionSlices(scene.memories), [scene])
  const gistSource = useMemo(() => createGistStarBodySource(), [])
  const gistChannels = useMemo<InstanceChannels>(
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
    <Canvas>
      <SkySphere stops={stops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
      <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
      <EpisodicLayer
        shape={DEFAULT_SHOWCASE_SHAPE}
        memories={scene.memories}
        positions={positions}
        reducedMotion={reducedMotion}
      />
      <InstancedNodeLayer
        source={gistSource}
        bodyId="gist-star"
        kind="shader"
        count={scene.gistCount}
        positions={gistPositions}
        channels={gistChannels}
      />
      <PostFX bloom={skin.bloom} />
    </Canvas>
  )
}

/**
 * The flare, replayable: each press births a new neuron id, because the choreography is idempotent per
 * id — a real launch flares once and never again for that neuron. On a device this is the specimen that
 * answers whether 1.1 seconds is long enough to see.
 */
function AwakenStage() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const [launches, setLaunches] = useState<readonly string[]>([])
  const field = useMemo(awakenShowcaseField, [])

  // The specimen consumes motes through the real store, so it restores exactly what it found: a review
  // surface may not leave the live universe missing dust it never awakened.
  useEffect(() => {
    const before = [...useLatentConsumedStore.getState().consumed]
    return () => {
      const store = useLatentConsumedStore.getState()
      store.reset()
      if (before.length > 0) store.consume(before)
    }
  }, [])

  return (
    <View style={styles.stack}>
      <Canvas>
        <StarField {...STAR_FIELD_PROFILE.mobile} reducedMotion={reducedMotion} />
        <LatentStarField
          field={field}
          reducedMotion={reducedMotion}
          sizeScale={AWAKEN_DUST_SCALE}
          segments={LATENT_FIELD_SEGMENTS.mobile}
        />
        <AwakenNeuron field={field} newNeuronIds={launches} resolveAnchors={NO_ANCHORS} />
        <PostFX bloom={skin.bloom} />
      </Canvas>
      <Pressable
        accessibilityRole="button"
        onPress={() => setLaunches((ids) => [...ids, `showcase-awaken-${ids.length}`])}
        style={[styles.chip, styles.chipAction]}
      >
        <Text style={styles.chipTextSelected}>{T.awakenReplay}</Text>
      </Pressable>
    </View>
  )
}

const AWAKEN_DUST_SCALE = 5
/** The flare picks its seed anywhere in the field, which is what a first neuron does. */
const NO_ANCHORS = () => []

/** The production channels, unchanged — every specimen is a real projection, not a mock of one. */
function EpisodicLayer({
  shape,
  memories,
  positions,
  reducedMotion,
}: {
  shape: StarShapeKey
  memories: ReturnType<typeof forgettingShowcaseScene>['memories']
  positions: CoordinateBufferRef
  reducedMotion: boolean
}) {
  const source = useMemo(
    () => createStarShapeBodySource(shape, { animate: !reducedMotion }),
    [shape, reducedMotion],
  )
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
      bodyId={shape}
      kind="shader"
      count={memories.length}
      positions={positions}
      channels={channels}
    />
  )
}

const styles = StyleSheet.create({
  blurb: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  canvas: {
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    height: 320,
    overflow: 'hidden',
  },
  chip: {
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: tokens.spacing[2],
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipAction: { alignSelf: 'flex-start', borderColor: tokens.color.primary },
  chipSelected: { borderColor: tokens.color.primary },
  chipStack: { gap: 6 },
  chipText: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.sm },
  chipTextSelected: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  countLabel: { color: tokens.color['text-subtle'], fontSize: tokens.fontSize.xs },
  elapsedRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stack: { gap: 12 },
})
