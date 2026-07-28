// Filament body: the synapse fat-line. The look is an additive, per-vertex-colored node
// material; the batched ribbon geometry (camera-facing quads whose half-width = synapse
// strength) is owned by the FatLineLayer, which reads only this material. Additive blending
// makes overlapping filaments glow and — unlike three's Line2 fat-line, whose transparent
// path samples the opaque viewport texture the package's custom PostFX pipeline never exposes
// (WebGPU then rejects the bind group) — needs no viewport texture, so it survives the
// pipeline. Per-filament width feeds the geometry; per-filament brightness feeds this color.
//
// The LOOK is a strand of light, not a flat band: the ribbon's centre line carries the colour and
// both rims fall to nothing, so a thick filament reads as a bright cord and a thin one as a thread.
// Over it runs a slow shimmer that travels INWARD FROM BOTH ENDS — a synapse joins neuron A and
// neuron B, not a from and a to, so nothing may flow one way along it and reads as a direction the
// domain never stored. TSL only (one source → WGSL + GLSL, §3.3).
import { abs, float, mix, sin, time } from 'three/tsl'
import * as THREE from 'three/webgpu'

import type { VisualBodySource } from '../../asset-source.ts'
import { asFloatNode, attributeVec3Node } from '../../tsl.ts'

/** Per-vertex ribbon color (vec3) = emotion-neutral filament tint × brightness; filled by the layer. */
export const FILAMENT_VERTEX_COLOR = 'aFilamentColor'
/**
 * Per-vertex ribbon frame (vec3) — `(side, along, phase)`: `side` is ∓1 across the ribbon's width,
 * `along` 0→1 between its two endpoints, `phase` a per-edge shimmer offset. Static geometry data
 * written once by the FatLineLayer, so the strand costs no per-frame work beyond its endpoints.
 */
export const FILAMENT_VERTEX_EDGE = 'aFilamentEdge'

/**
 * Build the static ribbon frame for `capacity` edges — 4 vertices each, in the FatLineLayer's fixed
 * corner order: a(-1) · a(+1) · b(-1) · b(+1). The body and the layer have to agree on this layout
 * exactly (a swapped corner would put the cord's bright centre line on a rim), so the one array that
 * encodes it lives here beside the attribute name it fills.
 */
export function buildFilamentFrame(capacity: number): Float32Array {
  const frame = new Float32Array(Math.max(0, capacity) * 4 * 3)
  for (let edge = 0; edge < capacity; edge++) {
    // A scattered 0..1 per edge slot, so neighbouring strands never pulse in unison. Deterministic
    // (the fract-sin hash the star field twinkles on), so web and mobile shimmer identically.
    const phase = Math.abs(Math.sin(edge * 12.9898) * 43758.5453) % 1
    for (let corner = 0; corner < 4; corner++) {
      const offset = (edge * 4 + corner) * 3
      frame[offset] = corner % 2 === 0 ? -1 : 1
      frame[offset + 1] = corner < 2 ? 0 : 1
      frame[offset + 2] = phase
    }
  }
  return frame
}

// The strand's visual grammar (code, not values.yaml tuning, like the star's seed-form graph):
// how fast the cross-section falls to its rims, and the shimmer's wavelength, speed and depth.
const CORE_FALLOFF = 1.6
const SHIMMER_WAVELENGTH = 14
const SHIMMER_SPEED = 1.1
const SHIMMER_DEPTH = 0.18
const TAU = Math.PI * 2

export interface FilamentBodyOptions {
  /** Let the shimmer run; false holds every strand at its own static phase. */
  readonly animate?: boolean
}

// The filament body is a `shader` source: an additive node material read per vertex. The
// FatLineLayer supplies the ribbon geometry and disposes this placeholder geometry.
export function createFilamentBodySource({
  animate = true,
}: FilamentBodyOptions = {}): VisualBodySource {
  return {
    resolve(): THREE.Mesh {
      const material = new THREE.MeshBasicNodeMaterial()
      const frame = attributeVec3Node(FILAMENT_VERTEX_EDGE)
      const side = frame.x
      const along = frame.y
      const phase = frame.z.mul(float(TAU))

      // 1 on the centre line, 0 at both rims — the cord's cross-section. Additive blending turns
      // that profile straight into glow, so the strand has no hard edge to catch the eye.
      const core = float(1).sub(side.mul(side)).pow(float(CORE_FALLOFF))

      // Distance from the nearer endpoint, so one wave leaves A and B together and meets in the
      // middle: the strand pulses without either end becoming a source.
      const inward = float(0.5).sub(abs(along.sub(float(0.5))))
      const travel = animate ? asFloatNode(time).mul(float(SHIMMER_SPEED)) : float(0)
      const wave = sin(inward.mul(float(SHIMMER_WAVELENGTH)).sub(travel).add(phase))
        .mul(float(0.5))
        .add(float(0.5))
      const shimmer = mix(float(1 - SHIMMER_DEPTH), float(1 + SHIMMER_DEPTH), wave)

      material.colorNode = attributeVec3Node(FILAMENT_VERTEX_COLOR).mul(core).mul(shimmer)
      material.transparent = true
      material.depthWrite = false
      material.blending = THREE.AdditiveBlending
      // The ribbon is a camera-billboarded quad with fixed index winding, so its facing flips
      // with endpoint order and camera angle — draw both sides or ~half the filaments cull away.
      material.side = THREE.DoubleSide
      return new THREE.Mesh(new THREE.BufferGeometry(), material)
    },
  }
}
