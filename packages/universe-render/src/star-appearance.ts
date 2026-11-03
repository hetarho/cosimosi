import { VALUES } from '@cosimosi/config'

export interface StarAppearance {
  readonly progress: Map<string, number>
  hydrated: boolean
  ids: readonly string[]
  active: boolean
}

export function createStarAppearance(): StarAppearance {
  return { progress: new Map(), hydrated: false, ids: [], active: false }
}

/** Existing memories hydrate at full size; only births after that commit emerge. */
export function reconcileStarAppearance(
  state: StarAppearance,
  ids: readonly string[],
  targets: ArrayLike<number>,
  scales: Float32Array,
  reducedMotion: boolean,
  birthIds?: ReadonlySet<string>,
): void {
  const alive = new Set(ids)
  for (const id of state.progress.keys()) if (!alive.has(id)) state.progress.delete(id)
  state.ids = ids
  state.active = false
  let birthIndex = 0
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    let progress = state.progress.get(id)
    if (reducedMotion || !state.hydrated) progress = 1
    else if (progress === undefined) {
      progress = birthIds && !birthIds.has(id) ? 1 : -Math.min(birthIndex++ * 0.06, 0.18)
    }
    state.progress.set(id, progress)
    state.active ||= progress < 1
    scales[i] = (targets[i] ?? 0) * envelope(progress)
  }
  state.hydrated = true
}

export function advanceStarAppearance(
  state: StarAppearance,
  deltaSeconds: number,
  targets: ArrayLike<number>,
  scales: Float32Array,
  paused = false,
): boolean {
  if (!state.active || paused) return false
  const step =
    Math.max(0, Math.min(deltaSeconds, VALUES.rendering.awakenMaxStepS)) /
    VALUES.rendering.awakenDurationS
  state.active = false
  for (let i = 0; i < state.ids.length; i++) {
    const id = state.ids[i]!
    const progress = Math.min(1, (state.progress.get(id) ?? 1) + step)
    state.progress.set(id, progress)
    state.active ||= progress < 1
    scales[i] = (targets[i] ?? 0) * envelope(progress)
  }
  return true
}

function envelope(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}
