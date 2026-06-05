// Star visualization (spec 08, Architecture §3.3): every star drawn by ONE
// InstancedMesh (few draw calls — constitution §8) with a TSL node material so it
// runs on WebGPU and the WebGL2 fallback. Per-instance color/brightness/seed come
// from InstancedBufferAttributes; size (=f(intensity)) is baked into the instance
// matrix scale. Coordinates are updated in useFrame from the force-sim buffer (07)
// with NO React re-render (constitution §3, acceptance 1.6) — until 10 wires that
// buffer, a deterministic dummy cluster stands in. This is the only place three/TSL
// appears; the model layer stays pure.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { attribute, float, vec3 } from 'three/tsl'
import { starBrightness, useMemoryStore } from '@/entities/memory'
import { moodRgb } from '@/shared/config'

/** intensity (0..1) → instance scale. */
function sizeFor(intensity: number): number {
  return 0.6 + Math.max(0, Math.min(1, intensity)) * 1.4
}

export interface StarFieldProps {
  /** force-sim positions buffer (07/10). When absent, a dev dummy cluster is used. */
  positionsRef?: { readonly current: Float32Array | null }
}

export function StarField({ positionsRef }: StarFieldProps) {
  const stars = useMemoryStore((s) => s.stars)
  const select = useMemoryStore((s) => s.select)
  const count = stars.length
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const scalesRef = useRef<Float32Array>(new Float32Array(0))

  // Shared geometry + TSL material, created once. The material reads per-instance
  // attributes by name; emissive = mood·brightness (bloom in 06 picks it up), with a
  // subtle seed-driven variation so stars aren't identical. roughness/metalness use
  // plain uniforms.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  const material = useMemo(() => {
    const m = new MeshStandardNodeMaterial()
    // attribute()'s TS type doesn't carry its value type, so wrap in vec3()/float()
    // (casting the input) to get typed ShaderNodeObjects that carry .mul/.add.
    const mood = vec3(attribute('aMood', 'vec3') as never)
    const bright = float(attribute('aBrightness', 'float') as never)
    const seed = float(attribute('aSeed', 'float') as never)
    m.colorNode = mood
    // emissive = mood·brightness·seedFactor. seedFactor ∈ [0.75, 1.0] (≤1) so emissive
    // never exceeds the mood color — with toneMapped=false a >1 factor would clip
    // channels toward white and wash out the hue (undercutting "color = mood").
    m.emissiveNode = mood.mul(bright).mul(seed.mul(0.25).add(0.75))
    m.roughness = 0.45
    m.metalness = 0.0
    m.toneMapped = false // keep emissive bright for bloom
    return m
  }, [])

  // (Re)build per-instance attributes + base matrices when the star set changes.
  // useLayoutEffect runs in the commit phase (before the first R3F frame), so the
  // attributes are bound before the material first renders. Date.now() here is fine
  // (effect, not render).
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const moodArr = new Float32Array(count * 3)
    const seedArr = new Float32Array(count)
    const brightArr = new Float32Array(count)
    const scales = new Float32Array(count)
    const dummy = new Float32Array(count * 3)
    const now = Date.now()
    const obj = new THREE.Object3D()
    const golden = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < count; i++) {
      const m = stars[i].memory
      const rgb = moodRgb(m.mood)
      moodArr[i * 3] = rgb[0]
      moodArr[i * 3 + 1] = rgb[1]
      moodArr[i * 3 + 2] = rgb[2]
      seedArr[i] = m.seed
      brightArr[i] = starBrightness(m.lastRecalledAt, now)
      scales[i] = sizeFor(m.intensity)

      // Deterministic fibonacci-sphere dummy layout (radius varies by seed).
      const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0
      const rAtY = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = golden * i
      const r = 22 + m.seed * 24
      dummy[i * 3] = Math.cos(theta) * rAtY * r
      dummy[i * 3 + 1] = y * r
      dummy[i * 3 + 2] = Math.sin(theta) * rAtY * r

      obj.position.set(dummy[i * 3], dummy[i * 3 + 1], dummy[i * 3 + 2])
      obj.scale.setScalar(scales[i])
      obj.updateMatrix()
      mesh.setMatrixAt(i, obj.matrix)
    }

    geometry.setAttribute('aMood', new THREE.InstancedBufferAttribute(moodArr, 3))
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArr, 1))
    geometry.setAttribute('aBrightness', new THREE.InstancedBufferAttribute(brightArr, 1))
    scalesRef.current = scales
    mesh.count = count
    mesh.instanceMatrix.needsUpdate = true
  }, [stars, count, geometry])

  // Per-frame coordinate subscription: write LIVE force-sim positions (07/10) into the
  // instance matrices, preserving the baked scale. No setState → no re-render (1.6).
  // The dummy layout is static (set once above), so without a live buffer this does
  // nothing — no per-frame re-upload of a motionless scene.
  const scratch = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const mesh = meshRef.current
    const buf = positionsRef?.current
    if (!mesh || count === 0 || !buf) return
    const scales = scalesRef.current
    if (buf.length < count * 3 || scales.length < count) return
    for (let i = 0; i < count; i++) {
      scratch.position.set(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2])
      scratch.scale.setScalar(scales[i])
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (count === 0) return null
  // key={count} → fresh instanceMatrix sized to the new count when stars change.
  // onClick → select that star (raycast gives the instance slot); the recall feature
  // (11) reacts to selectedId. stopPropagation so only the nearest star is picked.
  return (
    <instancedMesh
      key={count}
      ref={meshRef}
      args={[geometry, material, count]}
      onClick={(e) => {
        e.stopPropagation()
        if (e.instanceId == null) return
        const node = stars[e.instanceId]
        if (node) select(node.id)
      }}
    />
  )
}
