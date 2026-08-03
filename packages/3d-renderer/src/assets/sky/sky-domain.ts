import {
  acos,
  clamp,
  cos,
  cross,
  dot,
  float,
  normalize,
  positionLocal,
  sin,
  vec2,
  vec3,
} from 'three/tsl'

import { fbm01, ridged, worley } from '../../shader-art/noise.ts'
import { cellEdge } from '../../shader-art/pattern.ts'
import { asFloatNode, asVec3Node } from '../../tsl.ts'

// DOMAIN — the first of the four axes a sky recipe composes (domain · field · emotion · finish).
//
// A domain turns a point on the sky sphere into the coordinates a field is sampled at, and every
// domain here is a function of the surface DIRECTION alone. That is the whole point: a chart that
// flattens the sphere onto a plane must tear or converge somewhere, and on an enclosing sphere that
// convergence is visible as a pinch — a sheet of paper gathered to a point. Direction-only domains
// cannot produce it, because there is no chart to gather. Anything a recipe needs — bands, rings,
// cells, a local 2D patch — is expressed below in terms of the direction, so no recipe has to
// reintroduce one.
//
// Anchors (a feature's centre on the sphere) are plain JS unit vectors, resolved at build time along
// with the emotion count, so a tangent frame costs two constant dot products rather than shader-side
// cross products.

/** A unit direction on the sphere, as plain JS numbers (build-time constant). */
export type SkyAnchor = readonly [number, number, number]

/** The seamless surface direction (unit vector, sphere centre → fragment) — every domain's input.
 *  Continuous everywhere: no wrap line, no pole pinch, and it turns with the camera. */
export function skyDir() {
  return normalize(positionLocal)
}

/** Signed band coordinate about an arbitrary axis: `dot(dir, axis)` in [-1, 1]. Iso-levels of this
 *  are great-circle bands, so a recipe gets stripes, curtains or layers with no seam and no pole —
 *  the axis chooses which way they lie. */
export function skyBand(dir: unknown, axis: SkyAnchor) {
  return dot(asVec3Node(dir), vec3(axis[0], axis[1], axis[2]))
}

/** Angular distance (0 at the anchor → π at its antipode) from a direction to an anchor. The natural
 *  domain for anything radial — rings, bursts, an iris — whose centre IS the anchor, so its one
 *  singular point is exactly where the pattern wants a centre. */
export function skyAngleTo(dir: unknown, anchor: SkyAnchor) {
  return acos(clamp(skyBand(dir, anchor), float(-1), float(1)))
}

/** A tangent basis at an anchor, in JS. Its two axes span the plane the anchor faces, so a recipe can
 *  read local 2D coordinates around a feature without a global chart. */
export function skyTangentFrame(anchor: SkyAnchor): { tangent: SkyAnchor; bitangent: SkyAnchor } {
  // Pick the world axis least aligned with the anchor, so the cross product never degenerates.
  const up: SkyAnchor = Math.abs(anchor[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const tangent = unit(cross3(up, anchor))
  return { tangent, bitangent: unit(cross3(anchor, tangent)) }
}

/** Local 2D coordinates of a direction in an anchor's tangent plane, scaled so one unit is roughly
 *  one radian of arc near the anchor. Valid across the whole cap that faces the anchor; its only
 *  degenerate point is the antipode, a hemisphere away from the feature it describes. */
export function skyLocal2D(dir: unknown, anchor: SkyAnchor, scale = 1) {
  const { tangent, bitangent } = skyTangentFrame(anchor)
  const d = asVec3Node(dir)
  return vec2(skyBand(d, tangent), skyBand(d, bitangent)).mul(scale)
}

/** Spherical cells: 3D Worley sampled on the direction, so the cells tile the sphere itself. Returns
 *  the distance to the nearest cell centre — 0 at a centre, largest at a border. */
export function skyCells(dir: unknown, scale = 3, jitter = 1) {
  return worley(asVec3Node(dir).mul(scale), jitter).f1
}

/** The borders between spherical cells: ~1 on a seam between two cells, 0 inside one. The mask behind
 *  anything that wants a lattice rather than a set of blobs. */
export function skyCellEdge(dir: unknown, scale = 3, sharpness = 8) {
  const { f1, f2 } = worley(asVec3Node(dir).mul(scale))
  return cellEdge(f1, f2, sharpness)
}

/** Soft cloud on the direction: fbm in [0,1]. The general-purpose structure field — thickness,
 *  density, film depth, flow — sampled on the sphere with no seam at any octave. */
export function skyCloud(dir: unknown, scale = 1.8, octaves = 3) {
  return fbm01(asVec3Node(dir).mul(scale), { octaves })
}

/** Ridged cloud on the direction: creases and filaments rather than blobs. */
export function skyRidge(dir: unknown, scale = 1.8, octaves = 3) {
  return ridged(asVec3Node(dir).mul(scale), { octaves })
}

/** Drift a sampling coordinate through the field over time, so structure flows rather than the
 *  sphere's texture sliding under a still field. The offset is a 3D translation of the sample point,
 *  so it has no preferred direction on the surface and introduces no seam.
 *
 *  For NOISE INPUTS ONLY — fbm/worley/gnoise eat unbounded coordinates forever. A coordinate that is
 *  later `normalize()`d must move by `skySpin` instead: a translation accumulates until it dominates
 *  the coordinate, at which point every fragment normalizes to the velocity axis and the sky
 *  collapses to a single value — a wash that quietly dies a few minutes in. */
export function skyDrift(coord: unknown, seconds: unknown, velocity: SkyAnchor) {
  const t = asFloatNode(seconds)
  return asVec3Node(coord).add(vec3(velocity[0], velocity[1], velocity[2]).mul(t))
}

/** Turn a direction about a fixed axis over time — the endless way to move a frame that will be
 *  normalized. Rotation preserves length, so the spun coordinate is as alive at hour three as at
 *  second one, and — being a motion of the sphere's own surface — it introduces no seam. Rodrigues'
 *  formula; the axis is a build-time constant, unit-length by construction here. */
export function skySpin(dir: unknown, seconds: unknown, axis: SkyAnchor, rate = 0.1) {
  const a = unit(axis)
  const axisNode = vec3(a[0], a[1], a[2])
  const angle = asFloatNode(seconds).mul(rate)
  const d = asVec3Node(dir)
  const c = cos(angle)
  const s = sin(angle)
  return d
    .mul(c)
    .add(cross(axisNode, d).mul(s))
    .add(axisNode.mul(dot(axisNode, d)).mul(float(1).sub(c)))
}

// ── JS vector helpers (build-time only) ──────────────────────────────────────────────────────

function cross3(a: SkyAnchor, b: SkyAnchor): SkyAnchor {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function unit(v: SkyAnchor): SkyAnchor {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}
