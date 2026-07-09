package memory

import (
	"math"

	"github.com/cosimosi/api/internal/platform/values"
)

// EffectiveStrength grows a memory's size ([V3]) and universe-color weight ([M4]) with recall
// accumulation ([R3]) — the recall term the synapse-plasticity stub reserved. It shares Potentiate's
// saturating, headroom-proportional shape (each recall gains reconsolidation.recall_strength_gain of
// the remaining headroom), so applying that gain recallCount times has the closed form
// cap − (cap − base)·(1 − gain)^recallCount:
//   - EffectiveStrength(base, 0) = base exactly — no regression for a launched, never-recalled memory;
//   - monotone non-decreasing in recallCount;
//   - diminishing returns, asymptotic to synapse.strength_cap (never exceeding it), so a
//     heavily-recalled memory can never blow past the single cap [L9].
//
// The shape is a formula (code, not a value); only the gain coefficient is a value. Client render and
// server gating read the same generated constant, so this function is golden-parity pinned.
func EffectiveStrength(baseStrength float64, recallCount int32) float64 {
	base := clamp(baseStrength, 0, values.SynapseStrengthCap)
	if recallCount <= 0 {
		return base
	}
	remaining := (values.SynapseStrengthCap - base) * math.Pow(1-values.ReconsolidationRecallStrengthGain, float64(recallCount))
	return clamp(values.SynapseStrengthCap-remaining, base, values.SynapseStrengthCap)
}

// EffectiveBrightness is the read-time brightness seam reserved for the forgetting dynamics ([V2]):
// brightness will decay from elapsed universe time. Until the forgetting decay drives it, it is the
// identity (full brightness), so callers read through it now without a later signature change.
func EffectiveBrightness(_ float64) float64 {
	return 1.0
}
