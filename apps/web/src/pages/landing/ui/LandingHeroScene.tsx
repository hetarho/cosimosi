import { useMemo } from 'react'

import { VALUES } from '@cosimosi/config'
import {
  SkinProvider,
  SkySphere,
  UniverseCanvas,
  resolveActiveSkin,
  useSkin,
  type GradientStop,
} from '@cosimosi/3d-renderer'
import { moodColor } from '@cosimosi/emotion'
import { ObservedErrorBoundary } from '@cosimosi/observability/react'
import { generateLatentField } from '@cosimosi/universe'
import { LatentStarField } from '@cosimosi/universe-render'
import { useReducedMotion } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { HERO_SKY_MOODS, HERO_SKY_WEIGHTS } from '../config/illustration.ts'

const HERO_POSTER = '/landing-hero.png'

// The hero: the universe with nothing in it yet — the emotion sky, and the field the first memory will
// be drawn from. Exactly two layers, and the omissions are deliberate. No episodic layer, no cell body,
// no filament, no colour field, no camera controls, no sim bridge and no frame pump: the hero is not
// navigable, and a marketing page is not where the frame budget the demo needs one click later should
// go.
//
// It is honest twice over. It is literally what a new account looks like, and — because there is no
// coordinate source on the page at all — there is no position here that any sentence could mis-describe
// as anatomy.
function LandingHeroCanvas() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()

  const stops = useMemo<readonly GradientStop[]>(
    () =>
      HERO_SKY_MOODS.map((mood) => ({
        color: moodColor(mood),
        weight: HERO_SKY_WEIGHTS[mood] ?? 1,
      })),
    [],
  )

  const field = useMemo(
    () =>
      generateLatentField({
        seed: VALUES.forceSim.seed,
        count: VALUES.rendering.latentStarCount,
        zMin: VALUES.forceSim.hippocampusZMin,
        zMax: VALUES.forceSim.hippocampusZMax,
        radius: VALUES.rendering.latentFieldRadius,
      }),
    [],
  )

  return (
    <UniverseCanvas
      dpr={[1, VALUES.rendering.maxPixelRatio]}
      fov={skin.camera.fov}
      clearColor={skin.sky.night}
    >
      <SkySphere stops={stops} reducedMotion={reducedMotion} />
      <LatentStarField field={field} reducedMotion={reducedMotion} />
    </UniverseCanvas>
  )
}

// The poster is the DEFAULT, not the failure case: a visitor never waits on WebGPU to see the hero, and
// the headline above it is readable before any of this resolves. The canvas replaces it once mounted,
// and reduced motion or a renderer that cannot initialize simply leaves it in place.
function LandingHeroPoster() {
  return (
    <img
      src={HERO_POSTER}
      alt={m.landing_hero_image_alt()}
      className="size-full object-cover"
      // The poster IS the first paint, so it must not be deferred.
      loading="eager"
      decoding="async"
    />
  )
}

export function LandingHeroScene() {
  const reducedMotion = useReducedMotion()

  // Reduced motion keeps the poster and never mounts the canvas at all — the hero's whole motion is the
  // sky's slow drift, so there is nothing left to honour once it is off.
  if (reducedMotion) return <LandingHeroPoster />

  // The poster sits UNDER the canvas rather than being swapped for it, which is what makes "the poster is
  // the default" true rather than aspirational. It is the first paint, the canvas clears to opaque night
  // over it once the renderer is up, and every way the renderer can fail to arrive — a slow init, a
  // rejected `renderer.init()` that never throws during render, no WebGPU at all — leaves the poster
  // showing with nothing to detect. The boundary below is only for a render-time throw, and it has no
  // `resetKeys` on purpose: retrying WebGPU behind a marketing headline buys nothing.
  return (
    <div className="relative size-full">
      <div className="absolute inset-0">
        <LandingHeroPoster />
      </div>
      <div className="absolute inset-0">
        <ObservedErrorBoundary fallback={HeroSceneFallback}>
          <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
            <LandingHeroCanvas />
          </SkinProvider>
        </ObservedErrorBoundary>
      </div>
    </div>
  )
}

// A render-time throw takes the canvas out and leaves the poster beneath it, so the fallback renders
// nothing of its own. It exists to stop the throw, not to draw a replacement.
function HeroSceneFallback() {
  return null
}
