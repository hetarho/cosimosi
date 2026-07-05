import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { clamp, float, normalView } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { asVec3Node, attributeVec3Node } from '../tsl.ts'
import type { CoordinateBufferRef } from './InstancedNodeLayer.tsx'

/** Per-contributor emotion color (vec3, linear 0..1) — filled by the field's tints channel. */
const FIELD_INSTANCE_TINT = 'aFieldTint'

export interface ColorFieldProps {
  /** The live simulation coordinate buffer (interleaved xyz, stride 3), read per frame. */
  readonly positions: CoordinateBufferRef
  /** Active contributor count; only the first `count` entries of the arrays below are drawn. */
  readonly count: number
  /**
   * Absolute node index into the coordinate buffer for each contributor (a contributor may be
   * any slot, since callers select the strongest — so this is not a contiguous range).
   */
  readonly nodeIndices: Int32Array | null
  /** Per-contributor color, linear RGB (stride 3). */
  readonly tints: Float32Array | null
  /** Per-contributor bleed radius in world units — the instance scale (wider = stronger). */
  readonly radii: Float32Array | null
  /** Local-region density falloff sharpness; higher keeps a denser core. Caller-supplied
   * (from generated config) — no in-code default, so the field can never render tuning that
   * silently disagrees with values.yaml. */
  readonly falloffExponent: number
  /** Overall ambient amplitude of the field (caller-supplied from generated config). */
  readonly baseIntensity: number
  /** Kernel silhouette tessellation (the per-platform fidelity lever; mobile lower;
   * caller-supplied from generated config). */
  readonly resolution: number
}

// Shared R3F layer: the domain-agnostic color field. Colors in, pixels out — no emotion, no
// palette, no domain import (the scalars are parameters). Each contributor is a soft view-facing
// glow kernel at a coordinate-buffer position, scaled by its bleed radius; the kernels composite
// ADDITIVELY behind the bodies, so overlapping regions sum and bleed rather than collapsing to a
// mean and the overall tone is whatever the framebuffer accumulates — emergent, never stored.
// Positions are read per frame from the coordinate buffer into instance matrices (§3.3), so
// coordinates never pass through React state; the field neither drives the sim nor writes back.
// A background layer (renderOrder -2, depth off) so the latent field (-1) and every real body
// draw on top. Authored in TSL (one source → WGSL + GLSL); no raw-GLSL fork.
export function ColorField({
  positions,
  count,
  nodeIndices,
  tints,
  radii,
  falloffExponent,
  baseIntensity,
  resolution,
}: ColorFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  // A zero-scale matrix collapses an instance to a point (invisible) — used for contributors whose
  // coordinate isn't in the live buffer yet, so they never draw a glow at the world origin.
  const zeroMatrix = useMemo(() => new THREE.Matrix4().makeScale(0, 0, 0), [])
  const segments = Math.max(3, Math.round(resolution))
  const instanceCount = Math.max(1, count)

  const geometry = useMemo(() => new THREE.SphereGeometry(1, segments, segments), [segments])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    mat.transparent = true
    mat.blending = THREE.AdditiveBlending
    mat.depthWrite = false
    mat.depthTest = false
    const tint = attributeVec3Node(FIELD_INSTANCE_TINT)
    // View-facing radial falloff: normalView.z is 1 where the sphere surface faces the camera
    // (the kernel's dense core) and fades to 0 at the silhouette — so a plain sphere reads as a
    // soft glow with no billboarding. `pow(exponent)` sharpens the core; the amplitude is the
    // additive weight (AdditiveBlending premultiplies src by this alpha, so contributions sum).
    const facing = clamp(asVec3Node(normalView).z, float(0), float(1))
    mat.colorNode = tint
    mat.opacityNode = facing.pow(float(falloffExponent)).mul(float(baseIntensity))
    return mat
  }, [falloffExponent, baseIntensity])

  // Upload per-contributor tints as an instance attribute (not per frame): reuse the live buffer
  // in place when the count is unchanged, otherwise create a fresh attribute sized to capacity.
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !tints || count <= 0) return
    const existing = mesh.geometry.getAttribute(FIELD_INSTANCE_TINT) as THREE.InstancedBufferAttribute | undefined
    if (existing && existing.array.length === tints.length) {
      ;(existing.array as Float32Array).set(tints)
      existing.needsUpdate = true
    } else {
      // A count change remounts the mesh but keeps the memoized geometry, so the previous tint
      // attribute is still attached — dispose its GPU buffer before replacing it, or it leaks (the
      // geometry.dispose cleanup below only runs on unmount, not on a count change).
      existing?.dispose()
      mesh.geometry.setAttribute(FIELD_INSTANCE_TINT, new THREE.InstancedBufferAttribute(tints, 3))
    }
  }, [tints, count, instanceCount])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const buffer = positions.current
    if (!buffer || !nodeIndices || !radii || count <= 0) {
      mesh.visible = false
      return
    }
    for (let i = 0; i < count; i++) {
      const offset = (nodeIndices[i] ?? 0) * 3
      // No live coordinate for this contributor yet — e.g. a memory inserted optimistically before
      // the next GetUniverse read grew the buffer. Draw it at zero scale (invisible) rather than
      // piling its glow at the world origin.
      if (offset < 0 || offset + 2 >= buffer.length) {
        mesh.setMatrixAt(i, zeroMatrix)
        continue
      }
      const size = radii[i] ?? 0
      matrix.makeScale(size, size, size)
      matrix.setPosition(buffer[offset] ?? 0, buffer[offset + 1] ?? 0, buffer[offset + 2] ?? 0)
      mesh.setMatrixAt(i, matrix)
    }
    mesh.count = count
    mesh.visible = true
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      key={instanceCount}
      ref={(mesh: THREE.InstancedMesh | null) => {
        meshRef.current = mesh
        if (mesh) {
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
          mesh.count = 0
          mesh.visible = false
        }
      }}
      args={[geometry, material, instanceCount]}
      frustumCulled={false}
      renderOrder={-2}
    />
  )
}
