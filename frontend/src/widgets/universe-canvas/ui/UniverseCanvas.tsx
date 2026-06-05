// The universe canvas shell (Architecture §3.3): R3F <Canvas> + async WebGPU
// renderer + dark background + ambient star dust + glowing dummy stars + Bloom +
// camera rig. Real stars/synapses/force-sim/data come in specs 07–10; this proves
// the rendering foundation on dummy data. No DOM <Html> in the scene (constitution
// §4 — mobile portability); labels/HUD are a separate 2D widget later.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, type GLProps } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { type WebGPURenderer } from 'three/webgpu'
import { mulberry32 } from '@/shared/lib'
import { createRenderer, rendererBackend } from '@/shared/lib/r3f'
import { useCameraMode } from '../model/use-camera-mode'
import { BloomPass } from './BloomPass'

/** Faint ambient point cloud — the "star dust" backdrop (acceptance 1.3). Always
 *  present, independent of the graph, so an empty universe still renders (1.10).
 *  mulberry32 (not Math.random) keeps generation pure during render
 *  (react-hooks/purity) and the layout stable across re-renders. */
function StarDust({ count = 1500 }: { count?: number }) {
  const positions = useMemo(() => {
    const rng = mulberry32(0x5eed)
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 35 + rng() * 110
      const theta = rng() * Math.PI * 2
      const phi = Math.acos(2 * rng() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.7}
        sizeAttenuation
        color="#9fb4ff"
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}

/** Verification-only glowing points — replaced by entities/star (08). Bright +
 *  toneMapped=false so Bloom picks them up. count<=0 (empty universe) renders
 *  nothing without crashing (acceptance 1.10). key={count} forces a fresh
 *  instanceMatrix if the count ever changes (avoids writing past the old buffer). */
function DummyStars({ count = 14 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rng = mulberry32(0xc0ffee)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      dummy.position.set((rng() - 0.5) * 26, (rng() - 0.5) * 26, (rng() - 0.5) * 26)
      dummy.scale.setScalar(0.3 + rng() * 0.6)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count])

  if (count <= 0) return null
  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1, 2]} />
      <meshBasicMaterial color="#cdb6ff" toneMapped={false} />
    </instancedMesh>
  )
}

/** Camera controls gated by mode: nebula clamps zoom for a whole-universe overview
 *  (1.5); recall releases the clamp for free close-up navigation (1.6). makeDefault
 *  so future camera consumers (specs 07–10) and the bloom pass stay on one camera. */
function CameraRig() {
  const mode = useCameraMode((s) => s.mode)
  return (
    <OrbitControls
      makeDefault
      enableDamping
      enablePan={mode === 'recall'}
      minDistance={mode === 'nebula' ? 22 : 1}
      maxDistance={mode === 'nebula' ? 80 : 600}
    />
  )
}

export function UniverseCanvas({ dummyCount = 14 }: { dummyCount?: number }) {
  // R3F does NOT dispose a custom WebGPU renderer on unmount (its teardown only
  // calls renderLists?.dispose()/forceContextLoss?.(), neither of which exists on
  // WebGPURenderer), so we dispose it ourselves. This parent-level cleanup runs
  // AFTER the Canvas subtree (incl. BloomPass) unmounts, so the pipeline is
  // disposed first, then the renderer frees the backend device + all GPU textures
  // (acceptance 1.7).
  const glRef = useRef<WebGPURenderer | null>(null)
  useEffect(() => () => glRef.current?.dispose(), [])

  return (
    <Canvas
      // gl = async WebGPU factory (WebGL2 auto-fallback). createRenderer is a valid
      // R3F async GLProps factory; the cast only bridges its WebGPURenderer-specific
      // param/return types to R3F's nominal GLProps.
      gl={createRenderer as unknown as GLProps}
      flat
      camera={{ position: [0, 0, 46], fov: 55, near: 0.1, far: 2000 }}
      onCreated={(state) => {
        const gl = state.gl as unknown as WebGPURenderer
        glRef.current = gl
        if (import.meta.env.DEV) {
          console.log('[universe] renderer backend:', rendererBackend(gl))
        }
      }}
    >
      <color attach="background" args={['#070b1e']} />
      <ambientLight intensity={0.4} />
      <StarDust count={1500} />
      <DummyStars count={dummyCount} />
      <CameraRig />
      <BloomPass />
    </Canvas>
  )
}
