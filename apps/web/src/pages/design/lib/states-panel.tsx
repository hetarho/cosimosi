import { useMemo, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  CameraControls,
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
  createStarShapeBodySource,
  resolveActiveSkin,
  useSkin,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import { createEmotion } from '@cosimosi/emotion'
import type { EpisodicMemory } from '@cosimosi/memory'
import { starChannels, universeEmotionSlices } from '@cosimosi/universe'
import { Switch, useReducedMotion } from '@cosimosi/ui'

import { T } from './showcase-copy.ts'
import { Specimen } from './showcase-shell.tsx'

/**
 * The forgetting row: one memory, drawn as it reads after several lengths of absence.
 *
 * Everything else in the frame is held identical — one mood, one strength, one seed — so the only
 * variable is how long it has been since the memory was returned to. That is the whole point of the
 * specimen: the rubric asks whether forgetting is *readable*, and it can only be read as a
 * difference between neighbours.
 *
 * What differs is light and MOVEMENT. A fading star does not shrink (size is strength's) and does not
 * pale (hue and chroma are the emotion's); its breath quiets instead, until a long-closed memory sits
 * almost still beside one that is still turning. Watch it for a few seconds — a single frame cannot
 * show this specimen's subject, which is exactly why it is here rather than in a screenshot.
 */

/** Days since the last recall, left to right — recent to long closed. */
const ELAPSED_DAYS = [0, 20, 60, 150, 400] as const
const UNIVERSE_TIME = '2026-01-28'
const BASE_STRENGTH = 0.7
/** One mood for the whole row: the specimen is about time, not about feeling. */
const ROW_MOOD = 'CALM' as const
const ROW_SEED = 991_027n
const SPACING = 9

interface ForgettingScene {
  readonly memories: readonly EpisodicMemory[]
  readonly positions: Float32Array
}

/** Wind the created/last-recalled day back by `days` from the scene's universe time. */
function dayBefore(days: number): string {
  const [year, month, day] = UNIVERSE_TIME.split('-').map(Number)
  const at = Date.UTC(year, month - 1, day) - days * 86_400_000
  return new Date(at).toISOString().slice(0, 10)
}

function buildForgettingScene(): ForgettingScene {
  const positions = new Float32Array(ELAPSED_DAYS.length * 3)
  const memories = ELAPSED_DAYS.map((days, i) => {
    positions[i * 3] = (i - (ELAPSED_DAYS.length - 1) / 2) * SPACING
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = 0
    const recalled = dayBefore(days)
    return {
      id: `forgetting-${days}`,
      name: String(days),
      emotion: createEmotion(ROW_MOOD),
      baseStrength: BASE_STRENGTH,
      recallCount: 0,
      createdUniverseTime: recalled,
      lastRecalledUniverseTime: recalled,
      // One seed across the row: the form must be recognisably the same memory at every age, because
      // the form is identity and identity does not fade.
      seed: ROW_SEED,
      activations: [],
      decayStages: [],
      forgettingOffsetDays: 0,
      currentText: ROW_MOOD,
      semanticStage: 0,
    } satisfies EpisodicMemory
  })
  return { memories, positions }
}

export function StatesPanel() {
  const [animate, setAnimate] = useState(true)
  const scene = useMemo(buildForgettingScene, [])

  return (
    <div className="flex flex-col gap-8">
      <Specimen label={T.statesForgettingLabel} note={T.statesForgettingNote}>
        <div className="flex flex-col gap-3">
          <Switch checked={animate} onCheckedChange={setAnimate} label={T.statesMotionLabel} />
          <div className="h-96 overflow-hidden rounded-2xl border border-border">
            <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
              <ForgettingCanvas scene={scene} animate={animate} />
            </SkinProvider>
          </div>
          <ol className="flex justify-between text-xs tabular-nums text-text-subtle">
            {ELAPSED_DAYS.map((days) => (
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
        <p className="text-sm text-text-subtle">{T.statesReviewedLive}</p>
      </Specimen>

      <Specimen label={T.statesAwakenLabel} note={T.statesAwakenNote}>
        <p className="text-sm text-text-subtle">{T.statesReviewedLive}</p>
      </Specimen>
    </div>
  )
}

function ForgettingCanvas({ scene, animate }: { scene: ForgettingScene; animate: boolean }) {
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
      <ForgettingLayer memories={scene.memories} positions={positions} animate={moving} />
      <CameraControls />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

/** The production channels, unchanged — the row is a real projection, not a mock of one. */
function ForgettingLayer({
  memories,
  positions,
  animate,
}: {
  memories: readonly EpisodicMemory[]
  positions: CoordinateBufferRef
  animate: boolean
}) {
  const source = useMemo(() => createStarShapeBodySource('facet', { animate }), [animate])
  const channels = useMemo<InstanceChannels>(() => {
    const count = memories.length
    const scales = new Float32Array(count)
    const tint = new Float32Array(count * 3)
    const brightness = new Float32Array(count)
    const seed = new Float32Array(count)
    memories.forEach((memory, i) => {
      const channel = starChannels(memory, UNIVERSE_TIME)
      scales[i] = channel.size * 2.4
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
      bodyId="facet"
      kind="shader"
      count={memories.length}
      positions={positions}
      channels={channels}
    />
  )
}
