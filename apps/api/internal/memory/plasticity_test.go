package memory

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
)

func TestSynapseGeneratedValuesMatchGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readSynapseFixture(t)

	assertAlmostEqual(t, "potentiation_rate", values.SynapsePotentiationRate, fixture.Values.PotentiationRate, fixture.Tolerance)
	assertAlmostEqual(t, "strength_cap", values.SynapseStrengthCap, fixture.Values.StrengthCap, fixture.Tolerance)
	assertAlmostEqual(t, "initial_same_memory", values.SynapseInitialSameMemory, fixture.Values.InitialSameMemory, fixture.Tolerance)
	assertAlmostEqual(t, "initial_shared_neuron", values.SynapseInitialSharedNeuron, fixture.Values.InitialSharedNeuron, fixture.Tolerance)
	assertAlmostEqual(t, "initial_temporal", values.SynapseInitialTemporal, fixture.Values.InitialTemporal, fixture.Tolerance)
	assertAlmostEqual(t, "strength_decay_per_day", values.SynapseStrengthDecayPerDay, fixture.Values.StrengthDecayPerDay, fixture.Tolerance)
}

func TestPotentiateInvariants(t *testing.T) {
	t.Parallel()

	for _, rate := range []float64{0, values.SynapsePotentiationRate, 1} {
		var previousIncrement float64
		for index, strength := range []float64{0, 0.1, 0.25, 0.5, 0.75, 0.9, 1} {
			got := Potentiate(strength, rate)
			if got < strength {
				t.Fatalf("Potentiate(%v, %v) = %v, want >= strength", strength, rate, got)
			}
			if got > values.SynapseStrengthCap {
				t.Fatalf("Potentiate(%v, %v) = %v, want <= cap %v", strength, rate, got, values.SynapseStrengthCap)
			}
			increment := got - strength
			if index > 0 && increment > previousIncrement+1e-12 {
				t.Fatalf("Potentiate increment at strength %v = %v, previous %v", strength, increment, previousIncrement)
			}
			previousIncrement = increment
		}
	}

	if got := Potentiate(values.SynapseStrengthCap, values.SynapsePotentiationRate); got != values.SynapseStrengthCap {
		t.Fatalf("Potentiate(cap, rate) = %v, want cap", got)
	}

	strength := 0.2
	for range 200 {
		next := Potentiate(strength, values.SynapsePotentiationRate)
		if next < strength || next > values.SynapseStrengthCap {
			t.Fatalf("repeated Potentiate produced %v from %v", next, strength)
		}
		strength = next
	}
	if strength < values.SynapseStrengthCap-1e-9 {
		t.Fatalf("repeated Potentiate = %v, want near cap %v", strength, values.SynapseStrengthCap)
	}
}

func TestInitialStrengthInvariants(t *testing.T) {
	t.Parallel()

	if values.SynapseStrengthCap != 1.0 {
		t.Fatalf("strength cap = %v, want 1.0", values.SynapseStrengthCap)
	}

	sameMemory := mustInitialStrength(t, SignalKindSameMemory)
	sharedNeuron := mustInitialStrength(t, SignalKindSharedNeuron)
	temporal := mustInitialStrength(t, SignalKindTemporal)

	if !(sameMemory > sharedNeuron && sharedNeuron > temporal) {
		t.Fatalf("initial strengths = same %v, shared %v, temporal %v; want strictly descending", sameMemory, sharedNeuron, temporal)
	}
	for kind, strength := range map[SignalKind]float64{
		SignalKindSameMemory:   sameMemory,
		SignalKindSharedNeuron: sharedNeuron,
		SignalKindTemporal:     temporal,
	} {
		if strength <= 0 || strength >= values.SynapseStrengthCap {
			t.Fatalf("InitialStrength(%s) = %v, want > 0 and < cap", kind, strength)
		}
	}
	if _, ok := InitialStrength(SignalKind("unknown")); ok {
		t.Fatal("InitialStrength accepted an unknown signal kind")
	}
}

func TestDepressInvariants(t *testing.T) {
	t.Parallel()

	for _, testCase := range []struct {
		strength float64
		amount   float64
	}{
		{strength: 0.8, amount: 0.2},
		{strength: 0.08, amount: 0.2},
		{strength: 0, amount: 0.1},
	} {
		got := Depress(testCase.strength, testCase.amount)
		if got > testCase.strength {
			t.Fatalf("Depress(%v, %v) = %v, want <= strength", testCase.strength, testCase.amount, got)
		}
		if got < 0 {
			t.Fatalf("Depress(%v, %v) = %v, want non-negative", testCase.strength, testCase.amount, got)
		}
	}
}

func TestEffectiveSynapseStrengthInvariants(t *testing.T) {
	t.Parallel()

	base := 0.72
	if got := EffectiveSynapseStrength(base, 0); !almostEqual(got, base, 1e-12) {
		t.Fatalf("EffectiveSynapseStrength(%v, 0) = %v, want base", base, got)
	}

	previous := base
	for _, elapsed := range []float64{1, 3, 10, 30, 365} {
		got := EffectiveSynapseStrength(base, elapsed)
		if got > previous+1e-12 {
			t.Fatalf("EffectiveSynapseStrength increased at elapsed %v: %v > %v", elapsed, got, previous)
		}
		if got < 0 || got > base {
			t.Fatalf("EffectiveSynapseStrength(%v, %v) = %v, want within [0, base]", base, elapsed, got)
		}
		previous = got
	}
}

func TestMemoryEffectiveStubs(t *testing.T) {
	t.Parallel()

	// EffectiveStrength now accumulates recall (plan 32); its full monotone/diminishing/cap
	// invariants live in reconsolidation_test.go. Here we pin only the launched (count 0) identity
	// and that EffectiveBrightness remains the Epic-D stub (full brightness).
	if got := EffectiveStrength(0.42, 0); got != 0.42 {
		t.Fatalf("EffectiveStrength(base, 0) = %v, want base", got)
	}
	if got := EffectiveBrightness(180); got != 1.0 {
		t.Fatalf("EffectiveBrightness = %v, want full brightness", got)
	}
}

func TestSynapsePlasticityGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readSynapseFixture(t)
	for _, testCase := range fixture.Cases {
		var got float64
		switch testCase.Function {
		case "potentiate":
			got = Potentiate(testCase.Inputs.Strength, testCase.Inputs.Rate)
		case "potentiate_repeated":
			got = testCase.Inputs.Strength
			for range testCase.Inputs.Iterations {
				got = Potentiate(got, testCase.Inputs.Rate)
			}
		case "depress":
			got = Depress(testCase.Inputs.Strength, testCase.Inputs.Amount)
		case "initial_strength":
			var ok bool
			got, ok = InitialStrength(testCase.Inputs.SignalKind)
			if !ok {
				t.Fatalf("InitialStrength(%s) failed", testCase.Inputs.SignalKind)
			}
		case "apply_temporal_bonus":
			got = ApplyTemporalBonus(testCase.Inputs.Strength)
		case "effective_synapse_strength":
			got = EffectiveSynapseStrength(testCase.Inputs.Base, testCase.Inputs.ElapsedUniverseDays)
		case "effective_strength":
			got = EffectiveStrength(testCase.Inputs.BaseStrength, testCase.Inputs.RecallCount)
		case "effective_brightness":
			got = EffectiveBrightness(testCase.Inputs.ElapsedUniverseDays)
		default:
			t.Fatalf("unknown golden function %q", testCase.Function)
		}
		assertAlmostEqual(t, testCase.Function, got, testCase.Expected, fixture.Tolerance)
	}
}

type synapseFixture struct {
	Tolerance float64              `json:"tolerance"`
	Values    synapseFixtureValues `json:"values"`
	Cases     []synapseFixtureCase `json:"cases"`
}

type synapseFixtureValues struct {
	PotentiationRate    float64 `json:"potentiation_rate"`
	StrengthCap         float64 `json:"strength_cap"`
	InitialSameMemory   float64 `json:"initial_same_memory"`
	InitialSharedNeuron float64 `json:"initial_shared_neuron"`
	InitialTemporal     float64 `json:"initial_temporal"`
	StrengthDecayPerDay float64 `json:"strength_decay_per_day"`
}

type synapseFixtureCase struct {
	Function string               `json:"function"`
	Inputs   synapseFixtureInputs `json:"inputs"`
	Expected float64              `json:"expected"`
}

type synapseFixtureInputs struct {
	Strength            float64    `json:"strength"`
	Rate                float64    `json:"rate"`
	Iterations          int        `json:"iterations"`
	Amount              float64    `json:"amount"`
	SignalKind          SignalKind `json:"signal_kind"`
	Base                float64    `json:"base"`
	ElapsedUniverseDays float64    `json:"elapsed_universe_days"`
	BaseStrength        float64    `json:"base_strength"`
	RecallCount         int32      `json:"recall_count"`
}

func readSynapseFixture(t *testing.T) synapseFixture {
	t.Helper()

	data, err := os.ReadFile("testdata/synapse-plasticity-golden.json")
	if err != nil {
		t.Fatalf("read synapse fixture: %v", err)
	}
	var fixture synapseFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode synapse fixture: %v", err)
	}
	return fixture
}

func mustInitialStrength(t *testing.T, signalKind SignalKind) float64 {
	t.Helper()

	strength, ok := InitialStrength(signalKind)
	if !ok {
		t.Fatalf("InitialStrength(%s) failed", signalKind)
	}
	return strength
}

func assertAlmostEqual(t *testing.T, label string, got float64, want float64, tolerance float64) {
	t.Helper()

	if !almostEqual(got, want, tolerance) {
		t.Fatalf("%s = %v, want %v", label, got, want)
	}
}

func almostEqual(got float64, want float64, tolerance float64) bool {
	if got < want {
		return want-got <= tolerance
	}
	return got-want <= tolerance
}
