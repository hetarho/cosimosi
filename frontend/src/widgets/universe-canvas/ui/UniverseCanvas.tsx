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

// Stars sit on a fibonacci shell at radius 22 + seed·24 (shared/lib/layout), so the cloud's
// outer edge is ~46. The two camera experiences pivot on that boundary:
//  - nebula (자유 관찰): orbit from OUTSIDE — pull back to frame the whole cloud, but zoom-IN
//    is capped at OBSERVE_MIN_DIST so you can't enter the star space (observe from outside).
//  - recall (우주선): start at the dead centre and fly with the D-pad, but the camera is
//    clamped inside SHIP_BOUNDARY so you can't leave the star space (NavController enforces it).
const STAR_SHELL_OUTER = 46
const OBSERVE_MIN_DIST = STAR_SHELL_OUTER + 12 // 58 — cap zoom-in a bit earlier (observe from outside)
const SHIP_BOUNDARY = STAR_SHELL_OUTER * 0.85 // ~39 — stop short of the empty edge (at the wall nothing's in view)
const SHIP_LOOK_AHEAD = 24 // recentre: how far ahead of the origin the look target sits
const NEBULA_FRAME_DIST = 110 // fallback reframe distance (only when there's no saved overview pose)

// Recall-mode flight feel. Forward/back thrust uses a world-space VELOCITY → inertia (coasts on
// release) plus acceleration (eases up to BASE_SPEED·boost while held). Shake is a tiny rig wobble.
const BASE_SPEED = 16 // world units/sec cruise (before the hold-boost)
const MAX_BOOST = 2 // hold thrust → up to 2× cruise (가속도 최대 2배)
const BOOST_RAMP = 1.4 // seconds of holding to reach MAX_BOOST
const ACCEL_K = 2.4 // velocity ease toward the target speed while thrusting (1/s)
const DRAG_K = 0.9 // velocity ease toward 0 on release (1/s) — the coasting inertia
const SPEED_REF = BASE_SPEED * MAX_BOOST // normaliser for the speed-scaled shake
const RECOIL = 1.2 // inward bounce on wall contact ("hit a wall")
const WALL_REARM = 3 // must drift this far back inside before another wall jolt can fire
const HIT_SHAKE = 1 // jolt handed to the shake on impact
const IDLE_AMP = 0.09 // always-on engine wobble (present even when stationary)
const SPEED_AMP = 0.13 // extra wobble scaled by current speed
const IMPULSE_AMP = 0.9 // peak extra wobble from a wall jolt
const IMPULSE_DECAY = 6 // 1/s — jolt fades in ~0.4s
// Shake speed: a slow gentle sway when stationary, a faster vibration with speed, a quick
// rattle on impact. Drives a phase accumulator (continuous → no jumps when the rate changes).
const SHAKE_FREQ_IDLE = 0.32 // idle frequency scale (slow left-right sway)
const SHAKE_FREQ_MOVE = 1.25 // added at full speed
const SHAKE_FREQ_HIT = 1.6 // added at peak jolt

/** OrbitControls gated by mode. nebula = wide overview: zoom-out free (frame the whole shell),
 *  zoom-IN capped at OBSERVE_MIN_DIST so you stay outside the cloud. recall = close navigation
 *  via the HUD D-pad (NavController), bounded by SHIP_BOUNDARY. While a mode transition is in
 *  flight the distance clamps are relaxed declaratively (so the flight can pass through the
 *  forbidden zone) and snap back on arrival. makeDefault so the bloom pass + fly-to + mode
 *  transitions share one camera. */
function CameraRig() {
  const mode = useCameraMode((s) => s.mode)
  const transitioning = useCameraMode((s) => s.transitioning)
  const minDistance = transitioning ? 0.01 : mode === 'nebula' ? OBSERVE_MIN_DIST : 1
  const maxDistance = transitioning ? 1e6 : mode === 'nebula' ? 1500 : 70
  // recall (우주선) is driven ENTIRELY by the D-pad (NavController owns position + look), so
  // mouse/drag orbit + scroll-zoom are disabled there — otherwise they fight the controller.
  // Pan is never wanted. During a transition flight, input is off too so it can't grab the lerp.
  const interactive = mode === 'nebula' && !transitioning
  return (
    <OrbitControls
      makeDefault
      enableDamping
      enableRotate={interactive}
      enableZoom={interactive}
      enablePan={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  )
}

const WORLD_UP = new THREE.Vector3(0, 1, 0)

/** Recall-mode "real navigation" — one frame-rate-independent useFrame. Order: gate → revert
 *  last shake → accel/inertia thrust → look rotation → wall clamp(+recoil/jolt) → orbit solve →
 *  apply fresh shake → final solve. A no-op outside recall AND during any guided flight
 *  (transitioning): silencing nav during the dive/fly-to guarantees those flights reach arrival
 *  and clear `transitioning`, so the wall is never left disabled.
 *  - 전진/후진: a world-space velocity (vel) — eases up to BASE_SPEED·boost while held (boost
 *    ramps 1→2 for acceleration) and coasts toward 0 on release → real inertia. pos += vel·dt.
 *  - 방향키: rotate the look in place (un-accelerated); inertia keeps you drifting as you turn.
 *  - Wall: ALWAYS clamp inside SHIP_BOUNDARY (same-delta shift preserves heading + camera↔target
 *    distance, so OrbitControls.update() reproduces it); first contact recoils inward, kills the
 *    inertia, and fires a jolt → "hit a wall" feel.
 *  - Shake: a tiny screen-space rig wobble (same offset on camera+target → heading/radius kept;
 *    reverted next frame so it never drifts). Always on (idle hum), stronger with speed + jolts. */
function NavController() {
  const mode = useCameraMode((s) => s.mode)
  const move = useCameraMode((s) => s.move)
  const transitioning = useCameraMode((s) => s.transitioning)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null

  const right = useRef(new THREE.Vector3())
  const upAxis = useRef(new THREE.Vector3())
  const fwd = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const tmp = useRef(new THREE.Vector3())
  const vel = useRef(new THREE.Vector3()) // world-space velocity → inertia/coasting
  const boost = useRef(1) // 1→2 acceleration multiplier while thrusting
  const onWall = useRef(false) // touching the wall last frame (one-shot recoil/jolt gate)
  const shakePhase = useRef(0) // accumulated shake phase (its rate varies with speed/impact)
  const shakeImpulse = useRef(0) // decaying wall jolt
  const shakeOffset = useRef(new THREE.Vector3()) // last frame's wobble (reverted next frame)

  useFrame((_, dt) => {
    // GATE: bail outside recall and during any guided flight. No nav fights the dive/fly-to, so
    // those always arrive and clear `transitioning`. Undo any residual shake and reset state.
    if (mode !== 'recall' || !controls || transitioning) {
      if (shakeOffset.current.lengthSq() > 0) {
        camera.position.sub(shakeOffset.current)
        controls?.target.sub(shakeOffset.current)
        shakeOffset.current.set(0, 0, 0)
        controls?.update()
      }
      vel.current.set(0, 0, 0)
      boost.current = 1
      shakeImpulse.current = 0
      onWall.current = false
      return
    }

    // Operate on the CLEAN (un-shaken) base so nav/clamp never accumulate the wobble.
    camera.position.sub(shakeOffset.current)
    controls.target.sub(shakeOffset.current)

    const { x, y, z } = move
    let changed = false

    // 전진/후진 — ACCELERATION + INERTIA. boost ramps 1→2 while held (resets on release); the
    // velocity eases toward (look · BASE_SPEED · boost) while thrusting and toward 0 when not,
    // so releasing leaves the ship coasting to a stop.
    boost.current = z !== 0 ? Math.min(MAX_BOOST, boost.current + dt / BOOST_RAMP) : 1
    if (z !== 0) {
      fwd.current
        .subVectors(controls.target, camera.position)
        .normalize()
        .multiplyScalar(z * BASE_SPEED * boost.current)
    } else {
      fwd.current.set(0, 0, 0)
    }
    vel.current.lerp(fwd.current, 1 - Math.exp(-dt * (z !== 0 ? ACCEL_K : DRAG_K)))
    if (vel.current.lengthSq() > 1e-5) {
      camera.position.addScaledVector(vel.current, dt)
      controls.target.addScaledVector(vel.current, dt)
      changed = true
    }

    // 방향키: rotate the look in place (un-accelerated); position fixed, only the aim turns.
    if (x !== 0 || y !== 0) {
      const dist = camera.position.distanceTo(controls.target)
      if (dist > 0) {
        const ang = 1.4 * dt
        look.current.subVectors(controls.target, camera.position)
        if (x !== 0) look.current.applyAxisAngle(WORLD_UP, -x * ang) // yaw
        if (y !== 0) {
          right.current.setFromMatrixColumn(camera.matrix, 0).normalize()
          tmp.current.copy(look.current).applyAxisAngle(right.current, y * ang) // pitch
          if (Math.abs(tmp.current.dot(WORLD_UP) / dist) < 0.985) look.current.copy(tmp.current)
        }
        controls.target.copy(camera.position).add(look.current)
        changed = true
      }
    }

    // WALL — UNCONDITIONAL in recall (we already returned if transitioning). Same-delta shift
    // keeps camera↔target distance fixed, so OrbitControls.update() reproduces the clamp.
    const r = camera.position.length()
    if (r > SHIP_BOUNDARY) {
      const s = SHIP_BOUNDARY / r
      tmp.current.copy(camera.position).multiplyScalar(s - 1)
      camera.position.multiplyScalar(s)
      controls.target.add(tmp.current)
      if (!onWall.current) {
        // First contact → "hit a wall": inward recoil + fire a one-shot jolt.
        tmp.current.copy(camera.position).normalize().multiplyScalar(-RECOIL)
        camera.position.add(tmp.current)
        controls.target.add(tmp.current)
        shakeImpulse.current = Math.max(shakeImpulse.current, HIT_SHAKE)
        onWall.current = true
      }
      vel.current.set(0, 0, 0) // no outward momentum while pinned to the wall
      boost.current = 1
      changed = true
    } else if (onWall.current && r < SHIP_BOUNDARY - WALL_REARM) {
      onWall.current = false // drifted well clear of the wall → re-arm the next jolt
    }

    if (changed) controls.update()

    // SHIP SHAKE — a tiny screen-space rig wobble. Always on (engine idle), and its SPEED varies:
    // slow gentle sway when stationary, faster vibration with speed, a quick rattle on a wall jolt.
    // Advancing a phase by (freqScale·dt) keeps it continuous when the rate changes (no jumps).
    // Axes read AFTER the solve so the wobble tracks the current aim.
    shakeImpulse.current *= Math.exp(-dt * IMPULSE_DECAY)
    const speedN = Math.min(1, vel.current.length() / SPEED_REF)
    const freqScale =
      SHAKE_FREQ_IDLE + SHAKE_FREQ_MOVE * speedN + SHAKE_FREQ_HIT * shakeImpulse.current
    shakePhase.current += freqScale * dt
    const p = shakePhase.current
    const amp = IDLE_AMP + SPEED_AMP * speedN + IMPULSE_AMP * shakeImpulse.current
    const ox = Math.sin(p * 11.0) * 0.6 + Math.sin(p * 17.3) * 0.4
    const oy = Math.sin(p * 9.4 + 1.7) * 0.6 + Math.sin(p * 23.1) * 0.4
    right.current.setFromMatrixColumn(camera.matrix, 0).normalize()
    upAxis.current.setFromMatrixColumn(camera.matrix, 1).normalize()
    shakeOffset.current
      .copy(right.current)
      .multiplyScalar(ox * amp)
      .addScaledVector(upAxis.current, oy * amp)
    camera.position.add(shakeOffset.current)
    controls.target.add(shakeOffset.current)
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
  const setTransitioning = useCameraMode((s) => s.setTransitioning)
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
    setTransitioning(true) // relax the orbit + ship-boundary clamps so the flight isn't yanked
    focusStar(null) // consume the request now → no stale store focus; refs drive the flight
  }, [focusStarId, stars, setMode, setTransitioning, focusStar])

  useFrame((_, dt) => {
    const target = targetRef.current
    if (!target) return
    // Park the camera on the INNER side of the star (toward the centre) so it stays within
    // the ship boundary — you meet the star from inside the universe, not from outside it.
    const desired = target.clone().sub(target.clone().normalize().multiplyScalar(12))
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
      setTransitioning(false) // restore recall clamps now that we're parked inside the shell
    }
  })

  return null
}

/** On a mode TOGGLE (camera button → resetNonce bump), FLY the camera to that mode's
 *  signature pose so the two experiences feel distinct: recall → dive to the dead centre of
 *  the universe along the current heading (then explore with the D-pad, bounded by
 *  SHIP_BOUNDARY); nebula → pull back out to NEBULA_FRAME_DIST for a whole-cloud overview.
 *  Keyed off resetNonce (NOT mode), so a fly-to (setMode without a bump) is never recentred.
 *
 *  During the flight the orbit-distance clamps (OrbitControls min/max) AND the ship-boundary
 *  clamp (NavController, via the `transitioning` flag) are relaxed, so the camera can pass
 *  through the otherwise-forbidden zone — e.g. diving in from far outside, or flying out from
 *  deep inside. They're restored to the destination mode's limits on arrival. */
function ModeTransitionController() {
  const mode = useCameraMode((s) => s.mode)
  const resetNonce = useCameraMode((s) => s.resetNonce)
  const setTransitioning = useCameraMode((s) => s.setTransitioning)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const posRef = useRef<THREE.Vector3 | null>(null)
  const tgtRef = useRef<THREE.Vector3 | null>(null)
  const dir = useRef(new THREE.Vector3())
  // The overview vantage we last left, so 전체 → 근접 → 전체 returns to the exact same spot.
  const savedNebulaPos = useRef<THREE.Vector3 | null>(null)
  const savedNebulaTgt = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (resetNonce === 0) return // skip the initial mount; react only to real toggles
    // Preserve the current facing through the flight.
    if (controls) dir.current.subVectors(controls.target, camera.position)
    else camera.getWorldDirection(dir.current)
    if (dir.current.lengthSq() < 1e-6) dir.current.set(0, 0, -1)
    dir.current.normalize()

    if (mode === 'recall') {
      // Remember the overview vantage we're leaving (position + look), so toggling back
      // returns us to it instead of reframing — the camera ends up right where it started.
      savedNebulaPos.current = camera.position.clone()
      savedNebulaTgt.current = controls ? controls.target.clone() : new THREE.Vector3()
      // 우주선: dive to the dead centre, looking along the current heading.
      posRef.current = new THREE.Vector3(0, 0, 0)
      tgtRef.current = dir.current.clone().multiplyScalar(SHIP_LOOK_AHEAD)
    } else if (savedNebulaPos.current && savedNebulaTgt.current) {
      // 자유 관찰: fly back to the exact overview we left (전체→근접→전체 = 제자리).
      posRef.current = savedNebulaPos.current.clone()
      tgtRef.current = savedNebulaTgt.current.clone()
    } else {
      // No saved vantage yet (e.g. first toggle out after a fly-to): frame the whole cloud.
      const out =
        camera.position.lengthSq() > 1e-6
          ? camera.position.clone().normalize()
          : new THREE.Vector3(0, 0, 1)
      posRef.current = out.multiplyScalar(NEBULA_FRAME_DIST)
      tgtRef.current = new THREE.Vector3(0, 0, 0)
    }
    // CameraRig relaxes the orbit clamps while this flag is up; restored on arrival.
    setTransitioning(true)
  }, [resetNonce, mode, camera, controls, setTransitioning])

  useFrame((_, dt) => {
    const pos = posRef.current
    const tgt = tgtRef.current
    if (!pos || !tgt) return
    const k = 1 - Math.exp(-dt * 4) // frame-rate-independent ease
    camera.position.lerp(pos, k)
    if (controls) {
      controls.target.lerp(tgt, k)
      controls.update()
    } else {
      camera.lookAt(tgt)
    }
    if (camera.position.distanceTo(pos) < 0.5) {
      camera.position.copy(pos)
      if (controls) {
        controls.target.copy(tgt)
        controls.update()
      }
      posRef.current = null
      tgtRef.current = null
      setTransitioning(false) // CameraRig snaps the destination clamps back
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
      <ModeTransitionController />
      <BloomPass />
    </Canvas>
  )
}
