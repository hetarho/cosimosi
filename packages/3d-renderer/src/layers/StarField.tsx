import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { float, fract, instanceIndex, sin, uniform, vec3 } from 'three/tsl'
import * as THREE from 'three/webgpu'

export interface StarFieldProps {
  /** Number of background stars. */
  readonly count?: number
  /** Shell radius the stars scatter within. */
  readonly radius?: number
  readonly color?: THREE.ColorRepresentation
  /** Slow drift, radians/sec. */
  readonly spin?: number
  /** Freeze the twinkle to a static frame. */
  readonly reducedMotion?: boolean
}

const FROZEN_TIME = 8

// Shared R3F layer: the small floating background stars — the universe backdrop every emotion sky
// wears. Unlit (MeshBasicNodeMaterial) so they read as light points, and each star TWINKLES on its
// own phase (a per-instance hash off `instanceIndex` drives a host-timed sine), so the field shimmers
// like real starlight rather than sitting as dead dots. Deterministic scatter — no domain data.
export function StarField({
  count = 400,
  radius = 60,
  color = '#cfe0ff',
  spin = 0.01,
  reducedMotion = false,
}: StarFieldProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(0.18, 8, 8), [])
  const time = useMemo(() => uniform(0), [])
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicNodeMaterial()
    const c = new THREE.Color(color)
    // Per-star phase from the instance id (golden-ratio hash → evenly scattered 0..1), so no two
    // stars pulse in lockstep. Squaring the sine sharpens the peaks into brief sparkles, and the
    // 0.2 floor keeps every star faintly lit so none blink fully out.
    const phase = fract(float(instanceIndex).mul(0.618033988749))
    const pulse = sin(time.mul(2.2).add(phase.mul(6.2831853)))
      .mul(0.5)
      .add(0.5)
    const brightness = pulse.mul(pulse).mul(0.8).add(0.2)
    mat.colorNode = vec3(c.r, c.g, c.b).mul(brightness)
    return mat
  }, [color, time])

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

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const frozen = useRef(false)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin
    if (reducedMotion) {
      if (!frozen.current) {
        time.value = FROZEN_TIME
        frozen.current = true
      }
      return
    }
    frozen.current = false
    time.value += delta
  })

  return <instancedMesh ref={ref} args={[geometry, material, count]} frustumCulled={false} />
}
