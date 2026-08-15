// Gist-shape catalogue — the LOOKS the neocortical gist body can wear, so the way an abstracted
// memory reads is chosen by eye instead of argued in the abstract. Not a bench-only list: the
// universe's own gist bodies are built from a key out of this registry, and until one is decorated
// that key is DEFAULT_GIST_SHAPE — the look an undecorated universe wears, owned here rather than
// by config, exactly as DEFAULT_SKY_EFFECT and DEFAULT_STAR_SHAPE are.
//
// A gist is the SUMMARY of a memory, and every form here has to look like one. Three rules hold that
// line, and they are what make this catalogue deliberately plainer than the star bench:
//
//   1. NO SEED. A gist body reads no per-instance form channel, so every gist in a universe is the
//      same shape [V5]. An episodic star's silhouette is its own — that is the whole point of the
//      seed-form — and a gist that also had a private shape would be claiming an identity it does not
//      have. What distinguishes one gist from another is its emotion tint and its depth, nothing else.
//   2. ONE IDEA EACH. A form is a single graph — a falloff, a band, a step, a gradient — never a
//      stack of them. A summary that took three compounded noise fields to draw would be describing
//      more than it knows.
//   3. NO GEOMETRY OF ITS OWN. Nothing here moves a vertex; every form is light on the same unit
//      sphere the plainest one wears, and no form may cost more triangles than that sphere. Softness
//      is a property of light, so the forms differ in how they are LIT rather than in what they are.
//
// Every entry reads the same two per-instance channels the shipped gist body reads — tint and
// softness — so a look can be swapped under a live universe without touching any layer, and a deeper
// gist stage still reads as more diffuse whichever look is worn.
//
// TSL only (one source → WGSL + GLSL, §3.3). The graph constants here are the looks' visual grammar —
// falloff, width, gain — not values.yaml tuning.
import {
  float,
  normalGeometry,
  normalView,
  normalize,
  positionGeometry,
  vec2,
  vec3,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { isoLine } from '../../shader-art/pattern.ts'
import { asFloatNode, attributeFloatNode, attributeVec3Node } from '../../tsl.ts'
import {
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  createGistStarBodySource,
} from './gist-star-body.ts'

export interface GistShape {
  /** Stable id (kebab-case), also the body id the layer requests. */
  readonly key: string
  /** Builds this look's body source; each resolve yields a fresh mesh (the layer owns disposal). */
  readonly source: () => VisualBodySource
}

/** The one shell every form is lit on. Its triangle count is also the ceiling: a form that wanted a
 *  finer sphere would be spending vertices on a body that has no surface to resolve. */
const SPHERE_SEGMENTS = 20

function sphere(): THREE.SphereGeometry {
  return new THREE.SphereGeometry(1, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
}

/** The gist softness channel, bounded — deeper stages feed a higher value, and every form reads it
 *  as "how much less defined is this". */
function gistSoftness() {
  return attributeFloatNode(GIST_INSTANCE_DIFFUSE).clamp(0, 1)
}

interface GistInputs {
  readonly tint: ReturnType<typeof attributeVec3Node>
  readonly soft: ReturnType<typeof gistSoftness>
}

function gistInputs(): GistInputs {
  return { tint: attributeVec3Node(GIST_INSTANCE_TINT), soft: gistSoftness() }
}

/** How much of the silhouette faces the viewer: 1 at its centre, 0 at the limb. Every radial form is
 *  built on this, because on a body with no surface it is the only shape there is. */
function facing() {
  return normalView.z.abs().clamp(0, 1)
}

/** Ease an exponent from sharp toward soft as the gist deepens, so one number carries "more
 *  gistified" in whatever the form happens to draw with it. */
function softened(value: GistInputs['soft'], sharp: number, hazy: number) {
  return float(sharp).sub(value.mul(sharp - hazy))
}

/** Additive haze that never occludes: gist bodies layer over the scene without punching holes in each
 *  other or in the hippocampus below. Depth is still TESTED — a gist behind a star stays behind. */
function haze(material: THREE.MeshBasicNodeMaterial): THREE.MeshBasicNodeMaterial {
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  return material
}

/** Wrap a mesh builder as a body source — a fresh mesh per resolve, as the port requires. */
function meshSource(build: () => THREE.Mesh): VisualBodySource {
  return { resolve: build }
}

// ── the looks ────────────────────────────────────────────────────────────────────────────────

// Bead: the same falloff pulled tight. The light collects into a small defined centre, so the body
// reads as a thing rather than a breath — the hardest-edged gist the rules allow.
function buildBeadBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const falloff = facing().pow(softened(soft, 7, 2.4))
  material.colorNode = tint.mul(falloff).mul(float(2.4))
  material.opacityNode = falloff.mul(float(0.9)).add(float(0.08))
  return new THREE.Mesh(sphere(), material)
}

// Ring: an annulus lying FLAT. The light sits in a band around the body's own equator rather than
// around its silhouette, so the ring is level with the ground and its axis is the universe's up —
// z, the axis a gist rises along. Seen from above it is an outline with an empty middle; seen level,
// one thin line. Measuring it in body space rather than in view space is the whole difference: a
// silhouette annulus turns with the camera, and a field of those shares no direction at all.
function buildRingBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const width = soft.mul(0.22).add(0.12)
  const band = positionGeometry.z.abs().div(width).clamp(0, 1).oneMinus().pow(float(1.6))
  material.colorNode = tint.mul(band).mul(float(2.2))
  material.opacityNode = band
  return new THREE.Mesh(sphere(), material)
}

// Corona: light only where the body turns away. A hollow shell of glow whose inside is open, so a
// star sitting behind one is seen THROUGH it.
function buildCoronaBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const rim = facing()
    .oneMinus()
    .pow(softened(soft, 3.2, 1.2))
  material.colorNode = tint.mul(rim).mul(float(2.6))
  material.opacityNode = rim.mul(float(0.9))
  return new THREE.Mesh(sphere(), material)
}

// Echo: concentric rings drawn from the same falloff the plain form fades with, so the body reads as
// a few repetitions of one shape — a summary said more than once.
function buildEchoBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const falloff = facing()
  const rings = asFloatNode(isoLine(falloff, 3, 5)).mul(soft.oneMinus().mul(0.5).add(0.5))
  const glow = rings.add(falloff.pow(float(3)).mul(float(0.35)))
  material.colorNode = tint.mul(glow).mul(float(1.9))
  material.opacityNode = glow.clamp(0, 1)
  return new THREE.Mesh(sphere(), material)
}

// Pearl: the one opaque form. A matte body shaded by a fixed key light rather than a glow that adds
// itself to whatever is behind — the least ghostly a gist can look while still being soft.
function buildPearlBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  const key = normalize(vec3(0.42, 0.74, 0.52))
  const wrapped = normalGeometry.dot(key).mul(0.5).add(0.5)
  const shade = wrapped
    .pow(softened(soft, 1.6, 0.7))
    .mul(float(0.78))
    .add(float(0.22))
  material.colorNode = tint.mul(shade).mul(float(1.15))
  return new THREE.Mesh(sphere(), material)
}

// Lens: the same glow, wider than it is tall, and open at both ends — a flare caught in glass rather
// than a body in space. The width is the point, so nothing about it may read as a ball.
function buildLensBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  // The view normal's screen-space length IS the distance from the silhouette centre; squeezing one
  // component before measuring it turns the round falloff into an ellipse.
  const oval = vec2(normalView.x.mul(float(0.45)), normalView.y.mul(float(1.5)))
    .length()
    .clamp(0, 1)
    .oneMinus()
  // The ends were the one hard edge left. Widening the falloff runs it straight into the sphere's
  // own silhouette, which cuts it off square and gives away the ball underneath — so the glow is
  // faded out BEFORE it gets there, and what is left drifts off to either side like cloud.
  const ends = normalView.x.abs().oneMinus().clamp(0, 1).pow(float(0.7))
  const falloff = oval.mul(ends).pow(softened(soft, 1.9, 0.8))
  material.colorNode = tint.mul(falloff).mul(float(2.6))
  material.opacityNode = falloff
  return new THREE.Mesh(sphere(), material)
}

// ── the registry ─────────────────────────────────────────────────────────────────────────────

export const GIST_SHAPES = [
  {
    key: 'halo',
    // Delegates to the shipped body, so the REAL thing is in the comparison rather than a re-typed
    // copy that could drift from it.
    source: () => createGistStarBodySource(),
  },
  { key: 'bead', source: () => meshSource(buildBeadBody) },
  { key: 'ring', source: () => meshSource(buildRingBody) },
  { key: 'corona', source: () => meshSource(buildCoronaBody) },
  { key: 'echo', source: () => meshSource(buildEchoBody) },
  { key: 'pearl', source: () => meshSource(buildPearlBody) },
  { key: 'lens', source: () => meshSource(buildLensBody) },
] as const satisfies readonly GistShape[]

export type GistShapeKey = (typeof GIST_SHAPES)[number]['key']

/** The look every gist body wears until one is chosen — the shipped body itself. */
export const DEFAULT_GIST_SHAPE: GistShapeKey = 'halo'

/** The triangle count no form may exceed: the plain sphere every one of them is lit on. A form that
 *  wanted more would be resolving a surface a gist does not have. */
export const GIST_TRIANGLE_CEILING = SPHERE_SEGMENTS * SPHERE_SEGMENTS * 2

/** Resolve a shape key to its definition. An unknown or retired key falls back to the DEFAULT — the
 *  look an undecorated universe wears — rather than to whatever sits first in the registry. */
export function resolveGistShape(key: string): (typeof GIST_SHAPES)[number] {
  return (
    GIST_SHAPES.find((shape) => shape.key === key) ??
    GIST_SHAPES.find((shape) => shape.key === DEFAULT_GIST_SHAPE) ??
    GIST_SHAPES[0]
  )
}

/** The body source for a gist shape key — hand it to an instanced layer alongside the gist channels. */
export function createGistShapeBodySource(key: string): VisualBodySource {
  return resolveGistShape(key).source()
}
