import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  abs,
  float,
  fract,
  instanceIndex,
  normalView,
  positionLocal,
  pow,
  sin,
  uniform,
  vec3,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

import { asFloatNode } from '../tsl.ts'

/** The time every mote is frozen at under reduced motion — a frame mid-twinkle, not a dark one. */
const FROZEN_TIME = 8

// The dust's visual grammar (code, like the field's colour): how soft each mote's edge falls, how
// deep it can dim between breaths, and how slowly it breathes.
const MOTE_SOFTNESS = 1.5
const BREATH_DEPTH = 0.4
const BREATH_RATE_MIN = 0.12
const BREATH_RATE_SPREAD = 0.3
const TAU = Math.PI * 2

// Per-mote hash: a scattered 0..1 off the instance id, one independent draw per salt. The same
// fract-sin hash the background star field uses, so the two dust layers agree on how they scatter.
function moteHash(salt: number) {
  return fract(sin(float(instanceIndex).mul(12.9898).add(salt)).mul(43758.5453))
}

export interface LatentFieldProps {
  /** Interleaved xyz instance positions (stride 3), length >= count*3. Written once, not per frame. */
  readonly positions: Float32Array | null
  readonly count: number
  /** World radius of each latent point. Caller-supplied (from generated config) so the
   * default can't silently disagree with values.yaml. */
  readonly size: number
  readonly color?: THREE.ColorRepresentation
  /** Shader-time ambient drift amplitude, as a fraction of a point's radius; 0 disables the wobble. */
  readonly drift?: number
  /** Instance indices to hide (a point that has awakened is no longer drawn as latent). */
  readonly consumed?: ReadonlySet<number> | null
  /** Freeze the drift and the per-mote breath to a static frame. */
  readonly reducedMotion?: boolean
}

// Shared R3F layer: the gray latent-neuron field — the not-yet-recruited "silent engram"
// backdrop [E7a][V7]. A single InstancedMesh whose transforms are written ONCE at init (and
// only rewritten when the field/consumed set changes), never per frame — the field is ambient,
// not a force-sim node, so it neither reads the coordinate buffer nor attracts real nodes [I5].
// A background layer: depthTest/Write off + renderOrder -1 so every real body draws on top
// (AC A3). The material is authored in TSL (one source → WGSL + GLSL, §3.3); a subtle
// shader-time positionLocal wobble gives the dust life without carrying any meaning.
//
// The LOOK is dust, not beads: each mote fades at its own silhouette (additive, so a clump of them
// pools into a faint cloud instead of stacking hard dots) and BREATHES on its own slow clock. Every
// mote is the same colour and the same size — a latent neuron has no identity and no emotion yet
// [E7a][V7] — so the only thing that distinguishes one from another is when it happens to be
// brightest. That is the whole feeling: something is out there, not yet anything in particular.
export function LatentField({
  positions,
  count,
  size,
  color = '#7d8ba8',
  drift = 0,
  consumed = null,
  reducedMotion = false,
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
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 6, 6), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    mat.color.set(color)
    mat.depthWrite = false
    mat.depthTest = false
    // Additive so overlapping motes pool into a faint haze rather than punching over each other,
    // and so the field can carry a soft edge at all — the profile below IS the softness.
    mat.transparent = true
    mat.blending = THREE.AdditiveBlending
    const t = asFloatNode(uTime)
    // Each mote breathes on its own phase at its own slow rate, and none goes fully dark: the field
    // should look like it is settling, not blinking.
    const breath = sin(
      t
        .mul(moteHash(23.1).mul(BREATH_RATE_SPREAD).add(BREATH_RATE_MIN))
        .add(moteHash(11.7).mul(TAU)),
    )
      .mul(float(0.5))
      .add(float(0.5))
    const glow = float(1)
      .sub(float(BREATH_DEPTH))
      .add(breath.mul(float(BREATH_DEPTH)))
    // Fade each mote toward its own silhouette (the normal turns side-on there), so a point reads as
    // a smudge of dust instead of a hard little sphere.
    mat.opacityNode = pow(abs(normalView.z), float(MOTE_SOFTNESS)).mul(glow)
    if (drift > 0) {
      // Per-vertex sine wobble on the local sphere → a gentle, meaning-free breathing of the
      // dust. Amplitude is scaled by the instance size (positionLocal is pre-instance-matrix),
      // so `drift` reads as a fraction of a point's own radius.
      const wobble = vec3(sin(t), sin(t.mul(1.3).add(2.1)), sin(t.mul(0.7).add(4.2))).mul(
        float(drift),
      )
      mat.positionNode = positionLocal.add(wobble)
    }
    return mat
  }, [color, drift, uTime])

  // Write the instance matrices once from the static field (re-run only when the field, size, or
  // the consumed set changes) — a consumed point collapses to scale 0 so it stops being drawn.
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
  }, [positions, count, size, consumed])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Advance the field clock in place (a single uniform write) — it carries both the drift and each
  // mote's breath; the matrices stay untouched. Reduced motion holds one frame mid-twinkle.
  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (reducedMotion) {
      if (!frozen.current) {
        uTime.value = FROZEN_TIME
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
