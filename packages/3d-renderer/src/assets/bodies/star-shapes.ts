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
import { seededTurn } from '../../shader-art/motion.ts'
import { fbm01, ridged, worley } from '../../shader-art/noise.ts'
import { cellEdge, contourSteps, isoLine } from '../../shader-art/pattern.ts'
import { asFloatNode, asVec3Node, attributeFloatNode, attributeVec3Node } from '../../tsl.ts'
import {
  STAR_INSTANCE_BRIGHTNESS,
  STAR_EMISSIVE_GAIN,
  STAR_INSTANCE_SEED,
  STAR_INSTANCE_SCALE,
  STAR_INSTANCE_TINT,
  createStarBodySource,
  starLife,
} from './star-body.ts'

const TAU = Math.PI * 2
const RIGID_TURN_SPEED = 2.25

/** The one fixed key light every lit look shades against (unit, body axes == world axes). */
const KEY_LIGHT = normalize(vec3(0.42, 0.74, 0.52))

/** A near-white highlight tint — pushes lit crests off the emotion hue so edges stay crisp under bloom. */
const HIGHLIGHT = vec3(1, 0.97, 0.92)

export interface StarShapeOptions {
  /** Let rigid turns and living surfaces move; false freezes the seed-derived pose. */
  readonly animate?: boolean
}

export interface StarShape {
  /** Stable id (kebab-case), also the body id the layer requests. */
  readonly key: string
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
    scale: attributeFloatNode(STAR_INSTANCE_SCALE),
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

/** The turned body's world position: the instance's own point plus the world-space delta the turn
 *  moved this vertex by. Turning `positionLocal` itself would swing the star around the origin. */
function turnedInto(
  seed: InstanceInputs['seed'],
  scale: InstanceInputs['scale'],
  animate: boolean,
  life: unknown,
) {
  return positionLocal.add(
    seededTurn(positionGeometry, seed, animate, asFloatNode(life).mul(RIGID_TURN_SPEED))
      .sub(positionGeometry)
      .mul(scale),
  )
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

// Every animated body reads its phase from here, so `life` reaching this one place slows all ten of
// them together: a star that is no longer returned to quiets down whatever its own motion happens to
// be — a turn, a swell, a travelling wave (see `starLife`).
function flowPhase(animate: boolean, rate: number, life: unknown) {
  return animate ? asFloatNode(time).mul(rate).mul(asFloatNode(life)) : float(0)
}

function surfaceDrift(seed: InstanceInputs['seed'], animate: boolean, rate: number, life: unknown) {
  const phase = flowPhase(animate, rate, life)
  return vec3(
    phase.mul(seed.mul(0.21).add(0.7)),
    phase.mul(seed.mul(0.13).add(0.45)).mul(float(-1)),
    phase.mul(seed.mul(0.17).add(0.3)),
  )
}

/** Wrap a mesh builder as a body source — a fresh mesh per resolve, as the port requires. */
function meshSource(build: () => THREE.Mesh): VisualBodySource {
  return { resolve: build }
}

// ── the looks ────────────────────────────────────────────────────────────────────────────────

// Cut facet: 20 flat faces, one tone each. The hardest-edged look in the set — the emotion reads as
// a stone that was cut rather than a body that grew, and the lit crowns flare toward white so the
// silhouette holds its corners through the bloom.
function buildFacetBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  material.positionNode = turnedInto(seed, scale, animate, life)
  const shade = keyShade(
    seededTurn(normalGeometry, seed, animate, asFloatNode(life).mul(RIGID_TURN_SPEED)),
    0.14,
    1.9,
  )
  const glow = shade.mul(float(0.55)).add(float(0.72)).mul(float(STAR_EMISSIVE_GAIN))
  const flare = shade.pow(float(8)).mul(float(0.22))
  material.colorNode = tint.mul(glow).add(HIGHLIGHT.mul(flare)).mul(brightness)
  return new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material)
}

// Prism: twelve pentagonal faces under a thin-film sheen — the hue slides per face while the mood
// stays the dominant half of the mix, so the star is unmistakably its emotion and still catches
// light like a jewel.
function buildPrismBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  material.positionNode = turnedInto(seed, scale, animate, life)
  const normal = seededTurn(normalGeometry, seed, animate, asFloatNode(life).mul(RIGID_TURN_SPEED))
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
function buildGeodeBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  const phase = flowPhase(animate, 0.64, life)
  const drift = surfaceDrift(seed, animate, 0.24, life)
  const field = domainWarp(positionGeometry.mul(float(2.2)).add(seedOffset(seed)).add(drift), {
    amount: 0.38,
    octaves: 2,
  })
  const { f1, f2 } = worley(field, 1)
  const unevenFlow = asFloatNode(
    fbm01(
      domainWarp(
        positionGeometry
          .mul(float(1.15))
          .add(seedOffset(seed))
          .add(surfaceDrift(seed, animate, 0.19, life)),
        { amount: 0.72, octaves: 2 },
      ),
      { octaves: 3 },
    ),
  )
  const crystalWave = sin(
    positionGeometry.x
      .mul(float(2.2))
      .add(positionGeometry.y.mul(float(1.35)))
      .add(positionGeometry.z.mul(float(2.65)))
      .add(unevenFlow.mul(float(TAU * 1.4)))
      .sub(phase.mul(seed.mul(float(0.35)).add(float(1.05))))
      .add(seed.mul(TAU)),
  )
    .mul(float(0.5))
    .add(float(0.5))
  const crystalRelief = f1
    .mul(float(0.32))
    .sub(float(0.14))
    .add(crystalWave.sub(float(0.5)).mul(float(0.18)))
  material.positionNode = displaced(crystalRelief, scale)
  const veins = asFloatNode(cellEdge(f1, f2, 6))
  const veinPulse = crystalWave.mul(float(0.35)).add(float(0.75))
  const shade = keyShade(normalGeometry, 0.2, 1.3)
  material.colorNode = tint
    .mul(shade.mul(float(0.9)))
    .add(mix(tint, HIGHLIGHT, float(0.35)).mul(veins.mul(veinPulse).mul(float(1.8))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), material)
}

// Bubble: a hollow shell with nothing in the middle — all the light sits at the limb, tinted by a
// thin-film sheen. Double-sided and additive, so the far wall glows through the near one and two
// overlapping stars read as soap film rather than as two discs.
function buildBubbleBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  const phase = flowPhase(animate, 0.48, life)
  const field = domainWarp(
    positionGeometry
      .mul(float(0.9))
      .add(seedOffset(seed))
      .add(surfaceDrift(seed, animate, 0.12, life)),
    { amount: 0.55, octaves: 2 },
  )
  const softWave = sin(
    positionGeometry.x
      .mul(float(1.7))
      .add(positionGeometry.y.mul(float(2.1)))
      .add(positionGeometry.z.mul(float(1.3)))
      .add(phase)
      .add(seed.mul(TAU)),
  )
  const swell = asFloatNode(fbm01(field, { octaves: 3 }))
    .sub(float(0.5))
    .mul(float(0.36))
    .add(softWave.mul(float(0.055)))
  material.positionNode = displaced(swell, scale)
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

// Spire: the eight-point star — a broad core with low pyramids toward the cube corners, cut into
// flat crystalline facets. Its form is carved into the geometry rather than into the shader.
const SPIRE_CORE = 0.48
const SPIRE_TIP_RADIUS = 0.9

function buildEightPointSpireGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const appendFace = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
    const centroid = new THREE.Vector3().addVectors(a, b).add(c)
    const [second, third] = normal.dot(centroid) >= 0 ? [b, c] : [c, b]
    positions.push(a.x, a.y, a.z, second.x, second.y, second.z, third.x, third.y, third.z)
  }

  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        const tip = new THREE.Vector3(xSign, ySign, zSign)
          .normalize()
          .multiplyScalar(SPIRE_TIP_RADIUS)
        const x = new THREE.Vector3(xSign * SPIRE_CORE, 0, 0)
        const y = new THREE.Vector3(0, ySign * SPIRE_CORE, 0)
        const z = new THREE.Vector3(0, 0, zSign * SPIRE_CORE)
        appendFace(tip, x, y)
        appendFace(tip, y, z)
        appendFace(tip, z, x)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

function buildSpireBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  material.positionNode = turnedInto(seed, scale, animate, life)
  const shade = keyShade(
    seededTurn(normalGeometry, seed, animate, asFloatNode(life).mul(RIGID_TURN_SPEED)),
    0.16,
    1.5,
  )
  // The tips are the point of this look, so they carry the light: body radius doubles as the falloff.
  const tip = positionGeometry
    .length()
    .smoothstep(float(SPIRE_CORE + 0.16), float(SPIRE_TIP_RADIUS))
  material.colorNode = tint
    .mul(shade.mul(float(1.6)))
    .add(mix(tint, HIGHLIGHT, float(0.4)).mul(tip.mul(float(0.8))))
    .mul(brightness)
  return new THREE.Mesh(buildEightPointSpireGeometry(), material)
}

// Urchin: a dim body under a coat of needles, each needle incandescent at the tip. Where the facet
// looks cut and the orb looks grown, this one looks defensive — worth seeing next to a high-arousal
// emotion.
function buildUrchinBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  const field = positionGeometry.mul(float(3.6)).add(seedOffset(seed))
  const { f1 } = worley(field, 1)
  const phase = flowPhase(animate, 0.92, life)
  const wavePhase = positionGeometry.x
    .mul(float(4.4))
    .add(positionGeometry.y.mul(float(3.2)))
    .add(positionGeometry.z.mul(float(3.7)))
    .sub(phase)
    .add(seed.mul(TAU))
  const leadingWave = sin(wavePhase).mul(float(0.5)).add(float(0.5))
  const trailingWave = sin(
    positionGeometry.x
      .mul(float(-2.1))
      .add(positionGeometry.y.mul(float(3.8)))
      .add(positionGeometry.z.mul(float(1.9)))
      .add(phase.mul(float(0.63)))
      .add(seed.mul(float(3.4))),
  )
    .mul(float(0.5))
    .add(float(0.5))
  const spikePulse = leadingWave
    .mul(float(0.72))
    .add(trailingWave.mul(float(0.28)))
    .pow(float(1.35))
    .mul(float(0.2))
    .add(float(0.8))
  const needle = f1.oneMinus().clamp(0, 1).pow(float(6)).mul(spikePulse)
  material.positionNode = displaced(needle.mul(float(0.95)), scale)
  const shade = keyShade(normalGeometry, 0.16, 1.2)
  material.colorNode = tint
    .mul(shade.mul(float(1.1)))
    .add(mix(tint, HIGHLIGHT, float(0.22)).mul(needle.pow(float(0.5)).mul(float(0.5))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), material)
}

// Plasma: a churning surface — warped fbm banded into hot steps with ridged filaments over it. Its
// relief surges like burning gas instead of rotating as a solid body.
function buildPlasmaBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  const phase = flowPhase(animate, 0.32, life)
  const drift = vec3(
    sin(phase.mul(float(0.7)).add(seed.mul(TAU))).mul(float(0.28)),
    phase,
    sin(phase.mul(float(0.53)).add(seed.mul(float(3.7)))).mul(float(0.24)),
  )
  const field = domainWarp(positionGeometry.mul(float(0.9)).add(seedOffset(seed)).add(drift), {
    amount: 0.9,
    octaves: 2,
  })
  const heat = asFloatNode(fbm01(field.mul(float(0.8)), { octaves: 2 }))
  const bands = asFloatNode(contourSteps(heat, 4))
  const veins = asFloatNode(ridged(field.mul(float(1.2)), { octaves: 2 })).pow(float(6))
  const surge = sin(
    positionGeometry.y
      .mul(float(2.2))
      .add(positionGeometry.x.mul(float(1.1)))
      .sub(phase.mul(float(1.6)))
      .add(seed.mul(TAU)),
  ).mul(float(0.04))
  material.positionNode = displaced(heat.sub(float(0.5)).mul(float(0.24)).add(surge), scale)
  material.colorNode = tint
    .mul(bands.mul(float(1.3)).add(float(0.28)))
    .add(mix(tint, HIGHLIGHT, float(0.5)).mul(veins.mul(float(0.6))))
    .mul(brightness)
  return new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), material)
}

// Contour: a lumpy hull wearing its own topographic map — the relief that shapes the body is the
// same value the isolines are drawn from, so the lines describe the form exactly. A quiet,
// cartographic reading of a memory.
function buildContourBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness, scale } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  const phase = flowPhase(animate, 0.3, life)
  const field = positionGeometry
    .mul(float(0.85))
    .add(seedOffset(seed))
    .add(surfaceDrift(seed, animate, 0.12, life))
  const relief = asFloatNode(fbm01(field, { octaves: 3 }))
  const contourTide = sin(
    positionGeometry.y
      .mul(float(3.4))
      .add(positionGeometry.x.mul(float(1.2)))
      .sub(phase)
      .add(seed.mul(TAU)),
  )
    .mul(float(0.5))
    .add(float(0.5))
  const terrain = relief.mul(float(0.88)).add(contourTide.mul(float(0.12)))
  material.positionNode = displaced(terrain.sub(float(0.5)).mul(float(0.44)), scale)
  const lines = asFloatNode(isoLine(terrain, 6, 4))
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
function buildHazeBody(animate: boolean): THREE.Mesh {
  const { seed, tint, brightness } = instanceInputs()
  const life = starLife(brightness)
  const material = new THREE.MeshBasicNodeMaterial()
  const facing = asFloatNode(normalView.z).abs().clamp(0, 1)
  const falloff = facing.pow(float(1.5))
  const phase = flowPhase(animate, 0.78, life)
  const puff = asFloatNode(
    fbm01(
      positionGeometry
        .mul(float(2.4))
        .add(seedOffset(seed))
        .add(surfaceDrift(seed, animate, 0.21, life)),
      { octaves: 3 },
    ),
  )
  const breath = sin(
    positionGeometry.x
      .mul(float(2.1))
      .add(positionGeometry.y.mul(float(1.6)))
      .add(phase)
      .add(seed.mul(TAU)),
  )
    .mul(float(0.12))
    .add(float(0.88))
  material.colorNode = tint
    .mul(falloff.add(puff.mul(float(0.24))))
    .mul(float(1.9))
    .mul(brightness)
  material.opacityNode = falloff
    .mul(puff.mul(float(0.5)).add(float(0.6)))
    .mul(breath)
    .clamp(0, 1)
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  return new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), material)
}

// ── the registry ─────────────────────────────────────────────────────────────────────────────

export const STAR_SHAPES = [
  {
    key: 'orb',
    source: ({ animate = true }) => createStarBodySource({ animate }),
  },
  {
    key: 'facet',
    source: ({ animate = true }) => meshSource(() => buildFacetBody(animate)),
  },
  {
    key: 'prism',
    source: ({ animate = true }) => meshSource(() => buildPrismBody(animate)),
  },
  {
    key: 'geode',
    source: ({ animate = true }) => meshSource(() => buildGeodeBody(animate)),
  },
  {
    key: 'bubble',
    source: ({ animate = true }) => meshSource(() => buildBubbleBody(animate)),
  },
  {
    key: 'spire',
    source: ({ animate = true }) => meshSource(() => buildSpireBody(animate)),
  },
  {
    key: 'urchin',
    source: ({ animate = true }) => meshSource(() => buildUrchinBody(animate)),
  },
  {
    key: 'plasma',
    source: ({ animate = true }) => meshSource(() => buildPlasmaBody(animate)),
  },
  {
    key: 'contour',
    source: ({ animate = true }) => meshSource(() => buildContourBody(animate)),
  },
  {
    key: 'haze',
    source: ({ animate = true }) => meshSource(() => buildHazeBody(animate)),
  },
] as const satisfies readonly StarShape[]

export type StarShapeKey = (typeof STAR_SHAPES)[number]['key']

/** The shape every universe opens on — the free entry point. `orb` remains the bench's baseline (it
 *  IS the primitive body source), so it stays in the registry without being what a universe wears. */
export const DEFAULT_STAR_SHAPE: StarShapeKey = 'facet'

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
