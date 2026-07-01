// SDF (signed distance field) primitives + smooth ops — material for shader-based organic
// forms (metaballs/blobs/self-objects). Pure: coordinate node → distance scalar node.
// (Object family. Mesh displacement is geometry.ts.)
import { vec3, float, length, max, min, clamp, mix } from 'three/tsl'
import { asFloatNode, asVec3Node } from '../tsl'

/** Sphere SDF — signed distance of p from the surface of a radius-r sphere (inside < 0). */
export function sdSphere(p: unknown, r = 1) {
  return length(asVec3Node(p)).sub(r)
}

/** Box SDF — b = half-size vector. Exact corners. */
export function sdBox(p: unknown, b: unknown) {
  const d = asVec3Node(p).abs().sub(asVec3Node(b))
  return length(max(d, vec3(0))).add(min(max(d.x, max(d.y, d.z)), float(0)))
}

/** Smooth union (smin) — rounds two distances together like metaballs. k = roundness (larger blends more). */
export function smin(a: unknown, b: unknown, k = 0.5) {
  const an = asFloatNode(a)
  const bn = asFloatNode(b)
  const kn = float(k)
  const h = clamp(float(0.5).add(bn.sub(an).mul(0.5).div(kn)), float(0), float(1))
  return mix(bn, an, h).sub(kn.mul(h).mul(float(1).sub(h)))
}
