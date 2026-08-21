import { VALUES } from '@cosimosi/config'

import { slowFactor } from './effective-values.ts'
import { elapsedUniverseDays } from './universe-time.ts'

// Semanticization ([C]) — the read-time gist axis mirroring the Go internal/memory implementation for
// golden-parity. Pure and IO-free. Independent of forgetting ([F] vs [C]): the gist-timer reads the
// semanticize reset anchor, forgetting reads the last-recall anchor. The rise is one-way ([C7]): a
// reset delays the next stage but never lowers the stage; semanticization deletes nothing ([I1][I2]).

// SEMANTIC_MAX_STAGE — the derived gist-ladder length (the count of pregenerated gist texts, matching
// the Go `len(SemanticStages)`); code, not a value. Stages never rise past it ([C7]).
export const SEMANTIC_MAX_STAGE = 4

// semanticize rises a gist stage by the whole gist-units elapsed, clamped at SEMANTIC_MAX_STAGE:
// monotone non-decreasing and total. A single advance may cross multiple stages ([R8a], CC5).
export function semanticize(currentStage: number, unitsElapsed: number): number {
  const units = unitsElapsed < 0 ? 0 : unitsElapsed
  const next = currentStage + units
  return next > SEMANTIC_MAX_STAGE ? SEMANTIC_MAX_STAGE : next
}

// gistUnitsElapsed is the gist-timer: whole gist-units elapsed since the reset anchor, in
// universe-days ([C6a][I10]). At the anchor it is 0 ([F5]). Arousal + connection strength slow it.
export function gistUnitsElapsed(
  now: string | null,
  timerResetAt: string,
  arousal: number,
  connectionStrength: number,
): number {
  const rawDays = elapsedUniverseDays(timerResetAt, now)
  const effectiveDays = rawDays * timerModulation(arousal, connectionStrength)
  return Math.floor(effectiveDays / VALUES.semantic.gistUnitsPerStage)
}

// timerModulation slows the gist-timer by arousal + connection strength, REUSING the forgetting
// slow-factor (no second coefficient) — in (0, 1]: `1 / slowFactor`, = 1 unmodulated, smaller as
// modulation grows. Arousal only, never valence ([F6][F7][I3]).
function timerModulation(arousal: number, connectionStrength: number): number {
  return 1 / slowFactor(arousal, connectionStrength)
}

// gistZOffset is the per-stage z LIFT of a gist body, not an absolute coordinate: the renderer adds
// it to the memory's live hippocampal (x, y, z), so the neocortex layer is a literal z-shifted copy
// of the lens ([C5][C6]; [I5] — the server derives no absolute coordinate).
// Stage-monotonic (the rise is one-way, [C6a]); a stage-progressive linear map over
// [gistZOffsetMin, gistZOffsetMax]. Layer separation is by construction:
// hippocampusZMin + gistZOffset(1) > hippocampusZMax, guard-tested next to this function.
export function gistZOffset(stage: number): number {
  const offsetMin = VALUES.forceSim.gistZOffsetMin
  const offsetMax = VALUES.forceSim.gistZOffsetMax
  const clamped = Math.min(Math.max(stage, 0), SEMANTIC_MAX_STAGE)
  return offsetMin + (clamped / SEMANTIC_MAX_STAGE) * (offsetMax - offsetMin)
}
