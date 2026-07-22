import {
  acos,
  atan,
  clamp,
  cos,
  dot,
  float,
  fract,
  max,
  normalize,
  positionLocal,
  sin,
  texture,
  vec2,
  vec3,
} from 'three/tsl'
import type { Texture } from 'three/webgpu'

import { asFloatNode, asVec2Node, asVec3Node } from '../../tsl'

// The shared contract every emotion-sky effect is written against. An effect is a pure TSL
// color-node builder: given the emotion palette ramp + a host-timed seconds uniform, it returns
// the color the sky-sphere paints on its inner surface. It samples COLOR from the ramp (so the
// universe's emotions drive the hue and the emotion COUNT reshapes the zones) and owns only its
// STRUCTURE and MOTION — faithful to the react-bits source it ports.
//
// SEAMLESS DOMAIN. An effect must NOT be sampled by the flat equirect `uv()` — that leaves a visible
// wrap seam (where u=0 meets u=1) and pinch points at the poles ("2D unrolled onto a sphere"). Drive
// every effect from the 3D surface DIRECTION instead: `skyDir()` for 3D-noise/raymarch effects (no
// seam, no pole, and it wraps as the camera looks about), and `skyStereo()` — a stereographic chart
// with its single singularity tucked behind the viewer — for the inherently-2D/radial ones.

export interface SkyNodeArgs {
  /** The emotion palette ramp (see buildEmotionGradientTexture). */
  readonly gradient: Texture
  /** Seconds-elapsed uniform node (host-controlled; frozen under reduced motion). */
  readonly time: unknown
  /** How many emotions the universe holds. Count-structured effects (one line / eye / ring per
   *  emotion) read it to shape their STRUCTURE; continuous effects ignore it. It is a plain JS number
   *  because the effect loops unroll at build time — the material is rebuilt when the count changes. */
  readonly count: number
  /** Normalized emotion shares, primary-first, summing to 1 (parallel to the ramp bands). Intensity-
   *  structured effects size their per-emotion feature (eye radius, ring width) by `weights[i]`. */
  readonly weights: readonly number[]
}

/** A sky effect builder: palette ramp + time → the sphere's surface color node. */
export type SkyNodeBuilder = (args: SkyNodeArgs) => unknown

/** The time uniform as a seconds float node, optionally scaled. */
export function skySeconds(time: unknown, speed = 1) {
  return float(time as never).mul(speed)
}

// Accumulator seeds. A bare `float(0)` / `vec3(0)` infers as a narrow const-var node the TSL types
// won't let you reassign; the identity `.add(0)` widens it to the operator-node type a JS-unrolled
// shader loop reassigns into. (Runtime is a constant fold — free.)

/** A float accumulator seed, typed broadly for reassignment in a JS-unrolled loop. */
export function floatAcc(x = 0) {
  return asFloatNode(x).add(0)
}

/** A vec3 accumulator seed, typed broadly for reassignment in a JS-unrolled loop. */
export function vec3Acc(x = 0) {
  return asVec3Node(x).add(0)
}

/** The seamless 3D surface direction (unit vector, sphere centre → fragment). Continuous
 *  everywhere — no equirect wrap seam, no pole pinch — and it wraps as the camera turns. The domain
 *  for 3D-noise effects and for raymarch ray directions. */
export function skyDir() {
  return normalize(positionLocal)
}

/** Stereographic chart of the surface direction → a 2D plane, projected from the +Z pole so its one
 *  singularity sits at +Z — behind the default view (the camera sits at +Z looking down −Z, so the
 *  view centre is −Z). Seamless — no wrap line — for the inherently-2D and radial effects that face
 *  the viewer. `zoom` > 1 pulls the field in. */
export function skyStereo(zoom = 1) {
  const d = skyDir()
  return d.xy.div(max(float(1).sub(d.z), float(1e-3))).div(zoom)
}

/** Seamless radial "radius": the angle (0 at −Z, the view centre → π behind) from the front axis.
 *  Rotationally symmetric, so concentric/radial effects get no seam line — the poles are the
 *  pattern's natural centre and its far convergence. */
export function skyFrontAngle() {
  return acos(clamp(skyDir().z.mul(-1), float(-1), float(1)))
}

/** Longitude angle (−π..π) about the +Y axis. Periodic — use it only through sin/cos to stay
 *  seamless (raw longitude wraps). */
export function skyLongitude() {
  const d = skyDir()
  return atan(d.z, d.x)
}

/** Sample the emotion palette ramp at t∈[0,1] → the emotion color for that zone. */
export function sampleRamp(gradient: Texture, t: unknown) {
  return texture(gradient, vec2(clamp(asFloatNode(t), float(0), float(1)), 0.5)).rgb
}

/** Fine film grain keyed off the 3D surface direction (not the flat UV, which would seam) — a
 *  whisper of texture so flats never band. */
export function filmGrain(amp = 0.05) {
  const g = fract(sin(dot(skyDir().mul(300), vec3(12.9898, 78.233, 45.164))).mul(43758.5453))
  return g.sub(0.5).mul(amp)
}

/** Cheap 2D value hash → [0,1]. */
export function hash21(p: unknown) {
  return fract(sin(dot(asVec2Node(p), vec2(127.1, 311.7))).mul(43758.5453))
}

/** Hash a vec3 → [0,1] — the exact `hash` react-bits' Ferrofluid uses (`.zyx` swizzle variant). */
export function hash13(p: unknown) {
  const a = fract(asVec3Node(p).mul(0.1031))
  const b = a.add(dot(a, a.zyx.add(33.33)))
  return fract(b.x.add(b.y).mul(b.z))
}

/** 2D value noise ([0,1]) with cosine (smootherstep-ish) interpolation — organic base grain. */
export function valueNoise(p: unknown) {
  const pv = asVec2Node(p)
  const i = pv.sub(fract(pv))
  const f = fract(pv)
  const u = f.mul(f).mul(float(3).sub(f.mul(2)))
  const a = hash21(i)
  const b = hash21(i.add(vec2(1, 0)))
  const c = hash21(i.add(vec2(0, 1)))
  const d = hash21(i.add(vec2(1, 1)))
  const x1 = a.add(b.sub(a).mul(u.x))
  const x2 = c.add(d.sub(c).mul(u.x))
  return x1.add(x2.sub(x1).mul(u.y))
}

/** Rotate a 2D coordinate node by an angle node. */
export function spin(v: unknown, angle: unknown) {
  const p = asVec2Node(v)
  const a = asFloatNode(angle)
  const c = cos(a)
  const s = sin(a)
  return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c)))
}

/** The safe, premium finish shared across the effects: gentle contrast, a grain whisper, clamp. */
export function skyFinish(color: unknown, { contrast = 1.1, grain = 0.04 } = {}) {
  const c = asVec3Node(color)
  const contrasted = c.sub(0.5).mul(contrast).add(0.5).add(filmGrain(grain))
  return clamp(contrasted, float(0), float(1))
}
