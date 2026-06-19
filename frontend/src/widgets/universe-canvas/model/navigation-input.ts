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
}

const state: NavigationInput = {
  lookDelta: { yaw: 0, pitch: 0 },
  thrust: 0,
  gestureActive: false,
  suppressClickSeq: 0,
}

/** The shared singleton (read snapshot fields; mutate via the helpers below). */
export function navigationInput(): NavigationInput {
  return state
}

/** Accumulate a frame's worth of close-mode look rotation (radians). */
export function addLookDelta(yaw: number, pitch: number): void {
  state.lookDelta.yaw += yaw
  state.lookDelta.pitch += pitch
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
