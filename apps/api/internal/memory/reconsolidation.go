package memory

import (
	"context"

	"github.com/cosimosi/api/internal/platform/values"
)

// Reconsolidation rules ([R6]) — the pure domain of a recall-time rewrite. A recall is not a replay
// but a rewrite: the objective record stays in the Diary ([I2][R7]), while the engram (the memory's
// current text, form seed, strength) changes. This file owns HOW that change is decided and shaped;
// WHEN it runs (the Recall/Reinforce/Reconsolidate transaction) is the recall use-case.
//
// The rule shape the use-case must satisfy ([R6][C7]):
//   - Prediction error (PredictionError.Differs = true): current_text ← the rewrite; seed ←
//     Reshape(seed, newSeed) ([V5]); only the NOT-yet-created remaining semantic/decay stage texts are
//     regenerated while already-created gist stages are kept ([C7]); a reconsolidated/user provenance
//     row is appended. Plus every no-error effect below (a reconsolidation is also a recall).
//   - No prediction error (Differs = false): reinforce ONLY ([R4][I8]) — brightness reset ([R2]),
//     recall LTP + the EffectiveStrength bump ([R3]), gist-timer reset ([C6a]); current_text, seed,
//     and stage texts are left UNCHANGED and NO reconsolidated provenance row is appended.
//   - Both cases: recall_count += 1, last_recalled_universe_time = now, and each neighbor's
//     forgetting_offset_days += NeighborForgettingDelta(sharedSemanticCount). The recalled memory
//     itself recovers wholly ([F5]) and takes NO self-offset. The Diary is untouched ([I2][R7]).
//
// The neighbor ± reuses the Depress/LTD seam (associative/local); it is explicitly NOT Downscale
// (SHY, homeostatic sleep [I9]), which appears nowhere here.

// PredictionError is the consumer-owned gate ([R6], ARCHITECTURE §2.4): a single LLM semantic-compare
// answering "is the rewrite meaningfully different in CONTENT from the current memory text, ignoring
// wording, spacing, and word order?". A content change (true) makes the recall a reconsolidation; a
// mere re-wording (false) is reinforce-only. The boundary is a semantic judgment that lives in the
// prompt/model, so this is deliberately a boolean port and NOT a similarity score with a values
// threshold — exposing a numeric cutoff would be a false knob. The domain depends on this interface;
// the concrete adapter (the AI provider seam + keyless-mock fallback + cost metering) lives outside
// the domain and is bound by the recall use-case. No LLM SDK is imported here.
type PredictionError interface {
	Differs(ctx context.Context, currentText string, rewrite string) (bool, error)
}

// reshapeCollisionNudge guarantees Reshape returns a different seed on the vanishingly rare collision
// where the caller's fresh entropy equals the current seed. It is an algorithmic constant (the
// difference guarantee is a formula, deliberately not a tuning value), not a knob. Kept small and
// additive — never a 64-bit bitwise op — so the TS mirror reproduces it within JS's safe-integer
// range (golden parity).
const reshapeCollisionNudge int64 = 1

// Reshape returns the new visual-form seed for a reconsolidated memory ([V5]). A seed is a meaningless
// value that fixes a unique form; it changes ONLY on reconsolidation, so the form visibly shifts when
// the content actually changes (reconstruction made visual) — plain recall never calls this
// ([R4][I8]). The caller (the backend, never the client — ARCHITECTURE §5) supplies fresh entropy as
// newSeed, keeping this pure and deterministic; the returned seed is guaranteed to differ from
// currentSeed, nudged on the rare collision.
func Reshape(currentSeed int64, newSeed int64) int64 {
	if newSeed != currentSeed {
		return newSeed
	}
	return newSeed + reshapeCollisionNudge
}

// NeighborForgettingDelta is the signed forgetting nudge ([R5]) a recall adds to ONE neighbor's
// forgetting_offset_days (universe-days). The caller computes sharedSemanticCount over SEMANTIC
// neurons only — spatial and entity neurons are excluded and emotion is never counted ([I3]); this
// function is purely the sign+magnitude rule over that count:
//
//	0                                   → 0            (not a neighbor)
//	exactly 1                           → slow (< 0)   spreading activation co-recalls a weak link
//	>= neighbor_speed_threshold (= 2)   → speed (> 0)  retrieval-induced forgetting inhibits a competitor
//
// The >=2 branch is the Depress/LTD case (associative/local), NOT Downscale/SHY ([I9]). The magnitudes
// are two independent values (slow ≠ −speed) because the two mechanisms tune separately.
func NeighborForgettingDelta(sharedSemanticCount int) float64 {
	switch {
	case sharedSemanticCount <= 0:
		return 0
	case sharedSemanticCount >= values.ReconsolidationNeighborSpeedThreshold:
		return values.ReconsolidationNeighborSpeedDays
	default:
		return values.ReconsolidationNeighborSlowDays
	}
}
