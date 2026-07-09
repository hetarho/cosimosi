import { VALUES } from '@cosimosi/config'

// Reconsolidation numeric rules ([R5][V5]) — the TS mirror of the pure functions in the Go
// internal/memory context, held byte-for-byte by golden parity. The prediction-error gate is server-
// only (an LLM port), so it has NO mirror here. reshape/neighborForgettingDelta are parity-pinned so
// the client simulation can grow without drifting from the server.

// Guarantees Reshape returns a seed different from currentSeed on the rare collision where the
// caller's fresh entropy equals it. Matches the Go reshapeCollisionNudge; additive (never a bitwise
// op) so it stays exact within JS's safe-integer range.
const RESHAPE_COLLISION_NUDGE = 1

// reshape returns the new visual-form seed for a reconsolidated memory ([V5]): the caller-supplied
// fresh entropy (newSeed), or a nudged value on the vanishingly rare collision, always ≠ currentSeed.
// Plain recall never calls this ([R4][I8]).
export function reshape(currentSeed: number, newSeed: number): number {
  if (newSeed !== currentSeed) return newSeed
  return newSeed + RESHAPE_COLLISION_NUDGE
}

// neighborForgettingDelta is the signed forgetting nudge ([R5]) a recall adds to ONE neighbor's
// forgetting_offset_days (universe-days). The caller counts shared SEMANTIC neurons only (spatial/
// entity excluded, emotion never counted — [I3]); this is the sign+magnitude rule: 0 → 0; exactly 1 →
// slow (< 0, spreading activation); >= neighbor_speed_threshold (= 2) → speed (> 0, retrieval-induced
// forgetting). The recalled memory itself takes no offset ([F5]).
export function neighborForgettingDelta(sharedSemanticCount: number): number {
  if (sharedSemanticCount <= 0) return 0
  if (sharedSemanticCount >= VALUES.reconsolidation.neighborSpeedThreshold) {
    return VALUES.reconsolidation.neighborSpeedDays
  }
  return VALUES.reconsolidation.neighborSlowDays
}
