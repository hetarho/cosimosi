// Star body: the episodic-memory big star. A unit sphere whose surface is displaced by
// ridged noise keyed on a per-instance seed, so two seeds take different coherent big-star
// forms [V5]; color is the memory's emotion tint (fed per instance) scaled by a brightness
// channel [V2][I3]. Size is applied by the layer as per-instance scale, so this body is
// authored at unit radius. TSL only (one source → WGSL + GLSL, §3.3); the seed-form graph is
// code, not config (the shader graph is excluded from values.yaml).
import { float, normalGeometry, positionGeometry, positionLocal, sin, time, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { fbm, ridged } from '../../shader-art/noise.ts'
import { asFloatNode, attributeFloatNode, attributeVec3Node } from '../../tsl.ts'

/** Per-instance emotion color (vec3, linear 0..1) — filled by the star layer's channels. */
export const STAR_INSTANCE_TINT = 'aStarTint'
/** Per-instance brightness (float) — resolves full while forgetting decay is unmodeled; the [V2] seam. */
export const STAR_INSTANCE_BRIGHTNESS = 'aStarBrightness'
/** Per-instance seed (float, normalized) — drives the immutable seed-form [V5][A7]. */
export const STAR_INSTANCE_SEED = 'aStarSeed'
/** Per-instance world scale used by body-space displacement. */
export const STAR_INSTANCE_SCALE = 'aStarScale'

// Seed-form graph constants. Not config tuning — they define the star's visual grammar (the
// shape's frequency/relief/shimmer), the way the nebula's octaves live in code, so the shader graph
// excludes them from values.yaml.
const FORM_FREQUENCY = 1.4
const FORM_RELIEF = 0.28
const SURFACE_CONTRAST = 0.35

// The scene bloom threshold is deliberately low, so a near-neutral gain lets the core catch light
// without washing the emotion tint toward white. This is part of the body's luminosity grammar,
// not product tuning in values.yaml.
export const STAR_EMISSIVE_GAIN = 0.95

export interface StarBodyOptions {
  /** Animate the seed-form's living relief; false freezes its seed-derived pose. */
  readonly animate?: boolean
}

function createStarMaterial(animate: boolean): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial()
  const seed = attributeFloatNode(STAR_INSTANCE_SEED)
  const tint = attributeVec3Node(STAR_INSTANCE_TINT)
  const brightness = attributeFloatNode(STAR_INSTANCE_BRIGHTNESS)
  const scale = attributeFloatNode(STAR_INSTANCE_SCALE)

  // Offset the noise field by the seed so each star samples a different region → a different
  // coherent form. Three out-of-phase loops carry that field over the surface, so the star's
  // irregularity itself evolves instead of a fixed lump merely rotating. The seed remains an
  // immutable input (rendered, never mutated/animated [A7]).
  const phase = animate ? asFloatNode(time).mul(float(0.22)) : float(0)
  const drift = vec3(
    sin(phase.add(seed.mul(Math.PI * 2))).mul(float(0.32)),
    sin(phase.mul(float(0.73)).add(seed.mul(float(2.1)))).mul(float(0.28)),
    sin(phase.mul(float(0.51)).add(seed.mul(float(4.7)))).mul(float(0.34)),
  )
  const field = positionGeometry
    .mul(FORM_FREQUENCY)
    .add(vec3(seed.mul(4.1), seed.mul(1.7), seed.mul(0.3)))
    .add(drift)
  const travellingBreath = sin(
    positionGeometry.x
      .mul(float(2.7))
      .add(positionGeometry.y.mul(float(1.9)))
      .add(positionGeometry.z.mul(float(2.3)))
      .sub(phase.mul(float(1.6)))
      .add(seed.mul(Math.PI * 2)),
  )
    .mul(float(0.12))
    .add(float(0.88))
  const relief = ridged(field, { octaves: 3 }).mul(FORM_RELIEF).mul(travellingBreath)
  material.positionNode = positionLocal.add(normalGeometry.mul(relief).mul(scale))

  // Color is emotion only [I3]: the per-instance tint, given a subtle seed-keyed surface
  // shimmer for texture, then scaled by the brightness channel (resolves full while forgetting
  // decay is unmodeled, [V2]).
  const shimmer = fbm(field.mul(2)).mul(0.5).add(0.5).mul(SURFACE_CONTRAST)
  material.colorNode = tint
    .mul(float(1).add(shimmer))
    .mul(brightness)
    .mul(float(STAR_EMISSIVE_GAIN))
  return material
}

// The star body is a `shader` source (TSL): a unit sphere carrying the seed-form material.
// The layer instances it and feeds size (scale) / tint / brightness / seed per instance.
export function createStarBodySource({ animate = true }: StarBodyOptions = {}): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      return new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), createStarMaterial(animate))
    },
  }
}
