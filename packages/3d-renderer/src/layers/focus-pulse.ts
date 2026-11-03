export function createFocusPulse() {
  return { elapsed: 0, scale: 1, opacity: 0.8, completed: false }
}

/** Returns a completion edge once; a reduced-motion cue stays static and resolves promptly. */
export function advanceFocusPulse(
  state: ReturnType<typeof createFocusPulse>,
  delta: number,
  reducedMotion: boolean,
): boolean {
  if (state.completed) return false
  state.elapsed += Math.max(0, Math.min(delta, 0.1))
  const t = Math.min(1, state.elapsed / (reducedMotion ? 0.35 : 1.1))
  state.scale = reducedMotion ? 1.35 : 1 + 1.8 * t
  state.opacity = reducedMotion ? 0.8 : 0.8 * (1 - t) ** 0.65
  state.completed = t === 1
  return state.completed
}
