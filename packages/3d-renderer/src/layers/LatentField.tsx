import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { float, positionLocal, sin, uniform, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

import { asFloatNode } from '../tsl.ts'

export interface LatentFieldProps {
  /** Interleaved xyz instance positions (stride 3), length >= count*3. Written once, not per frame. */
  readonly positions: Float32Array | null
  readonly count: number
  /** World radius of each latent point. */
  readonly size?: number
  readonly color?: THREE.ColorRepresentation
  /** Shader-time ambient drift amplitude, as a fraction of a point's radius; 0 disables the wobble. */
  readonly drift?: number
  /** Instance indices to hide (a point that has awakened is no longer drawn as latent). */
  readonly consumed?: ReadonlySet<number> | null
}

// Shared R3F layer: the gray latent-neuron field — the not-yet-recruited "silent engram"
// backdrop [E7a][V7]. A single InstancedMesh whose transforms are written ONCE at init (and
// only rewritten when the field/consumed set changes), never per frame — the field is ambient,
// not a force-sim node, so it neither reads the coordinate buffer nor attracts real nodes [I5].
// A background layer: depthTest/Write off + renderOrder -1 so every real body draws on top
// (AC A3). The material is authored in TSL (one source → WGSL + GLSL, §3.3); a subtle
// shader-time positionLocal wobble gives the dust life without carrying any meaning.
export function LatentField({
  positions,
  count,
  size = 0.15,
  color = '#7d8ba8',
  drift = 0,
  consumed = null,
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
    if (drift > 0) {
      // Per-vertex sine wobble on the local sphere → a gentle, meaning-free breathing of the
      // dust. Amplitude is scaled by the instance size (positionLocal is pre-instance-matrix),
      // so `drift` reads as a fraction of a point's own radius.
      const t = asFloatNode(uTime)
      const wobble = vec3(sin(t), sin(t.mul(1.3).add(2.1)), sin(t.mul(0.7).add(4.2))).mul(float(drift))
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
      dummy.position.set(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0)
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

  // Advance the drift clock in place (a single uniform write); the matrices stay untouched.
  useFrame((_, delta) => {
    if (drift > 0) uTime.value += delta
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
