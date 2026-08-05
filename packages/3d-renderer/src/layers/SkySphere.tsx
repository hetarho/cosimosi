import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { float, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import {
  buildEmotionGradientTexture,
  updateEmotionGradientTexture,
  type GradientStop,
} from '../assets/sky/emotion-gradient.ts'
import { DEFAULT_SKY_EFFECT, resolveSkyEffect } from '../assets/sky/sky-effects.ts'

// The emotion sky: a large sphere drawn on its INNER surface (BackSide), enclosing the whole
// universe scene, shaded by a TSL effect. Not a flat screen-space wash — a real body wrapping
// the camera, so the background has depth and the effect wraps around as you look about.
// Emotion palette drives the color (via the ramp texture); the effect motion is host-timed so
// reduced motion freezes it at a developed frame.

export interface SkySphereProps {
  /** The universe's emotions (color + weight); reshapes the palette ramp. */
  readonly stops: readonly GradientStop[]
  /** Which effect shades the sphere (defaults to Grainient). A plain key rather than the narrow
   *  union, because the effect a universe wears arrives as an opaque decoration id from outside the
   *  renderer; resolution — including the fallback for a retired key — belongs here (§3.4). */
  readonly effect?: string
  /** Freeze the animation to a static frame. */
  readonly reducedMotion?: boolean
  /**
   * How much faster the sky's own time should run right now, read every frame — 1 at rest.
   *
   * A ref rather than a value because the host writes it per frame during a time acceleration, and a
   * per-frame value may never be React state. The sky is what says time is passing: running its
   * seconds uniform fast is the effect, where a sheet over the canvas would say the transition is
   * happening to the viewer rather than to the place.
   */
  readonly rateRef?: { readonly current: number }
  /** Alpha override; when omitted, the selected effect's generated tuning is used. */
  readonly opacity?: number
  /**
   * Sphere radius. It sits between the star shell and the canvas far plane (see `UniverseCanvas`):
   * the sky is drawn on its INNER surface, so a camera that leaves the sphere loses the background
   * entirely, and a sphere past the far plane is clipped into a hole straight ahead.
   */
  readonly radius?: number
}

const FROZEN_TIME = 12

interface SkyMaterialOptions {
  readonly gradient: THREE.Texture
  readonly time: unknown
  readonly effect: string
  readonly count: number
  readonly weights: readonly number[]
  readonly opacity: number
  readonly headroom: number
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
  headroom,
}: SkyMaterialOptions): THREE.MeshBasicNodeMaterial {
  const mat = new THREE.MeshBasicNodeMaterial()
  const alpha = Math.max(0, Math.min(1, opacity))
  mat.side = THREE.BackSide
  mat.transparent = alpha < 1
  mat.depthWrite = false
  mat.depthTest = true
  mat.opacityNode = float(alpha)
  mat.colorNode = resolveSkyEffect(effect).build({
    gradient,
    time,
    count,
    weights,
    headroom,
  }) as never
  return mat
}

/**
 * Emotion weights as a share of the whole, so the effect reads proportions rather than raw
 * magnitudes. An all-zero (or empty-of-weight) universe spreads evenly instead of dividing by zero.
 */
export function normalizeSkyWeights(stops: readonly GradientStop[]): number[] {
  const total = stops.reduce((sum, stop) => sum + Math.max(stop.weight, 0), 0)
  return stops.map((stop) =>
    total > 0 ? Math.max(stop.weight, 0) / total : 1 / Math.max(stops.length, 1),
  )
}

/**
 * The material memo's key. Fixed precision rather than raw `toString`, so a weight that differs only
 * in float noise below what a shader can express does not buy a recompile.
 */
export function skyWeightsKey(weights: readonly number[]): string {
  return weights.map((weight) => weight.toFixed(6)).join(',')
}

export function SkySphere({
  stops,
  effect = DEFAULT_SKY_EFFECT,
  reducedMotion = false,
  opacity,
  radius = 700,
  rateRef,
}: SkySphereProps) {
  const gradient = useMemo(() => buildEmotionGradientTexture(stops), [])
  const time = useMemo(() => uniform(0), [])
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 96, 48), [radius])

  // Count-structured effects (one line / eye / ring per emotion) bake structure from these, so the
  // material must rebuild when they change — a mere color swap still just repaints the ramp (below).
  const count = stops.length
  const resolved = resolveSkyEffect(effect)
  const effectOpacity = opacity ?? resolved.opacity
  const headroom = resolved.headroom

  // The weights are re-derived from their own VALUE key, so the array's identity moves only when a
  // weight actually moves. `stops` is rebuilt from every GetUniverse response, and keying the
  // material on that identity recompiles the sky's TSL shader on any refetch — including one that
  // carried the same emotions, which is the most expensive work in the scene bought by the cheapest
  // event. Round-tripping through the key rather than memoizing on `stops` keeps the material memo's
  // dependency list honest instead of hiding the real key behind a lint suppression.
  const weightsKey = skyWeightsKey(normalizeSkyWeights(stops))
  const weights = useMemo(() => weightsKey.split(',').map(Number), [weightsKey])

  const material = useMemo(() => {
    return createSkyMaterial({
      gradient,
      time,
      effect,
      count,
      weights,
      opacity: effectOpacity,
      headroom,
    })
  }, [gradient, time, effect, count, weights, effectOpacity, headroom])

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
    // A non-finite or negative rate would strand or rewind the sky, so it is coerced rather than
    // trusted — the host writing it is a rAF loop in another widget.
    const rate = rateRef ? rateRef.current : 1
    time.value += delta * (Number.isFinite(rate) && rate > 0 ? rate : 1)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-3} />
}
