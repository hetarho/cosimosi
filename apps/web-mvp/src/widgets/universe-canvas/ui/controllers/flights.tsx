import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useSelector } from '@xstate/react'
import * as THREE from 'three'
import {
  focusActor,
  selectFocusedStarId,
  selectHighlightedRecordId,
  selectIsStarFocus,
  selectIsDiaryFocus,
  selectFrameNonce,
  useMemoryStore,
} from '@/entities/memory'
import { frameTarget } from '@/features/wayfinding'
import { fibonacciStarPosition } from '@/shared/lib'
import { navigationActor, selectFlyStarId, selectFrameRecordId, selectFrameSeq, selectInModeTransition, selectTransitionTo, selectIsNebula, selectIsRecall, selectTransitioning } from '../../model/navigation.machine'
import { useViewport } from '../../model/use-viewport'
import { readBufferPosition } from '../../model/layout-position'
import { useOrbitControls } from '@/shared/lib/r3f'
import {
  FOCUS_K,
  NEBULA_FRAME_DIST,
  OBSERVE_MIN_DIST,
  SHEET_BREAKPOINT_PX,
  SHEET_VIEW_SHIFT,
  SHEET_ZOOM,
  SHIP_LOOK_AHEAD,
} from '../../model/nav-tuning'

/** Camera fly-to (12): when the dormant page sets focusStarId, lerp the camera to that
 *  star's position and look at it, then select() it (opens the recall panel — re-ignite,
 *  2.2). Reads the SAME layout helper as StarField so it lands on the rendered star.
 *  The request is CONSUMED into local refs (and the store focus cleared) the moment the
 *  target is captured — so no stale focus can yank the camera on a later visit, and the
 *  flight survives StrictMode's setup→cleanup→setup (refs persist). Pure useFrame
 *  interpolation — no per-frame React state. */
export function FlyToController({ positionsRef }: { positionsRef: MutableRefObject<Float32Array | null> }) {
  // 항행 머신이 flyingToStar 상태일 때만 flyStarId가 목표를 준다(spec 39); transitioning 태그가 클램프 완화.
  const flyStarId = useSelector(navigationActor, selectFlyStarId)
  const stars = useMemoryStore((s) => s.stars)
  const camera = useThree((s) => s.camera)
  const controls = useOrbitControls()
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
export function FrameAllController({ positionsRef }: { positionsRef: MutableRefObject<Float32Array | null> }) {
  // 일기 조망 = 항행 머신의 framingDiary 상태(spec 39). focus→nav 브리지(FocusNavBridge)가 포커스가
  // 일기로 진입할 때 FRAME_DIARY를 보내 이 상태로 들이고, recordId·frameSeq를 채운다. frameSeq는 단조
  // 증가(같은 일기 재조망도 재발화 — 구 wayfinding.frameRequest.nonce 대체). transitioning 태그가 클램프 완화.
  const recordId = useSelector(navigationActor, selectFrameRecordId)
  const frameSeq = useSelector(navigationActor, selectFrameSeq)
  const stars = useMemoryStore((s) => s.stars)
  const camera = useThree((s) => s.camera)
  const controls = useOrbitControls()
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
export function FocusNavBridge() {
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
export function RecallDismissGuard() {
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
export function ModeTransitionController() {
  // 항행 머신 modeTransition 상태(spec 39) — TOGGLE_MODE로 진입, transitionTo가 도착 모드.
  const inModeTransition = useSelector(navigationActor, selectInModeTransition)
  const transitionTo = useSelector(navigationActor, selectTransitionTo)
  const camera = useThree((s) => s.camera)
  const controls = useOrbitControls()
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
export function ViewOffsetController() {
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
export function FocusController({ positionsRef }: { positionsRef: MutableRefObject<Float32Array | null> }) {
  const selectedId = useSelector(focusActor, selectFocusedStarId)
  const stars = useMemoryStore((s) => s.stars)
  const isNebula = useSelector(navigationActor, selectIsNebula)
  const transitioning = useSelector(navigationActor, selectTransitioning)
  // 일기 조망(spec 28)이 활성이면 frame-all이 orbit 타깃을 소유한다 — 포커스 해제 복원이
  // 그 프레이밍을 끌어내리지 않게 한다(아래 deselect 분기에서 가드). (focus 머신, spec 39)
  const highlightedRecordId = useSelector(focusActor, selectHighlightedRecordId)
  const camera = useThree((s) => s.camera)
  const controls = useOrbitControls()
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
