import { useEffect, useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
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
  createGistStarBodySource,
  createStarShapeBodySource,
  resolveActiveSkin,
  useSkin,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import type { EpisodicMemory } from '@cosimosi/memory'
import { AwakenNeuron, LatentStarField } from '@cosimosi/universe-render'
import {
  SHOWCASE_ELAPSED_DAYS,
  SHOWCASE_UNIVERSE_TIME,
  awakenShowcaseField,
  forgettingShowcaseScene,
  gistShowcaseScene,
  starChannels,
  universeEmotionSlices,
  useLatentConsumedStore,
  type ForgettingShowcaseScene,
  type GistShowcaseScene,
} from '@cosimosi/universe'
import { Button, Switch, useReducedMotion } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'
import { Specimen } from './showcase-shell.tsx'

/**
 * The three things a memory can be seen doing, each read as a difference rather than described.
 *
 * Forgetting is a row of one memory at five ages: what differs is light and MOVEMENT, because a
 * fading star may not shrink (size is strength's) and may not pale (hue and chroma are the
 * emotion's). Watch it for a few seconds — a single frame cannot show this specimen's subject.
 *
 * Rising is a pair: the same memory, remembered and abstracted. Height carries the whole statement.
 *
 * Awakening is a flare that hands off: a mote of dust becomes a neuron, once, in place.
 */

/** Bench magnification — the row is read at arm's length, not from the universe's own distance. */
const STAR_MAGNIFICATION = 2.4
const AWAKEN_DUST_SCALE = 5
const SHAPE_KEY = 'facet'

/** The flare picks its seed anywhere in the field, which is what a first neuron does. */
const NO_ANCHORS = () => []

export function StatesPanel() {
  const [animate, setAnimate] = useState(true)
  const forgetting = useMemo(forgettingShowcaseScene, [])
  const gist = useMemo(gistShowcaseScene, [])

  return (
    <div className="flex flex-col gap-8">
      <Specimen label={T.statesForgettingLabel} note={T.statesForgettingNote}>
        <div className="flex flex-col gap-3">
          <Switch checked={animate} onCheckedChange={setAnimate} label={T.statesMotionLabel} />
          <Stage>
            <ForgettingCanvas scene={forgetting} animate={animate} />
          </Stage>
          <ol className="flex justify-between text-xs tabular-nums text-text-subtle">
            {SHOWCASE_ELAPSED_DAYS.map((days) => (
              <li key={days}>{T.statesElapsed(days)}</li>
            ))}
          </ol>
        </div>
      </Specimen>

      {/* The 3D body says nothing here by decision, so what the specimen shows is the 2D treatment
          that does the talking — the same erosion, read up close. */}
      <Specimen label={T.statesWordLossLabel} note={T.statesWordLossNote}>
        <ol className="card-surface flex flex-col gap-2 rounded-2xl p-5">
          {T.statesWordLossStages.map((stage, i) => (
            <li key={stage} className="flex gap-3 text-sm">
              <span className="w-14 shrink-0 text-xs tabular-nums text-text-subtle">
                {T.statesStage(i)}
              </span>
              <span className={i === 0 ? 'text-text' : 'text-text-muted'}>{stage}</span>
            </li>
          ))}
        </ol>
      </Specimen>

      <Specimen label={T.statesGistLabel} note={T.statesGistNote}>
        <div className="flex flex-col gap-3">
          <Stage>
            <GistCanvas scene={gist} animate={animate} />
          </Stage>
          <p className="text-xs text-text-subtle">{T.statesGistLegend}</p>
        </div>
      </Specimen>

      <Specimen label={T.statesAwakenLabel} note={T.statesAwakenNote}>
        <AwakenSpecimen animate={animate} />
      </Specimen>
    </div>
  )
}

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-96 overflow-hidden rounded-2xl border border-border">
      <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
        {children}
      </SkinProvider>
    </div>
  )
}

function ForgettingCanvas({
  scene,
  animate,
}: {
  scene: ForgettingShowcaseScene
  animate: boolean
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const positions = useMemo<CoordinateBufferRef>(
    () => ({ current: scene.positions }),
    [scene.positions],
  )
  const skyStops = useMemo(() => universeEmotionSlices(scene.memories), [scene.memories])
  const moving = animate && !reducedMotion

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={skyStops} effect={skin.sky.effect} reducedMotion={!moving} />
      <StarField reducedMotion={!moving} />
      <EpisodicLayer memories={scene.memories} positions={positions} animate={moving} />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

/**
 * The pair: both memories' episodic bodies on one line, and the risen one's gist bodies above their
 * own original. The original is NOT dimmed — dimming is forgetting's channel, and spending it here
 * would make an abstracted memory look like a neglected one.
 */
function GistCanvas({ scene, animate }: { scene: GistShowcaseScene; animate: boolean }) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const moving = animate && !reducedMotion
  const positions = useMemo<CoordinateBufferRef>(
    () => ({ current: scene.positions }),
    [scene.positions],
  )
  const gistPositions = useMemo<CoordinateBufferRef>(
    () => ({ current: scene.gistPositions }),
    [scene.gistPositions],
  )
  const skyStops = useMemo(() => universeEmotionSlices(scene.memories), [scene.memories])
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
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={skyStops} effect={skin.sky.effect} reducedMotion={!moving} />
      <StarField reducedMotion={!moving} />
      <EpisodicLayer memories={scene.memories} positions={positions} animate={moving} />
      <InstancedNodeLayer
        source={gistSource}
        bodyId="gist-star"
        kind="shader"
        count={scene.gistCount}
        positions={gistPositions}
        channels={gistChannels}
      />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

/**
 * The flare, replayable. Each press births a new neuron id, because the choreography is idempotent
 * per id by design — a real launch flares once and never again for that neuron.
 */
function AwakenSpecimen({ animate }: { animate: boolean }) {
  const [launches, setLaunches] = useState<readonly string[]>([])
  const field = useMemo(awakenShowcaseField, [])

  // The specimen consumes latent motes through the real store, so it restores exactly what it found:
  // a review surface may not leave the live universe missing dust it never awakened.
  useEffect(() => {
    const before = [...useLatentConsumedStore.getState().consumed]
    return () => {
      const store = useLatentConsumedStore.getState()
      store.reset()
      if (before.length > 0) store.consume(before)
    }
  }, [])

  return (
    <div className="flex flex-col gap-3">
      <Button
        color="neutral"
        className="self-start"
        onClick={() => setLaunches((ids) => [...ids, `showcase-awaken-${ids.length}`])}
      >
        {T.statesAwakenReplay}
      </Button>
      <Stage>
        <AwakenCanvas field={field} launches={launches} animate={animate} />
      </Stage>
      <p className="text-xs text-text-subtle">{T.statesAwakenLegend}</p>
    </div>
  )
}

function AwakenCanvas({
  field,
  launches,
  animate,
}: {
  field: ReturnType<typeof awakenShowcaseField>
  launches: readonly string[]
  animate: boolean
}) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()
  const moving = animate && !reducedMotion

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <StarField reducedMotion={!moving} />
      <LatentStarField field={field} reducedMotion={!moving} sizeScale={AWAKEN_DUST_SCALE} />
      <AwakenNeuron field={field} newNeuronIds={launches} resolveAnchors={NO_ANCHORS} />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

/** The production channels, unchanged — every specimen is a real projection, not a mock of one. */
function EpisodicLayer({
  memories,
  positions,
  animate,
}: {
  memories: readonly EpisodicMemory[]
  positions: CoordinateBufferRef
  animate: boolean
}) {
  const source = useMemo(() => createStarShapeBodySource(SHAPE_KEY, { animate }), [animate])
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
      bodyId={SHAPE_KEY}
      kind="shader"
      count={memories.length}
      positions={positions}
      channels={channels}
    />
  )
}
