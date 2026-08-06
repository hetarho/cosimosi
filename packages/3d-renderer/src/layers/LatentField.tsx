import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  abs,
  float,
  fract,
  instanceIndex,
  min,
  normalView,
  positionLocal,
  pow,
  sin,
  uniform,
  vec3,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import { asFloatNode, attributeFloatNode } from '../tsl.ts'
import { REDUCED_MOTION_FROZEN_TIME } from './reduced-motion.ts'

// The dust's visual grammar (code, like the field's colour): how soft each mote's edge falls, and the
// bands every mote draws its own twinkle and its own wander from. One independent hash draw per band,
// so no two motes agree on brightness, beat, shape or heading.
const MOTE_SOFTNESS = 1.5
const BREATH_DEPTH_MIN = 0.55
const BREATH_DEPTH_SPREAD = 0.4
const BREATH_RATE_MIN = 0.7
const BREATH_RATE_SPREAD = 1.8
const BREATH_SHARPNESS_MIN = 1.6
const BREATH_SHARPNESS_SPREAD = 2.4
const MOTE_DIM_MIN = 0.72
const MOTE_DIM_SPREAD = 0.28
// Overdrive on the twinkle, clamped at full: the peak SATURATES instead of merely arriving, which is
// what turns a rise in brightness into a spark, and it buys back the average the deep troughs spend.
// The clamp is explicit rather than left to the backend — WebGL clamps a fragment's alpha and WebGPU
// does not, and a flash may not be brighter on one path than the other.
const BREATH_GAIN = 1.35
const DRIFT_RATE_MIN = 0.28
const DRIFT_RATE_SPREAD = 0.34
const HASH_GAIN = 43758.5453
const TAU = Math.PI * 2

// Per-mote hash for the FRAGMENT stage: a scattered 0..1 off the instance id, one independent draw per
// salt. The same fract-sin hash the background star field uses, so the two dust layers agree on how
// they scatter.
//
// Fragment stage ONLY. `instanceIndex` is one shared contextual node: outside the vertex stage it
// resolves through a varying, and the TSL spec's varying rule ("if `varying()` is added only to
// `material.positionNode` ... varying will not be created") means the same index read inside
// `positionNode` leaves the fragment side holding a vertex-only variable — an invalid shader, which
// draws the whole field as nothing. Vertex-stage randomness comes off the seed attribute instead.
function moteHash(salt: number) {
  return fract(sin(float(instanceIndex).mul(12.9898).add(salt)).mul(HASH_GAIN))
}

/** Per-instance wander seed (float, 0..1) — written once by the layer, read by the vertex stage. */
export const LATENT_INSTANCE_SEED = 'aLatentSeed'

// The seed a mote is born with: the golden-ratio sequence, so the values spread evenly over 0..1 at
// every count instead of clumping the way independent draws would, and identically on every platform.
function moteSeed(index: number) {
  return (index * 0.618033988749895) % 1
}

// Per-mote hash for the VERTEX stage, off that seed. Same fract-sin shape as `moteHash`, and one
// independent draw per salt — but from an attribute, so the value is per-MOTE rather than per-vertex
// and never asks the position pipeline for an instance index.
function seedHash(seed: ReturnType<typeof attributeFloatNode>, salt: number) {
  return fract(sin(seed.mul(12.9898).add(salt)).mul(HASH_GAIN))
}

export interface LatentFieldProps {
  /** Interleaved xyz instance positions (stride 3), length >= count*3. Written once, not per frame. */
  readonly positions: Float32Array | null
  readonly count: number
  /** World radius of each latent point. Caller-supplied (from generated config) so the
   * default can't silently disagree with values.yaml. */
  readonly size: number
  readonly color?: THREE.ColorRepresentation
  /** How far a mote may wander from its place, in WORLD units; 0 holds every mote still. */
  readonly drift?: number
  /** Instance indices to hide (a point that has awakened is no longer drawn as latent). */
  readonly consumed?: ReadonlySet<number> | null
  /** Freeze the drift and the per-mote breath to a static frame. */
  readonly reducedMotion?: boolean
  /** Sphere segments per mote (width and height alike). Caller-supplied from generated config for
   *  the same reason `size` is — the mobile MVP takes a coarser shell than the web (§3.5). */
  readonly segments?: number
}

/** The two platform mote tessellations, straight from `rendering.latent_star_segments*`. */
export const LATENT_FIELD_SEGMENTS = {
  web: VALUES.rendering.latentStarSegments,
  mobile: VALUES.rendering.latentStarSegmentsMobile,
} as const

export interface LatentMaterialOptions {
  readonly color: THREE.ColorRepresentation
  /** World distance a mote may wander from its place; 0 leaves the position pipeline untouched. */
  readonly drift: number
  /** The field clock uniform the host advances each frame. */
  readonly time: unknown
}

// One mote's worth of geometry, plus the per-instance seed its wander is drawn from. The seed rides
// the geometry as an instanced attribute (the way a star body carries its own seed) because the vertex
// stage needs a value constant across a mote's vertices: a hash that varied per vertex would scatter
// the sphere's triangles instead of moving the sphere, and a mote collapsed to scale 0 — one that has
// awakened — would come back as a cloud of them instead of staying gone.
//
// A construction seam for the same reason the material is one: the wander reads this attribute BY NAME,
// and a name that stops matching costs nothing at build time and silently freezes every mote.
export function createLatentGeometry(count: number, segments: number) {
  const geometry = new THREE.SphereGeometry(1, segments, segments)
  const seeds = new Float32Array(Math.max(1, count))
  for (let i = 0; i < seeds.length; i++) seeds[i] = moteSeed(i)
  geometry.setAttribute(LATENT_INSTANCE_SEED, new THREE.InstancedBufferAttribute(seeds, 1))
  return geometry
}

// Package-internal construction seam: the material IS the look, and it is the part of this layer a
// test can hold. A graph that reaches for the wrong stage builds without complaint here and then draws
// the whole field as nothing, so `LatentField.test.ts` walks what comes out of this function.
export function createLatentMaterial({ color, drift, time }: LatentMaterialOptions) {
  const mat = new THREE.MeshBasicNodeMaterial()
  mat.color.set(color)
  mat.depthWrite = false
  mat.depthTest = false
  // Additive so overlapping motes pool into a faint haze rather than punching over each other,
  // and so the field can carry a soft edge at all — the profile below IS the softness.
  mat.transparent = true
  mat.blending = THREE.AdditiveBlending
  const t = asFloatNode(time)
  // Each mote twinkles on its own clock AND at its own strength: its own phase and rate, its own
  // pulse shape (the exponent turns a slow breath into a brief spark), its own depth of dimming, and
  // its own steady brightness. So the field is a mix of faint and bright with nothing beating in
  // unison — most motes sitting low, a scattering of them flaring to full at any instant. The
  // dimmest very nearly leave the frame between flashes; that trough is what makes the flash read.
  const breath = sin(
    t.mul(moteHash(23.1).mul(BREATH_RATE_SPREAD).add(BREATH_RATE_MIN)).add(moteHash(11.7).mul(TAU)),
  )
    .mul(float(0.5))
    .add(float(0.5))
  const depth = moteHash(47.3).mul(BREATH_DEPTH_SPREAD).add(BREATH_DEPTH_MIN)
  const sharpness = moteHash(59.7).mul(BREATH_SHARPNESS_SPREAD).add(BREATH_SHARPNESS_MIN)
  const dim = moteHash(71.9).mul(MOTE_DIM_SPREAD).add(MOTE_DIM_MIN)
  const glow = min(
    pow(breath, sharpness).mul(depth).add(float(1).sub(depth)).mul(dim).mul(float(BREATH_GAIN)),
    float(1),
  )
  // Fade each mote toward its own silhouette (the normal turns side-on there), so a point reads as
  // a smudge of dust instead of a hard little sphere.
  mat.opacityNode = pow(abs(normalView.z), float(MOTE_SOFTNESS)).mul(glow)
  if (drift > 0) {
    // Each mote wanders along its OWN heading, on its own clock. A heading shared across the field
    // would slide all of it one way at once, and motion that coherent reads as the sky sliding rather
    // than as dust living inside it. `drift` is a WORLD distance: `positionLocal` reaches a
    // positionNode with the instance transform already baked in (the coordinate-space trap the star
    // bodies are built around), so an offset added here is not scaled by a mote's own radius.
    //
    // Each heading component is its own hash, which leaves the vector's length scattered too: some
    // motes cross the full reach, some barely leave their place. Slow, but not slower than the eye can
    // see — a few pixels a second, or the field reads as a photograph.
    const seed = attributeFloatNode(LATENT_INSTANCE_SEED)
    const heading = vec3(
      seedHash(seed, 3.7).sub(float(0.5)),
      seedHash(seed, 41.3).sub(float(0.5)),
      seedHash(seed, 67.1).sub(float(0.5)),
    )
    const sway = sin(
      t
        .mul(seedHash(seed, 83.9).mul(DRIFT_RATE_SPREAD).add(DRIFT_RATE_MIN))
        .add(seedHash(seed, 5.3).mul(TAU)),
    )
    mat.positionNode = positionLocal.add(heading.mul(sway).mul(float(drift)))
  }
  return mat
}

// Shared R3F layer: the gray latent-neuron field — the not-yet-recruited "silent engram"
// backdrop [E7a][V7]. A single InstancedMesh whose transforms are written ONCE at init (and
// only rewritten when the field/consumed set changes), never per frame — the field is ambient,
// not a force-sim node, so it neither reads the coordinate buffer nor attracts real nodes [I5].
// A background layer: depthTest/Write off + renderOrder -1 so every real body draws on top
// (AC A3). The material is authored in TSL (one source → WGSL + GLSL, §3.3); a shader-time
// positionLocal offset gives the dust life without carrying any meaning.
//
// The LOOK is dust, not beads: each mote fades at its own silhouette (additive, so a clump of them
// pools into a faint cloud instead of stacking hard dots), twinkles on its own clock at its own
// strength, and wanders along its own heading. Every mote is the same colour and the same size — a
// latent neuron has no identity and no emotion yet [E7a][V7] — so brightness and heading are the only
// things that tell one from another, and both are per-mote hashes rather than anything meant. That is
// the whole feeling: something is out there, alive, not yet anything in particular.
export function LatentField({
  positions,
  count,
  size,
  color = '#7d8ba8',
  drift = 0,
  consumed = null,
  reducedMotion = false,
  segments = LATENT_FIELD_SEGMENTS.web,
}: LatentFieldProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const uTime = useMemo(() => uniform(0), [])
  const instanceCount = Math.max(1, count)
  // Hide a freshly-mounted mesh until the matrix effect writes it: a new InstancedMesh starts at
  // full count with zero matrices (a keyed remount would otherwise draw one degenerate frame).
  // A stable callback ref (never re-run per render) so an unrelated re-render can't reset count.
  const attach = useCallback((mesh: THREE.InstancedMesh | null) => {
    ref.current = mesh
    if (mesh) {
      mesh.count = 0
      mesh.visible = false
    }
  }, [])
  const geometry = useMemo(
    () => createLatentGeometry(instanceCount, segments),
    [instanceCount, segments],
  )
  const material = useMemo(
    () => createLatentMaterial({ color, drift, time: uTime }),
    [color, drift, uTime],
  )

  // Write the instance matrices once from the static field (re-run only when the field, size, or
  // the consumed set changes) — a consumed point collapses to scale 0 so it stops being drawn.
  // `geometry` is a dependency because a new one rebuilds the mesh through `args`, and the attach
  // ref hides it at count 0 until this effect fills it: without the dep, a field whose only change
  // was its tessellation would stay blank.
  useEffect(() => {
    const mesh = ref.current
    if (!mesh || !positions) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const hidden = consumed?.has(i) ?? false
      dummy.position.set(
        positions[i * 3] ?? 0,
        positions[i * 3 + 1] ?? 0,
        positions[i * 3 + 2] ?? 0,
      )
      dummy.scale.setScalar(hidden ? 0 : size)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
    mesh.visible = true
  }, [positions, count, size, consumed, geometry])

  // One resource per effect: a geometry rebuilt for a new count or tessellation must not take the
  // still-mounted material down with it.
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  // Advance the field clock in place (a single uniform write) — it carries both the drift and each
  // mote's breath; the matrices stay untouched. Reduced motion holds one frame mid-twinkle.
  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        uTime.value = REDUCED_MOTION_FROZEN_TIME
        frozen.current = true
      }
      return
    }
    frozen.current = false
    uTime.value += delta
  })

  return (
    <instancedMesh
      key={instanceCount}
      ref={attach}
      args={[geometry, material, instanceCount]}
      frustumCulled={false}
      renderOrder={-1}
    />
  )
}
