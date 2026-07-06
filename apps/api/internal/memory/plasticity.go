package memory

import (
	"math"

	"github.com/cosimosi/api/internal/platform/values"
)

type SignalKind string

const (
	SignalKindSameMemory SignalKind = "same_memory"
	// Reserved tiered initials [L10]: the current linking rules seed no synapse from these —
	// a shared neuron *is* the link through activation membership (no edge, [L2]) and temporal
	// proximity is applied as a bonus on top of an existing base (ApplyTemporalBonus, [L4]), not
	// as a fresh initial. They keep the tier so a later cross-memory linker that mints distinct
	// shared/temporal edges reads its seed here without a signature change.
	SignalKindSharedNeuron SignalKind = "shared_neuron"
	SignalKindTemporal     SignalKind = "temporal"
)

func Potentiate(strength float64, rate float64) float64 {
	boundedStrength := clamp(strength, 0, values.SynapseStrengthCap)
	boundedRate := clamp(rate, 0, 1)
	next := boundedStrength + boundedRate*(values.SynapseStrengthCap-boundedStrength)
	return clamp(next, 0, values.SynapseStrengthCap)
}

// Depress is the LTD counterpart to Potentiate, reserved for the forgetting dynamics: it weakens a
// stored base without downscaling other synapses ([I9]). No launch/link path calls it yet — linking
// only inserts or strengthens ([I1]) — so it is kept pure and golden-parity-mirrored until the
// forgetting epic drives it.
func Depress(strength float64, amount float64) float64 {
	boundedStrength := clamp(strength, 0, values.SynapseStrengthCap)
	boundedAmount := math.Max(0, amount)
	return clamp(boundedStrength-boundedAmount, 0, values.SynapseStrengthCap)
}

// ApplyTemporalBonus adds the temporal-proximity bonus [L4] on top of a synapse
// base strength when a co-activation falls inside synapse.temporal_window_days,
// saturating at the single cap [L9]. Keeping the bonus in the pure layer (not in
// Link) is what lets the client golden-parity mirror reproduce the stored base.
func ApplyTemporalBonus(strength float64) float64 {
	return clamp(strength+values.SynapseTemporalBonus, 0, values.SynapseStrengthCap)
}

func InitialStrength(signalKind SignalKind) (float64, bool) {
	switch signalKind {
	case SignalKindSameMemory:
		return values.SynapseInitialSameMemory, true
	case SignalKindSharedNeuron:
		return values.SynapseInitialSharedNeuron, true
	case SignalKindTemporal:
		return values.SynapseInitialTemporal, true
	default:
		return 0, false
	}
}

// EffectiveSynapseStrength fades a stored base by elapsed universe-days at read time without
// mutating it [L5]. The server writes only the base today, so the live consumer is the FE render
// mirror (a synapse's rendered width/glow) held byte-identical by golden parity; this copy is
// reserved for when the server itself computes effective values (recall/forgetting).
func EffectiveSynapseStrength(base float64, elapsedUniverseDays float64) float64 {
	boundedBase := clamp(base, 0, values.SynapseStrengthCap)
	boundedElapsed := math.Max(0, elapsedUniverseDays)
	decayPerDay := clamp(values.SynapseStrengthDecayPerDay, 0, 1)
	next := boundedBase * math.Pow(1-decayPerDay, boundedElapsed)
	return clamp(next, 0, boundedBase)
}

func clamp(value float64, minValue float64, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
