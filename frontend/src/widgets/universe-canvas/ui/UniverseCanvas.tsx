// The universe canvas shell (Architecture §3.3): R3F <Canvas> + async WebGPU
// renderer + dark background + ambient star dust + the real StarField (08, driven by
// the memory store / spec 10 data) + Bloom + camera rig. No DOM <Html> in the scene
// (constitution §4 — mobile portability); labels/HUD are a separate 2D widget.
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, type GLProps, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { type WebGPURenderer } from 'three/webgpu'
import { StarField } from '@/entities/star'
import { SynapseFilaments, SynapseDust, useSynapseStore } from '@/entities/synapse'
import { useMemoryStore } from '@/entities/memory'
import { moodRgb, NEUTRAL_RGB } from '@/shared/config'
import { mulberry32, fibonacciStarPosition } from '@/shared/lib'
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

/** Camera controls gated by mode. nebula = the wide overview: fully free zoom in/out
 *  (no clamp) so you can frame the whole star shell or dive in at will. recall = close
 *  navigation: zoom-OUT is capped (maxDistance 70) so you stay "in" the universe and
 *  can't pull back to an overview — instead you fly around via the HUD D-pad (NavController
 *  translates the camera). makeDefault so the bloom pass + fly-to share one camera. */
function CameraRig() {
  const mode = useCameraMode((s) => s.mode)
  return (
    <OrbitControls
      makeDefault
      enableDamping
      enablePan={mode === 'recall'}
      minDistance={mode === 'nebula' ? 2 : 1}
      maxDistance={mode === 'nebula' ? 1500 : 70}
    />
  )
}

const WORLD_UP = new THREE.Vector3(0, 1, 0)

/** Recall-mode "real navigation". Two distinct motions, both frame-rate-independent and
 *  a no-op outside recall:
 *  - z (전진/후진): translate the camera AND orbit target together along the look
 *    direction — flies the rig through space, distance (and zoom clamp) preserved.
 *  - x/y (방향키): rotate the LOOK in place. Camera position stays fixed; only the orbit
 *    target swings around it (yaw about world-up, pitch about the camera's right axis),
 *    so it's a first-person turn, not a strafe. Rotation preserves the camera↔target
 *    distance, so OrbitControls.update() re-aims without nudging the position. */
function NavController() {
  const mode = useCameraMode((s) => s.mode)
  const move = useCameraMode((s) => s.move)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const right = useRef(new THREE.Vector3())
  const fwd = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const tmp = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const { x, y, z } = move
    if (mode !== 'recall' || !controls || (x === 0 && y === 0 && z === 0)) return
    const dist = camera.position.distanceTo(controls.target)

    // 전진/후진: move the whole rig along the look direction (position changes).
    if (z !== 0) {
      fwd.current.subVectors(controls.target, camera.position).normalize()
      fwd.current.multiplyScalar(z * dist * 0.9 * dt)
      camera.position.add(fwd.current)
      controls.target.add(fwd.current)
    }

    // 방향키: rotate the look vector (target − camera). Length is preserved, so the
    // position stays put and only the aim changes.
    if ((x !== 0 || y !== 0) && dist > 0) {
      const ang = 1.4 * dt
      look.current.subVectors(controls.target, camera.position)
      if (x !== 0) look.current.applyAxisAngle(WORLD_UP, -x * ang) // yaw (left/right)
      if (y !== 0) {
        right.current.setFromMatrixColumn(camera.matrix, 0).normalize()
        tmp.current.copy(look.current).applyAxisAngle(right.current, y * ang) // pitch
        // Don't tip past ~±80° of vertical (avoid the gimbal flip at the poles).
        if (Math.abs(tmp.current.dot(WORLD_UP) / dist) < 0.985) look.current.copy(tmp.current)
      }
      controls.target.copy(camera.position).add(look.current)
    }

    controls.update()
  })

  return null
}

/** Renders the synapse graph (braided TSL filaments) at the same deterministic star
 *  positions StarField uses, so edges connect the rendered stars; each filament also
 *  fades between its two endpoint stars' mood colors. Edge brightness (incl. dormant
 *  dimming) is already baked into the store by get-universe (12). positionOf + colorOf
 *  are built in one useMemo so both stay stable (the filament geometry rebuilds only
 *  when the star set changes, not on every parent render). */
function UniverseSynapses() {
  const edges = useSynapseStore((s) => s.edges)
  const stars = useMemoryStore((s) => s.stars)
  const { positionOf, colorOf } = useMemo(() => {
    const posById = new Map(
      stars.map((s, i) => [s.id, fibonacciStarPosition(i, stars.length, s.memory.seed)] as const),
    )
    const colById = new Map(stars.map((s) => [s.id, moodRgb(s.memory.mood)] as const))
    return {
      positionOf: (id: string): [number, number, number] | null => posById.get(id) ?? null,
      colorOf: (id: string): readonly [number, number, number] => colById.get(id) ?? NEUTRAL_RGB,
    }
  }, [stars])
  if (edges.length === 0 || stars.length === 0) return null
  return (
    <>
      <SynapseFilaments edges={edges} positionOf={positionOf} colorOf={colorOf} />
      <SynapseDust edges={edges} positionOf={positionOf} colorOf={colorOf} />
    </>
  )
}

/** Camera fly-to (12): when the dormant page sets focusStarId, lerp the camera to that
 *  star's position and look at it, then select() it (opens the recall panel — re-ignite,
 *  2.2). Reads the SAME layout helper as StarField so it lands on the rendered star.
 *  The request is CONSUMED into local refs (and the store focus cleared) the moment the
 *  target is captured — so no stale focus can yank the camera on a later visit, and the
 *  flight survives StrictMode's setup→cleanup→setup (refs persist). Pure useFrame
 *  interpolation — no per-frame React state. */
function FlyToController() {
  const focusStarId = useCameraMode((s) => s.focusStarId)
  const focusStar = useCameraMode((s) => s.focusStar)
  const setMode = useCameraMode((s) => s.setMode)
  const stars = useMemoryStore((s) => s.stars)
  const select = useMemoryStore((s) => s.select)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const flyingIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!focusStarId) return
    // Index by ARRAY position (like StarField + UniverseSynapses), not StarNode.index,
    // so the camera lands exactly where the star is rendered even if the two ever drift.
    const idx = stars.findIndex((s) => s.id === focusStarId)
    if (idx === -1) return // stars not loaded yet — effect re-runs when `stars` arrives
    const [x, y, z] = fibonacciStarPosition(idx, stars.length, stars[idx].memory.seed)
    targetRef.current = new THREE.Vector3(x, y, z)
    flyingIdRef.current = focusStarId
    setMode('recall') // release the nebula zoom clamp for the close-up
    focusStar(null) // consume the request now → no stale store focus; refs drive the flight
  }, [focusStarId, stars, setMode, focusStar])

  useFrame((_, dt) => {
    const target = targetRef.current
    if (!target) return
    // Park the camera just outside the star along its radial direction, looking in.
    const desired = target.clone().add(target.clone().normalize().multiplyScalar(12))
    const k = 1 - Math.exp(-dt * 3) // frame-rate-independent damping
    camera.position.lerp(desired, k)
    if (controls) {
      controls.target.lerp(target, k)
      controls.update()
    } else {
      camera.lookAt(target)
    }
    if (camera.position.distanceTo(desired) < 0.6) {
      if (flyingIdRef.current) select(flyingIdRef.current) // arrived → recall panel (11)
      targetRef.current = null
      flyingIdRef.current = null
    }
  })

  return null
}

export function UniverseCanvas() {
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
      camera={{ position: [0, 0, 110], fov: 72, near: 0.1, far: 2000 }}
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
      <UniverseSynapses />
      <StarField />
      <CameraRig />
      <NavController />
      <FlyToController />
      <BloomPass />
    </Canvas>
  )
}
