// The universe canvas shell (Architecture §3.3): R3F <Canvas> + async WebGPU
// renderer + dark background + ambient star dust + the real StarField (08, driven by
// the memory store / spec 10 data) + Bloom + camera rig. No DOM <Html> in the scene
// (constitution §4 — mobile portability); labels/HUD are a separate 2D widget.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { Canvas, type GLProps, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useSelector } from '@xstate/react'
import * as THREE from 'three'
import { type WebGPURenderer } from 'three/webgpu'
import { StarField } from '@/entities/star'
import { SynapseFilaments, SynapseDust, useSynapseStore, edgesWithin } from '@/entities/synapse'
import {
  useMemoryStore,
  starsOfRecord,
  focusActor,
  selectFocusedStarId,
  selectHighlightedRecordId,
  selectIsStarFocus,
  selectIsDiaryFocus,
  selectFrameNonce,
} from '@/entities/memory'
import { frameTarget } from '@/features/wayfinding'
import { useAppearance, backgroundMeta, type BackgroundTexture } from '@/entities/appearance'
import { resolveMoodRgb, NEUTRAL_RGB, VALUES } from '@/shared/config'
import {
  cn,
  mulberry32,
  fibonacciStarPosition,
  scatterDirection,
  applyAngularDrift,
  reportUniverseRenderer,
} from '@/shared/lib'
import { AmbientNebula } from './AmbientNebula'
import { UniverseNebula } from './UniverseNebula'
import { SelfStar } from './SelfStar'
import { radiusOf, atRadius, RADIAL_SIM_PARAMS } from '../model/radial-layout'
import {
  createSim,
  advance,
  isSettled,
  positions as simPositions,
  tick,
  seedNearCluster,
  type SeedNeighbor,
  type SimEdge,
  type SimNode,
  type SimState,
} from '@/shared/lib/force-sim'
import { virtualNowMs, isDemoMode } from '@/shared/lib/demo'
import { createRenderer, rendererBackend } from '@/shared/lib/r3f'
import {
  navigationActor,
  selectIsNebula,
  selectIsRecall,
  selectTransitioning,
  selectFlyStarId,
  selectFrameRecordId,
  selectFrameSeq,
  selectInModeTransition,
  selectTransitionTo,
} from '../model/navigation.machine'
import { useViewport } from '../model/use-viewport'
import { BloomPass } from '@/shared/ui'

/** A star's live (or settled) position by `stars`-array slot. The single source of star
 *  coordinates (constitution §3): read the force-sim buffer when it's ready, else the
 *  deterministic fibonacci shell seed (07's new-node rule) so the first frames don't
 *  flicker. ALL four readers (StarField/Synapses/FlyTo/Focus) resolve through this so
 *  the camera always reaches the rendered star (acceptance 1.7). */
function readBufferPosition(
  buf: Float32Array | null,
  index: number,
  count: number,
  seed: number,
): [number, number, number] {
  if (buf && index >= 0 && index < count && buf.length >= count * 3) {
    return [buf[index * 3], buf[index * 3 + 1], buf[index * 3 + 2]]
  }
  return fibonacciStarPosition(index, count, seed)
}

/** A snapshot of settled star positions by id — what the synapse renderers bake against.
 *  Published by the layout controller at each settle so filaments reconnect at the stars'
 *  emergent (not stale fibonacci) coordinates. */
type LayoutMap = Map<string, [number, number, number]>

/** Stable empty highlight set (spec 28) — a module singleton so the default prop identity
 *  never changes (no needless re-memo / effect re-run when nothing is highlighted). */
const EMPTY_ID_SET: ReadonlySet<string> = new Set()

// Live force-sim pumping budget. ~6h excitability window for the FE hot-cluster seed,
// mirroring the server's tauExc (spec 22) — a star recalled within ~6h is "hot".
const LAYOUT_TICKS_PER_FRAME = 2
const HOT_TAU_MS = VALUES.excitability.tauHours * 60 * 60 * 1000
// Representational drift (spec 40): one angular drift step per NIGHT the clock crosses. A day in
// ms — the night index is floor(virtualNow / DAY_MS), so drift advances on day boundaries (and a
// multi-day demo skip applies the steps at once), never continuously in real time.
const DAY_MS = 86_400_000

// Self-anchored radial layout (spec 38). Each star's target shell radius = f(strength);
// the radius is recomputed each frame from the current time so a star glides outward as it
// fades and inward when recalled. `sim.radius` is the SOFT target the sim's radial spring
// relaxes toward (alongside links + repulsion) — so at settle |p| is a BALANCE, not exactly
// the shell. To avoid re-relaxing the whole graph every frame, the sim is only re-kicked when
// some star's target radius drifts past REKICK_THRESHOLD (a recall jump always crosses it;
// slow time-decay crosses it occasionally → stepwise glide). The whole sim (radial + links +
// repulsion) relaxes together to a new balance; synapses publish on settle, never mid-relax.
const REKICK_THRESHOLD = VALUES.layout.rekickThreshold
const REKICK_ALPHA = VALUES.layout.rekickAlpha

// radiusOf / atShell layout helpers live in model/radial-layout (shared with the spec-37 overlay
// so both canvases place stars on identical strength shells — single source of the layout math).

/** Faint ambient point cloud — the "star dust" backdrop (acceptance 1.3). Always
 *  present, independent of the graph, so an empty universe still renders (1.10).
 *  mulberry32 (not Math.random) keeps generation pure during render
 *  (react-hooks/purity) and the layout stable across re-renders. */
// 배경 번들의 텍스처/요소 슬롯(spec 44 A9): 선택된 배경에 texture가 있으면 장면을 감싸는 큰 안쪽 구
// 한 겹으로 은은한 색 베일을 깐다(별보다 멀고 renderOrder<0·depthWrite 없음 → 별 mood 색·깊이 불간섭).
// 텍스처 없는 배경(vast/lively/calm)은 null → 기존 렌더와 동일. 비주얼 디테일은 디자인 반복용 슬롯.
function BackgroundVeil({ texture }: { texture?: BackgroundTexture }) {
  if (!texture?.veilColor) return null
  return (
    <mesh renderOrder={-2}>
      <sphereGeometry args={[800, 24, 16]} />
      <meshBasicMaterial
        color={texture.veilColor}
        side={THREE.BackSide}
        transparent
        opacity={texture.veilOpacity ?? 0.15}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function StarDust({ count = 1500 }: { count?: number }) {
  // Dim the ambient dust while a star is focused (spotlight) OR a diary is highlighted
  // (원본 일기 조망, spec 28) so only the foregrounded stars read bright. (focus 머신, spec 39)
  const focused = useSelector(focusActor, selectIsStarFocus)
  const highlighting = useSelector(focusActor, selectIsDiaryFocus)
  const dimmed = focused || highlighting
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
        opacity={dimmed ? VALUES.starDust.opacityDimmed : VALUES.starDust.opacityNormal}
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

// nebula free-orbit (자유 관찰): a custom arcball rotation that NEVER hits a pole. Drag yaws
// about the camera's LOCAL up and pitches about its LOCAL right — both derived from the live
// camera basis each frame — so there's no world-up alignment and no [0,PI] phi clamp to get
// stuck on. Distance (radius from target) is dollied by wheel/pinch, clamped to the same
// 58/1500 range OrbitControls used.
const NEBULA_ROTATE_SPEED = 2.4 // radians of orbit per full-canvas-width drag
const NEBULA_DAMP = 9 // 1/s — angular-velocity decay (inertial spin-down on release)
const NEBULA_ZOOM_SPEED = 0.12 // wheel dolly sensitivity (fraction of radius per notch)

// Recall-mode flight feel. Forward/back thrust uses a world-space VELOCITY → inertia (coasts on
// release) plus acceleration (eases up to BASE_SPEED·boost while held). Shake is a tiny rig wobble.
const BASE_SPEED = 16 // world units/sec cruise (before the hold-boost)
const MAX_BOOST = 2 // hold thrust → up to 2× cruise
const BOOST_RAMP = 1.4 // seconds of holding to reach MAX_BOOST
const ACCEL_K = 2.4 // velocity ease toward the target speed while thrusting (1/s)
const DRAG_K = 4 // velocity ease toward 0 on release (1/s) — firm "regen braking" (τ≈0.25s, settles <1s)
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

// Look-rotation feel (시선 회전) — mirrors the thrust: a TARGET angular velocity the actual eases
// toward (가속도, ramping faster the longer you hold via lookBoost) and coasts to a stop on release
// (관성). The per-frame yaw/pitch is applied about the live LOCAL axes so it composes with free-look.
const LOOK_BASE_RATE = 1.4 // rad/s base turn rate
const LOOK_MAX_BOOST = 2.2 // hold longer → up to 2.2× turn rate (가속도)
const LOOK_BOOST_RAMP = 1.2 // seconds of holding to reach LOOK_MAX_BOOST
const LOOK_ACCEL_K = 5 // angular-velocity ease toward target while turning (1/s)
const LOOK_DRAG_K = 3 // angular-velocity ease toward 0 on release (1/s) — the coasting inertia
const FOCUS_K = 4 // aim-lerp rate (1/s) — how fast the gaze swings onto a selected star and holds

/** OrbitControls stays mounted + makeDefault in EVERY mode, so `s.controls` (its .target +
 *  .update()) is a single stable instance that NavController / FlyTo / ModeTransition can rely on
 *  with zero null/swap windows. What changes per mode:
 *   - recall (우주선): UNCHANGED — driven entirely by the D-pad (NavController owns position +
 *     look); OrbitControls' own rotate/zoom are off so they don't fight the controller. Pan is
 *     never wanted. controls.enabled stays true so NavController's same-delta shifts are
 *     reproduced by update().
 *   - nebula (자유 관찰): OrbitControls' rotate/zoom are off too, and we DISABLE the controls
 *     entirely (enabled=false) — this stops drei's per-frame update() loop, so its [0,PI] polar
 *     clamp + world-up re-alignment can no longer snap back the free orbit. The custom
 *     NebulaOrbitController owns rotation/zoom this whole time (arcball about local axes → no pole).
 *   - during a transition flight: controls are RE-ENABLED (controlsEnabled becomes true) so the
 *     FlyTo / ModeTransition lerp can keep calling update() to point the camera at the lerped
 *     target, and the distance clamps are relaxed so the flight can cross the forbidden zone.
 *  makeDefault so the bloom pass + fly-to + mode transitions share one camera. */
function CameraRig() {
  // 항행 머신(spec 39). settled nebula/recall은 transitioning 태그가 없으므로 isNebula가 곧 비전환 nebula.
  const transitioning = useSelector(navigationActor, selectTransitioning)
  const isNebula = useSelector(navigationActor, selectIsNebula)
  const minDistance = transitioning ? 0.01 : isNebula ? OBSERVE_MIN_DIST : 1
  const maxDistance = transitioning ? 1e6 : isNebula ? 1500 : 70
  // OrbitControls' OWN rotate/zoom are never used now (recall = D-pad, nebula = custom orbit);
  // it only provides the shared target + update() solve. Keep them false so no built-in drag can
  // grab any mode.
  // `enabled`: in nebula (non-transition) we turn the whole controller OFF so its per-frame
  // update() can't re-clamp the pole / re-flatten camera.up under the custom orbit. In recall and
  // during ANY transition flight it must stay ON (NavController + the lerps depend on update()).
  const controlsEnabled = transitioning || !isNebula
  return (
    <OrbitControls
      makeDefault
      enabled={controlsEnabled}
      enableDamping
      enableRotate={false}
      enableZoom={false}
      enablePan={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
    />
  )
}

/** nebula-mode FREE rotation. A custom arcball: a one-finger (or left-mouse) drag
 *  yaws about the camera's LOCAL up and pitches about its LOCAL right — both re-read from the live
 *  camera basis each frame — so there is NO world-up pole and no "stuck spot"; you can tumble fully
 *  over the top/bottom and keep going. A flick keeps spinning, decaying via NEBULA_DAMP. Wheel
 *  (desktop) and two-finger pinch (touch) dolly along the view ray, clamped to the same 58..1500
 *  radius nebula used. Pan is intentionally absent.
 *
 *  Coupling: OrbitControls stays makeDefault but CameraRig sets it enabled=false in nebula, so its
 *  per-frame update() (and its [0,PI] polar clamp / world-up re-alignment) is dormant and never
 *  fights us — we drive camera.position + camera.up + lookAt(target) directly, orbiting the shared
 *  (fixed) controls.target.
 *
 *  Roll containment: the arcball necessarily rolls camera.up off world-up (that's what removes the
 *  pole). On LEAVING nebula (active→false — a mode toggle, a fly-to, or a transition flight) the
 *  effect cleanup RE-LEVELS camera.up to world-up, so the rolled frame can't leak into recall /
 *  fly-to / the guided flights, which all consume camera.up via OrbitControls.update()→lookAt
 *
 *  A strict no-op outside nebula AND during any guided flight (active = nebula && !transitioning):
 *  there OrbitControls is enabled and owns the camera. Listeners attach to the WebGL canvas. */
function NebulaOrbitController() {
  // 항행 머신(spec 39): settled nebula에서만 자유 궤도를 소유(전환/recall/flyingToStar 중엔 비활성).
  const isNebula = useSelector(navigationActor, selectIsNebula)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null

  const pending = useRef({ yaw: 0, pitch: 0 }) // drag delta accumulated since last frame (radians)
  const vel = useRef({ yaw: 0, pitch: 0 }) // inertial angular velocity (rad/s) after release
  const dragging = useRef(false)
  const lastXY = useRef({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>()) // live pointers (multi-touch)
  const pinchDist = useRef(0) // previous two-finger distance (0 = not pinching)
  const pendingZoom = useRef(0) // dolly accumulated since last frame (fraction of radius)
  const armedPointer = useRef<number | null>(null) // 1-finger pointer awaiting the drag deadzone (tap vs orbit)
  const downXY = useRef({ x: 0, y: 0 }) // its press position — the deadzone origin
  // While a star is selected (focus/spotlight), FocusController owns the aim — stand down. (focus 머신)
  const starFocused = useSelector(focusActor, selectIsStarFocus)
  const active = isNebula && !starFocused

  const right = useRef(new THREE.Vector3())
  const up = useRef(new THREE.Vector3())
  const offset = useRef(new THREE.Vector3())
  const q = useRef(new THREE.Quaternion())

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const span = () => Math.max(1, el.clientWidth || el.width)
    // Capture refs into locals so the cleanup reads the same objects (react-hooks/exhaustive-deps).
    const pts = pointers.current
    const drag = dragging
    const pend = pending
    const vRef = vel
    const pinch = pinchDist
    const zoom = pendingZoom
    const last = lastXY
    const arm = armedPointer
    const dwn = downXY
    const DRAG_DEADZONE = 8 // px — below this, a 1-finger press is a tap (→ star select), not an orbit
    const twoFingerDist = () => {
      const it = pts.values()
      const a = it.next().value
      const b = it.next().value
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return // mouse: left-drag only
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      // Capture on down so THIS pointer's up/cancel ALWAYS returns to us — even if the finger lifts
      // over a HUD overlay — so `pts` never keeps a stale id (which a later gesture would mis-read
      // as a pinch). Capture does NOT suppress the star's R3F onClick; the tap-vs-orbit split is the
      // deadzone below (rotation is gated on drag.current), not on capture.
      el.setPointerCapture?.(e.pointerId)
      if (pts.size === 1) {
        // Arm the finger but DON'T rotate yet — wait for the deadzone, so a tap (the finger barely
        // moves) doesn't nudge the universe out from under the fingertip; the star's onClick fires.
        drag.current = false
        arm.current = e.pointerId
        dwn.current = { x: e.clientX, y: e.clientY }
        last.current = { x: e.clientX, y: e.clientY }
        vRef.current.yaw = 0
        vRef.current.pitch = 0
        pend.current.yaw = 0
        pend.current.pitch = 0
      } else if (pts.size === 2) {
        drag.current = false // two fingers → pinch-zoom, suspend rotate
        arm.current = null
        pinch.current = twoFingerDist()
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size >= 2) {
        // PINCH: spreading fingers (distance grows) zooms IN (radius shrinks).
        const d = twoFingerDist()
        if (pinch.current > 0 && d > 0) zoom.current += pinch.current / d - 1
        pinch.current = d
        return
      }
      if (!drag.current) {
        // Still inside the deadzone → not a drag yet (keep it tappable). Promote to an orbit only
        // once the armed finger travels past the threshold, and capture ONLY then so a sub-deadzone
        // tap is never stolen from the star raycast.
        if (arm.current !== e.pointerId) return
        if (Math.hypot(e.clientX - dwn.current.x, e.clientY - dwn.current.y) < DRAG_DEADZONE) return
        drag.current = true // promote past the deadzone (already captured on down)
        last.current = { x: e.clientX, y: e.clientY } // orbit starts here — no jump for the deadzone travel
      }
      // Accumulate the raw pointer delta (handles multiple moves per frame) into a 1:1 orbit.
      const s = span()
      pend.current.yaw += (-(e.clientX - last.current.x) / s) * NEBULA_ROTATE_SPEED
      pend.current.pitch += (-(e.clientY - last.current.y) / s) * NEBULA_ROTATE_SPEED
      last.current = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture?.(e.pointerId)
      if (pts.size === 1) {
        // dropped from pinch back to one finger → resume rotate from the survivor (no jump). It's a
        // confirmed drag (post-pinch), not a fresh tap, so no deadzone re-arm.
        pinch.current = 0
        const survivor = pts.values().next().value
        if (survivor) last.current = { x: survivor.x, y: survivor.y }
        drag.current = true
        arm.current = null
      } else if (pts.size === 0) {
        drag.current = false
        pinch.current = 0
        arm.current = null
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom.current += Math.sign(e.deltaY) * NEBULA_ZOOM_SPEED
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
      pts.clear()
      drag.current = false
      arm.current = null
      pinch.current = 0
      zoom.current = 0
      vRef.current.yaw = 0
      vRef.current.pitch = 0
      pend.current.yaw = 0
      pend.current.pitch = 0
      // RE-LEVEL: shed any roll the free arcball accrued so the guided flights + recall (which read
      // camera.up via OrbitControls.update()→lookAt) start upright.
      camera.up.set(0, 1, 0)
    }
  }, [active, gl, camera])

  useFrame((_, dt) => {
    if (!active || !controls) return
    const target = controls.target
    offset.current.subVectors(camera.position, target)

    // ROTATE — 1:1 while dragging; coast (decaying) after release. Angles are frame-rate independent.
    let yaw: number
    let pitch: number
    if (dragging.current) {
      yaw = pending.current.yaw
      pitch = pending.current.pitch
      pending.current.yaw = 0
      pending.current.pitch = 0
      if (dt > 0) {
        vel.current.yaw = yaw / dt // remember this frame's rate → flick inertia on release
        vel.current.pitch = pitch / dt
      }
    } else {
      yaw = vel.current.yaw * dt
      pitch = vel.current.pitch * dt
      const decay = Math.exp(-dt * NEBULA_DAMP)
      vel.current.yaw *= decay
      vel.current.pitch *= decay
      if (Math.abs(vel.current.yaw) < 1e-4) vel.current.yaw = 0
      if (Math.abs(vel.current.pitch) < 1e-4) vel.current.pitch = 0
    }
    if (yaw !== 0 || pitch !== 0) {
      // LOCAL right/up from the live camera basis → true arcball, never re-aligns to world up.
      right.current.setFromMatrixColumn(camera.matrix, 0).normalize()
      up.current.setFromMatrixColumn(camera.matrix, 1).normalize()
      q.current.setFromAxisAngle(up.current, yaw)
      offset.current.applyQuaternion(q.current)
      camera.up.applyQuaternion(q.current)
      q.current.setFromAxisAngle(right.current, pitch)
      offset.current.applyQuaternion(q.current)
      camera.up.applyQuaternion(q.current)
    }

    // DOLLY (wheel / two-finger pinch), clamped to the nebula 58..1500 radius range.
    if (pendingZoom.current !== 0) {
      const r = offset.current.length()
      offset.current.setLength(
        THREE.MathUtils.clamp(r * (1 + pendingZoom.current), OBSERVE_MIN_DIST, 1500),
      )
      pendingZoom.current = 0
    }

    // Drive the camera directly — OrbitControls is disabled in nebula, so no update() is needed
    // (calling it would only re-solve the same pose). We own position + up + aim here.
    camera.position.copy(target).add(offset.current)
    camera.up.normalize()
    camera.lookAt(target)
  })

  return null
}

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
  // 항행·포커스 머신은 매 프레임 getSnapshot으로 읽는다(NavController는 useFrame만 — 구독 불필요).
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null

  const right = useRef(new THREE.Vector3())
  const upAxis = useRef(new THREE.Vector3())
  const fwd = useRef(new THREE.Vector3())
  const q = useRef(new THREE.Quaternion()) // free-look yaw/pitch rotation
  const tmp = useRef(new THREE.Vector3())
  const vel = useRef(new THREE.Vector3()) // world-space velocity → inertia/coasting
  const boost = useRef(1) // 1→2 acceleration multiplier while thrusting
  const lookVel = useRef({ yaw: 0, pitch: 0 }) // angular velocity (rad/s) → look inertia/coasting
  const lookBoost = useRef(1) // 1→LOOK_MAX_BOOST turn-rate multiplier while turning
  const onWall = useRef(false) // touching the wall last frame (one-shot recoil/jolt gate)
  const shakePhase = useRef(0) // accumulated shake phase (its rate varies with speed/impact)
  const shakeImpulse = useRef(0) // decaying wall jolt
  const shakeOffset = useRef(new THREE.Vector3()) // last frame's wobble (reverted next frame)

  useFrame((_, dt) => {
    // GATE: settled recall에서만 D-pd 항해(matches('recall')는 transitioning 태그가 없어 fly-to/모드전환
    // 비행을 자동 제외 — 그 비행들이 항상 도착해 transitioning이 풀린다). 별 포커스 중엔 stand down.
    const navSnap = navigationActor.getSnapshot()
    const recall = navSnap.matches('recall')
    const starFocused = focusActor.getSnapshot().matches('star')
    if (!recall || !controls || starFocused) {
      if (shakeOffset.current.lengthSq() > 0) {
        camera.position.sub(shakeOffset.current)
        controls?.target.sub(shakeOffset.current)
        shakeOffset.current.set(0, 0, 0)
        controls?.update()
      }
      vel.current.set(0, 0, 0)
      boost.current = 1
      lookVel.current.yaw = 0
      lookVel.current.pitch = 0
      lookBoost.current = 1
      shakeImpulse.current = 0
      onWall.current = false
      return
    }

    // Operate on the CLEAN (un-shaken) base so nav/clamp never accumulate the wobble.
    camera.position.sub(shakeOffset.current)
    controls.target.sub(shakeOffset.current)

    const { x, y, z } = navSnap.context.move
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

    // 방향키: FREE-LOOK with ACCELERATION + INERTIA. A TARGET angular velocity from the input
    // (ramping via lookBoost the longer you hold = 가속도) is eased toward while turning and coasts
    // toward 0 on release (관성) — so the aim glides to a stop like the thrust. The resulting
    // per-frame yaw/pitch is applied about the live LOCAL axes (yaw=local up, pitch=local right,
    // rotating BOTH look and up). So "turn right" always pans the view right relative to the
    // cockpit — never a clockwise spin near the zenith — and there's NO world-up pole to lock pitch
    // on. World-frame roll only accrues from combined yaw+pitch, like a real ship; guided flights
    // (fly-to / mode transition) re-level camera.up to world up.
    const turning = x !== 0 || y !== 0
    lookBoost.current = turning
      ? Math.min(LOOK_MAX_BOOST, lookBoost.current + dt / LOOK_BOOST_RAMP)
      : 1
    const tgtYaw = -x * LOOK_BASE_RATE * lookBoost.current
    const tgtPitch = y * LOOK_BASE_RATE * lookBoost.current
    lookVel.current.yaw +=
      (tgtYaw - lookVel.current.yaw) * (1 - Math.exp(-dt * (x !== 0 ? LOOK_ACCEL_K : LOOK_DRAG_K)))
    lookVel.current.pitch +=
      (tgtPitch - lookVel.current.pitch) *
      (1 - Math.exp(-dt * (y !== 0 ? LOOK_ACCEL_K : LOOK_DRAG_K)))
    // Snap the tiny coasting tail to a dead stop once released (no endless sub-pixel drift).
    if (x === 0 && Math.abs(lookVel.current.yaw) < 1e-3) lookVel.current.yaw = 0
    if (y === 0 && Math.abs(lookVel.current.pitch) < 1e-3) lookVel.current.pitch = 0
    const dYaw = lookVel.current.yaw * dt
    const dPitch = lookVel.current.pitch * dt
    if (dYaw !== 0 || dPitch !== 0) {
      const dist = camera.position.distanceTo(controls.target)
      if (dist > 0) {
        fwd.current.subVectors(controls.target, camera.position).normalize()
        upAxis.current.copy(camera.up).normalize()
        if (dYaw !== 0) {
          // yaw about LOCAL up (rotating about up leaves up itself unchanged)
          q.current.setFromAxisAngle(upAxis.current, dYaw)
          fwd.current.applyQuaternion(q.current)
        }
        if (dPitch !== 0) {
          // pitch about LOCAL right; rotate up too so it stays ⟂ to look → smooth past vertical
          right.current.crossVectors(fwd.current, upAxis.current).normalize()
          q.current.setFromAxisAngle(right.current, dPitch)
          fwd.current.applyQuaternion(q.current)
          upAxis.current.applyQuaternion(q.current)
        }
        fwd.current.normalize()
        camera.up.copy(upAxis.current).normalize()
        controls.target.copy(camera.position).addScaledVector(fwd.current, dist)
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

/** The live force-sim pump (spec 22 + 38). Builds ONE weighted graph from the star set and
 *  synapse edges and advances it each frame into a single positions buffer every coordinate
 *  reader shares (acceptance 1.7) — star coordinates EMERGE from the graph (constitution §3).
 *
 *  spec 38 — distance is strength, angle is connection: ALL memory stars are free and pulled
 *  toward a shell of radius = f(strength) (radial-shell force); the graph springs + repulsion
 *  place the ANGLE, biased toward the hottest cluster a new fragment links into (seedNearCluster,
 *  spec 22). Angular continuity across rebuilds comes from resuming each star at its prior live
 *  position. Recall (activation↑ → radius↓) glides a star inward, time decay glides it outward —
 *  the per-frame loop recomputes target radii and re-kicks the sim when they drift past a
 *  threshold. Tightened sim params (less repulsion, shorter links, firmer radial spring) keep
 *  the cloud compact rather than sprawling. `onReady` fires once the FIRST layout settles (or
 *  immediately for a genuinely-empty universe) so the shell can reveal the placed stars. */
function LiveLayoutController({
  positionsRef,
  onLayout,
  onReady,
  onReset,
}: {
  positionsRef: MutableRefObject<Float32Array | null>
  onLayout: (layout: LayoutMap) => void
  onReady: () => void
  /** Re-hide the universe when the star set empties WITHOUT being a genuine empty universe —
   *  a mid-session source reset (demo "처음으로") clears stars without remounting, so the next
   *  batch must settle behind the veil again instead of animating in from seeds (spec 38). */
  onReset: () => void
}) {
  const stars = useMemoryStore((s) => s.stars)
  const edges = useSynapseStore((s) => s.edges)
  const loadedEmpty = useMemoryStore((s) => s.loadedEmpty)
  const quietSettleSeq = useViewport((s) => s.quietSettleSeq)
  const simRef = useRef<SimState | null>(null)
  const settledRef = useRef(true)
  const readyRef = useRef(false) // fire onReady exactly once
  const quietSeqRef = useRef(quietSettleSeq)
  // Last graph topology (star ids + edge pairs) the sim was built for — so a stars/edges
  // array-ref change that DIDN'T change the graph (the demo skip's refreshActivation replaces
  // both arrays ~12×/tween just to recompute brightness) does NOT rebuild the sim.
  const topoRef = useRef('')
  // Reused scratch for the per-frame target radii (avoids a per-frame allocation).
  const targetScratchRef = useRef<Float32Array>(new Float32Array(0))
  // Last night index (floor(virtualNow/DAY_MS)) a representational-drift step was applied for
  // (spec 40). null = not yet established for the current sim → the next frame sets the baseline
  // without drifting. Survives sim rebuilds (drift accumulates across them); reset on empty.
  const nightRef = useRef<number | null>(null)
  // Memory facts by id (lastRecalledAt + intensity) for the per-frame radius recompute —
  // memoized so it's not rebuilt every frame, only when the star set changes.
  const memoryById = useMemo(
    () => new Map(stars.map((s) => [s.id, s.memory] as const)),
    [stars],
  )

  // Publish a positions snapshot (id → coord) for the synapse renderers to bake against.
  const publish = useCallback(
    (sim: SimState, buf: Float32Array) => {
      const layout: LayoutMap = new Map()
      sim.ids.forEach((id, i) => layout.set(id, [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]]))
      onLayout(layout)
    },
    [onLayout],
  )

  // Reveal the universe once the FIRST layout has settled (fires exactly once).
  const markReady = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    onReady()
  }, [onReady])

  useEffect(() => {
    if (stars.length === 0) {
      simRef.current = null
      positionsRef.current = null
      topoRef.current = ''
      nightRef.current = null // re-arm drift baseline so the next universe doesn't jump-drift
      onLayout(new Map())
      // A genuinely-empty universe has nothing to place — reveal immediately. Otherwise it's
      // "not loaded yet" (initial pending) OR a mid-session reset: re-arm the veil so the next
      // batch settles hidden (readyRef reset → markReady can fire again on the next settle).
      if (loadedEmpty) markReady()
      else {
        readyRef.current = false
        onReset()
      }
      return
    }
    // Rebuild the sim only when the graph TOPOLOGY changes (a star or edge added/removed) —
    // NOT on every stars/edges array-ref change. Demo time-skip refreshes activation for the
    // same topology; without this guard that refresh rebuilt the sim from seed and re-kicked,
    // producing star churn + stretched synapses. Elapsed-time radius drift is handled by the
    // per-frame re-kick below, so a same-topology refresh keeps the live sim continuity.
    const topo =
      stars.map((s) => s.id).join(',') + '|' + edges.map((e) => `${e.aId}~${e.bId}`).join(',')
    if (topo === topoRef.current && simRef.current) return
    topoRef.current = topo

    const now = virtualNowMs()

    // The OUTGOING sim's live positions by id — so a star still moving when this rebuild
    // fires resumes from where it currently is (angular continuity, no jump). spec 38: all
    // stars are free (they breathe radially with strength); the radial-shell force places
    // distance, the graph springs + repulsion place angle.
    const prevPos = new Map<string, [number, number, number]>()
    const prevSim = simRef.current
    const prevBuf = positionsRef.current
    if (prevSim && prevBuf && prevBuf.length >= prevSim.ids.length * 3) {
      prevSim.ids.forEach((id, i) =>
        prevPos.set(id, [prevBuf[i * 3], prevBuf[i * 3 + 1], prevBuf[i * 3 + 2]]),
      )
    }

    // Heat (recency 0..1) per star — exp decay over ~6h, mirroring the server's excitability
    // window so the new-fragment seed leans toward the recently-active cluster (spec 22).
    const heatById = new Map<string, number>()
    for (const s of stars) {
      const ageMs = Math.max(0, now - s.memory.lastRecalledAt)
      heatById.set(s.id, Math.exp(-ageMs / HOT_TAU_MS))
    }
    const neighborsById = new Map<string, string[]>()
    const addNeighbor = (from: string, to: string) => {
      const list = neighborsById.get(from)
      if (list) list.push(to)
      else neighborsById.set(from, [to])
    }
    for (const e of edges) {
      addNeighbor(e.aId, e.bId)
      addNeighbor(e.bId, e.aId)
    }
    const prevPosOf = (id: string): readonly [number, number, number] | null => prevPos.get(id) ?? null

    const nodes: SimNode[] = stars.map((s) => {
      const r = radiusOf(s.memory, now)
      // Angular continuity: resume from the live position if it was already placed.
      const resume = prevPos.get(s.id)
      if (resume) return { id: s.id, pinned: false, x: resume[0], y: resume[1], z: resume[2], radius: r }
      // New (or first load): rise at the hottest cluster's ANGLE (seedNearCluster), but at
      // the strength's DISTANCE (fresh memory → strong → near the centre). spec 38 1.5/1.6.
      const seedNbrs: SeedNeighbor[] = (neighborsById.get(s.id) ?? []).map((nid) => ({
        id: nid,
        heat: heatById.get(nid) ?? 0,
      }))
      // No placed neighbor → a per-id SCATTERED direction on the strength shell, NOT the
      // golden-angle-by-index fibonacci spiral (adding stars one by one used to trace a spiral
      // arc — spec 40 1.4). atRadius pins the final distance to the strength shell either way.
      const fallback = atRadius(scatterDirection(s.memory.seed), r)
      const seeded = seedNearCluster(s.id, seedNbrs, prevPosOf, fallback)
      const [x, y, z] = atRadius(seeded, r)
      return { id: s.id, pinned: false, x, y, z, radius: r }
    })
    const simEdges: SimEdge[] = edges.map((e) => ({ source: e.aId, target: e.bId, weight: e.weight }))

    // Tightened params (spec 38) keep the cloud compact: weaker repulsion + a SHORT link rest
    // length so connected stars pull into tight constellations (not a sprawling line), and a
    // firmer radial spring so each still hugs its strength-shell (distance = strength).
    // seedNewNodes:false → keep the resume / dir·radius placement instead of a neighbor average.
    const sim = createSim({ nodes, edges: simEdges }, RADIAL_SIM_PARAMS, { seedNewNodes: false })
    simRef.current = sim
    const buf = simPositions(sim)
    positionsRef.current = buf
    settledRef.current = isSettled(sim)
    publish(sim, buf) // synapses get the seed layout now; they reconnect on each settle
    if (isSettled(sim)) markReady() // already settled (e.g. a single star) → reveal now
    // edges are part of the graph; rebuilding on an edge change keeps the springs current.
  }, [stars, edges, positionsRef, onLayout, publish, loadedEmpty, markReady, onReset])

  useFrame(() => {
    const sim = simRef.current
    if (!sim) return

    // Recompute each star's target radius from the CURRENT time so it glides outward as it
    // fades / inward when recalled (spec 38 1.3/1.4). `sim.radius` holds the shells the sim
    // last relaxed to; we compare the fresh targets against THAT (not against last frame's
    // value) so slow sub-threshold decay ACCUMULATES and eventually crosses the threshold —
    // otherwise a per-frame overwrite would reset the baseline and the drift would never fire.
    // When it crosses, apply all targets at once and re-kick the whole sim (radial + links +
    // repulsion relax together to a new balance); otherwise stay settled. Synapses publish on
    // settle, so they reconnect at the relaxed coordinates — never mid-relaxation.
    const now = virtualNowMs()

    // Representational drift (spec 40): each NIGHT the clock crosses, every star's DIRECTION rotates
    // one step about its fixed per-seed axis — |p| (= strength) preserved, nothing moves between
    // boundaries (no real-time motion). DEMO-ONLY: the time machine ("하루/한 달 지나기") is where
    // time visibly passes, so this is the showcase of drift; in production coordinates re-emerge
    // fresh each session (헌법3 — not persisted) so there's nothing to animate mid-session, and the
    // user shouldn't see the layout lurch while watching. The axis is fixed (layout.applyAngularDrift)
    // so the rotations compose — a multi-day skip lands the same whether the clock jumps or tweens.
    // The re-kick lets links partly restore well-connected clusters → isolated stars drift more.
    if (isDemoMode()) {
      const night = Math.floor(now / DAY_MS)
      if (nightRef.current === null || night < nightRef.current) {
        nightRef.current = night // establish, or on a clock rewind re-establish, the baseline (no drift)
      } else if (night > nightRef.current) {
        const dn = night - nightRef.current
        nightRef.current = night
        const px = sim.px
        const vx = sim.vx
        for (let i = 0; i < sim.n; i++) {
          if (!sim.free[i]) continue
          const seed = memoryById.get(sim.ids[i])?.seed ?? 0
          const xi = i * 3
          const [dx, dy, dz] = applyAngularDrift([px[xi], px[xi + 1], px[xi + 2]], seed, dn)
          px[xi] = dx
          px[xi + 1] = dy
          px[xi + 2] = dz
          // Discrete reorientation → old velocity now aims wrong; clear it so a mid-relaxation
          // skip doesn't carry stale momentum into the rotated frame.
          vx[xi] = 0
          vx[xi + 1] = 0
          vx[xi + 2] = 0
        }
        if (sim.alpha < REKICK_ALPHA) sim.alpha = REKICK_ALPHA
        settledRef.current = false
      }
    }

    let targets = targetScratchRef.current
    if (targets.length !== sim.n) {
      targets = new Float32Array(sim.n)
      targetScratchRef.current = targets
    }
    let maxDelta = 0
    for (let i = 0; i < sim.n; i++) {
      const mem = memoryById.get(sim.ids[i])
      const r = mem ? radiusOf(mem, now) : sim.radius[i]
      targets[i] = r
      const d = Math.abs(r - sim.radius[i])
      if (d > maxDelta) maxDelta = d
    }
    if (maxDelta > REKICK_THRESHOLD) {
      sim.radius.set(targets) // commit the new shells (recall pull-in / accumulated decay)
      if (sim.alpha < REKICK_ALPHA) sim.alpha = REKICK_ALPHA
      settledRef.current = false
    }

    // 체험 우주 시간 이동은 데이터 배치를 한 번에 끝낸 뒤 최종 좌표만 보여준다. 좌표는 여전히
    // 클라이언트 force-sim에서 창발하지만, 중간 tick을 화면에 내보내지 않아 별이 튀어 보이지 않는다.
    if (quietSettleSeq !== quietSeqRef.current) {
      quietSeqRef.current = quietSettleSeq
      if (!isSettled(sim)) {
        if (sim.alpha < REKICK_ALPHA) sim.alpha = REKICK_ALPHA
        advance(sim, VALUES.forceSim.alphaDecayTicks)
      }
      sim.vx.fill(0)
      const buf = simPositions(sim)
      positionsRef.current = buf
      publish(sim, buf)
      settledRef.current = true
      markReady()
      return
    }

    if (isSettled(sim)) {
      if (!settledRef.current) {
        settledRef.current = true
        const buf = simPositions(sim)
        positionsRef.current = buf
        publish(sim, buf) // filaments reconnect at the emergent coordinates
        markReady() // first settle → reveal the placed universe (idempotent)
      }
      return
    }
    settledRef.current = false
    positionsRef.current = tick(sim, LAYOUT_TICKS_PER_FRAME)
  })

  return null
}

/** Renders the synapse graph (braided TSL filaments) at the SAME star positions the live
 *  force-sim produces (shared `layout` snapshot), so edges connect the rendered stars; each
 *  filament also fades between its two endpoint stars' mood colors. Edge brightness (incl.
 *  dormant dimming) is already baked into the store by get-universe (12). positionOf + colorOf
 *  are built in one useMemo so both stay stable (the filament geometry rebuilds only when the
 *  star set, colors, or the published layout change — not on every parent render). The layout
 *  is published at build (seed positions) and again on each settle, so filaments render right
 *  away and then reconnect at the relaxed coordinates once the sim settles (spec 22/38). */
function UniverseSynapses({
  layout,
  positionsRef,
  highlightedRecordId = null,
}: {
  layout: LayoutMap
  positionsRef: MutableRefObject<Float32Array | null>
  /** 강조 중인 원본 일기 id(spec 28). null = 강조 없음. 자기 stars 구독으로 집합을 파생한다. */
  highlightedRecordId?: string | null
}) {
  const edges = useSynapseStore((s) => s.edges)
  const stars = useMemoryStore((s) => s.stars)
  const emotionColors = useAppearance((s) => s.emotionColors)
  // 시냅스 스타일(spec 44): 선택값을 그대로 적용(store가 알 수 없는 스타일은 default로 검증·폴백). 소유권은
  // 스위처 선택 시점 + 서버 UpdateSettings(A4)에서 강제 — 렌더 폴백은 공유 우주 방문 시 소유자 선택을
  // 방문자 소유로 가려 회귀하므로 하지 않는다. 색·weight 시각·삭제금지 불변식은 SynapseFilaments가 유지.
  const synapseStyle = useAppearance((s) => s.synapseStyle)
  const selectedId = useSelector(focusActor, selectFocusedStarId)
  // 강조 일기의 별 id 집합 — record_id로 그룹(spec 28). 별 집합/강조 record 변경 시에만 재계산.
  const highlightedIds = useMemo(
    () =>
      highlightedRecordId
        ? new Set(starsOfRecord(stars, highlightedRecordId).map((s) => s.id))
        : EMPTY_ID_SET,
    [highlightedRecordId, stars],
  )
  // 일기 조망 강조(spec 28)는 단일 선택이 없을 때만(선택=근접 포커스 우선, StarField와 동일).
  const highlightActive = !selectedId && highlightedIds.size > 0
  // Spotlight/조망: fade the whole synapse web while a star is focused OR a diary is framed,
  // so the foregrounded connections stand alone. 조망일 땐 그 일기의 일내(intra) 선만 위에 또렷이.
  const dim = selectedId ? VALUES.focus.synapseDimStar : highlightActive ? VALUES.focus.synapseDimDiary : 1
  const { positionOf, colorOf, seedOf } = useMemo(() => {
    const colById = new Map(stars.map((s) => [s.id, resolveMoodRgb(s.memory.mood, emotionColors)] as const))
    const seedById = new Map(stars.map((s) => [s.id, s.memory.seed] as const))
    return {
      positionOf: (id: string): [number, number, number] | null => layout.get(id) ?? null,
      colorOf: (id: string): readonly [number, number, number] => colById.get(id) ?? NEUTRAL_RGB,
      // 부유 seed(StarField와 동일) — 필라멘트 끝이 떠다니는 별 중앙을 따라간다(spec 19).
      seedOf: (id: string): number => seedById.get(id) ?? 0,
    }
  }, [stars, emotionColors, layout])
  // id → live force-sim buffer row (stars order == sim.ids order == buffer order). Lets the
  // filaments follow the live positions per frame so they don't lag the moving stars (spec 24).
  const idIndex = useMemo(() => new Map(stars.map((s, i) => [s.id, i] as const)), [stars])
  // 강조 일기의 일내(within-event) 선 — 두 끝점이 모두 강조 집합에 든 엣지(spec 28, 1.1).
  const withinEdges = useMemo(
    () => (highlightActive ? edgesWithin(edges, highlightedIds) : []),
    [edges, highlightedIds, highlightActive],
  )
  if (edges.length === 0 || stars.length === 0) return null
  return (
    <>
      <SynapseFilaments
        edges={edges}
        positionOf={positionOf}
        colorOf={colorOf}
        seedOf={seedOf}
        positionsRef={positionsRef}
        idIndex={idIndex}
        dim={dim}
        style={synapseStyle}
      />
      <SynapseDust
        edges={edges}
        positionOf={positionOf}
        colorOf={colorOf}
        positionsRef={positionsRef}
        idIndex={idIndex}
        dim={dim}
      />
      {/* 조망 강조: 그 일기의 일내 선만 또렷하게(dim=1) 위에 한 겹 더 — 나머지 웹은 dim. */}
      {withinEdges.length > 0 && (
        <SynapseFilaments
          edges={withinEdges}
          positionOf={positionOf}
          colorOf={colorOf}
          seedOf={seedOf}
          positionsRef={positionsRef}
          idIndex={idIndex}
          dim={1}
          style={synapseStyle}
        />
      )}
    </>
  )
}

/** 우주의 숨(미세 부유): 별·시냅스를 한 그룹으로 묶어 아주 느리게 위아래·좌우로 띄운다 —
 *  입력이 없을 때도 우주가 정지화면처럼 굳지 않는다. 시냅스가 같은 그룹에 있어 연결이
 *  별에서 떨어지지 않고, 진폭(≤0.9)이 작아 fly-to/포커스의 고정 좌표 타깃과의 오차는
 *  체감되지 않는다. 별이 선택(포커스)되면 진폭을 0으로 풀어 조준이 흔들리지 않게 하고,
 *  prefers-reduced-motion이면 아예 움직이지 않는다(정책: motion-accessibility). */
function UniverseDrift({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const amp = useRef(1) // 선택 중 0으로, 해제 후 1로 부드럽게 복귀
  const selected = useSelector(focusActor, selectIsStarFocus)
  const reduce = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  useFrame((state, dt) => {
    const g = ref.current
    if (!g || reduce) return
    amp.current += ((selected ? 0 : 1) - amp.current) * (1 - Math.exp(-dt * 2))
    const t = state.clock.elapsedTime
    g.position.y = Math.sin(t * 0.22) * 0.9 * amp.current
    g.position.x = Math.sin(t * 0.13 + 1.7) * 0.45 * amp.current
  })
  return <group ref={ref}>{children}</group>
}

/** Camera fly-to (12): when the dormant page sets focusStarId, lerp the camera to that
 *  star's position and look at it, then select() it (opens the recall panel — re-ignite,
 *  2.2). Reads the SAME layout helper as StarField so it lands on the rendered star.
 *  The request is CONSUMED into local refs (and the store focus cleared) the moment the
 *  target is captured — so no stale focus can yank the camera on a later visit, and the
 *  flight survives StrictMode's setup→cleanup→setup (refs persist). Pure useFrame
 *  interpolation — no per-frame React state. */
function FlyToController({ positionsRef }: { positionsRef: MutableRefObject<Float32Array | null> }) {
  // 항행 머신이 flyingToStar 상태일 때만 flyStarId가 목표를 준다(spec 39); transitioning 태그가 클램프 완화.
  const flyStarId = useSelector(navigationActor, selectFlyStarId)
  const stars = useMemoryStore((s) => s.stars)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const flyingIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!flyStarId) return
    // Index by ARRAY position (= the force-sim buffer slot, like StarField + Synapses),
    // not StarNode.index, so the camera lands exactly where the star is rendered. Read the
    // LIVE buffer (fibonacci fallback) — never the static shell, or fly-to misses the star.
    const idx = stars.findIndex((s) => s.id === flyStarId)
    if (idx === -1) return // stars not loaded yet — effect re-runs when `stars` arrives
    const [x, y, z] = readBufferPosition(positionsRef.current, idx, stars.length, stars[idx].memory.seed)
    targetRef.current = new THREE.Vector3(x, y, z)
    flyingIdRef.current = flyStarId
    camera.up.set(0, 1, 0) // re-level: shed any free-look/arcball roll so the dive + recall is upright
    // 모드/전환 플래그는 nav 머신의 flyingToStar 상태(transitioning 태그)가 소유 — 별도 set 불요.
    // flyStarId는 도착(ARRIVED→recall) 전까지만 non-null이라 stale 재발화가 없다(구 focusStar(null) 소비 대체).
  }, [flyStarId, stars, camera, positionsRef])

  useFrame((_, dt) => {
    const target = targetRef.current
    if (!target) return
    // 다른 전이(FRAME_DIARY로 framingDiary 전환 등)가 flyingToStar를 가져가면 nav가 그 상태를 떠난다 →
    // 여기서 양보(FrameAll과 대칭). 안 그러면 FlyTo가 계속 카메라를 끌며 도착 시 stale SELECT_STAR·ARRIVED를
    // 쏴 일기 조망을 별 선택으로 덮고 엉뚱한 상태로 안착한다. nav를 LIVE(getSnapshot)로 읽는다.
    if (!navigationActor.getSnapshot().matches('flyingToStar')) {
      targetRef.current = null
      flyingIdRef.current = null
      return
    }
    // Track the star LIVE while flying: if it's still relaxing (a fresh fragment), re-read its
    // buffer position each frame so the camera follows it to its settled spot instead of a
    // stale capture (and "arrival" is judged against where it actually is).
    if (flyingIdRef.current) {
      const idx = stars.findIndex((s) => s.id === flyingIdRef.current)
      if (idx !== -1) {
        const [x, y, z] = readBufferPosition(positionsRef.current, idx, stars.length, stars[idx].memory.seed)
        target.set(x, y, z)
      }
    }
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
      // arrived → recall panel (11). 도착 시점에 focus를 별로 — dormant fly-to가 우주에 안착한 뒤
      // 패널을 연다(focus 머신, spec 39). 직접 클릭은 StarField onSelect가 이미 즉시 SELECT_STAR.
      if (flyingIdRef.current) focusActor.send({ type: 'SELECT_STAR', id: flyingIdRef.current })
      targetRef.current = null
      flyingIdRef.current = null
      navigationActor.send({ type: 'ARRIVED' }) // nav flyingToStar → recall (클램프 복원)
    }
  })

  return null
}

/** Frame-all camera (spec 28, 원본 일기로 별 찾기): when the user picks a diary, fly to a far
 *  vantage that fits ALL its stars on screen and hold there while they're highlighted. Reads
 *  the wayfinding store's frameRequest (keyed by nonce so re-framing the same diary re-fires),
 *  resolves the diary's stars to live force-sim buffer slots (the single coordinate source —
 *  헌법3; fibonacci fallback when the buffer isn't ready), and computes the vantage with the
 *  PURE frameTarget (frame.ts). Near/far guard (acceptance 1.4): a diary 조망 is FAR-only, so a
 *  recall (근접) camera is switched to nebula first and any single-star focus is released; the
 *  fit distance is clamped to the nebula viewing range so arrival isn't yanked by CameraRig.
 *  The whole-set centroid is recomputed fresh each request (acceptance 1.2). lerp/damp reuses
 *  the 12 fly-to feel (k=1−exp(−dt·4), as ModeTransition). */
function FrameAllController({ positionsRef }: { positionsRef: MutableRefObject<Float32Array | null> }) {
  // 일기 조망 = 항행 머신의 framingDiary 상태(spec 39). focus→nav 브리지(FocusNavBridge)가 포커스가
  // 일기로 진입할 때 FRAME_DIARY를 보내 이 상태로 들이고, recordId·frameSeq를 채운다. frameSeq는 단조
  // 증가(같은 일기 재조망도 재발화 — 구 wayfinding.frameRequest.nonce 대체). transitioning 태그가 클램프 완화.
  const recordId = useSelector(navigationActor, selectFrameRecordId)
  const frameSeq = useSelector(navigationActor, selectFrameSeq)
  const stars = useMemoryStore((s) => s.stars)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  const lastSeqRef = useRef(0)
  const posRef = useRef<THREE.Vector3 | null>(null)
  const tgtRef = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (recordId == null || frameSeq === lastSeqRef.current) return

    // Resolve the diary's stars → buffer slots (= array slot, like FlyTo/StarField/Synapses).
    const count = stars.length
    const slots: number[] = []
    for (let i = 0; i < count; i++) if (stars[i].memory.recordId === recordId) slots.push(i)
    // Don't consume the seq yet if the universe stars haven't loaded — the diary list loads
    // independently of GetUniverse, so a pick (or ?panel=diary deep-link) can fire first. The
    // effect re-runs when `stars` arrives (it's a dep); consume only once we can actually frame.
    if (slots.length === 0) return
    lastSeqRef.current = frameSeq

    // Read the LIVE coordinates (single source); fall back to the deterministic fibonacci
    // shell (same as the other readers) for any slot whose buffer row isn't ready yet.
    let buf = positionsRef.current
    if (!buf || buf.length < count * 3) {
      buf = new Float32Array(count * 3)
      for (const slot of slots) {
        const [x, y, z] = fibonacciStarPosition(slot, count, stars[slot].memory.seed)
        buf[slot * 3] = x
        buf[slot * 3 + 1] = y
        buf[slot * 3 + 2] = z
      }
    }

    // Limiting fov so the bounding sphere fits in BOTH dimensions (portrait → horizontal fov
    // is the tighter one). frameTarget is pure; the widget supplies the fov + reads coords.
    const persp = camera instanceof THREE.PerspectiveCamera ? camera : null
    const vFov = THREE.MathUtils.degToRad(persp ? persp.fov : 72)
    const aspect = persp ? persp.aspect : 1
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const ft = frameTarget(buf, slots, Math.min(vFov, hFov))
    if (!ft) return

    const center = new THREE.Vector3(ft.center[0], ft.center[1], ft.center[2])
    // View from OUTSIDE along the centroid's radial (nebula 조망 feel); centroid at the origin
    // → keep the current view direction; degenerate → +Z. Clamp the fit distance to the nebula
    // viewing range so arrival sits exactly where CameraRig will keep it (no post-arrival yank).
    const dir = center.clone()
    if (dir.lengthSq() < 1e-6) dir.copy(camera.position).sub(center)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1)
    dir.normalize()
    const dist = THREE.MathUtils.clamp(ft.distance, OBSERVE_MIN_DIST, 1500)
    posRef.current = center.clone().addScaledVector(dir, dist)
    tgtRef.current = center

    // 단일 포커스 해제는 구조적 — focus 머신이 diary 상태라 별 선택은 이미 없다(구 select(null) 불요).
    camera.up.set(0, 1, 0) // re-level: shed any free-look/arcball roll
    // 근접→far 강제·클램프 완화는 nav framingDiary 상태(transitioning 태그)가 소유. 도착 시 ARRIVED→nebula.
  }, [recordId, frameSeq, stars, positionsRef, camera])

  useFrame((_, dt) => {
    const pos = posRef.current
    const tgt = tgtRef.current
    if (!pos || !tgt) return
    // 다른 비행(토글→modeTransition, fly-to)이 카메라를 가져가면 nav가 framingDiary를 떠난다 → 여기서
    // 양보(두 컨트롤러가 같은 프레임에 camera/target을 쓰는 jitter 방지). nav 상태를 LIVE로 읽는다
    // (getSnapshot, 렌더-지연 구독 아님) — 다른 전이가 동기로 일어나도 즉시 반영된다.
    if (!navigationActor.getSnapshot().matches('framingDiary')) {
      posRef.current = null
      tgtRef.current = null
      return
    }
    const k = 1 - Math.exp(-dt * 4) // frame-rate-independent ease (= ModeTransition)
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
      navigationActor.send({ type: 'ARRIVED' }) // framingDiary → nebula (CameraRig가 클램프 복원)
    }
  })

  return null
}

/** focus→nav 브리지(spec 39): 포커스가 일기로 진입하면(또는 같은 일기 재선택으로 frameNonce가 오르면)
 *  항행 머신에 FRAME_DIARY를 보내 framingDiary 상태로 들인다 — 두 머신을 순환 ref 없이 잇는 한 곳.
 *  recordId가 null(별 포커스·idle)이면 보내지 않는다(나브는 자기 상태로 전이). */
function FocusNavBridge() {
  const recordId = useSelector(focusActor, selectHighlightedRecordId)
  const frameNonce = useSelector(focusActor, selectFrameNonce)
  useEffect(() => {
    if (recordId != null) navigationActor.send({ type: 'FRAME_DIARY', recordId })
  }, [recordId, frameNonce])
  return null
}

/** 근접/원거리 가드(spec 28·39). 일기 조망은 FAR(nebula) 전용이므로, 카메라가 recall로 들어가면
 *  일기 조망을 해제한다(acceptance 1.4 — 근접에서는 단일 엔그램만). 별 선택이 강조를 푸는 두 번째
 *  불변식은 이제 구조적이다 — focus 머신은 star/diary 중 하나만 활성이라 별을 고르면 diary는 자동
 *  해제된다(구 NearFarHighlightGuard의 selectedId 분기 불요). recall에서 별 포커스(star)는 정상이라
 *  diary일 때만 DISMISS한다. */
function RecallDismissGuard() {
  const isRecall = useSelector(navigationActor, selectIsRecall)
  useEffect(() => {
    if (isRecall && focusActor.getSnapshot().matches('diary')) {
      focusActor.send({ type: 'DISMISS' })
    }
  }, [isRecall])
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
  // 항행 머신 modeTransition 상태(spec 39) — TOGGLE_MODE로 진입, transitionTo가 도착 모드.
  const inModeTransition = useSelector(navigationActor, selectInModeTransition)
  const transitionTo = useSelector(navigationActor, selectTransitionTo)
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
    if (!inModeTransition) return // modeTransition 상태로 들어올 때만(실제 토글)
    // Preserve the current facing through the flight.
    if (controls) dir.current.subVectors(controls.target, camera.position)
    else camera.getWorldDirection(dir.current)
    if (dir.current.lengthSq() < 1e-6) dir.current.set(0, 0, -1)
    dir.current.normalize()

    if (transitionTo === 'recall') {
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
    // Re-level: shed any free-look roll (recall) or arcball roll (nebula) so the flight and the
    // destination pose are upright — matches the always-level overview the saved pose was taken at.
    camera.up.set(0, 1, 0)
    // 클램프 완화는 nav modeTransition 상태(transitioning 태그)가 소유 — 도착 시 ARRIVED→transitionTo.
  }, [inModeTransition, transitionTo, camera, controls])

  useFrame((_, dt) => {
    const pos = posRef.current
    const tgt = tgtRef.current
    if (!pos || !tgt) return
    // 비행 중 fly-to/조망 요청이 끼면 nav가 modeTransition을 떠난다 → 양보(FlyTo/FrameAll과 대칭).
    if (!navigationActor.getSnapshot().matches('modeTransition')) {
      posRef.current = null
      tgtRef.current = null
      return
    }
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
      navigationActor.send({ type: 'ARRIVED' }) // modeTransition → transitionTo (CameraRig가 클램프 복원)
    }
  })

  return null
}

// 모바일 하단 시트(작성 폼·회상 패널·기억 실험실)가 열리면 우주의 중심이 시트에 가려진다
// — 카메라는 그대로 두고 투영만 조작한다: view offset으로 세계 중심을 화면 위 1/3 지점에
// 올리고, camera.zoom을 살짝 풀어(줌아웃) 별들이 남은 화면 위쪽에 더 넓게 담기게 한다.
// 투영 차원의 시프트라 두 카메라 모드·전환 비행·포커스 어느 것과도 충돌하지 않고, 시트가
// 닫히면 부드럽게 복귀한다. sm(640px) 미만에서만 — 데스크톱 패널은 측면이라 불필요.
const SHEET_BREAKPOINT_PX = 640
const SHEET_VIEW_SHIFT = 1 / 6 // 중심(1/2)을 1/3로 올리는 데 필요한 오프셋 = 화면높이의 1/6
const SHEET_ZOOM = 0.8 // 시트가 열린 동안의 줌아웃(1 = 원래 화각)

function ViewOffsetController() {
  // 페이지 HUD가 올리는 시트(작성 폼, 기억 실험실) + 위젯이 스스로 아는 회상 패널(선택된
  // 별) — 회상은 여기서 직접 구독해, 별 선택이 어느 경로로 일어나도 시프트가 따라온다.
  const hudSheetOpen = useViewport((s) => s.sheetOpen)
  const recallOpen = useSelector(focusActor, selectIsStarFocus)
  // 일기 조망(spec 31): 일기를 고르면 하단에 일기 카드가 떠 있으므로, 그 일기 별들을 화면 위쪽으로
  // 올려(시선 위로) 카드에 가리지 않게 한다 — 모바일·데스크톱 공통(카드가 하단 중앙이라). (focus 머신)
  const diaryFramed = useSelector(focusActor, selectIsDiaryFocus)
  const offset = useRef(0)
  const zoom = useRef(1)
  const applied = useRef({ off: 0, zoom: 1, w: 0, h: 0 })
  useFrame((state, dt) => {
    const camera = state.camera
    const size = state.size
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const sheetActive = (hudSheetOpen || recallOpen) && size.width < SHEET_BREAKPOINT_PX
    const active = sheetActive || diaryFramed
    const targetOff = active ? size.height * SHEET_VIEW_SHIFT : 0
    // 일기 조망은 frame-all이 이미 별을 화면에 꼭 맞게 담았으므로 줌아웃하지 않는다(별이 작아지지
    // 않게) — 시선만 위로(offset). 모바일 시트(작성·회상)일 때만 살짝 줌아웃해 좁아진 위쪽에 더 담는다.
    const targetZoom = sheetActive ? SHEET_ZOOM : 1
    const k = 1 - Math.exp(-dt * 6) // frame-rate-independent ease
    const nextOff = offset.current + (targetOff - offset.current) * k
    offset.current = Math.abs(nextOff - targetOff) < 0.5 ? targetOff : nextOff
    const nextZoom = zoom.current + (targetZoom - zoom.current) * k
    zoom.current = Math.abs(nextZoom - targetZoom) < 1e-3 ? targetZoom : nextZoom

    const a = applied.current
    if (offset.current === 0 && zoom.current === 1) {
      if (camera.view?.enabled || camera.zoom !== 1) {
        camera.zoom = 1
        camera.clearViewOffset() // updateProjectionMatrix 포함
        a.off = 0
        a.zoom = 1
      }
      return
    }
    // 정착 후에는 재적용하지 않는다(매 프레임 투영행렬 재계산 방지). size가 바뀌면
    // 저장된 fullWidth/fullHeight가 낡으므로 그때만 다시 적용한다.
    if (a.off === offset.current && a.zoom === zoom.current && a.w === size.width && a.h === size.height) {
      return
    }
    camera.zoom = zoom.current
    camera.setViewOffset(size.width, size.height, 0, offset.current, size.width, size.height)
    a.off = offset.current
    a.zoom = zoom.current
    a.w = size.width
    a.h = size.height
  })
  return null
}

const FOCUS_UP = new THREE.Vector3(0, 1, 0) // world up — re-leveled into during a nebula framing

/** Gaze-lock + framing (focus): when a star is SELECTED — a direct click (recall panel, 11) or a
 *  fly-to arrival — bring it to front-centre and hold it while the panel is open. Mode-specific:
 *   - recall (근접): AIM-LOCK only — lerp the orbit target onto the star so the camera turns IN
 *     PLACE to face it (position fixed). Feels right when you're already among the stars.
 *   - nebula (원거리): also ORBIT the camera to the star's radial side at the SAME viewing distance
 *     (a rotation, not a surprise zoom) and re-level the horizon, so the star swings to a clean
 *     head-on framing — in FRONT, between the camera and the cloud — instead of being aimed at
 *     across the field from an arbitrary angle.
 *  NavController (recall) and NebulaOrbitController (nebula) stand down while selectedId is set, so
 *  nothing fights this. A no-op during a guided flight (transitioning) — FlyTo/ModeTransition own
 *  the camera then; this engages the instant they finish. Releases when the panel closes (select(null)).
 *  Reads the SAME fibonacci layout as StarField + fly-to so it lands on the rendered star. */
function FocusController({ positionsRef }: { positionsRef: MutableRefObject<Float32Array | null> }) {
  const selectedId = useSelector(focusActor, selectFocusedStarId)
  const stars = useMemoryStore((s) => s.stars)
  const isNebula = useSelector(navigationActor, selectIsNebula)
  const transitioning = useSelector(navigationActor, selectTransitioning)
  // 일기 조망(spec 28)이 활성이면 frame-all이 orbit 타깃을 소유한다 — 포커스 해제 복원이
  // 그 프레이밍을 끌어내리지 않게 한다(아래 deselect 분기에서 가드). (focus 머신, spec 39)
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null
  // The selected star's buffer slot + seed (pure derivation). Its position is read LIVE from
  // the force-sim buffer each frame, so focus tracks the star even while it's still relaxing.
  const sel = useMemo(() => {
    if (!selectedId) return null
    const idx = stars.findIndex((s) => s.id === selectedId)
    if (idx === -1) return null
    return { idx, seed: stars[idx].memory.seed }
  }, [selectedId, stars])
  const count = stars.length
  const targetPos = useRef(new THREE.Vector3())

  // Nebula framing distance, captured at selection: orbit to the star at the SAME distance the user
  // was viewing from (a rotation, not a surprise zoom). Clamped to the nebula range for safety.
  const radiusRef = useRef(OBSERVE_MIN_DIST)
  const desired = useRef(new THREE.Vector3())
  const dir = useRef(new THREE.Vector3())
  useEffect(() => {
    if (!selectedId || !controls) return
    radiusRef.current = THREE.MathUtils.clamp(
      camera.position.distanceTo(controls.target),
      OBSERVE_MIN_DIST,
      1500,
    )
  }, [selectedId, camera, controls])

  // 성운 모드에서 포커스가 orbit target을 별 위로 끌어다 두므로, 패널을 닫은 뒤에도 자유
  // 관찰 회전이 그 별을 축으로 돌게 된다(회전축이 바뀌는 버그). 선택 직전의 target을
  // 기억해 두었다가 해제 시 부드럽게 되돌린다. 근접(recall) 모드는 시선이 별에 남는 게
  // 자연스러우므로 복원하지 않는다.
  const savedTargetRef = useRef<THREE.Vector3 | null>(null)
  useEffect(() => {
    if (!isNebula) {
      savedTargetRef.current = null
      return
    }
    if (selectedId && controls && savedTargetRef.current === null) {
      savedTargetRef.current = controls.target.clone()
    }
  }, [selectedId, isNebula, controls])

  useFrame((_, dt) => {
    if (!controls || transitioning) return
    const k = 1 - Math.exp(-dt * FOCUS_K)
    if (!sel) {
      // 일기 조망(frame-all, spec 28)이 orbit 타깃을 소유 중이면 복원하지 않는다 — frameRecord가
      // select(null)을 하므로 그 직후 여기로 오는데, 저장 타깃으로 되돌리면 방금 프레이밍한 일기
      // 별들이 화면에서 미끄러진다. 저장 타깃을 버려(stale 복원 방지) frame-all에 양보한다.
      if (highlightedRecordId) {
        savedTargetRef.current = null
        return
      }
      // 해제 직후: orbit 중심을 포커스 이전 자리로 회복(NebulaOrbitController가 매 프레임
      // target을 바라보므로 lerp만으로 시점이 부드럽게 되돌아간다).
      const saved = savedTargetRef.current
      if (saved && isNebula) {
        controls.target.lerp(saved, k)
        if (controls.target.distanceTo(saved) < 0.05) {
          controls.target.copy(saved)
          savedTargetRef.current = null
        }
      }
      return
    }
    // The rendered star position — read LIVE from the shared buffer (fibonacci fallback), so
    // focus lands exactly where StarField drew it (acceptance 1.7).
    const [tx, ty, tz] = readBufferPosition(positionsRef.current, sel.idx, count, sel.seed)
    const target = targetPos.current.set(tx, ty, tz)
    // nebula (원거리): orbit the camera onto the star's radial line at the captured distance →
    // camera = star + starDir·D, so the star sits in FRONT with the cloud behind it. Re-level the
    // horizon for a clean head-on framing (skip near vertical, where lookAt's up is singular).
    if (isNebula && target.lengthSq() > 1e-6) {
      desired.current.copy(target).normalize().multiplyScalar(radiusRef.current).add(target)
      camera.position.lerp(desired.current, k)
      dir.current.subVectors(target, camera.position).normalize()
      if (Math.abs(dir.current.y) < 0.985) camera.up.lerp(FOCUS_UP, k).normalize()
    }
    // AIM-LOCK (both modes): lerp the orbit target onto the star. OrbitControls.update() repoints
    // the camera at it (recall: position fixed → turns in place; nebula: at the orbited position).
    controls.target.lerp(target, k)
    controls.update()
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
  const resizeObsRef = useRef<ResizeObserver | null>(null)
  useEffect(
    () => () => {
      resizeObsRef.current?.disconnect()
      glRef.current?.dispose()
    },
    [],
  )

  // Mount the R3F <Canvas> one frame after this widget, never on the same tick. R3F
  // only configures the renderer once it measures the container as non-zero; on a
  // fresh authed load the canvas would otherwise mount mid-layout, get measured as
  // 0×0, and never render (black). Deferring to the next animation frame guarantees
  // the full-viewport container is laid out before R3F measures it.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Keep the renderer + camera synced to the container size: ResizeObserver re-applies
  // it on layout changes and window resizes, so the WebGPU color attachment never
  // diverges from the swapchain (a mismatch rejects every frame → black canvas).
  const syncSize = useCallback((gl: WebGPURenderer, camera: THREE.Camera, el: Element) => {
    const w = el.clientWidth
    const h = el.clientHeight
    if (w === 0 || h === 0) return
    gl.setSize(w, h, true)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
  }, [])

  // 렌더러 init 실패 표면화(17, 2.2): R3F는 async gl 팩토리의 reject를 fire-and-forget
  // 으로 삼킨다(.catch 없는 내부 run()) — 바운더리가 영영 못 받는다. 그래서 실패를
  // state로 받아 "렌더 중 throw"로 바꿔 페이지의 에러 바운더리에 전달한다.
  const [initError, setInitError] = useState<unknown>(null)
  const glFactory = useCallback(
    (props: Parameters<typeof createRenderer>[0]) =>
      createRenderer(props).catch((e: unknown) => {
        setInitError(e)
        throw e // R3F 내부 진행도 멈춘다(거부 그대로 — 콘솔의 unhandled rejection은 진짜 장애 신호)
      }),
    [],
  )
  if (initError != null) throw initError

  // 우주의 배경 = 선택한 배경(Background) 번들(spec 44): 깊은 clear color + 선택적 텍스처(veil) 결.
  // 별(기억) 색은 mood(감정 의미색)라 배경과 무관하게 보존된다(A9 — StarField는 emotionColors/mood만 읽음).
  const background = backgroundMeta(useAppearance((s) => s.theme))
  const bg = background.bg
  // 별(기억) 오브제의 형태 = 선택한 object. StarField가 형태별 지오메트리·재질로 그린다(색은 mood 유지).
  const object = useAppearance((s) => s.object)
  // 감정색 사용자 오버라이드(spec 30) — 별·시냅스 색에 기본 팔레트 대신 우선 적용(빈 맵=기본).
  const emotionColors = useAppearance((s) => s.emotionColors)
  // 중심 "나" 별 형태(spec 38·44) — 우주 중심 앵커. 선택값을 그대로 그린다(store가 알 수 없는 id를 이미
  // 축 기본값으로 폴백·검증). 소유권은 *선택 시점*(스위처)과 서버(UpdateSettings A4)에서 강제한다 —
  // 렌더에서 소유권으로 다시 폴백하면 공유 우주(방문)에서 소유자 선택을 방문자 소유로 가려 깨진다(회귀).
  const selfObject = useAppearance((s) => s.selfObject)
  // 포커스 상태(focus 머신, spec 39) — 강조 일기 record_id + 선택 별 id. StarField/UniverseSynapses에
  // prop으로 내려 record_id로 자기 별 집합을 파생해 강조/dim하고, 별 탭은 onSelect로 머신에 보낸다.
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const selectedId = useSelector(focusActor, selectFocusedStarId)

  // The ONE live force-sim positions buffer all four readers share (spec 22, acceptance 1.7):
  // StarField + FlyTo + Focus read it directly (per-frame / at capture); the synapse renderers
  // bake against the `layout` snapshot published whenever the layout settles.
  const positionsRef = useRef<Float32Array | null>(null)
  const [layout, setLayout] = useState<LayoutMap>(() => new Map())
  const onLayout = useCallback((next: LayoutMap) => setLayout(next), [])
  // Hide the stars/synapses until the FIRST layout settles, then reveal them in place — so
  // the user never sees filaments snapping from seed positions to their relaxed spots (38).
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const onReset = useCallback(() => setReady(false), []) // re-veil on a mid-session source reset
  // Safety net: reveal anyway after a few seconds so a stuck/errored load (stars never
  // arrive, layout never settles) can't trap the user behind the loading veil forever.
  useEffect(() => {
    if (ready) return
    const id = setTimeout(() => setReady(true), 8000)
    return () => clearTimeout(id)
  }, [ready])

  if (!mounted) return null

  return (
    <>
      {/* 첫 레이아웃이 정착할 때까지 별·시냅스를 가리고, 그 동안 별먼지 배경 위에 잔잔한 안내를
          띄운다. 정착하면 부드럽게 사라진다(pointer-events 없음 — HUD는 그대로 조작 가능). */}
      <div
        aria-hidden={ready}
        className={cn(
          'pointer-events-none absolute inset-0 z-10 grid place-items-center transition-opacity duration-700',
          ready ? 'opacity-0' : 'opacity-100',
        )}
      >
        <p className="animate-pulse text-sm tracking-wide text-white/55">
          별들이 제자리를 찾고 있어요…
        </p>
      </div>
      <Canvas
      // gl = async WebGPU factory (WebGL2 auto-fallback) + init 실패 표면화 래퍼. 캐스트는
      // WebGPURenderer 고유 파라미터/반환 타입을 R3F의 명목 GLProps로 잇는 것뿐.
      gl={glFactory as unknown as GLProps}
      flat
      camera={{ position: [0, 0, 110], fov: 72, near: 0.1, far: 2000 }}
      // 빈 우주를 톡 치면 포커스 해제·복귀(은은한 딤도 함께 사라진다 — spec 31). R3F는 클릭 delta로
      // 드래그(회전)를 걸러 onPointerMissed는 '탭'에만 온다. 우선순위: 선택된 별 → 해제, 아니면 일기
      // 조망 → 강조 해제(페이지가 그 해제를 보고 일기 패널을 닫아 완전히 복귀시킨다). 별 탭은 onClick.
      onPointerMissed={() => {
        // 빈 우주를 톡 치면 포커스를 통째로 비워 복귀한다(focus 머신 DISMISS — 별/일기 한 번에, idle이면
        // 무해). 드래그(회전)는 R3F가 delta로 걸러 여기로 오지 않는다(탭만).
        focusActor.send({ type: 'DISMISS' })
      }}
      onCreated={(state) => {
        const gl = state.gl as unknown as WebGPURenderer
        glRef.current = gl
        const container = gl.domElement.parentElement ?? gl.domElement
        const ro = new ResizeObserver(() => syncSize(gl, state.camera, container))
        ro.observe(container)
        resizeObsRef.current = ro
        // universe_loaded의 renderer 속성(18, 3.3) — WebGPU/WebGL2 폴백 비율 측정.
        reportUniverseRenderer(rendererBackend(gl))
        if (import.meta.env.DEV) {
          console.log('[universe] renderer backend:', rendererBackend(gl))
        }
      }}
    >
      <color attach="background" args={[bg]} />
      {/* 몽환 성운 워시(spec 44): 선택한 배경 팔레트로 사방을 감싸는 도메인워프 오로라 한 겹(랜딩과 같은 결).
          모든 것 뒤(renderOrder -11)·depthWrite/Test 없음 → 별 mood 색·깊이 불간섭. reduced-motion이면 정지. */}
      <UniverseNebula palette={background.palette} />
      {/* 배경 번들의 텍스처/요소 슬롯(spec 44 A9): 선택적 색 베일 한 겹을 모든 것 뒤(renderOrder<0)에 깐다.
          별 mood 색은 불간섭(별보다 뒤·depthWrite 없음). 텍스처 없는 배경(vast/lively/calm)은 렌더 동일. */}
      <BackgroundVeil texture={background.texture} />
      {/* 어두운 반구 채움광(spec 03 — 하드코딩 0.4를 values로 이전). 반사(emissiveNode 내 계산)와 albedo
          이중계상 시 하향 재튜닝 대상. StarField는 자아-별이 원점이라 selfLightPos 기본(원점·점광)으로 충분. */}
      <ambientLight intensity={VALUES.starLighting.ambientFill} />
      {/* 테마 깊은 베이스색(위) 위에 요즘 상태(spec 25)를 여러 넓은 광원으로 가산한다 — 단일
          톤이 아니라 군데군데 번지는 불규칙 그라디언트. 별·시냅스보다 뒤(renderOrder<0). */}
      <AmbientNebula />
      <StarDust count={1500} />
      {/* 별과 시냅스는 함께 부유(연결이 떨어지지 않게); StarDust는 밖에 두어 시차가 생긴다.
          자아 별(나)도 같은 그룹에서 부유해 강한 기억과의 거리감이 유지된다(spec 38).
          visible=ready: 첫 레이아웃이 정착하기 전엔 가려, 시냅스가 엉뚱한 자리에서 움직이는
          과정을 숨기고 모두 제자리에 놓인 뒤 드러낸다(38). 컨트롤러는 게이트 밖에서 항상 돈다. */}
      <group visible={ready}>
        <UniverseDrift>
          <SelfStar selfObject={selfObject} />
          <UniverseSynapses
            layout={layout}
            positionsRef={positionsRef}
            highlightedRecordId={highlightedRecordId}
          />
          <StarField
            object={object}
            emotionColors={emotionColors}
            positionsRef={positionsRef}
            highlightedRecordId={highlightedRecordId}
            selectedId={selectedId}
            onSelect={(id) => focusActor.send({ type: 'SELECT_STAR', id })}
          />
        </UniverseDrift>
      </group>
      <LiveLayoutController
        positionsRef={positionsRef}
        onLayout={onLayout}
        onReady={onReady}
        onReset={onReset}
      />
      <CameraRig />
      <NebulaOrbitController />
      <NavController />
      <FlyToController positionsRef={positionsRef} />
      <FocusController positionsRef={positionsRef} />
      <FrameAllController positionsRef={positionsRef} />
      <FocusNavBridge />
      <RecallDismissGuard />
      <ModeTransitionController />
      <ViewOffsetController />
      <BloomPass />
      </Canvas>
    </>
  )
}
