import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { float, uniform } from 'three/tsl'
import * as THREE from 'three/webgpu'

import {
  buildEmotionGradientTexture,
  updateEmotionGradientTexture,
  type GradientStop,
} from '../assets/sky/emotion-gradient.ts'
import type { SkyFrameSpin } from '../assets/sky/sky-domain.ts'
import { DEFAULT_SKY_EFFECT, resolveSkyEffect, type SkyEffect } from '../assets/sky/sky-effects.ts'
import { emotionAnchors } from '../assets/sky/sky-emotion.ts'
import { SKY_SPHERE_RADIUS } from '../backdrop-scale.ts'
import { REDUCED_MOTION_FROZEN_TIME } from './reduced-motion.ts'

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
  /**
   * Which slice of `stops` the sky turns to face the camera's view direction (−Z): the whole mesh
   * rotates so that slice's `emotionAnchors` direction, the centre of its territory, sits straight
   * ahead. When the effect spins its own frame, the mesh turns with that spin every frame, so the
   * faced territory holds still on screen. Absent, the mesh keeps its identity orientation. A facing
   * that appears or disappears is taken at once, since there is no previous facing to turn from; a
   * change between two slices eases at `facingLambda`. An index outside `stops` faces nothing.
   */
  readonly facing?: number
  /** Exp-damp responsiveness of a turn between two facings, per second (higher is snappier), the
   *  way the camera rig's glides take theirs. Absent or non-positive, the sky takes the new facing at
   *  once, as it does under reduced motion. */
  readonly facingLambda?: number
}

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

/** The camera's view direction: the rig looks down −Z, so this is the sky point at frame centre. */
const VIEW_DIRECTION = new THREE.Vector3(0, 0, -1)

/**
 * The orientation that turns slice `index` of a `count`-slice sky to face the view direction, or
 * null when the index names no slice. The shortest rotation, so a territory near the horizon arrives
 * without a roll; the effects still read the local `skyDir`, so the painted sky turns as one body.
 */
export function skyFacingQuaternion(count: number, index: number): THREE.Quaternion | null {
  if (!Number.isInteger(index) || index < 0 || index >= count) return null
  const [x, y, z] = emotionAnchors(count)[index]
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(x, y, z), VIEW_DIRECTION)
}

// Scratch for `skyFacingAt`, which runs every frame and so allocates nothing.
const spinAxis = new THREE.Vector3()

/**
 * The facing as it stands `seconds` into the sky's clock: the static facing composed with the
 * effect's own frame spin. The shader reads its territories at the spun direction, so turning the
 * mesh by that same spin keeps the faced anchor on the view direction at every moment; without a
 * spin it is the static facing. Written into `out`, since it is evaluated every frame.
 */
export function skyFacingAt(
  facing: THREE.Quaternion,
  spin: SkyFrameSpin | undefined,
  seconds: number,
  out: THREE.Quaternion,
): THREE.Quaternion {
  if (spin === undefined) return out.copy(facing)
  spinAxis.set(spin.axis[0], spin.axis[1], spin.axis[2]).normalize()
  return out.setFromAxisAngle(spinAxis, spin.rate * seconds).premultiply(facing)
}

/** The fraction of the remaining turn one frame of `delta` seconds covers: an exponential approach,
 *  as `MathUtils.damp` takes it, so a turn can be retargeted mid-way at any frame rate. */
export function skyFacingStep(delta: number, lambda: number | undefined): number {
  if (lambda === undefined || !(lambda > 0)) return 1
  return 1 - Math.exp(-lambda * Math.max(delta, 0))
}

/**
 * One frame of the sky's facing, applied to `orientation` in place. `held` says whether a facing was
 * already applied; the return value is the same flag for the next frame. With no goal and nothing
 * held, the orientation is never touched.
 */
export function advanceSkyFacing(
  orientation: THREE.Quaternion,
  goal: THREE.Quaternion | null,
  held: boolean,
  step: number,
): boolean {
  if (goal === null) {
    if (held) orientation.identity()
    return false
  }
  if (held && step < 1) orientation.slerp(goal, step)
  else orientation.copy(goal)
  return true
}

export function SkySphere({
  stops,
  effect = DEFAULT_SKY_EFFECT,
  reducedMotion = false,
  opacity,
  radius = SKY_SPHERE_RADIUS,
  rateRef,
  facing,
  facingLambda,
}: SkySphereProps) {
  // Allocated once and repainted in place: a fresh texture per stops change would orphan a GPU
  // texture AND move the material memo's identity, recompiling the sky's TSL shader on every
  // refetch. It is allocated bare and painted by the layout effect below, so the memo depends on
  // nothing and the ramp is still correct before the first frame draws.
  const gradient = useMemo(() => buildEmotionGradientTexture(), [])
  const time = useMemo(() => uniform(0), [])
  const geometry = useMemo(() => new THREE.SphereGeometry(radius, 96, 48), [radius])

  // Count-structured effects (one line / eye / ring per emotion) bake structure from these, so the
  // material must rebuild when they change — a mere color swap still just repaints the ramp (below).
  const count = stops.length
  const resolved: SkyEffect = resolveSkyEffect(effect)
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

  // Repaint the ramp when the emotions change (no material rebuild). A LAYOUT effect, so the first
  // paint lands before R3F's first rendered frame rather than after it — a passive effect would let
  // one frame draw the unpainted (black) ramp.
  useLayoutEffect(() => updateEmotionGradientTexture(gradient, stops), [gradient, stops])

  // Dispose each resource only when it is actually replaced (or on unmount) — the material is
  // rebuilt on an effect switch, so its cleanup must NOT take the still-live geometry/gradient with it.
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => gradient.dispose(), [gradient])
  useEffect(() => () => material.dispose(), [material])

  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        time.value = REDUCED_MOTION_FROZEN_TIME
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

  const mesh = useRef<THREE.Mesh>(null)
  const staticFacing = useMemo(
    () => (facing === undefined ? null : skyFacingQuaternion(count, facing)),
    [count, facing],
  )
  const facingHeld = useRef(false)
  const facingNow = useMemo(() => new THREE.Quaternion(), [])
  const spin = resolved.spin
  // Registered after the clock's frame above, so the spin is read at the time this frame draws.
  useFrame((_, delta) => {
    const body = mesh.current
    if (!body) return
    const goal = staticFacing && skyFacingAt(staticFacing, spin, time.value, facingNow)
    const step = reducedMotion ? 1 : skyFacingStep(delta, facingLambda)
    facingHeld.current = advanceSkyFacing(body.quaternion, goal, facingHeld.current, step)
  })

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-3}
    />
  )
}
