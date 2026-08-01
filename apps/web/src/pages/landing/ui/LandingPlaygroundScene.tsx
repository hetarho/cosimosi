import { useMemo } from 'react'

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
import { moodColor } from '@cosimosi/emotion'
import { ObservedErrorBoundary } from '@cosimosi/observability/react'
import { starChannels, universeEmotionSlices } from '@cosimosi/universe'
import { useReducedMotion } from '@cosimosi/ui'

import type { EpisodicMemory } from '@cosimosi/memory'

// One star, straight ahead, near enough to be a portrait rather than a sky. The camera is the
// production rig (fixed at z=90), so nearness is the star's coordinate — the one number that is
// staged here rather than domain-derived, because a single-star scene has no force-sim to emerge
// a position from.
const STAR_COORDINATES = Float32Array.of(0, 0, 52)
// The channel projection sizes stars for a whole navigable universe; a portrait frame needs the
// same multiplier the star-shape bench uses to inspect a form up close.
const STAR_PORTRAIT_SCALE = 2.5

/**
 * The playground's universe: the production canvas, the production sky, the production star body
 * fed by the production channel projection — with exactly one memory in it. Nothing here invents a
 * look; every visual fact (size, brightness, colour, form) arrives through `starChannels`, so what
 * the visitor watches dim and return is the shipped behaviour, not an animation of it.
 */
export interface LandingPlaygroundSceneProps {
  readonly memory: EpisodicMemory
  readonly universeTime: string
}

function PlaygroundCanvas({ memory, universeTime }: LandingPlaygroundSceneProps) {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()

  const source = useMemo(
    () => createStarShapeBodySource(DEFAULT_STAR_SHAPE, { animate: !reducedMotion }),
    [reducedMotion],
  )
  const positions = useMemo<CoordinateBufferRef>(() => ({ current: STAR_COORDINATES }), [])
  // The sky mirrors what the universe holds — here, one memory, so one feeling's tint.
  const skyStops = useMemo(() => universeEmotionSlices([memory]), [memory])

  const channels = useMemo<InstanceChannels>(() => {
    const channel = starChannels(memory, universeTime)
    return {
      scales: Float32Array.of(channel.size * STAR_PORTRAIT_SCALE),
      attributes: [
        { name: STAR_INSTANCE_TINT, array: Float32Array.of(...channel.color), itemSize: 3 },
        { name: STAR_INSTANCE_BRIGHTNESS, array: Float32Array.of(channel.brightness), itemSize: 1 },
        { name: STAR_INSTANCE_SEED, array: Float32Array.of(channel.seed), itemSize: 1 },
      ],
      vertexScaleAttribute: STAR_INSTANCE_SCALE,
    }
  }, [memory, universeTime])

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={skyStops} effect={skin.sky.effect} reducedMotion={reducedMotion} />
      <InstancedNodeLayer
        source={source}
        bodyId={DEFAULT_STAR_SHAPE}
        kind="shader"
        count={1}
        positions={positions}
        channels={channels}
      />
      <PostFX bloom={skin.bloom} />
    </UniverseCanvas>
  )
}

// The default-first-paint / no-WebGPU stand-in: a soft dot in the memory's colour whose opacity is
// the same effective brightness the shader would draw, over the bare night. The story — dimming
// with neglect, returning on recall — survives on a machine the renderer never reaches.
function PlaygroundPoster({ memory, universeTime }: LandingPlaygroundSceneProps) {
  const channel = starChannels(memory, universeTime)
  const color = moodColor(memory.emotion.mood)
  return (
    <div className="relative size-full bg-bg">
      <div
        className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xs transition-opacity duration-300"
        style={{
          backgroundColor: color,
          opacity: channel.brightness,
          boxShadow: `0 0 48px 16px ${color}`,
        }}
      />
    </div>
  )
}

// A render-time throw takes the canvas out and leaves the poster beneath it — same posture as the
// hero scene, and for the same reason: retrying WebGPU inside a marketing page buys nothing.
function PlaygroundSceneFallback() {
  return null
}

export function LandingPlaygroundScene({ memory, universeTime }: LandingPlaygroundSceneProps) {
  return (
    <div className="relative size-full">
      <div className="absolute inset-0">
        <PlaygroundPoster memory={memory} universeTime={universeTime} />
      </div>
      <div className="absolute inset-0">
        <ObservedErrorBoundary fallback={PlaygroundSceneFallback}>
          <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
            <PlaygroundCanvas memory={memory} universeTime={universeTime} />
          </SkinProvider>
        </ObservedErrorBoundary>
      </div>
    </div>
  )
}
