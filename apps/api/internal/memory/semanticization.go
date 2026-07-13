package memory

import (
	"math"
	"sort"
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

// Semanticization ([C]) is the read-time gist axis: as universe-time passes since the last recall
// reset, a memory's meaning compresses and it rises through pregenerated gist stages, ascending from
// the hippocampus toward the neocortex band. Every function here is a pure, IO-free domain service
// (§2.5) — no clock, DB, transport, SDK, or randomness — so the FE render mirror in
// packages/memory-logic and the server compute the same gist, pinned by the shared golden fixture.
//
// The axis is INDEPENDENT of forgetting ([F] vs [C]): the gist-timer reads semanticize_timer_reset_at,
// while forgetting decay reads last_recalled_universe_time. A memory may be deeply decayed yet barely
// gistified and vice versa. Semanticization deletes nothing and never mutates the Diary — it rises a
// derived stage and computes a coordinate; the concrete hippocampal memory and its current_text remain
// ([I1][I2]). The rise is one-way ([C7], z-axis): a recall/reconsolidation reset of the timer anchor
// DELAYS the next stage (recomputed units → 0) but never lowers semantic_stage — already-risen gist
// stages are kept. (The reset WRITE is the recall use-case; this unit defines the read semantics.)

// semanticMaxStage is the DERIVED gist-ladder length — the count of pregenerated gist texts a memory
// carries (SemanticStages), not a tuned value. Stages never rise past it ([C7]).
const semanticMaxStage = len(SemanticStages{})

// Semanticize rises a gist stage by the whole gist-units elapsed, clamped at semanticMaxStage:
// monotone non-decreasing (≥ currentStage for unitsElapsed ≥ 0) and total ([C7]). A single advance may
// cross MULTIPLE stages (unitsElapsed > 1) — it adds all whole units and clamps; the consolidation
// use-case appends one memory_provenance row (kind=semanticized, source=system, the risen stage's
// pregenerated text, the advance universe_time) per crossed stage so 변천사 stays continuous across a
// large clock jump (CC5, [R8a]). This unit performs no IO — it only computes the risen stage.
func Semanticize(currentStage int, unitsElapsed int) int {
	if unitsElapsed < 0 {
		unitsElapsed = 0
	}
	next := currentStage + unitsElapsed
	if next > semanticMaxStage {
		return semanticMaxStage
	}
	return next
}

// GistUnitsElapsed is the gist-timer: whole gist-units elapsed since the reset anchor, in universe-days
// ([C6a][I10]). At the anchor (now = timerResetAt) it is 0 — no stage rises ([F5]). Arousal and
// connection strength SLOW it via timerModulation, and universe times are date-only so elapsed is whole
// universe-days (matching the TS mirror).
func GistUnitsElapsed(now time.Time, timerResetAt time.Time, arousal float64, connectionStrength float64) int {
	rawDays := math.Max(0, utcDate(now).Sub(utcDate(timerResetAt)).Hours()/24)
	effectiveDays := rawDays * timerModulation(arousal, connectionStrength)
	return int(math.Floor(effectiveDays / values.SemanticGistUnitsPerStage))
}

// timerModulation slows the gist-timer by arousal + connection strength, REUSING the forgetting
// slow-factor (no second coefficient introduced) — a high-arousal, well-connected memory gistifies
// slower, just as it forgets slower. It is in (0, 1]: `1 / slowFactor`, = 1 when unmodulated and
// smaller as modulation grows. Arousal only, never valence ([F6][F7][I3]).
func timerModulation(arousal float64, connectionStrength float64) float64 {
	return 1 / slowFactor(arousal, connectionStrength)
}

// ConsumeGistUnits is the gist-timer's inverse: the anchor moved forward by exactly the whole
// days the crossed units spanned, so residual sub-unit progress carries and re-reading the
// timer from the returned anchor yields zero units for the same "now" — the convergence the
// consolidation materializer relies on ([C6a]; never a refund that would re-rise the next
// stage early, never a discard that would delay it). The day count is the smallest whole-day
// elapsed at which GistUnitsElapsed itself first reads the crossed units — the inverse is
// derived from the forward timer, not a second formula that could drift from it. The search
// is bounded: the timer is monotone non-decreasing in elapsed days and unbounded above (the
// modulated day fraction keeps accumulating), so the target count is always reached.
func ConsumeGistUnits(anchor time.Time, crossedUnits int, arousal float64, connectionStrength float64) time.Time {
	if crossedUnits <= 0 {
		return utcDate(anchor)
	}
	anchorDate := utcDate(anchor)
	upperBound := 1
	for GistUnitsElapsed(anchorDate.AddDate(0, 0, upperBound), anchorDate, arousal, connectionStrength) < crossedUnits {
		upperBound *= 2
	}
	consumed := sort.Search(upperBound+1, func(days int) bool {
		return GistUnitsElapsed(anchorDate.AddDate(0, 0, days), anchorDate, arousal, connectionStrength) >= crossedUnits
	})
	return anchorDate.AddDate(0, 0, consumed)
}

// GistCoordinate places a gist body: x, y copied VERBATIM from the emergent hippocampal coordinates (the
// neocortex has no force-sim and no independent coordinate authority, [I5]), and z a stage-progressive
// linear map into the reserved neocortex band [neocortex_z_min, neocortex_z_max] (15..25), disjoint
// from the hippocampus band (0..10) ([C5][C6][V9]). The map shape is code; only the band bounds are
// values (reused from force_sim).
func GistCoordinate(hippocampalX float64, hippocampalY float64, stage int) (float64, float64, float64) {
	zMin := float64(values.ForceSimNeocortexZMin)
	zMax := float64(values.ForceSimNeocortexZMax)
	clamped := stage
	if clamped < 0 {
		clamped = 0
	}
	if clamped > semanticMaxStage {
		clamped = semanticMaxStage
	}
	z := zMin + (float64(clamped)/float64(semanticMaxStage))*(zMax-zMin)
	return hippocampalX, hippocampalY, z
}
