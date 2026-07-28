// Star body: the episodic-memory big star. A unit sphere whose surface is displaced by
// ridged noise keyed on a per-instance seed, so two seeds take different coherent big-star
// forms [V5]; color is the memory's emotion tint (fed per instance) scaled by a brightness
// channel [V2][I3]. Size is applied by the layer as per-instance scale, so this body is
// authored at unit radius. TSL only (one source → WGSL + GLSL, §3.3); the seed-form graph is
// code, not config (the shader graph is excluded from values.yaml).
import { float, normalGeometry, positionGeometry, positionLocal, sin, time, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import type { VisualBodySource } from '../../asset-source.ts'
import { fbm, ridged } from '../../shader-art/noise.ts'
import { asFloatNode, attributeFloatNode, attributeVec3Node } from '../../tsl.ts'

/** Per-instance emotion color (vec3, linear 0..1) — filled by the star layer's channels. */
export const STAR_INSTANCE_TINT = 'aStarTint'
/** Per-instance brightness (float) — `EffectiveBrightness`, the read-time forgetting fade [V2]. */
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

/** The movement a star at the silent-engram floor keeps — quiet, but not frozen. */
export const LIFE_FLOOR = 0.16

/**
 * How much life a star still has, from its brightness channel — 1 for a memory just returned to,
 * falling to `LIFE_FLOOR` for one at the silent-engram floor.
 *
 * This is the one thing forgetting is allowed to take besides light. Size belongs to strength and
 * hue and chroma belong to the emotion, so a fading star cannot shrink and cannot pale — but its
 * MOVEMENT is spoken for by nothing, and a body that stops moving reads as one that has stopped being
 * returned to. What subsides is the motion, never the form: the seed's relief stays at full
 * amplitude, so a forgotten star is still recognisably itself, just still.
 *
 * The floor is not zero. A star is dimmed and never deleted, so it keeps a whisper of movement rather
 * than becoming a prop.
 */
export function starLife(brightness: unknown) {
  const { starBrightnessMin: min, starBrightnessMax: max } = VALUES.rendering
  const span = Math.max(max - min, 1e-4)
  return asFloatNode(brightness)
    .sub(min)
    .div(span)
    .clamp(0, 1)
    .mul(1 - LIFE_FLOOR)
    .add(LIFE_FLOOR)
}

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
  // Forgetting subsides the movement, not the form (see `starLife`): the phase runs slower and the
  // travelling breath shallows around its OWN mean, so the relief keeps the same amplitude at both
  // ends of the range. A breath that shallowed toward zero instead would shrink the seed-form as the
  // memory faded, and the form is identity — it may not carry forgetting.
  const life = starLife(brightness)
  const phase = animate ? asFloatNode(time).mul(float(0.22)).mul(life) : float(0)
  const drift = vec3(
    sin(phase.add(seed.mul(Math.PI * 2))).mul(float(0.32)),
    sin(phase.mul(float(0.73)).add(seed.mul(float(2.1)))).mul(float(0.28)),
    sin(phase.mul(float(0.51)).add(seed.mul(float(4.7)))).mul(float(0.34)),
  ).mul(life)
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
    .mul(life)
    .add(float(0.88))
  const relief = ridged(field, { octaves: 3 }).mul(FORM_RELIEF).mul(travellingBreath)
  material.positionNode = positionLocal.add(normalGeometry.mul(relief).mul(scale))

  // Color is emotion only [I3]: the per-instance tint, given a subtle seed-keyed surface shimmer for
  // texture, then scaled by the brightness channel — the read-time forgetting fade, floored at the
  // silent-engram minimum [V2][F2].
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
