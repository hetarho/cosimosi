// Pure arrival-latch reducer for the navigation rig, extracted so the once-per-glide firing
// rule is unit-testable (the rig itself only runs inside R3F's useFrame). A focus/fly glide
// must fire ARRIVED exactly once when the camera settles inside the epsilon shell, AND must
// always terminate so free navigation is never permanently locked out.

export type NavigationPoseMode = 'idle' | 'focusing' | 'flying'

export interface ArrivalLatchState {
  arrivedSent: boolean
  lastMode: NavigationPoseMode
  lastTargetId: string | null
  glideElapsed: number
}

export interface ArrivalLatchFrame {
  readonly mode: NavigationPoseMode
  /** Identity of the travel target; a change re-arms the latch. */
  readonly targetId: string | null
  /** Camera position and look target both settled inside the arrival shell this frame. */
  readonly withinEpsilon: boolean
  /** Seconds elapsed since the previous frame. */
  readonly delta: number
  /** A glide that cannot settle within this many seconds force-arrives (safety net). */
  readonly arriveTimeoutSeconds: number
}

export function createArrivalLatchState(): ArrivalLatchState {
  return { arrivedSent: false, lastMode: 'idle', lastTargetId: null, glideElapsed: 0 }
}

// Advances the latch one frame and returns whether ARRIVED should fire now. Mutates `state`
// in place — called every frame, so no per-frame allocation (§3.3).
export function stepArrivalLatch(state: ArrivalLatchState, frame: ArrivalLatchFrame): boolean {
  // A new travel command — mode OR target changed — re-arms the latch. Keying on the target
  // id (not just the mode string) is what lets a retarget fire ARRIVED even when the machine
  // passed through idle between two same-mode glides without the rig ever polling that idle
  // frame; a mode-only latch strands the glide (controls stay disabled) until reload.
  if (frame.mode !== state.lastMode || frame.targetId !== state.lastTargetId) {
    state.lastMode = frame.mode
    state.lastTargetId = frame.targetId
    state.arrivedSent = false
    state.glideElapsed = 0
  }

  if (frame.mode === 'idle') {
    state.arrivedSent = false
    state.glideElapsed = 0
    return false
  }

  state.glideElapsed += frame.delta

  if (!frame.withinEpsilon) {
    // Left the arrival shell (or hasn't reached it yet) — re-arm so re-entry fires ARRIVED.
    state.arrivedSent = false
  } else if (!state.arrivedSent) {
    state.arrivedSent = true
    return true
  }

  // Safety net: an under-damped chase of a continuously drifting target (representational
  // drift never freezes the layout) might never settle inside the shell. Bound the glide so
  // it always returns to idle and re-enables free navigation rather than hanging.
  if (!state.arrivedSent && state.glideElapsed >= frame.arriveTimeoutSeconds) {
    state.arrivedSent = true
    return true
  }

  return false
}
