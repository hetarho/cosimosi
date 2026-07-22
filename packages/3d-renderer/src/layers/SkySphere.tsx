import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { float, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import {
  buildEmotionGradientTexture,
  updateEmotionGradientTexture,
  type GradientStop,
} from '../assets/sky/emotion-gradient.ts'
import {
  DEFAULT_SKY_EFFECT,
  resolveSkyEffect,
  type SkyEffectKey,
} from '../assets/sky/sky-effects.ts'

// The emotion sky: a large sphere drawn on its INNER surface (BackSide), enclosing the whole
// universe scene, shaded by a TSL effect. Not a flat screen-space wash — a real body wrapping
// the camera, so the background has depth and the effect wraps around as you look about.
// Emotion palette drives the color (via the ramp texture); the effect motion is host-timed so
// reduced motion freezes it at a developed frame.

export interface SkySphereProps {
  /** The universe's emotions (color + weight); reshapes the palette ramp. */
  readonly stops: readonly GradientStop[]
  /** Which react-bits-derived effect shades the sphere (defaults to Grainient). */
  readonly effect?: SkyEffectKey
  /** Freeze the animation to a static frame. */
  readonly reducedMotion?: boolean
  /** Alpha override; when omitted, the selected effect's generated tuning is used. */
  readonly opacity?: number
  /** Sphere radius — big enough to enclose the scene. */
  readonly radius?: number
}

const FROZEN_TIME = 12

interface SkyMaterialOptions {
  readonly gradient: THREE.Texture
  readonly time: unknown
  readonly effect: SkyEffectKey
  readonly count: number
  readonly weights: readonly number[]
  readonly opacity: number
}

// Package-internal construction seam: the emotion layer uses normal alpha over the black void and
// never writes depth. It still tests depth because Three renders transparent materials after opaque
// ones; the far sphere must fail behind already-drawn stars instead of washing over them.
export function createSkyMaterial({
  gradient,
  time,
  effect,
  count,
  weights,
  opacity,
}: SkyMaterialOptions): THREE.MeshBasicNodeMaterial {
  const mat = new THREE.MeshBasicNodeMaterial()
  const alpha = Math.max(0, Math.min(1, opacity))
  mat.side = THREE.BackSide
  mat.transparent = alpha < 1
  mat.depthWrite = false
  mat.depthTest = true
  mat.opacityNode = float(alpha)
  mat.colorNode = resolveSkyEffect(effect).build({ gradient, time, count, weights }) as never
  return mat
}

export function SkySphere({
  stops,
  effect = DEFAULT_SKY_EFFECT,
  reducedMotion = false,
  opacity,
  radius = 400,
}: SkySphereProps) {
  const gradient = useMemo(() => buildEmotionGradientTexture(stops), [])
  const time = useMemo(() => uniform(0), [])
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 96, 48), [radius])

  // Count-structured effects (one line / eye / ring per emotion) bake structure from these, so the
  // material must rebuild when they change — a mere color swap still just repaints the ramp (below).
  const count = stops.length
  const weights = useMemo(() => {
    const total = stops.reduce((sum, s) => sum + Math.max(s.weight, 0), 0)
    return stops.map((s) =>
      total > 0 ? Math.max(s.weight, 0) / total : 1 / Math.max(stops.length, 1),
    )
  }, [stops])
  const effectOpacity = opacity ?? resolveSkyEffect(effect).opacity

  const material = useMemo(() => {
    return createSkyMaterial({ gradient, time, effect, count, weights, opacity: effectOpacity })
  }, [gradient, time, effect, count, weights, effectOpacity])

  // Repaint the ramp when the emotions change (no material rebuild).
  useEffect(() => updateEmotionGradientTexture(gradient, stops), [gradient, stops])

  // Dispose each resource only when it is actually replaced (or on unmount) — the material is
  // rebuilt on an effect switch, so its cleanup must NOT take the still-live geometry/gradient with it.
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => gradient.dispose(), [gradient])
  useEffect(() => () => material.dispose(), [material])

  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        time.value = FROZEN_TIME
        frozen.current = true
      }
      return
    }
    frozen.current = false
    time.value += delta
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-3} />
}
