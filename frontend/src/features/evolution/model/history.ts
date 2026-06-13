// Pure evolution-history model (spec 24). No three/React/DOM (constitution §4 /
// acceptance 1.9 — mobile reusable). The viewer READS the append-only log spec 23
// wrote; nothing here mutates anything (it's a timelapse of variants).

/** A variant snapshot as the viewer consumes it — proto EvolutionSnapshot folded to a
 *  display shape. `brightness` is already an absolute 0..1 the renderer can use; `hueShift`
 *  is in degrees; `formSeedDelta` adds to the base seed (same memory, a little re-shaped). */
export interface EvolutionSnapshotVM {
  version: number
  brightness: number
  hueShift: number
  formSeedDelta: number
  trigger: string
  pe: number
  dir: number
  createdAt: string
}

/** trigger → Korean label (acceptance 1.3). Unknown triggers fall back to the raw value. */
export const TRIGGER_LABEL: Record<string, string> = {
  recall: '회상',
  new_neighbor: '새 이웃',
  nightly_gist: '야간 요지',
}

/** One scrub step: a snapshot plus its resolved label and normalized direction. */
export interface EvolutionStep {
  version: number
  brightness: number
  hueShift: number
  formSeedDelta: number
  triggerLabel: string
  /** +1 강화 / -1 약화 / 0 중립. */
  dir: 1 | -1 | 0
}

/** snapshots (version ASC) → scrubbable steps. Form/color drift comes only from the
 *  per-snapshot deltas (the base seed + emotion color stay fixed — same memory, a variant). */
export function toEvolutionSteps(snapshots: EvolutionSnapshotVM[]): EvolutionStep[] {
  return snapshots.map((s) => ({
    version: s.version,
    brightness: s.brightness,
    hueShift: s.hueShift,
    formSeedDelta: s.formSeedDelta,
    triggerLabel: TRIGGER_LABEL[s.trigger] ?? s.trigger,
    dir: s.dir > 0 ? 1 : s.dir < 0 ? -1 : 0,
  }))
}

/** Clamp a scrub index to [0, len-1] (0 when empty), so the slider can't run off the ends. */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0
  return Math.max(0, Math.min(len - 1, i))
}
