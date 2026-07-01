import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

export interface StarFieldProps {
  /** Number of background stars. */
  readonly count?: number
  /** Shell radius the stars scatter within. */
  readonly radius?: number
  readonly color?: THREE.ColorRepresentation
  /** Slow drift, radians/sec. */
  readonly spin?: number
}

// Shared R3F layer: the small floating background stars. Unlit (MeshBasicNodeMaterial) so
// they read as light points. Deterministic scatter — no domain data, no force-sim.
export function StarField({ count = 400, radius = 60, color = '#cfe0ff', spin = 0.01 }: StarFieldProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(0.18, 8, 8), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    mat.color.set(color)
    return mat
  }, [color])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count
      const phi = Math.acos(1 - 2 * t) // even latitude spread on a sphere
      const theta = i * 2.399963 // golden angle → even longitude
      const depth = 0.45 + 0.55 * (((i * 9301 + 49297) % 233280) / 233280) // deterministic depth
      const r = radius * depth
      dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      )
      dummy.scale.setScalar(0.5 + ((i * 12347) % 233280) / 233280)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count, radius])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
}
