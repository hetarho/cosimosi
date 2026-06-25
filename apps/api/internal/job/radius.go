package job

import (
	"math"
	"sort"

	"github.com/cosimosi/backend/internal/values"
)

// Server-side port of the live client radius (spec 38 change 18, frontend weight.ts +
// layout.ts). The nightly pass needs each star's distance-from-centre to (a) scope the
// re-stabilize/redistribute to the near, active region and (b) trigger abstraction stages —
// both off the SAME radius the client renders. The client emerges coordinates (constitution
// §3); the server only APPROXIMATES the radius from the raw Bjork fields (recall_count,
// intensity, last_recalled_at) + the connectivity graph, never to place a star, only to
// decide which stars the night touches. Pure (no DB/clock) so it is unit-tested.

// storageStrength S (Bjork): cumulative, monotone non-decreasing. Mirror of weight.ts.
func storageStrength(recallCount int, intensity float64) float64 {
	n := float64(recallCount)
	if n < 0 {
		n = 0
	}
	return (values.MemoryWeightStorageBase + n) * (1 + values.MemoryWeightEmoConsolidation*clamp(intensity, 0, 1))
}

// retrievalStrength R = exp(-Δt/τ(S)) ∈ (0,1]. τ(S) grows with S (spacing effect); tauGain ≥ 0
// is an OPTIONAL extra τ multiplier that only SLOWS decay (connectivity feeds it for the radius).
func retrievalStrength(s, dtDays, tauGain float64) float64 {
	if dtDays < 0 {
		dtDays = 0
	}
	if tauGain < 0 {
		tauGain = 0
	}
	tau := values.MemoryWeightTau0Days * (1 + values.MemoryWeightTauStorageGain*math.Log1p(math.Max(0, s))) * (1 + tauGain)
	return math.Exp(-dtDays / tau)
}

// targetRadius maps retrieval strength R → distance from the centre: R 1 → R_MIN, R 0 → R_MAX,
// de-saturated by the γ exponent so far stars keep drifting (mirror of layout.ts targetRadius).
func targetRadius(r float64) float64 {
	return values.RadialLayoutRMin + (values.RadialLayoutRMax-values.RadialLayoutRMin)*(1-math.Pow(clamp(r, 0, 1), values.RadialLayoutSatGamma))
}

// starRadii returns each star's approximate distance-from-centre (spec 38 change 18). Connectivity
// (median-normalized degree + Σweight) extends τ so well-connected memories stay nearer the centre —
// links pull inward, never push out (connectedness=0 → pure time-decay radius).
func starRadii(graph ConsolidateGraph, nowUnixDays float64) map[string]float64 {
	degNorm, wDegNorm := normalizedDegrees(graph.Links)
	out := make(map[string]float64, len(graph.Stars))
	for _, s := range graph.Stars {
		conn := degNorm[s.ID] + values.RadialLayoutConnWeightTerm*wDegNorm[s.ID]
		tauGain := values.RadialLayoutConnDriftAlpha * math.Max(0, conn)
		dtDays := nowUnixDays - float64(s.LastRecalledAt.Unix())/86400.0
		r := retrievalStrength(storageStrength(s.RecallCount, s.Intensity), dtDays, tauGain)
		out[s.ID] = targetRadius(r)
	}
	return out
}

// normalizedDegrees returns per-star degree and Σweight, each normalized by the universe MEDIAN
// (median 0 → 1 fallback so the ratio stays finite), mirroring the client's normalizedNodeMap
// (entities/synapse store.ts) — a typical star sits at ~1, a hub above. Stars with no edge are
// absent from the maps → callers read 0.
func normalizedDegrees(links []ConsolidateLink) (degNorm, wDegNorm map[string]float64) {
	deg := make(map[string]float64)
	wDeg := make(map[string]float64)
	for _, l := range links {
		deg[l.AID]++
		deg[l.BID]++
		wDeg[l.AID] += l.Weight
		wDeg[l.BID] += l.Weight
	}
	return normalizeByMedian(deg), normalizeByMedian(wDeg)
}

func normalizeByMedian(m map[string]float64) map[string]float64 {
	if len(m) == 0 {
		return m
	}
	vals := make([]float64, 0, len(m))
	for _, v := range m {
		vals = append(vals, v)
	}
	sort.Float64s(vals)
	mid := len(vals) / 2
	median := vals[mid]
	if len(vals)%2 == 0 {
		median = (vals[mid-1] + vals[mid]) / 2
	}
	denom := median
	if denom <= 0 {
		denom = 1
	}
	out := make(map[string]float64, len(m))
	for id, v := range m {
		out[id] = v / denom
	}
	return out
}

// stageForRadius is the abstraction stage a radius maps to: the count of gist_stage_radii
// thresholds it exceeds (0..len). The thresholds are ascending; crossing each is one step
// of abstraction (spec 27 change 20). Capped at len(thresholds) (=4).
func stageForRadius(r float64, thresholds []float64) int {
	stage := 0
	for _, t := range thresholds {
		if r > t {
			stage++
		}
	}
	return stage
}
