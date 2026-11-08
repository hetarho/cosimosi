import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  DEFAULT_STAR_SHAPE,
  InstancedNodeLayer,
  PostFX,
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_TINT,
  SkinProvider,
  SkySphere,
  UniverseCanvas,
  createStarShapeBodySource,
  resolveActiveSkin,
  useSkin,
  type CoordinateBufferRef,
  type InstanceChannels,
} from '@cosimosi/3d-renderer'
import { moodColor, type EmotionSlice } from '@cosimosi/emotion'
import { ObservedErrorBoundary } from '@cosimosi/observability/react'
import { UNIVERSE_CAMERA_RIG, starChannels } from '@cosimosi/universe/scene'
import { tokens, useReducedMotion } from '@cosimosi/ui'

import type { EpisodicMemory } from '@cosimosi/memory'

import { useDocumentVisible } from '../../../shared/lib/document-visibility.ts'

// The camera the slots are staged against: on the z axis looking down −Z at the origin, the canvas's
// straight-down staging pose and the view direction the sky facing turns toward.
const WALKTHROUGH_CAMERA_POSITION = [0, 0, 90] as const

// Where each star stands, by launch order — a staged group portrait, not a simulation. Nearness is
// the slot's z; a handful of stars has no force-sim to emerge positions from, and staging them here
// keeps every coordinate out of the authored content ([I5]). The camera's field of view is vertical,
// so a narrow stage keeps the height and loses width: every slot, with the largest body a star can
// render, stays inside the frame down to a phone-width stage (aspect about 0.95). `poster` is the
// same slot as CSS percentages for the no-WebGPU stand-in.
const WALKTHROUGH_STAR_SLOTS = [
  { position: [-14, 7, 46], poster: [30, 33] },
  { position: [2, -6, 50], poster: [52, 62] },
  { position: [16, 9, 44], poster: [72, 29] },
  { position: [-20, -9, 36], poster: [24, 68] },
  { position: [21, -12, 34], poster: [78, 74] },
  { position: [-8, 16, 38], poster: [40, 16] },
  { position: [10, -18, 40], poster: [62, 84] },
  { position: [22, 15, 32], poster: [80, 18] },
] as const

// The channel projection sizes stars for a whole navigable universe; a framed group shot needs a
// multiplier to read at card size — smaller than the playground's single-star portrait used, since
// up to seven stars share the frame.
const STAR_GROUP_SCALE = 1.6

// The sky turning to a new feeling is the view coming round to one chosen thing, which is what the
// universe camera's focus glide does; the turn takes that glide's pace rather than a 2D UI token.
const SKY_TURN_LAMBDA = UNIVERSE_CAMERA_RIG.glideLambda.focusing

/**
 * The walkthrough's universe: the production canvas, the production sky, the production star body
 * fed by the production channel projection — over the authored story's memories. Nothing here
 * invents a look; every visual fact (size, brightness, colour, form) arrives through `starChannels`
 * and the sky through the slices the model derived, so what the visitor watches dim, return and
 * tint IS the shipped behaviour, not an animation of it.
 */
export interface LandingWalkthroughSceneProps {
  readonly memories: readonly EpisodicMemory[]
  readonly universeTime: string
  readonly skyStops: readonly EmotionSlice[]
  /** Which of `skyStops` the sky turns to face the fixed camera; the poster has no facing. Required
   *  though it may be undefined, so a host that stops forwarding the step's facing fails to compile. */
  readonly skyFacing: number | undefined
}

// Mounted only without reduced motion (see `LandingWalkthroughScene`), so the body always animates.
function WalkthroughCanvas({
  memories,
  universeTime,
  skyStops,
  skyFacing,
  active,
}: LandingWalkthroughSceneProps & { readonly active: boolean }) {
  const { skin } = useSkin()

  const source = useMemo(() => createStarShapeBodySource(DEFAULT_STAR_SHAPE, { animate: true }), [])
  const positions = useMemo<CoordinateBufferRef>(
    () => ({
      current: Float32Array.from(
        memories.flatMap(
          (_, index) => WALKTHROUGH_STAR_SLOTS[index % WALKTHROUGH_STAR_SLOTS.length].position,
        ),
      ),
    }),
    [memories],
  )

  const channels = useMemo<InstanceChannels>(() => {
    const perStar = memories.map((memory) => starChannels(memory, universeTime))
    return {
      scales: Float32Array.from(perStar.map((channel) => channel.size * STAR_GROUP_SCALE)),
      attributes: [
        {
          name: STAR_INSTANCE_TINT,
          array: Float32Array.from(perStar.flatMap((channel) => channel.color)),
          itemSize: 3,
        },
        {
          name: STAR_INSTANCE_BRIGHTNESS,
          array: Float32Array.from(perStar.map((channel) => channel.brightness)),
          itemSize: 1,
        },
        {
          name: STAR_INSTANCE_SEED,
          array: Float32Array.from(perStar.map((channel) => channel.seed)),
          itemSize: 1,
        },
      ],
      vertexScaleAttribute: STAR_INSTANCE_SCALE,
    }
  }, [memories, universeTime])

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      cameraPosition={WALKTHROUGH_CAMERA_POSITION}
      clearColor={skin.sky.night}
      active={active}
    >
      <SkySphere
        stops={skyStops}
        effect={skin.sky.effect}
        facing={skyFacing}
        facingLambda={SKY_TURN_LAMBDA}
      />
      {/* Keyed by count: the steps grow the cast 3 → 7, and remounting on that change is simpler
          and safer than trusting an instanced buffer to resize in place. */}
      <InstancedNodeLayer
        key={memories.length}
        source={source}
        bodyId={DEFAULT_STAR_SHAPE}
        kind="shader"
        count={memories.length}
        positions={positions}
        channels={channels}
      />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

// The default-first-paint / no-WebGPU stand-in: one soft dot per star in its memory's colour, at
// the same slot, with the same effective brightness the shader would draw — and the sky as a faint
// gradient over the same slices the shader's ramp reads, so the story (tinting, dimming with
// neglect, the mirror's tilt) survives on a machine the renderer never reaches.
function WalkthroughPoster({ memories, universeTime, skyStops }: LandingWalkthroughSceneProps) {
  const gradient = posterSkyGradient(skyStops)
  return (
    <div className="relative size-full bg-bg">
      {gradient === null ? null : (
        <div className="absolute inset-0 opacity-35" style={{ background: gradient }} />
      )}
      {memories.map((memory, index) => {
        const channel = starChannels(memory, universeTime)
        const color = moodColor(memory.emotion.mood)
        const slot = WALKTHROUGH_STAR_SLOTS[index % WALKTHROUGH_STAR_SLOTS.length]
        return (
          <div
            key={memory.id}
            className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xs transition-opacity"
            style={{
              left: `${slot.poster[0]}%`,
              top: `${slot.poster[1]}%`,
              backgroundColor: color,
              opacity: channel.brightness,
              boxShadow: `0 0 32px 10px ${color}`,
              transitionDuration: tokens.duration.slow,
              transitionTimingFunction: tokens.ease.standard,
            }}
          />
        )
      })}
    </div>
  )
}

// The slices as hard CSS gradient bands, each holding its normalized share of the width — the same
// weights the shader's ramp reads, so the colour step's arrival and the mirror step's tilt are
// visible facts on the poster too, not shader-only ones.
function posterSkyGradient(skyStops: LandingWalkthroughSceneProps['skyStops']): string | null {
  if (skyStops.length === 0) return null
  const bands: string[] = []
  let at = 0
  for (const stop of skyStops) {
    const from = at
    at += stop.weight * 100
    bands.push(`${stop.color} ${from.toFixed(2)}% ${at.toFixed(2)}%`)
  }
  return `linear-gradient(105deg, ${bands.join(', ')})`
}

// A render-time throw takes the canvas out and leaves the poster beneath it — same posture as the
// hero scene, and for the same reason: retrying WebGPU inside a marketing page buys nothing.
function WalkthroughSceneFallback() {
  return null
}

/**
 * Whether the stage box is on screen, and whether it ever has been. Without an observer (a test DOM,
 * an old engine) the box counts as on screen, so the scene degrades to always-on, never to absent.
 */
function useStageInView(element: RefObject<HTMLDivElement | null>) {
  const [view, setView] = useState({ inView: false, seen: false })
  const observable = typeof IntersectionObserver !== 'undefined'

  useEffect(() => {
    const target = element.current
    if (!target || !observable) return
    const observer = new IntersectionObserver((entries) => {
      const inView = entries.some((entry) => entry.isIntersecting)
      setView((previous) => ({ inView, seen: previous.seen || inView }))
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [element, observable])

  return observable ? view : ALWAYS_IN_VIEW
}

const ALWAYS_IN_VIEW = { inView: true, seen: true } as const

// The poster is the stage until the visitor first reaches it; the canvas mounts over it then and
// stays mounted, so scrolling past and back resumes the same device instead of rebuilding it. The
// loop runs only while the stage is on screen in a visible document. Reduced motion keeps the poster
// alone: the scene's whole difference from it is motion.
export function LandingWalkthroughScene(props: LandingWalkthroughSceneProps) {
  const stage = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion()
  const documentVisible = useDocumentVisible()
  const { inView, seen } = useStageInView(stage)

  return (
    <div ref={stage} className="relative size-full">
      <div className="absolute inset-0">
        <WalkthroughPoster {...props} />
      </div>
      {reducedMotion || !seen ? null : (
        <div className="absolute inset-0">
          <ObservedErrorBoundary fallback={WalkthroughSceneFallback}>
            <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
              <WalkthroughCanvas {...props} active={inView && documentVisible} />
            </SkinProvider>
          </ObservedErrorBoundary>
        </div>
      )}
    </div>
  )
}
