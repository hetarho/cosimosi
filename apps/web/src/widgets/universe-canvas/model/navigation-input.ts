// Mutable gesture-input buffer (spec 06, change 08) bridging the canvas gesture controller →
// NavController WITHOUT routing high-frequency pointermove through React state / XState context.
// Pure: no React/three/DOM (헌법4) — a plain mutable module singleton the controller writes on each
// pointermove and NavController consumes each frame. lookDelta accumulates yaw/pitch since the last
// consume; thrust is the current −1..1 level. gestureActive / suppressClickSeq guard the tap path.

export interface NavigationInput {
  /** Accumulated yaw/pitch (radians) since the last consumeLookDelta — close-mode one-finger look. */
  lookDelta: { yaw: number; pitch: number }
  /** Current close-mode thrust −1..1 (two-finger vertical), 0 = none. */
  thrust: number
  /** True while a canvas gesture (drag / two-finger / zoom scrub) is active. */
  gestureActive: boolean
  /** Bumped whenever a pointer sequence should NOT count as a star-select tap (drag / two-finger /
   *  zoom scrub). The Canvas onPointerMissed guard reads it so a gesture never fires a dismiss. */
  suppressClickSeq: number
  /** Monotonic PASSIVE travel counters (change 12 — 데모 투어 항해 실습 관찰 전용). 입력 의미·consume
   *  경로 불변: 읽기 전용 가산만 한다. 투어가 rAF로 샘플링해 phase 진입 baseline 대비 임계 도달을 본다.
   *  세션 단조 누적(리셋 안 함) — 절대값이 아니라 delta로 판정하므로 reset 불요. */
  travel: NavTravel
}

/** 항해 실습 관찰용 단조 누적 카운터(모드별 배타 — orbit/zoom=nebula, look/thrust=recall). */
export interface NavTravel {
  /** recall 시선 누적 각(rad) — CloseGestureController가 addLookDelta로 가산. */
  look: number
  /** recall 전진 누적 거리(world) — NavController가 매 프레임 가산(키보드·D-pad·제스처 thrust 통합). */
  thrust: number
  /** nebula 궤도 회전 누적 각(rad) — NebulaOrbitController가 가산. */
  orbit: number
  /** nebula 줌 반경 변화 누적 비율(|fraction| 합) — NebulaOrbitController가 가산. */
  zoom: number
}

const state: NavigationInput = {
  lookDelta: { yaw: 0, pitch: 0 },
  thrust: 0,
  gestureActive: false,
  suppressClickSeq: 0,
  travel: { look: 0, thrust: 0, orbit: 0, zoom: 0 },
}

/** The shared singleton (read snapshot fields; mutate via the helpers below). */
export function navigationInput(): NavigationInput {
  return state
}

/** Accumulate a frame's worth of close-mode look rotation (radians). */
export function addLookDelta(yaw: number, pitch: number): void {
  state.lookDelta.yaw += yaw
  state.lookDelta.pitch += pitch
  state.travel.look += Math.hypot(yaw, pitch) // passive — 투어 시선 실습 관찰용(consume 경로 불변)
}

/** 항해 실습 관찰용 단조 카운터 스냅샷(투어 rAF 샘플러 read-only). 매번 *복사본*을 돌려준다 — 투어가
 *  phase 진입 baseline을 떠놓고 이후 delta를 보므로, 라이브 객체 참조를 주면 baseline이 같이 흘러 delta가
 *  항상 0이 된다(앨리어싱 방지). 4필드 복사라 비용 무시 가능. */
export function navTravel(): NavTravel {
  return { ...state.travel }
}

/** recall 전진 누적 거리 가산(NavController가 매 프레임, 키보드·D-pad·제스처 thrust 통합 — passive). */
export function addThrustTravel(dist: number): void {
  state.travel.thrust += dist
}

/** nebula 궤도 회전 누적 각 가산(NebulaOrbitController — passive). */
export function addOrbitTravel(rad: number): void {
  state.travel.orbit += rad
}

/** nebula 줌 반경 변화 누적 비율 가산(NebulaOrbitController — passive). */
export function addZoomTravel(ratio: number): void {
  state.travel.zoom += ratio
}

// ── 첫 별 튜토리얼 카메라 lock(change 34·job 50) — 순수 모듈 플래그 ──────────────────────────────
// 튜토리얼 시작부터 첫 별 클릭/회상 설명 전까지 마우스·터치·키보드 카메라 조작을 잠근다(A9). 제스처
// 컨트롤러·NavController·NavPad 키보드가 매 프레임/이벤트에서 이 플래그를 읽어 stand down한다. 별 click
// raycast·HUD/폼 pointer event는 막지 않는다(이 플래그는 *카메라 입력*에만 관여). 페이지가 tour 단계에
// 맞춰 set한다. 비반응형(컨트롤러가 핸들러/프레임에서 직접 읽는다 — React 구독 불요).
let tourCameraLocked = false

/** 튜토리얼 카메라 lock을 켜고/끈다. 켤 때 누적 제스처 입력을 비워(resetGestureInput) 잠금 직전의 관성·
 *  눌림이 새지 않게 한다. */
export function setTourCameraLocked(locked: boolean): void {
  if (tourCameraLocked === locked) return
  tourCameraLocked = locked
  if (locked) resetGestureInput()
}

/** 카메라 조작이 튜토리얼로 잠겨 있는가(컨트롤러·키보드가 매 프레임/이벤트 read-only로 본다). */
export function isTourCameraLocked(): boolean {
  return tourCameraLocked
}

/** Read AND clear the accumulated look delta — NavController calls once per frame. */
export function consumeLookDelta(): { yaw: number; pitch: number } {
  const out = { yaw: state.lookDelta.yaw, pitch: state.lookDelta.pitch }
  state.lookDelta.yaw = 0
  state.lookDelta.pitch = 0
  return out
}

/** Set the current close-mode thrust (−1..1; 0 = none). */
export function setThrust(t: number): void {
  state.thrust = t
}

/** Mark a canvas gesture active/inactive (onPointerMissed / lifecycle gating). */
export function setGestureActive(active: boolean): void {
  state.gestureActive = active
}

/** Flag that the in-flight pointer sequence is a gesture, not a selectable tap. */
export function markSuppressClick(): void {
  state.suppressClickSeq += 1
}

/** Clear all continuous gesture input — mode/focus/transition stand-down + controller teardown. */
export function resetGestureInput(): void {
  state.lookDelta.yaw = 0
  state.lookDelta.pitch = 0
  state.thrust = 0
  state.gestureActive = false
}
