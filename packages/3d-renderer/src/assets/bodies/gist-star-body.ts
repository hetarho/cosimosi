// Gist-star body: the neocortical gist version of an episodic memory — a soft, diffuse glow
// ball, deliberately a DISTINCT body from the episodic seed-form star: abstraction is expressed
// by z-rise + this softer look, never by reparameterizing the seed shape [V5]. Color is the
// memory's emotion tint fed per instance ([M3][I3]); softness is fed per instance so deeper
// stages read progressively more diffuse. Size is applied by the layer as per-instance scale,
// so this body is authored at unit radius. TSL only (one source → WGSL + GLSL, §3.3); the
// falloff graph is code, not config.
import { float, normalView, positionLocal } from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { fbm } from '../../shader-art/noise.ts'
import { attributeFloatNode, attributeVec3Node } from '../../tsl.ts'

/** Per-instance emotion color (vec3, linear 0..1) — filled by the gist layer's channels. */
export const GIST_INSTANCE_TINT = 'aGistTint'
/** Per-instance softness (float 0..1) — deeper gist stages feed a higher value [V5]. */
export const GIST_INSTANCE_DIFFUSE = 'aGistDiffuse'

// Diffuse-look grammar constants (the shader graph's visual vocabulary, not values.yaml tuning):
// the facing-falloff exponent range the softness attribute sweeps (sharper core → hazier shell),
// the faint breathing texture, and the emissive lift that lets the soft core still catch bloom.
const EDGE_EXPONENT_SHARP = 2.6
const EDGE_EXPONENT_SOFT = 0.9
const HAZE_CONTRAST = 0.18
const EMISSIVE_GAIN = 1.7

function createGistMaterial(): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial()
  const tint = attributeVec3Node(GIST_INSTANCE_TINT)
  const softness = attributeFloatNode(GIST_INSTANCE_DIFFUSE)

  // Facing falloff: bright toward the silhouette center, fading at the limb — a glow ball,
  // not a lit sphere. The softness attribute eases the exponent from a defined core toward a
  // near-formless haze, so a deeper stage genuinely reads "more gistified".
  const facing = normalView.z.abs().clamp(0, 1)
  const exponent = float(EDGE_EXPONENT_SHARP).sub(
    softness.clamp(0, 1).mul(EDGE_EXPONENT_SHARP - EDGE_EXPONENT_SOFT),
  )
  const falloff = facing.pow(exponent)

  // A faint grain keeps the haze from reading as a flat decal. Local-space sampling holds it
  // still under camera motion; every instance shares the one pattern on purpose — a gist has
  // no seed-form, no per-instance shape identity ([V5]).
  const grain = fbm(positionLocal.mul(2.2)).mul(0.5).add(0.5).mul(HAZE_CONTRAST)

  material.colorNode = tint.mul(falloff.add(grain)).mul(float(EMISSIVE_GAIN))
  // Additive haze: gist bodies layer over the scene without occluding the hippocampus below;
  // depth is still TESTED (a gist behind a star stays behind) but never written, so the
  // translucent shells cannot punch holes in each other.
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  const opacity = falloff.mul(float(0.85)).add(float(0.15))
  material.opacityNode = opacity
  return material
}

// The gist body is a `shader` source (TSL): a unit sphere carrying the diffuse material.
// The layer instances it and feeds size (scale) / tint / softness per instance.
export function createGistStarBodySource(): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      return new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), createGistMaterial())
    },
  }
}
