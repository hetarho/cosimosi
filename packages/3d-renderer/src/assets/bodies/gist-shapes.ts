// Gist-shape catalogue — the bench of candidate LOOKS for the neocortical gist body, so the way an
// abstracted memory reads can be chosen by eye instead of argued in the abstract.
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
  max,
  mix,
  normalGeometry,
  normalView,
  normalize,
  positionGeometry,
  sin,
  time,
  vec2,
  vec3,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { fbm01 } from '../../shader-art/noise.ts'
import { contourSteps, isoLine } from '../../shader-art/pattern.ts'
import { asFloatNode, attributeFloatNode, attributeVec3Node } from '../../tsl.ts'
import {
  GIST_INSTANCE_DIFFUSE,
  GIST_INSTANCE_TINT,
  createGistStarBodySource,
} from './gist-star-body.ts'

export interface GistShapeOptions {
  /** Let the breathing forms move; false freezes them to one still frame. */
  readonly animate?: boolean
}

export interface GistShape {
  /** Stable id (kebab-case), also the body id the layer requests. */
  readonly key: string
  /** Builds this look's body source; each resolve yields a fresh mesh (the layer owns disposal). */
  readonly source: (options: GistShapeOptions) => VisualBodySource
}

/** The one shell every form is lit on. Its triangle count is also the ceiling: a form that wanted a
 *  finer sphere would be spending vertices on a body that has no surface to resolve. */
const SPHERE_SEGMENTS = 20

/** The shipped body's own gain — the light level a gist reads as at all, and the reference every
 *  louder or quieter form here is judged against. */
const EMISSIVE_GAIN = 1.7

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

/** A shared beat, not a per-body one: with no seed to differ by, a breathing gist field breathes
 *  together — which is the honest reading of one process running over all of them. */
function breath(animate: boolean, rate: number) {
  return animate ? sin(asFloatNode(time).mul(rate)).mul(0.5).add(0.5) : float(0.5)
}

// ── the looks ────────────────────────────────────────────────────────────────────────────────

// Veil: the falloff alone. No grain, no rim, nothing added — the plainest possible reading of a gist,
// and the baseline every other form's extra idea is worth judging against.
function buildVeilBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const falloff = facing().pow(softened(soft, 2.6, 0.9))
  material.colorNode = tint.mul(falloff).mul(float(EMISSIVE_GAIN))
  material.opacityNode = falloff
  return new THREE.Mesh(sphere(), material)
}

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

// Ring: an annulus. The centre is empty and the light sits in a band partway out, so what the eye
// finds is an outline of a memory rather than its middle — the emptiest form here, on purpose.
function buildRingBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const width = soft.mul(0.22).add(0.12)
  const band = facing().sub(float(0.52)).abs().div(width).clamp(0, 1).oneMinus().pow(float(1.6))
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

// Crest: the falloff terraced into steps. Light in plateaus rather than a gradient — the gist as a
// few discrete levels of detail, which is close to what it literally is.
function buildCrestBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const steps = asFloatNode(contourSteps(facing(), 4))
  const glow = mix(steps, facing(), soft)
  material.colorNode = tint.mul(glow).mul(float(1.8))
  material.opacityNode = glow.mul(float(0.85)).add(float(0.1))
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

// Mist: the falloff eaten by soft noise, with no edge anywhere. The softest form in the set — a gist
// you can see the shape of only by looking away from it.
function buildMistBody(animate: boolean): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const drift = vec3(float(0), breath(animate, 0.18).mul(float(0.6)), float(0))
  const cloud = asFloatNode(fbm01(positionGeometry.mul(float(2.1)).add(drift), { octaves: 3 }))
  const falloff = facing().pow(softened(soft, 1.8, 0.7))
  const glow = falloff.mul(cloud.mul(float(0.7)).add(float(0.45)))
  material.colorNode = tint.mul(glow).mul(float(2.1))
  material.opacityNode = glow.clamp(0, 1)
  return new THREE.Mesh(sphere(), material)
}

// Lens: the same glow, wider than it is tall. One stretched axis is enough to read as a flare caught
// in glass rather than as a body in space.
function buildLensBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  // The view normal's screen-space length IS the distance from the silhouette centre; squeezing one
  // component before measuring it turns the round falloff into an ellipse.
  const oval = vec2(normalView.x.mul(float(0.45)), normalView.y.mul(float(1.5)))
    .length()
    .clamp(0, 1)
    .oneMinus()
  const falloff = oval.pow(softened(soft, 2.2, 0.9))
  material.colorNode = tint.mul(falloff).mul(float(2.3))
  material.opacityNode = falloff
  return new THREE.Mesh(sphere(), material)
}

// Sigil: a soft cross. The one form that is a MARK rather than a mass — it reads as notation, which
// is a fair thing for a summary to look like.
function buildSigilBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const arm = soft.mul(0.3).add(0.16)
  const across = normalView.x.abs().div(arm).clamp(0, 1).oneMinus()
  const down = normalView.y.abs().div(arm).clamp(0, 1).oneMinus()
  const glow = max(across, down)
    .pow(float(1.4))
    .mul(facing().pow(float(0.5)))
  material.colorNode = tint.mul(glow).mul(float(2.4))
  material.opacityNode = glow
  return new THREE.Mesh(sphere(), material)
}

// Pip: a hard point inside a wide faint aura. Two scales of the same light, so the body has a place
// you can point at and a presence much larger than it.
function buildPipBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const f = facing()
  const core = f.pow(softened(soft, 12, 5)).mul(float(2.2))
  const aura = f.pow(float(0.7)).mul(soft.mul(0.12).add(0.14))
  const glow = core.add(aura)
  material.colorNode = tint.mul(glow).mul(float(1.6))
  material.opacityNode = glow.clamp(0, 1)
  return new THREE.Mesh(sphere(), material)
}

// Pulse: the plain falloff on a slow shared breath. Nothing about the form changes — only whether the
// whole neocortical layer is currently brighter or dimmer, which reads as one process over all of it.
function buildPulseBody(animate: boolean): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const falloff = facing().pow(softened(soft, 2.4, 0.9))
  const glow = falloff.mul(breath(animate, 0.55).mul(float(0.45)).add(float(0.7)))
  material.colorNode = tint.mul(glow).mul(float(1.9))
  material.opacityNode = glow.clamp(0, 1)
  return new THREE.Mesh(sphere(), material)
}

// Dome: brighter along one body axis. The gist keeps an up and a down, so a field of them shares a
// direction — the cheapest cue that they all belong to the same layer.
function buildDomeBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const lit = positionGeometry.y.mul(float(0.5)).add(float(0.5)).clamp(0, 1)
  const falloff = facing().pow(softened(soft, 2.2, 0.9))
  const glow = falloff.mul(lit.mul(float(0.8)).add(float(0.3)))
  material.colorNode = tint.mul(glow).mul(float(2))
  material.opacityNode = glow.clamp(0, 1)
  return new THREE.Mesh(sphere(), material)
}

// Shell: hollow, and drawn on both faces, so the far wall glows through the near one. Two of them
// overlapping read as soap film — the form that most admits it is empty inside.
function buildShellBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  material.side = THREE.DoubleSide
  const rim = facing()
    .oneMinus()
    .pow(softened(soft, 2.6, 1.1))
  material.colorNode = tint.mul(rim.mul(float(1.6)).add(float(0.1))).mul(float(1.8))
  material.opacityNode = rim.mul(float(0.55)).add(float(0.06))
  return new THREE.Mesh(sphere(), material)
}

// Ash: the light drained toward grey and turned down. A gist that is nearly not there — worth having
// on the bench because the deepest stages are the ones the eye should have to look for.
function buildAshBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const falloff = facing().pow(softened(soft, 2, 0.8))
  const drained = mix(tint, vec3(0.62, 0.64, 0.7), soft.mul(float(0.45)).add(float(0.35)))
  material.colorNode = drained.mul(falloff).mul(float(1.1))
  material.opacityNode = falloff.mul(float(0.6))
  return new THREE.Mesh(sphere(), material)
}

// Bloom: the same glow overdriven until the post pass takes it. The loudest gist — it shows what the
// bloom threshold does to this body family, which is not visible on any quiet form.
function buildBloomBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const falloff = facing().pow(softened(soft, 3.4, 1.4))
  material.colorNode = tint.mul(falloff.mul(float(3.6)).add(float(0.2)))
  material.opacityNode = falloff.mul(float(0.9)).add(float(0.1))
  return new THREE.Mesh(sphere(), material)
}

// Drop: the bright centre pulled below the middle and the haze trailing under it. The only form with
// a weight to it, which makes a field of them read as hanging rather than floating.
function buildDropBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const below = positionGeometry.y.mul(float(-0.45)).add(float(0.55)).clamp(0, 1)
  const falloff = facing()
    .pow(softened(soft, 2.6, 1))
    .mul(below)
  material.colorNode = tint.mul(falloff).mul(float(2.2))
  material.opacityNode = falloff.clamp(0, 1)
  return new THREE.Mesh(sphere(), material)
}

// Bar: one soft horizontal band through the body. A line is the least a mark can be and still be
// seen, so this is the floor of the whole catalogue — anything simpler is nothing.
function buildBarBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const thickness = soft.mul(0.3).add(0.18)
  const band = positionGeometry.y.abs().div(thickness).clamp(0, 1).oneMinus().pow(float(1.3))
  const glow = band.mul(facing().pow(float(0.6)))
  material.colorNode = tint.mul(glow).mul(float(2.4))
  material.opacityNode = glow
  return new THREE.Mesh(sphere(), material)
}

// Grain: the haze printed rather than lit. Quantized noise over the falloff leaves a visible tooth,
// so the body reads as an image OF a memory instead of the light of one.
function buildGrainBody(): THREE.Mesh {
  const { tint, soft } = gistInputs()
  const material = haze(new THREE.MeshBasicNodeMaterial())
  const dots = asFloatNode(
    contourSteps(asFloatNode(fbm01(positionGeometry.mul(float(6.5)), { octaves: 2 })), 3),
  )
  const falloff = facing().pow(softened(soft, 2.2, 0.9))
  const glow = falloff.mul(dots.mul(float(0.75)).add(float(0.35)))
  material.colorNode = tint.mul(glow).mul(float(2))
  material.opacityNode = glow.clamp(0, 1)
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
  { key: 'veil', source: () => meshSource(buildVeilBody) },
  { key: 'bead', source: () => meshSource(buildBeadBody) },
  { key: 'ring', source: () => meshSource(buildRingBody) },
  { key: 'corona', source: () => meshSource(buildCoronaBody) },
  { key: 'echo', source: () => meshSource(buildEchoBody) },
  { key: 'crest', source: () => meshSource(buildCrestBody) },
  { key: 'pearl', source: () => meshSource(buildPearlBody) },
  { key: 'mist', source: ({ animate = true }) => meshSource(() => buildMistBody(animate)) },
  { key: 'lens', source: () => meshSource(buildLensBody) },
  { key: 'sigil', source: () => meshSource(buildSigilBody) },
  { key: 'pip', source: () => meshSource(buildPipBody) },
  { key: 'pulse', source: ({ animate = true }) => meshSource(() => buildPulseBody(animate)) },
  { key: 'dome', source: () => meshSource(buildDomeBody) },
  { key: 'shell', source: () => meshSource(buildShellBody) },
  { key: 'ash', source: () => meshSource(buildAshBody) },
  { key: 'bloom', source: () => meshSource(buildBloomBody) },
  { key: 'drop', source: () => meshSource(buildDropBody) },
  { key: 'bar', source: () => meshSource(buildBarBody) },
  { key: 'grain', source: () => meshSource(buildGrainBody) },
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
export function createGistShapeBodySource(
  key: string,
  options: GistShapeOptions = {},
): VisualBodySource {
  return resolveGistShape(key).source(options)
}
