// Star body: the episodic-memory big star. A unit sphere whose surface is displaced by
// ridged noise keyed on a per-instance seed, so two seeds take different coherent big-star
// forms [V5]; color is the memory's emotion tint (fed per instance) scaled by a brightness
// channel [V2][I3]. Size is applied by the layer as per-instance scale, so this body is
// authored at unit radius. TSL only (one source → WGSL + GLSL, §3.3); the seed-form graph is
// code, not config (the shader graph is excluded from values.yaml).
import { float, normalLocal, positionLocal, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { fbm, ridged } from '../../shader-art/noise.ts'
import { attributeFloatNode, attributeVec3Node } from '../../tsl.ts'

/** Per-instance emotion color (vec3, linear 0..1) — filled by the star layer's channels. */
export const STAR_INSTANCE_TINT = 'aStarTint'
/** Per-instance brightness (float) — resolves full while forgetting decay is unmodeled; the [V2] seam. */
export const STAR_INSTANCE_BRIGHTNESS = 'aStarBrightness'
/** Per-instance seed (float, normalized) — drives the immutable seed-form [V5][A7]. */
export const STAR_INSTANCE_SEED = 'aStarSeed'

// Seed-form graph constants. Not config tuning — they define the star's visual grammar (the
// shape's frequency/relief/shimmer), the way the nebula's octaves live in code, so the shader graph
// excludes them from values.yaml.
const FORM_FREQUENCY = 1.4
const FORM_RELIEF = 0.28
const SURFACE_CONTRAST = 0.35

// Emissive gain: the star reads as a light point only when its core clears the scene bloom
// threshold, but the emotion tint is a sub-1.0 linear colour and the brightness channel is pinned
// at 1 (forgetting decay unmodeled, [V2]), so an ungained core sits at/under the threshold and the
// sphere reads as a flat opaque disc. This constant lifts the core into HDR so bloom catches it —
// a luminosity grammar constant, part of the shader graph, not values.yaml tuning.
const EMISSIVE_GAIN = 2.4

function createStarMaterial(): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial()
  const seed = attributeFloatNode(STAR_INSTANCE_SEED)
  const tint = attributeVec3Node(STAR_INSTANCE_TINT)
  const brightness = attributeFloatNode(STAR_INSTANCE_BRIGHTNESS)

  // Offset the noise field by the seed so each star samples a different region → a different
  // coherent form. The seed is immutable input here (rendered, never mutated/animated [A7]).
  const field = positionLocal
    .mul(FORM_FREQUENCY)
    .add(vec3(seed.mul(4.1), seed.mul(1.7), seed.mul(0.3)))
  const relief = ridged(field, { octaves: 3 }).mul(FORM_RELIEF)
  material.positionNode = positionLocal.add(normalLocal.mul(relief))

  // Color is emotion only [I3]: the per-instance tint, given a subtle seed-keyed surface
  // shimmer for texture, then scaled by the brightness channel (resolves full while forgetting
  // decay is unmodeled, [V2]).
  const shimmer = fbm(field.mul(2)).mul(0.5).add(0.5).mul(SURFACE_CONTRAST)
  material.colorNode = tint.mul(float(1).add(shimmer)).mul(brightness).mul(float(EMISSIVE_GAIN))
  return material
}

// The star body is a `shader` source (TSL): a unit sphere carrying the seed-form material.
// The layer instances it and feeds size (scale) / tint / brightness / seed per instance.
export function createStarBodySource(): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      return new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), createStarMaterial())
    },
  }
}
