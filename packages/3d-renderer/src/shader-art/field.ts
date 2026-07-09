// Spatial transforms — the same noise becomes a different pattern when you bend the
// coordinates. Base of spirals, vortices, symmetry, turbulence. All pure: take a
// coordinate node, return a transformed coordinate/scalar node.
import {
  vec2,
  vec3,
  float,
  atan,
  asin,
  cos,
  sin,
  mod,
  log,
  length,
  clamp,
  abs,
  max,
} from 'three/tsl'
import { asFloatNode, asVec2Node, asVec3Node } from '../tsl'
import { fbm } from './noise'

export interface DomainWarpOptions {
  /** How hard the coordinates bend — larger swirls the pattern (small = calm, even grain). */
  amount?: number
  /** Warp-noise octaves. */
  octaves?: number
}

/** Domain warp — bends the coordinates themselves with fbm. Marble/fluid/smoke vortices. */
export function domainWarp(p: unknown, { amount = 0.6, octaves = 3 }: DomainWarpOptions = {}) {
  const pv = asVec3Node(p)
  // three fbms at different offsets twist the grid (offsets are arbitrary constants that keep the grains from overlapping).
  const wx = fbm(pv, { octaves })
  const wy = fbm(pv.add(vec3(5.2, 1.3, 2.7)), { octaves })
  const wz = fbm(pv.add(vec3(1.7, 9.2, 3.1)), { octaves })
  return pv.add(vec3(wx, wy, wz).mul(amount))
}

/** Unit direction vector → spherical coords. lon=longitude (-π..π), lat=latitude (-π/2..π/2). Base of radial/symmetric patterns. */
export function toSpherical(dir: unknown) {
  const d = asVec3Node(dir)
  return {
    lon: asFloatNode(atan(d.z, d.x)),
    lat: asFloatNode(asin(clamp(d.y, float(-1), float(1)))),
  }
}

/** 2D vector → polar coords. angle (-π..π), radius (distance to origin). */
export function polar(v: unknown) {
  const p = asVec2Node(v)
  return { angle: asFloatNode(atan(p.y, p.x)), radius: asFloatNode(length(p)) }
}

export interface LogSpiralOptions {
  /** Number of spiral arms — integer multiplied into angle. */
  arms?: number
  /** How tightly arms wind — log(radius) coefficient. Larger winds tighter. */
  twist?: number
}

/** Log-spiral phase — angle·arms + log(radius)·twist. Feed through sin to get arms.
 *  Spiral galaxies/whirlpools. Clamps radius to avoid log blowup at the center. */
export function logSpiral(
  angle: unknown,
  radius: unknown,
  { arms = 5, twist = 1 }: LogSpiralOptions = {},
) {
  return asFloatNode(angle)
    .mul(arms)
    .add(log(max(asFloatNode(radius), float(1e-3))).mul(twist))
}

/** Kaleidoscope fold — folds the angle into segments with mirror symmetry. Mandalas/sacred geometry. Returns the folded angle (0..π/segments). */
export function kaleido(angle: unknown, segments = 6) {
  const seg = float((Math.PI * 2) / segments)
  return abs(mod(asFloatNode(angle), seg).sub(seg.mul(0.5)))
}

/** 2D rotation — spin a pattern by time, etc. */
export function rotate2(v: unknown, angle: unknown) {
  const p = asVec2Node(v)
  const a = asFloatNode(angle)
  const c = cos(a)
  const s = sin(a)
  return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c)))
}
