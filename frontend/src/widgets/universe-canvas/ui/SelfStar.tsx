// The central "나" star (spec 38·44) — the universe's anchor. It is NOT a memory: it never
// joins the graph (no edges/KNN/synapses), sits fixed at the origin, and the radial layout
// pulls strong memories close to it and lets faded ones drift outward. One mesh, three+
// selectable forms (appearance.selfObject), each a self-emissive TSL glow the BloomPass blooms
// (no scene directional light → emissive only, the StarField/forms idiom).
//
// Body color = AMBIENT mood (요즘 감정, spec 25·07): "나 = 지금의 나". It is THEME-INDEPENDENT —
// derived from the loaded stars' affect (now R-weighted, spec 07), NOT the chosen background (spec
// 44 A7). No data / unauth / empty universe → background accent fallback. ⚠️ spec-03: this changes
// ONLY the self star's own BODY color (buildSelfForm colorNode). The light the self star CASTS on
// other stars (StarField's reflection channel, star_lighting.self_intensity) stays NEUTRAL — and the
// woven emotion colors live in the background skin (UniverseNebula), not here (no double injection).
// raycast off; reduced-motion freezes the internal flow.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useAppearance, themeAccent, buildSelfForm, type SelfObject } from '@/entities/appearance'
import {
  deriveAmbient,
  ambientToRgb,
  useMemoryStore,
  type AmbientStar,
} from '@/entities/memory'
import { virtualNowMs } from '@/shared/lib/demo'
import { VALUES } from '@/shared/config'

// Sits just inside the strongest memory shell (R_MIN=6, shared/lib/layout) so the closest
// memories ring it without being swallowed.
const SELF_RADIUS = VALUES.selfStar.radius

const NOOP_RAYCAST = () => undefined

/** StarNode[] → the affect-only shape deriveAmbient reads (spec 07: includes recall_count, the
 *  Bjork retrieval-strength R input). The body color derives from the loaded stars directly. */
function ambientStars(
  stars: {
    memory: { mood: string; intensity: number; valence: number; lastRecalledAt: number; recallCount: number }
  }[],
): AmbientStar[] {
  return stars.map((s) => ({
    mood: s.memory.mood,
    intensity: s.memory.intensity,
    valence: s.memory.valence,
    lastRecalledAt: s.memory.lastRecalledAt,
    recallCount: s.memory.recallCount,
  }))
}

export function SelfStar({ selfObject }: { selfObject: SelfObject }) {
  const theme = useAppearance((s) => s.theme)
  const stars = useMemoryStore((s) => s.stars)
  // Body color = ambient mood (theme-independent, A7). No meaningful ambient (empty/unauth/all-faded)
  // → background accent fallback. Derived from the loaded stars (the client ambient summary, spec 25).
  const color = useMemo(() => {
    const amb = deriveAmbient(ambientStars(stars), virtualNowMs())
    const c = new THREE.Color()
    if (stars.length > 0 && (amb.arousal > 0 || amb.sat > 0)) {
      const [r, g, b] = ambientToRgb(amb)
      c.setRGB(r, g, b) // ambient mood meaning-color (linear, mirrors AmbientNebula's setRGB)
    } else {
      c.set(themeAccent(theme)).convertSRGBToLinear() // no data → background accent (neutral-ish)
    }
    return c
  }, [stars, theme])
  const built = useMemo(() => buildSelfForm(selfObject), [selfObject])
  // Push the (possibly ambient) color into the material uniform whenever it changes — no rebuild.
  useEffect(() => {
    built.setColor(color)
  }, [built, color])
  // Dispose GPU resources when the form changes (avoid a leak on re-build).
  useEffect(
    () => () => {
      built.geometry.dispose()
      built.material.dispose()
    },
    [built],
  )

  const updateRef = useRef<((t: number) => void) | null>(null)
  useEffect(() => {
    updateRef.current = built.update
    return () => {
      updateRef.current = null
    }
  }, [built])

  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  useFrame((state) => {
    // Freeze the internal flow under reduced-motion (still rendered, just static).
    updateRef.current?.(reduceMotion ? 0 : state.clock.elapsedTime)
  })

  return (
    <mesh
      geometry={built.geometry}
      material={built.material}
      scale={SELF_RADIUS}
      dispose={null}
      raycast={NOOP_RAYCAST}
      frustumCulled={false}
    />
  )
}
