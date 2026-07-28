import { acos, atan, clamp, cos, dot, float, fract, sin, texture, vec2, vec3 } from 'three/tsl'
import type { Texture } from 'three/webgpu'

import { asFloatNode, asVec2Node } from '../../tsl'
import { skyDir } from './sky-domain.ts'

// The contract every sky recipe is written against, plus the small shared arithmetic that has no home
// on one of the four axes.
//
// A RECIPE is a pure TSL colour-node builder: given the emotion palette ramp and a host-timed seconds
// uniform, it returns the colour the sky sphere paints on its inner surface. It owns a COMPOSITION —
// which domain it reads, which fields it stacks, how the feelings divide it, how the result is
// finished — and it owns no colour of its own. Every colour comes from the emotions, through
// `sky-emotion.ts`; a recipe that samples the ramp at a coordinate of its own invention will hand a
// feature the wrong feeling's hue.
//
// The four axes live in `sky-domain.ts` · `../../shader-art/noise.ts` · `sky-emotion.ts` ·
// `sky-finish.ts`, and a new backdrop is a new arrangement of them. A recipe that needs something none
// of them offers should add a primitive there rather than inline it here, because a primitive
// multiplies across every recipe and an inlined trick helps exactly one.
//
// SEAMLESS BY CONSTRUCTION. Nothing may be sampled by the flat `uv()`, and nothing may flatten the
// sphere onto a plane: either leaves the pinch where the chart gathers — a sheet of paper drawn to a
// point. Read the surface direction instead, through the domain primitives, which have no chart to
// gather.

export interface SkyNodeArgs {
  /** The emotion palette ramp (see `buildEmotionGradientTexture`). */
  readonly gradient: Texture
  /** Seconds-elapsed uniform node (host-controlled; frozen under reduced motion). */
  readonly time: unknown
  /** How many emotions the universe holds. Unrolled at build time — the material is rebuilt when the
   *  count changes — so a recipe may loop over it in plain JS. */
  readonly count: number
  /** Normalized emotion shares, primary-first, summing to 1 (parallel to the ramp's bands). */
  readonly weights: readonly number[]
  /** The ceiling this sky holds itself under, leaving the rest of the range for the light added on top
   *  of it (stars, the nebula field, the bloom pass). Passed to `skyFinish`. */
  readonly headroom?: number
}

/** A sky recipe: palette ramp + time → the sphere's surface colour node. */
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
  return vec3(x, x, x).add(0)
}

/** Seamless radial "radius": the angle (0 at −Z, the view centre → π behind) from the front axis.
 *  Rotationally symmetric, so concentric effects get no seam line — the poles are the pattern's
 *  natural centre and its far convergence. */
export function skyFrontAngle() {
  return acos(clamp(skyDir().z.mul(-1), float(-1), float(1)))
}

/** Longitude angle (−π..π) about the +Y axis. Periodic — use it only through sin/cos to stay
 *  seamless (raw longitude wraps). */
export function skyLongitude() {
  const d = skyDir()
  return atan(d.z, d.x)
}

/** Sample the emotion palette ramp at t∈[0,1]. Prefer `emotionField().colorOf(i)` for a per-emotion
 *  feature: it reads the centre of that feeling's own band, where this reads whatever hue happens to
 *  sit at the coordinate you pass. */
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
