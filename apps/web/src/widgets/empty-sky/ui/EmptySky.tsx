import { useMemo, useRef } from 'react'

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

import { EMPTY_SKY_MOODS, EMPTY_SKY_RATE, EMPTY_SKY_WEIGHTS } from '../config/illustration.ts'

// The committed raster of this same sky. It is an address, not a tuning value.
const POSTER = '/landing-hero.png'

// The universe with nothing in it yet — the emotion sky, and the field the first memory will be drawn
// from. Exactly two layers, and the omissions are deliberate. No episodic layer, no cell body, no
// filament, no colour field, no camera controls, no sim bridge and no frame pump: this is not
// navigable, and a page a stranger passes through is not where the frame budget the demo needs one
// click later should go.
//
// It is honest twice over. It is the same two layers a new account opens on — an illustrative palette
// drifting at an illustrative pace (config/illustration.ts), and nothing invented beyond those two —
// and, because there is no coordinate source here at all, there is no position that any sentence could
// mis-describe as anatomy.
function EmptySkyCanvas() {
  const { skin } = useSkin()
  const reducedMotion = useReducedMotion()

  const stops = useMemo<readonly GradientStop[]>(
    () =>
      EMPTY_SKY_MOODS.map((mood) => ({
        color: moodColor(mood),
        weight: EMPTY_SKY_WEIGHTS[mood] ?? 1,
      })),
    [],
  )

  // The sky reads its rate every frame from a ref, because in the product a rAF loop writes it during
  // a time acceleration. Here it is a constant nothing touches — the illustrative pace, held.
  const rateRef = useRef(EMPTY_SKY_RATE)

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
      <SkySphere stops={stops} reducedMotion={reducedMotion} rateRef={rateRef} />
      <LatentStarField field={field} reducedMotion={reducedMotion} />
    </UniverseCanvas>
  )
}

// The poster is the DEFAULT, not the failure case: a visitor never waits on WebGPU to see the sky, and
// the words over it are readable before any of this resolves. The canvas replaces it once mounted, and
// reduced motion or a renderer that cannot initialize simply leaves it in place.
//
// It is decorative in every place this widget is mounted — a full-bleed ground behind a page's own
// words — so it is hidden from assistive technology rather than described. A backdrop that announced
// itself would be read out before the sentence it exists to sit behind.
function EmptySkyPoster() {
  return (
    <img
      aria-hidden
      src={POSTER}
      alt=""
      className="size-full object-cover"
      // The poster IS the first paint, so it must not be deferred.
      loading="eager"
      decoding="async"
    />
  )
}

/**
 * The empty universe as a ground: the sky a public surface stands on before anyone has a session.
 *
 * It fills whatever box it is given, so a page decides where the sky is — the landing pins it behind
 * the whole scroll and veils it, the sign-in screen holds it still behind one screen — and this owns
 * only what is drawn.
 */
export function EmptySky() {
  const reducedMotion = useReducedMotion()

  // Reduced motion keeps the poster and never mounts the canvas at all — this sky's whole motion is
  // its slow drift, so there is nothing left to honour once it is off.
  if (reducedMotion) return <EmptySkyPoster />

  // The poster sits UNDER the canvas rather than being swapped for it, which is what makes "the poster
  // is the default" true rather than aspirational. It is the first paint, the canvas clears to opaque
  // night over it once the renderer is up, and every way the renderer can fail to arrive — a slow init,
  // a rejected `renderer.init()` that never throws during render, no WebGPU at all — leaves the poster
  // showing with nothing to detect. The boundary below is only for a render-time throw, and it has no
  // `resetKeys` on purpose: retrying WebGPU behind a headline buys nothing.
  return (
    <div className="relative size-full">
      <div className="absolute inset-0">
        <EmptySkyPoster />
      </div>
      <div className="absolute inset-0">
        <ObservedErrorBoundary fallback={EmptySkyFallback}>
          <SkinProvider defaultSkin={resolveActiveSkin(VALUES.rendering.activeSkin)}>
            <EmptySkyCanvas />
          </SkinProvider>
        </ObservedErrorBoundary>
      </div>
    </div>
  )
}

// A render-time throw takes the canvas out and leaves the poster beneath it, so the fallback renders
// nothing of its own. It exists to stop the throw, not to draw a replacement.
function EmptySkyFallback() {
  return null
}
