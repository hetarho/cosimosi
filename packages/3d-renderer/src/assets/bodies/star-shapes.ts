// Star-shape catalogue — the bench of candidate LOOKS for the episodic-memory big star, so the
// star's visual grammar can be chosen by eye instead of argued in the abstract. Each entry pairs a
// FORM (sphere / polyhedron / spiked or noise-displaced hull) with a SURFACE (relief shimmer, flat
// facets, thin-film sheen, cell veins, needle tips, plasma flow, contour lines, formless haze), and
// every entry reads the SAME per-instance channels — tint, brightness, seed — that the production
// star body reads, so a look can be swapped under a live universe without touching any layer.
//
// `orb` IS the shipped body (it delegates to createStarBodySource), so the baseline in the
// comparison is the real thing, never a re-typed copy that could drift from it.
//
// TSL only (one source → WGSL + GLSL, §3.3). Like the shipped bodies, the graph constants here are
// the looks' visual grammar — frequency, relief, gain — not values.yaml tuning, and every body is
// authored at unit radius so the layer applies size as per-instance scale.
//
// COORDINATE SPACES (the trap these bodies are built around): the node pipeline bakes the instance
// transform INTO `positionLocal`, so inside the material it already carries the star's world
// position and world size. Anything body-shaped therefore reads `positionGeometry` / `normalGeometry`
// — the untouched unit-radius attributes — and converts back to world units with the per-instance
// scale channel. Sampling a noise field off `positionLocal` would anchor the surface to the sky
// instead of the star, and turning `positionLocal` would move the star rather than rotate it.
import {
  cos,
  dot,
  float,
  mix,
  normalGeometry,
  normalView,
  normalize,
  positionGeometry,
  positionLocal,
  sin,
  time,
  vec3,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { domainWarp } from '../../shader-art/field.ts'
import { iridescent } from '../../shader-art/finish.ts'
import { displaceGeometry } from '../../shader-art/geometry.ts'
import { fbm01, ridged, worley } from '../../shader-art/noise.ts'
import { cellEdge, contourSteps, isoLine } from '../../shader-art/pattern.ts'
import { asFloatNode, asVec3Node, attributeFloatNode, attributeVec3Node } from '../../tsl.ts'
import {
  STAR_INSTANCE_BRIGHTNESS,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_TINT,
  createStarBodySource,
} from './star-body.ts'

/**
 * Per-instance world scale (float) — the same number the layer feeds as the instance's uniform
 * scale. Bodies here displace and turn themselves in body units and multiply by this to reach world
 * units, so a look holds its proportions at any star size (see the coordinate-space note above).
 */
export const STAR_SHAPE_INSTANCE_SCALE = 'aStarShapeScale'

const TAU = Math.PI * 2

/** The one fixed key light every lit look shades against (unit, body axes == world axes). */
const KEY_LIGHT = normalize(vec3(0.42, 0.74, 0.52))

/** A near-white highlight tint — pushes lit crests off the emotion hue so edges stay crisp under bloom. */
const HIGHLIGHT = vec3(1, 0.97, 0.92)

export interface StarShapeOptions {
  /** Let time-driven surfaces (the plasma flow) move; false freezes them for reduced motion. */
  readonly animate?: boolean
}

export interface StarShape {
  /** Stable id (kebab-case), also the body id the layer requests. */
  readonly key: string
  /** Display name. */
  readonly label: string
  /** One line naming the form and the surface it wears. */
  readonly blurb: string
  /** Builds this look's body source; each resolve yields a fresh mesh (the layer owns disposal). */
  readonly source: (options: StarShapeOptions) => VisualBodySource
}

// ── per-instance inputs ──────────────────────────────────────────────────────────────────────

interface InstanceInputs {
  readonly seed: ReturnType<typeof asFloatNode>
  readonly tint: ReturnType<typeof asVec3Node>
  readonly brightness: ReturnType<typeof asFloatNode>
  /** Body units → world units (the instance's uniform scale). */
  readonly scale: ReturnType<typeof asFloatNode>
}

function instanceInputs(): InstanceInputs {
  return {
    seed: attributeFloatNode(STAR_INSTANCE_SEED),
    tint: attributeVec3Node(STAR_INSTANCE_TINT),
    brightness: attributeFloatNode(STAR_INSTANCE_BRIGHTNESS),
    scale: attributeFloatNode(STAR_SHAPE_INSTANCE_SCALE),
  }
}

/** Offset a noise field by the seed so each instance samples a different region → a different form. */
function seedOffset(seed: InstanceInputs['seed']) {
  return vec3(seed.mul(4.1), seed.mul(1.7), seed.mul(0.3))
}

/** Push the surface out along its own normal by `relief` BODY units (converted to world units). */
function displaced(relief: unknown, scale: InstanceInputs['scale']) {
  return positionLocal.add(normalGeometry.mul(asFloatNode(relief)).mul(scale))
}

// ── shared shading / orientation ─────────────────────────────────────────────────────────────

function rotateX(v: unknown, angle: unknown) {
  const p = asVec3Node(v)
  const a = asFloatNode(angle)
  const c = cos(a)
  const s = sin(a)
  return vec3(p.x, p.y.mul(c).sub(p.z.mul(s)), p.y.mul(s).add(p.z.mul(c)))
}

function rotateY(v: unknown, angle: unknown) {
  const p = asVec3Node(v)
  const a = asFloatNode(angle)
  const c = cos(a)
  const s = sin(a)
  return vec3(p.x.mul(c).add(p.z.mul(s)), p.y, p.z.mul(c).sub(p.x.mul(s)))
}

/** A static per-instance rotation read from the seed — so a field of identical polyhedra doesn't
 *  read as a row of clones. Applied to a body-space vector; pair it with `turnedInto` for position. */
function turn(v: unknown, seed: InstanceInputs['seed']) {
  return rotateY(rotateX(v, seed.mul(4.7).add(0.6)), seed.mul(TAU))
}

/** The turned body's world position: the instance's own point plus the world-space delta the turn
 *  moved this vertex by. Turning `positionLocal` itself would swing the star around the origin. */
function turnedInto(seed: InstanceInputs['seed'], scale: InstanceInputs['scale']) {
  return positionLocal.add(turn(positionGeometry, seed).sub(positionGeometry).mul(scale))
}

/** Half-lambert against the key light: a face turned away dims but never goes to pure black, so a
 *  silhouette still reads its form in an unlit scene (there are no lights here — this IS the light). */
function keyShade(normal: unknown, ambient: number, contrast: number) {
  const wrapped = asFloatNode(dot(asVec3Node(normal), KEY_LIGHT))
    .mul(0.5)
    .add(0.5)
  return wrapped
    .pow(float(contrast))
    .mul(float(1 - ambient))
    .add(float(ambient))
}

function flowPhase(animate: boolean, rate: number) {
  return animate ? asFloatNode(time).mul(rate) : float(0)
}

/** Wrap a mesh builder as a body source — a fresh mesh per resolve, as the port requires. */
function meshSource(build: () => THREE.Mesh): VisualBodySource {
  return { resolve: build }
}

// ── the looks ────────────────────────────────────────────────────────────────────────────────

// Cut facet: 20 flat faces, one tone each. The hardest-edged look in the set — the emotion reads as
// a stone that was cut rather than a body that grew, and the lit crowns flare toward white so the
// silhouette holds its corners through the bloom.
function buildFacetBody(): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  material.positionNode = turnedInto(seed, scale)
  const shade = keyShade(turn(normalGeometry, seed), 0.14, 1.9)
  const flare = shade.pow(float(8)).mul(float(0.3))
  material.colorNode = tint
    .mul(shade.mul(float(1.9)))
    .add(HIGHLIGHT.mul(flare))
    .mul(brightness)
  return new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material)
}

// Prism: twelve pentagonal faces under a thin-film sheen — the hue slides per face while the mood
// stays the dominant half of the mix, so the star is unmistakably its emotion and still catches
// light like a jewel.
function buildPrismBody(): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  material.positionNode = turnedInto(seed, scale)
  const normal = turn(normalGeometry, seed)
  const shade = keyShade(normal, 0.18, 1.4)
  const phase = asFloatNode(dot(asVec3Node(normal), KEY_LIGHT))
    .mul(float(3.1))
    .add(seed.mul(TAU))
  const film = iridescent(phase, { baseHue: 0.58, range: 0.34, sat: 0.72, val: 0.85 })
  material.colorNode = mix(tint, film, float(0.2))
    .mul(shade.mul(float(1.8)))
    .mul(brightness)
  return new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), material)
}

// Geode: a cracked crystal shell. Worley cells pull their interiors in and leave the boundaries
// standing, then those same edges light up as veins — the emotion glowing out of the fractures
// rather than off the surface.
function buildGeodeBody(): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  const field = positionGeometry.mul(float(2.4)).add(seedOffset(seed))
  const { f1, f2 } = worley(field, 1)
  material.positionNode = displaced(f1.mul(float(0.4)).sub(float(0.14)), scale)
  const veins = asFloatNode(cellEdge(f1, f2, 6))
  const shade = keyShade(normalGeometry, 0.2, 1.3)
  material.colorNode = tint
    .mul(shade.mul(float(0.9)))
    .add(mix(tint, HIGHLIGHT, float(0.35)).mul(veins.mul(float(1.8))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), material)
}

// Bubble: a hollow shell with nothing in the middle — all the light sits at the limb, tinted by a
// thin-film sheen. Double-sided and additive, so the far wall glows through the near one and two
// overlapping stars read as soap film rather than as two discs.
function buildBubbleBody(): THREE.Mesh {
  const { seed, tint, brightness } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  // A sphere needs no body-space work: the view normal is the same whichever way the ball is turned.
  const facing = asFloatNode(normalView.z).abs().clamp(0, 1)
  const rim = facing.oneMinus().pow(float(2.4))
  const film = iridescent(rim.mul(float(5.5)).add(seed.mul(TAU)), {
    baseHue: 0.52,
    range: 0.4,
    sat: 0.45,
    val: 1,
  })
  material.colorNode = mix(tint, film, float(0.45))
    .mul(rim.mul(float(3.2)).add(float(0.14)))
    .mul(brightness)
  material.opacityNode = rim.mul(float(0.85)).add(float(0.1))
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.side = THREE.DoubleSide
  return new THREE.Mesh(new THREE.SphereGeometry(1, 40, 40), material)
}

// Spire: the six-point star — a small core with sharp spikes down the three axes, cut into flat
// crystalline facets. The most graphic silhouette here, legible at any distance, and the only look
// whose form is carved into the geometry (CPU displacement, so the facets get true normals) rather
// than into the shader.
const SPIRE_CORE = 0.28
const SPIRE_SHARPNESS = 7

function buildSpireBody(): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  material.positionNode = turnedInto(seed, scale)
  const shade = keyShade(turn(normalGeometry, seed), 0.16, 1.5)
  // The tips are the point of this look, so they carry the light: body radius doubles as the falloff.
  const tip = positionGeometry.length().smoothstep(float(SPIRE_CORE + 0.2), float(1))
  material.colorNode = tint
    .mul(shade.mul(float(1.6)))
    .add(mix(tint, HIGHLIGHT, float(0.4)).mul(tip.mul(float(0.8))))
    .mul(brightness)
  // Vertices of a subdivided polyhedron sit on the unit sphere, so the direction's dominant axis
  // gives the spike profile: 1 along ±x/±y/±z, collapsing to the core along the diagonals.
  const geometry = displaceGeometry(new THREE.OctahedronGeometry(1, 4), (x, y, z) => {
    const axis = Math.max(Math.abs(x), Math.abs(y), Math.abs(z))
    return SPIRE_CORE + (1 - SPIRE_CORE) * axis ** SPIRE_SHARPNESS - 1
  })
  return new THREE.Mesh(geometry, material)
}

// Urchin: a dim body under a coat of needles, each needle incandescent at the tip. Where the facet
// looks cut and the orb looks grown, this one looks defensive — worth seeing next to a high-arousal
// emotion.
function buildUrchinBody(): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  const field = positionGeometry.mul(float(3.6)).add(seedOffset(seed))
  const { f1 } = worley(field, 1)
  const needle = f1.oneMinus().clamp(0, 1).pow(float(6))
  material.positionNode = displaced(needle.mul(float(0.95)), scale)
  const shade = keyShade(normalGeometry, 0.16, 1.2)
  material.colorNode = tint
    .mul(shade.mul(float(1.1)))
    .add(mix(tint, HIGHLIGHT, float(0.22)).mul(needle.pow(float(0.5)).mul(float(0.5))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), material)
}

// Plasma: a churning surface — warped fbm banded into hot steps with ridged filaments over it, and
// the only look that moves on its own. The emotion behaves like burning gas instead of solid matter.
function buildPlasmaBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  const drift = vec3(float(0), flowPhase(animate, 0.14), float(0))
  const field = domainWarp(positionGeometry.mul(float(0.9)).add(seedOffset(seed)).add(drift), {
    amount: 0.9,
    octaves: 2,
  })
  const heat = asFloatNode(fbm01(field.mul(float(0.8)), { octaves: 2 }))
  const bands = asFloatNode(contourSteps(heat, 4))
  const veins = asFloatNode(ridged(field.mul(float(1.2)), { octaves: 2 })).pow(float(6))
  material.positionNode = displaced(heat.sub(float(0.5)).mul(float(0.22)), scale)
  material.colorNode = tint
    .mul(bands.mul(float(1.3)).add(float(0.28)))
    .add(mix(tint, HIGHLIGHT, float(0.5)).mul(veins.mul(float(0.6))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), material)
}

// Contour: a lumpy hull wearing its own topographic map — the relief that shapes the body is the
// same value the isolines are drawn from, so the lines describe the form exactly. A quiet,
// cartographic reading of a memory.
function buildContourBody(): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  const field = positionGeometry.mul(float(0.85)).add(seedOffset(seed))
  const relief = asFloatNode(fbm01(field, { octaves: 3 }))
  material.positionNode = displaced(relief.sub(float(0.5)).mul(float(0.44)), scale)
  const lines = asFloatNode(isoLine(relief, 6, 4))
  const shade = keyShade(normalGeometry, 0.24, 1.1)
  material.colorNode = tint
    .mul(shade.mul(float(0.6)))
    .add(mix(tint, HIGHLIGHT, float(0.3)).mul(lines.mul(float(1.3))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), material)
}

// Haze: no surface at all. A facing falloff eaten by soft noise, additive — the emotion as a breath
// of light with no edge to point at. The soft end of the range, and the closest to the gist body's
// vocabulary, kept here so the contrast against a hard-edged look is visible in one screen.
function buildHazeBody(): THREE.Mesh {
  const { seed, tint, brightness } = instanceInputs()
  const material = new THREE.MeshBasicNodeMaterial()
  const facing = asFloatNode(normalView.z).abs().clamp(0, 1)
  const falloff = facing.pow(float(1.5))
  const puff = asFloatNode(
    fbm01(positionGeometry.mul(float(2.4)).add(seedOffset(seed)), { octaves: 3 }),
  )
  material.colorNode = tint
    .mul(falloff.add(puff.mul(float(0.24))))
    .mul(float(1.9))
    .mul(brightness)
  material.opacityNode = falloff.mul(puff.mul(float(0.5)).add(float(0.6))).clamp(0, 1)
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  return new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), material)
}

// ── the registry ─────────────────────────────────────────────────────────────────────────────

export const STAR_SHAPES = [
  {
    key: 'orb',
    label: 'Seed orb',
    blurb: 'The shipped star: a sphere in ridged relief, its form read from the seed.',
    source: () => createStarBodySource(),
  },
  {
    key: 'facet',
    label: 'Cut facet',
    blurb: 'Twenty flat faces, one tone each — a stone that was cut, not grown.',
    source: () => meshSource(buildFacetBody),
  },
  {
    key: 'prism',
    label: 'Prism',
    blurb: 'A twelve-faced jewel with a thin-film sheen sliding face to face.',
    source: () => meshSource(buildPrismBody),
  },
  {
    key: 'geode',
    label: 'Geode',
    blurb: 'A cracked crystal shell, the emotion glowing out of its veins.',
    source: () => meshSource(buildGeodeBody),
  },
  {
    key: 'bubble',
    label: 'Bubble',
    blurb: 'A hollow film — all the light at the limb, nothing in the middle.',
    source: () => meshSource(buildBubbleBody),
  },
  {
    key: 'spire',
    label: 'Six-point spire',
    blurb: 'A small core with sharp spikes down the axes — the graphic silhouette.',
    source: () => meshSource(buildSpireBody),
  },
  {
    key: 'urchin',
    label: 'Urchin',
    blurb: 'A dim body under a coat of needles, incandescent at the tips.',
    source: () => meshSource(buildUrchinBody),
  },
  {
    key: 'plasma',
    label: 'Plasma',
    blurb: 'Burning gas: warped noise banded into hot steps, and the only look that moves.',
    source: ({ animate = true }) => meshSource(() => buildPlasmaBody(animate)),
  },
  {
    key: 'contour',
    label: 'Contour',
    blurb: 'A lumpy hull wearing its own topographic map.',
    source: () => meshSource(buildContourBody),
  },
  {
    key: 'haze',
    label: 'Haze',
    blurb: 'No surface at all — a breath of light with no edge to point at.',
    source: () => meshSource(buildHazeBody),
  },
] as const satisfies readonly StarShape[]

export type StarShapeKey = (typeof STAR_SHAPES)[number]['key']

export const DEFAULT_STAR_SHAPE: StarShapeKey = 'orb'

/** Resolve a shape key to its definition (falls back to the shipped star). Keeps the narrow key
 *  literals, so callers get a `StarShapeKey` rather than a widened `string`. */
export function resolveStarShape(key: string): (typeof STAR_SHAPES)[number] {
  return STAR_SHAPES.find((shape) => shape.key === key) ?? STAR_SHAPES[0]
}

/** The body source for a shape key — hand it to an instanced layer alongside the star channels. */
export function createStarShapeBodySource(
  key: string,
  options: StarShapeOptions = {},
): VisualBodySource {
  return resolveStarShape(key).source(options)
}
