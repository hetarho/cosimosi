package memory

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
)

func TestReconsolidationGeneratedValuesMatchGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readReconsolidationFixture(t)
	assertAlmostEqual(t, "recall_strength_gain", values.ReconsolidationRecallStrengthGain, fixture.Values.RecallStrengthGain, fixture.Tolerance)
	assertAlmostEqual(t, "neighbor_slow_days", values.ReconsolidationNeighborSlowDays, fixture.Values.NeighborSlowDays, fixture.Tolerance)
	assertAlmostEqual(t, "neighbor_speed_days", values.ReconsolidationNeighborSpeedDays, fixture.Values.NeighborSpeedDays, fixture.Tolerance)
	if values.ReconsolidationNeighborSpeedThreshold != fixture.Values.NeighborSpeedThreshold {
		t.Fatalf("neighbor_speed_threshold = %d, want %d", values.ReconsolidationNeighborSpeedThreshold, fixture.Values.NeighborSpeedThreshold)
	}
}

func TestReconsolidationGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readReconsolidationFixture(t)
	for _, testCase := range fixture.Cases {
		var got float64
		switch testCase.Function {
		case "reshape":
			got = float64(Reshape(testCase.Inputs.CurrentSeed, testCase.Inputs.NewSeed))
		case "neighbor_forgetting_delta":
			got = NeighborForgettingDelta(testCase.Inputs.SharedSemanticCount)
		default:
			t.Fatalf("unknown golden function %q", testCase.Function)
		}
		assertAlmostEqual(t, testCase.Function, got, testCase.Expected, fixture.Tolerance)
	}
}

func TestReshapeGuarantee(t *testing.T) {
	t.Parallel()

	// Fresh entropy that differs is returned verbatim.
	if got := Reshape(100, 250); got != 250 {
		t.Fatalf("Reshape(100, 250) = %d, want the supplied 250", got)
	}
	// Adversarial: a supplied seed equal to the current one must still yield a different seed ([V5][A4]).
	for _, seed := range []int64{0, 1, -1, 42, -7, 9_000_000_000} {
		if got := Reshape(seed, seed); got == seed {
			t.Fatalf("Reshape(%d, %d) = %d, want a seed != current", seed, seed, got)
		}
	}
	// Deterministic given the inputs.
	if Reshape(42, 42) != Reshape(42, 42) {
		t.Fatal("Reshape is not deterministic for identical inputs")
	}
}

func TestNeighborForgettingDeltaSignTable(t *testing.T) {
	t.Parallel()

	if got := NeighborForgettingDelta(0); got != 0 {
		t.Fatalf("NeighborForgettingDelta(0) = %v, want 0 (not a neighbor)", got)
	}
	if got := NeighborForgettingDelta(1); got >= 0 {
		t.Fatalf("NeighborForgettingDelta(1) = %v, want negative (slow)", got)
	}
	// The sign flips at the generated threshold, not a hardcoded 2.
	threshold := values.ReconsolidationNeighborSpeedThreshold
	if got := NeighborForgettingDelta(threshold - 1); got >= 0 {
		t.Fatalf("NeighborForgettingDelta(%d) = %v, want negative below threshold", threshold-1, got)
	}
	for _, count := range []int{threshold, threshold + 1, threshold + 5} {
		if got := NeighborForgettingDelta(count); got <= 0 {
			t.Fatalf("NeighborForgettingDelta(%d) = %v, want positive (speed) at/above threshold", count, got)
		}
	}
	// Magnitudes come from the generated values, and the two mechanisms tune independently.
	if NeighborForgettingDelta(1) != values.ReconsolidationNeighborSlowDays {
		t.Fatalf("slow delta = %v, want the generated value", NeighborForgettingDelta(1))
	}
	if NeighborForgettingDelta(threshold) != values.ReconsolidationNeighborSpeedDays {
		t.Fatalf("speed delta = %v, want the generated value", NeighborForgettingDelta(threshold))
	}
}

func TestEffectiveStrengthInvariants(t *testing.T) {
	t.Parallel()

	for _, base := range []float64{0, 0.42, 0.95, values.SynapseStrengthCap} {
		// Identity at count 0 — no regression to launched, never-recalled stars ([A5]).
		if got := EffectiveStrength(base, 0); !almostEqual(got, base, 1e-12) {
			t.Fatalf("EffectiveStrength(%v, 0) = %v, want base", base, got)
		}
		// Consecutive counts so each increment is exactly one recall — the shape is monotone
		// non-decreasing, never past the cap, with per-recall increments that never grow.
		previous := base
		var previousIncrement float64
		for count := int32(1); count <= 40; count++ {
			got := EffectiveStrength(base, count)
			if got < previous-1e-12 {
				t.Fatalf("EffectiveStrength(%v, %d) = %v, want monotone non-decreasing (previous %v)", base, count, got, previous)
			}
			if got > values.SynapseStrengthCap+1e-12 {
				t.Fatalf("EffectiveStrength(%v, %d) = %v, want <= cap %v", base, count, got, values.SynapseStrengthCap)
			}
			increment := got - previous
			if count > 1 && increment > previousIncrement+1e-12 {
				t.Fatalf("EffectiveStrength increment at %v/%d = %v, previous %v; want diminishing", base, count, increment, previousIncrement)
			}
			previousIncrement = increment
			previous = got
		}
	}
}

// TestPredictionErrorPortContract pins the gate as a consumer-owned boolean semantic-compare port
// ([A1][A12]): a deterministic keyless fake can implement it offline, and both branches are
// expressible — a content change is a prediction error (true → reconsolidate), a mere re-wording is
// not (false → reinforce only). No LLM SDK, no values threshold — the boundary is the port's judgment.
func TestPredictionErrorPortContract(t *testing.T) {
	t.Parallel()

	var gate PredictionError = normalizingPredictionError{}
	ctx := context.Background()

	differs, err := gate.Differs(ctx, "we hiked the ridge at dawn", "  We   hiked  the RIDGE at dawn  ")
	if err != nil {
		t.Fatalf("Differs (re-wording) error: %v", err)
	}
	if differs {
		t.Fatal("Differs = true for a mere re-wording; want false (reinforce only)")
	}

	differs, err = gate.Differs(ctx, "we hiked the ridge at dawn", "we turned back before the ridge")
	if err != nil {
		t.Fatalf("Differs (content change) error: %v", err)
	}
	if !differs {
		t.Fatal("Differs = false for a genuine content change; want true (reconsolidate)")
	}

	// Deterministic offline default: identical inputs always yield the same decision.
	first, _ := gate.Differs(ctx, "a", "b")
	second, _ := gate.Differs(ctx, "a", "b")
	if first != second {
		t.Fatal("prediction-error fake is not deterministic")
	}
}

// normalizingPredictionError is a keyless deterministic stand-in for the LLM gate used only to pin the
// port contract: it strips wording noise (case + whitespace) and calls what remains a content change.
// The real semantic compare is the AI adapter's (job 44); this is not that model.
type normalizingPredictionError struct{}

func (normalizingPredictionError) Differs(_ context.Context, currentText string, rewrite string) (bool, error) {
	return normalizeForContract(currentText) != normalizeForContract(rewrite), nil
}

func normalizeForContract(text string) string {
	return strings.ToLower(strings.Join(strings.Fields(text), " "))
}

type reconsolidationFixture struct {
	Tolerance float64                      `json:"tolerance"`
	Values    reconsolidationFixtureValues `json:"values"`
	Cases     []reconsolidationFixtureCase `json:"cases"`
}

type reconsolidationFixtureValues struct {
	RecallStrengthGain     float64 `json:"recall_strength_gain"`
	NeighborSlowDays       float64 `json:"neighbor_slow_days"`
	NeighborSpeedDays      float64 `json:"neighbor_speed_days"`
	NeighborSpeedThreshold int     `json:"neighbor_speed_threshold"`
}

type reconsolidationFixtureCase struct {
	Function string                       `json:"function"`
	Inputs   reconsolidationFixtureInputs `json:"inputs"`
	Expected float64                      `json:"expected"`
}

type reconsolidationFixtureInputs struct {
	CurrentSeed         int64 `json:"current_seed"`
	NewSeed             int64 `json:"new_seed"`
	SharedSemanticCount int   `json:"shared_semantic_count"`
}

func readReconsolidationFixture(t *testing.T) reconsolidationFixture {
	t.Helper()

	data, err := os.ReadFile("testdata/reconsolidation-golden.json")
	if err != nil {
		t.Fatalf("read reconsolidation fixture: %v", err)
	}
	var fixture reconsolidationFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode reconsolidation fixture: %v", err)
	}
	return fixture
}
