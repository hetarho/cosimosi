import { useEffect, useRef, type MutableRefObject } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useSelector } from '@xstate/react'
import * as THREE from 'three'
import { focusActor, selectIsStarFocus } from '@/entities/memory'
import { VALUES } from '@/shared/config'
import {
  addLookDelta,
  consumeLookDelta,
  setThrust,
  setGestureActive,
  markSuppressClick,
  resetGestureInput,
  addThrustTravel,
  addOrbitTravel,
  addZoomTravel,
  navigationInput,
} from '../../model/navigation-input'
import { passedDeadzone, isDoubleTap, thrustRamp, zoomScrubDelta } from '../../model/navigation-gesture'
import { navigationActor, selectIsNebula, selectIsRecall, selectTransitioning } from '../../model/navigation.machine'
import {
  ACCEL_K,
  BASE_SPEED,
  BOOST_RAMP,
  DRAG_K,
  HIT_SHAKE,
  IDLE_AMP,
  IMPULSE_AMP,
  IMPULSE_DECAY,
  LOOK_ACCEL_K,
  LOOK_BASE_RATE,
  LOOK_BOOST_RAMP,
  LOOK_DRAG_K,
  LOOK_MAX_BOOST,
  MAX_BOOST,
  NEBULA_DAMP,
  NEBULA_ROTATE_SPEED,
  NEBULA_ZOOM_SPEED,
  OBSERVE_MIN_DIST,
  RECALL_LIGHT_BACK,
  RECALL_LIGHT_UP,
  RECOIL,
  SHAKE_FREQ_HIT,
  SHAKE_FREQ_IDLE,
  SHAKE_FREQ_MOVE,
  SHIP_BOUNDARY,
  SPEED_AMP,
  SPEED_REF,
  WALL_REARM,
} from '../../model/nav-tuning'

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
export function CameraRig() {
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
export function NebulaOrbitController() {
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
  // change 08 — 두 손가락 pan(centroid 이동 → controls.target 평면 이동) + double-tap-hold 세로 zoom scrub.
  const pendingPan = useRef({ x: 0, y: 0 }) // 프레임 사이 누적 pan(스크린 px)
  const lastCentroid = useRef({ x: 0, y: 0 }) // 직전 2-finger centroid(pan delta 산출)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null) // double-tap 판정용 직전 탭
  const zoomScrub = useRef(false) // double-tap-hold 세로 스크럽 lock 중
  const scrubOriginY = useRef(0) // 스크럽 시작 Y(고정 기준점 — deadzone은 여기서 한 번만 차감)
  const scrubApplied = useRef(0) // 지금까지 zoom에 반영한 누적 fraction(증분만 더하려고 추적)

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
    const pan = pendingPan
    const cen = lastCentroid
    const tap = lastTap
    const scrub = zoomScrub
    const scrubOrigin = scrubOriginY
    const scrubApp = scrubApplied
    const DRAG_DEADZONE = VALUES.gesture.dragDeadzonePx // px — below this a 1-finger press is a tap (→ star select), not an orbit
    const twoFingerDist = () => {
      const it = pts.values()
      const a = it.next().value
      const b = it.next().value
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }
    const twoFingerCentroid = () => {
      const it = pts.values()
      const a = it.next().value
      const b = it.next().value
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 }
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
        // double-tap-hold → vertical zoom scrub (change 08): a second tap close in time/space to the
        // first ARMS the scrub; vertical drag then zooms and pan/rotate stay locked out.
        const prev = tap.current
        if (
          isDoubleTap(
            prev ? { t: prev.t, pt: { x: prev.x, y: prev.y } } : null,
            { t: e.timeStamp, pt: { x: e.clientX, y: e.clientY } },
            VALUES.gesture.doubleTapMs,
            VALUES.gesture.doubleTapMaxDistPx,
          )
        ) {
          scrub.current = true
          scrubOrigin.current = e.clientY
          scrubApp.current = 0
          tap.current = null
          setGestureActive(true)
          markSuppressClick()
        } else {
          scrub.current = false
          tap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY }
        }
      } else if (pts.size === 2) {
        drag.current = false // two fingers → pan + pinch-zoom, suspend rotate/scrub
        arm.current = null
        scrub.current = false
        pinch.current = twoFingerDist()
        cen.current = twoFingerCentroid()
        setGestureActive(true)
        markSuppressClick()
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size >= 2) {
        // PINCH zoom + two-finger PAN (change 08): distance change → dolly, centroid move → screen-plane
        // pan of controls.target so the orbit pivot follows the fingers (조망 기준점이 중앙에 안 묶인다).
        const d = twoFingerDist()
        if (pinch.current > 0 && d > 0) zoom.current += pinch.current / d - 1
        pinch.current = d
        const c = twoFingerCentroid()
        pan.current.x += c.x - cen.current.x
        pan.current.y += c.y - cen.current.y
        cen.current = c
        return
      }
      if (scrub.current) {
        // double-tap-hold vertical zoom scrub (change 08): vertical drag → dolly; pan/rotate locked out
        // (this whole branch returns before the orbit accumulation). Up = zoom in, down = zoom out.
        // zoomScrubDelta는 스크럽 시작점부터의 누적 이동량을 받아 deadzone을 한 번만 차감한다(rest에서
        // 시작 → 점프 없음). 프레임 간 델타를 넘기면 매번 deadzone에 못 미쳐 0이 되므로(줌이 거의 안 됨),
        // 고정 origin부터의 총 fraction을 구해 직전 반영분과의 증분만 누적한다.
        const totalFrac = zoomScrubDelta(
          e.clientY - scrubOrigin.current,
          VALUES.gesture.farZoomScrubDeadzonePx,
          VALUES.gesture.farZoomScrubSpeed,
        )
        zoom.current += totalFrac - scrubApp.current
        scrubApp.current = totalFrac
        return
      }
      if (!drag.current) {
        // Still inside the deadzone → not a drag yet (keep it tappable). Promote to an orbit only
        // once the armed finger travels past the threshold, and capture ONLY then so a sub-deadzone
        // tap is never stolen from the star raycast.
        if (arm.current !== e.pointerId) return
        if (!passedDeadzone(dwn.current, { x: e.clientX, y: e.clientY }, DRAG_DEADZONE)) return
        drag.current = true // promote past the deadzone (already captured on down)
        last.current = { x: e.clientX, y: e.clientY } // orbit starts here — no jump for the deadzone travel
        setGestureActive(true) // a drag, not a tap — guard onPointerMissed dismiss
        markSuppressClick()
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
        scrub.current = false
        const survivor = pts.values().next().value
        if (survivor) last.current = { x: survivor.x, y: survivor.y }
        drag.current = true
        arm.current = null
      } else if (pts.size === 0) {
        drag.current = false
        pinch.current = 0
        arm.current = null
        scrub.current = false
        pan.current.x = 0
        pan.current.y = 0
        // Clear gestureActive on a microtask so it OUTLASTS R3F's synchronous onPointerMissed for this
        // up — a drag/pan/scrub/pinch never fires the empty-tap dismiss; a true tap (never set it) does.
        queueMicrotask(() => setGestureActive(false))
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
      pan.current.x = 0
      pan.current.y = 0
      scrub.current = false
      tap.current = null
      setGestureActive(false)
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
      addOrbitTravel(Math.hypot(yaw, pitch)) // 데모 투어 회전 실습 관찰용(change 12, passive — 회전 불변)
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
      addZoomTravel(Math.abs(pendingZoom.current)) // 데모 투어 줌 실습 관찰용(change 12, passive — 줌 불변)
      const r = offset.current.length()
      offset.current.setLength(
        THREE.MathUtils.clamp(r * (1 + pendingZoom.current), OBSERVE_MIN_DIST, 1500),
      )
      pendingZoom.current = 0
    }

    // PAN (change 08) — two-finger centroid move shifts controls.target on the screen plane, so the
    // orbit pivot follows the fingers (camera rides along via the solve below). Scaled by radius so
    // far views pan proportionally. right*(-dx) + up*(+dy): the scene grabs and follows the fingers.
    if (pendingPan.current.x !== 0 || pendingPan.current.y !== 0) {
      const h = Math.max(1, gl.domElement.clientHeight || gl.domElement.height)
      const panScale = (VALUES.gesture.farPanSpeed * offset.current.length()) / h
      right.current.setFromMatrixColumn(camera.matrix, 0).normalize()
      up.current.setFromMatrixColumn(camera.matrix, 1).normalize()
      target.addScaledVector(right.current, -pendingPan.current.x * panScale)
      target.addScaledVector(up.current, pendingPan.current.y * panScale)
      pendingPan.current.x = 0
      pendingPan.current.y = 0
    }

    // Drive the camera directly — OrbitControls is disabled in nebula, so no update() is needed
    // (calling it would only re-solve the same pose). We own position + up + aim here.
    camera.position.copy(target).add(offset.current)
    camera.up.normalize()
    camera.lookAt(target)
  })

  return null
}

/** Close-mode ("별들 가까이서 탐험하기") canvas gestures (change 08): one-finger drag → look
 *  (yaw/pitch into navigation-input.lookDelta), two fingers → thrust (centroid vertical, deadzone→
 *  full ramp; left/right wobble ignored). 1↔2 transitions lock cleanly — look ends when the 2nd
 *  finger lands; thrust holds while two are down; on 2→1 look stays suspended until a fresh deadzone.
 *  Writes the ref-based navigation-input buffer (NO React state per pointermove — A15); NavController
 *  composes it with the keyboard `move`. A no-op outside settled recall AND during a star focus
 *  (FocusController owns the aim then) — so it never fights the guided flights / focus (A13). */
export function CloseGestureController() {
  const isRecall = useSelector(navigationActor, selectIsRecall)
  const starFocused = useSelector(focusActor, selectIsStarFocus)
  const gl = useThree((s) => s.gl)
  const active = isRecall && !starFocused

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const span = () => Math.max(1, el.clientWidth || el.width)
    const pts = new Map<number, { x: number; y: number }>()
    let mode: 'idle' | 'look' | 'thrust' = 'idle'
    let armed: number | null = null
    let downX = 0
    let downY = 0
    let lastX = 0
    let lastY = 0
    let thrustStartY = 0
    const centroidY = () => {
      let y = 0
      for (const p of pts.values()) y += p.y
      return pts.size ? y / pts.size : 0
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      if (pts.size === 1) {
        armed = e.pointerId
        mode = 'idle'
        downX = e.clientX
        downY = e.clientY
        lastX = e.clientX
        lastY = e.clientY
      } else if (pts.size === 2) {
        // 1→2: end look, lock thrust. centroid baseline so the ramp starts from rest.
        mode = 'thrust'
        armed = null
        thrustStartY = centroidY()
        setThrust(0)
        setGestureActive(true)
        markSuppressClick()
      }
    }
    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (pts.size >= 2) {
        // THRUST: centroid vertical delta → −1..1 (up = forward). 좌우 흔들림은 무시(세로 성분만).
        setThrust(
          thrustRamp(
            centroidY() - thrustStartY,
            VALUES.gesture.closeThrustDeadzonePx,
            VALUES.gesture.closeThrustFullPx,
          ),
        )
        return
      }
      if (mode === 'idle') {
        if (armed !== e.pointerId) return
        if (!passedDeadzone({ x: downX, y: downY }, { x: e.clientX, y: e.clientY }, VALUES.gesture.dragDeadzonePx))
          return
        mode = 'look'
        lastX = e.clientX
        lastY = e.clientY
        setGestureActive(true)
        markSuppressClick()
      }
      if (mode === 'look') {
        const s = span()
        const sens = VALUES.gesture.closeLookSensitivity
        // drag right → turn right (same sign sense as the D/→ key), drag up → look up.
        addLookDelta((-(e.clientX - lastX) / s) * sens, (-(e.clientY - lastY) / s) * sens)
        lastX = e.clientX
        lastY = e.clientY
      }
    }
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture?.(e.pointerId)
      if (pts.size === 1) {
        // 2→1: stop thrust; do NOT resume look until a fresh deadzone (re-arm the survivor).
        setThrust(0)
        const survivor = pts.entries().next().value
        if (survivor) {
          armed = survivor[0]
          downX = survivor[1].x
          downY = survivor[1].y
          lastX = survivor[1].x
          lastY = survivor[1].y
        }
        mode = 'idle'
      } else if (pts.size === 0) {
        mode = 'idle'
        armed = null
        setThrust(0)
        queueMicrotask(() => setGestureActive(false))
      }
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      pts.clear()
      resetGestureInput() // mode exit / focus → drop any held look/thrust (stand down, A13)
    }
  }, [active, gl])

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
export function NavController({
  selfLightRef,
}: {
  selfLightRef: MutableRefObject<readonly [number, number, number] | null>
}) {
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
  const lightArr = useRef<[number, number, number]>([0, 0, 0]) // reused → no per-frame allocation

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
      // Outside recall → no moving light: defer to the static center self-light (A3 — 원거리 중심
      // 자아 광원 규칙 유지). StarField falls back to its static selfLightPos when the ref is null.
      selfLightRef.current = null
      return
    }

    // Operate on the CLEAN (un-shaken) base so nav/clamp never accumulate the wobble.
    camera.position.sub(shakeOffset.current)
    controls.target.sub(shakeOffset.current)

    const { x, y } = navSnap.context.move
    // 추력 z = 키보드(move.z) + 제스처 thrust(두 손가락 세로, change 08), −1..1 클램프 — 둘 다 같은
    // 가속·관성·벽 물리를 탄다. 손을 떼면 thrust 0 → 기존 관성/제동으로 멈춘다(A6).
    const z = Math.max(-1, Math.min(1, navSnap.context.move.z + navigationInput().thrust))
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
      // 데모 투어 전진 실습 관찰용(change 12, passive): 사용자가 실제로 추력을 줄 때(z≠0)만 이동 거리 가산
      // — 키보드·D-pad(move.z)·제스처 thrust가 모두 z로 통합되므로 한 곳에서 전 경로를 센다(A5). 물리 불변.
      if (z !== 0) addThrustTravel(vel.current.length() * dt)
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
    // 키보드 look(가속·관성) + 제스처 look(한 손가락 드래그 — 매 프레임 누적분을 소비). consume는 매
    // 프레임 호출해 버퍼를 비운다(recall 밖에선 컨트롤러가 비활성이라 누적 자체가 없다).
    const gLook = consumeLookDelta()
    const dYaw = lookVel.current.yaw * dt + gLook.yaw
    const dPitch = lookVel.current.pitch * dt + gLook.pitch
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

    // 근접 이동 광원·아바타 앵커(spec 49 A1·A2·A3): 카메라 위치가 아니라 **어깨 너머(뒤+위)** 한 점.
    //   anchor = camPosBase − fwd·BACK_OFFSET + up·UP_OFFSET
    // shake 적용 전의 깨끗한 항행 기준 위치(camera.position은 위에서 shakeOffset을 뺀 base)에서 계산해
    // idle/벽 shake가 반사·아바타를 흔들지 않게 한다(A7). 같은 앵커를 SelfStar(나 아바타)도 공유하므로
    // 광원이 곧 나 — 정면 별이 뒤+위에서 오는 빛을 받아 입체 음영으로 서고, 정면 비행 시야엔 안 들어온다.
    // StarField가 매 프레임 ref.current로 반사 채널 uniform만 갱신(채널 경계 — A5: selfGlow/activation/
    // λ_eff/별 색·좌표·A_MIN 불변).
    fwd.current.subVectors(controls.target, camera.position).normalize()
    upAxis.current.copy(camera.up).normalize()
    lightArr.current[0] =
      camera.position.x - fwd.current.x * RECALL_LIGHT_BACK + upAxis.current.x * RECALL_LIGHT_UP
    lightArr.current[1] =
      camera.position.y - fwd.current.y * RECALL_LIGHT_BACK + upAxis.current.y * RECALL_LIGHT_UP
    lightArr.current[2] =
      camera.position.z - fwd.current.z * RECALL_LIGHT_BACK + upAxis.current.z * RECALL_LIGHT_UP
    selfLightRef.current = lightArr.current

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
