package memory

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
)

const semanticizationGoldenPath = "testdata/semanticization-golden.json"

// TestSemanticizeInvariants covers A1/A2: monotone non-decreasing, clamped at the derived max, and a
// single advance crossing multiple stages.
func TestSemanticizeInvariants(t *testing.T) {
	t.Parallel()

	for stage := 0; stage <= semanticMaxStage; stage++ {
		if got := Semanticize(stage, 0); got != stage {
			t.Fatalf("Semanticize(%d, 0) = %d, want unchanged", stage, got)
		}
		previous := stage
		for _, units := range []int{0, 1, 2, 5, 100} {
			got := Semanticize(stage, units)
			if got < previous {
				t.Fatalf("Semanticize(%d, %d) = %d, not monotone", stage, units, got)
			}
			if got < stage {
				t.Fatalf("Semanticize(%d, %d) = %d, lowered below currentStage", stage, units, got)
			}
			if got > semanticMaxStage {
				t.Fatalf("Semanticize(%d, %d) = %d, exceeded max %d", stage, units, got, semanticMaxStage)
			}
			previous = got
		}
	}
	// A multi-unit single advance crosses several stages at once, clamped at the ceiling.
	if got := Semanticize(1, 2); got != 3 {
		t.Fatalf("Semanticize(1, 2) = %d, want 3", got)
	}
	if got := Semanticize(3, 10); got != semanticMaxStage {
		t.Fatalf("Semanticize(3, 10) = %d, want clamp %d", got, semanticMaxStage)
	}
}

// TestGistUnitsElapsedInvariants covers A3/A4: 0 at the anchor, universe-day granularity, and
// arousal/connection slowing (fewer units at the same elapsed).
func TestGistUnitsElapsedInvariants(t *testing.T) {
	t.Parallel()

	reset := date(t, "2026-01-01")
	if got := GistUnitsElapsed(reset, reset, 0, 0); got != 0 {
		t.Fatalf("GistUnitsElapsed at anchor = %d, want 0", got)
	}
	// 25 days, unmodulated, 10 days/stage → 2 whole units.
	now := date(t, "2026-01-26")
	if got := GistUnitsElapsed(now, reset, 0, 0); got != 2 {
		t.Fatalf("GistUnitsElapsed(25d, unmodulated) = %d, want 2", got)
	}
	// Modulation slows it: high arousal/strength yields fewer (or equal) units at the same elapsed.
	slowed := GistUnitsElapsed(now, reset, 1, 1)
	if slowed > 2 {
		t.Fatalf("modulated units %d exceeded unmodulated 2", slowed)
	}
	// A future reset (now before anchor) never yields negative units.
	future := date(t, "2027-01-01")
	if got := GistUnitsElapsed(reset, future, 0, 0); got != 0 {
		t.Fatalf("GistUnitsElapsed(now<reset) = %d, want 0", got)
	}
}

// TestConsumeGistUnitsInvariants pins the timer inverse the consolidation materializer relies
// on: consuming the crossed units moves the anchor forward by exactly their span — re-reading
// the timer from the consumed anchor at the same "now" yields zero units (convergence), and
// the residual sub-unit days are neither refunded (an early next stage) nor discarded (a
// delayed one).
func TestConsumeGistUnitsInvariants(t *testing.T) {
	t.Parallel()

	anchor := date(t, "2026-01-01")
	// 24 unmodulated days at 10 days/unit → 2 units spanning exactly 20 days.
	now := date(t, "2026-01-25")
	units := GistUnitsElapsed(now, anchor, 0, 0)
	if units != 2 {
		t.Fatalf("fixture units = %d, want 2", units)
	}
	consumed := ConsumeGistUnits(anchor, units, 0, 0)
	if want := date(t, "2026-01-21"); !consumed.Equal(want) {
		t.Fatalf("consumed anchor = %v, want exactly the crossed units' span %v", consumed, want)
	}
	if got := GistUnitsElapsed(now, consumed, 0, 0); got != 0 {
		t.Fatalf("units at consumed anchor = %d, want 0 (convergence)", got)
	}
	// The 4 residual days carry: the next unit completes 6 days later, not 10.
	if got := GistUnitsElapsed(date(t, "2026-01-31"), consumed, 0, 0); got != 1 {
		t.Fatalf("units 6 days past the consumed anchor = %d, want the on-schedule 1", got)
	}

	// Modulated timers invert exactly the same way — through the forward fn itself.
	slowedUnits := GistUnitsElapsed(date(t, "2026-03-01"), anchor, 1, 1)
	if slowedUnits < 1 {
		t.Fatal("fixture must cross at least one modulated unit")
	}
	slowedConsumed := ConsumeGistUnits(anchor, slowedUnits, 1, 1)
	if got := GistUnitsElapsed(date(t, "2026-03-01"), slowedConsumed, 1, 1); got != 0 {
		t.Fatalf("modulated units at consumed anchor = %d, want 0", got)
	}
	if got := GistUnitsElapsed(slowedConsumed, anchor, 1, 1); got != slowedUnits {
		t.Fatalf("units spanned by the consumed days = %d, want %d (no refund, no discard)", got, slowedUnits)
	}

	// Zero or negative crossings leave the anchor where it is.
	if got := ConsumeGistUnits(anchor, 0, 0, 0); !got.Equal(anchor) {
		t.Fatalf("ConsumeGistUnits(anchor, 0) = %v, want the anchor unchanged", got)
	}
}

// TestGistZOffsetInvariants covers A7: the offset stays inside the ladder, is stage-monotonic, and
// the worst-case gist floor (hippocampus_z_min + offset(1)) clears the lens top — the by-construction
// layer separation ([C5][V9], change 13).
func TestGistZOffsetInvariants(t *testing.T) {
	t.Parallel()

	offsetMin := float64(values.ForceSimGistZOffsetMin)
	offsetMax := float64(values.ForceSimGistZOffsetMax)

	for stage := 1; stage <= semanticMaxStage; stage++ {
		offset := GistZOffset(stage)
		if offset < offsetMin-1e-9 || offset > offsetMax+1e-9 {
			t.Fatalf("GistZOffset stage %d = %v outside [%v,%v]", stage, offset, offsetMin, offsetMax)
		}
		if stage > 1 && offset <= GistZOffset(stage-1) {
			t.Fatalf("GistZOffset not monotone at stage %d: %v <= %v", stage, offset, GistZOffset(stage-1))
		}
	}
	// The clamp holds both ends of the ladder.
	if GistZOffset(-3) != GistZOffset(0) || GistZOffset(99) != GistZOffset(semanticMaxStage) {
		t.Fatalf("GistZOffset clamp drifted: %v / %v", GistZOffset(-3), GistZOffset(99))
	}
	// Layer separation by construction: a gist body inherits its memory's live z (≥ hippocampus_z_min)
	// plus at least the stage-1 lift, so even the worst case sits above the lens top.
	worstFloor := float64(values.ForceSimHippocampusZMin) + GistZOffset(1)
	if worstFloor <= float64(values.ForceSimHippocampusZMax) {
		t.Fatalf("gist floor %v does not clear the hippocampus band top %v", worstFloor, values.ForceSimHippocampusZMax)
	}
}

// --- Golden fixture (TS↔Go parity, A11) ---

type semanticFixture struct {
	Tolerance float64               `json:"tolerance"`
	Values    semanticFixtureValues `json:"values"`
	Cases     []semanticCase        `json:"cases"`
}

type semanticFixtureValues struct {
	GistUnitsPerStage float64 `json:"gist_units_per_stage"`
	GistZOffsetMin    float64 `json:"gist_z_offset_min"`
	GistZOffsetMax    float64 `json:"gist_z_offset_max"`
	MaxStage          int     `json:"max_stage"`
}

type semanticCase struct {
	Function string         `json:"function"`
	Inputs   semanticInputs `json:"inputs"`
	Expected *float64       `json:"expected,omitempty"`
}

type semanticInputs struct {
	CurrentStage       *int     `json:"current_stage,omitempty"`
	UnitsElapsed       *int     `json:"units_elapsed,omitempty"`
	Now                string   `json:"now,omitempty"`
	TimerResetAt       string   `json:"timer_reset_at,omitempty"`
	Arousal            *float64 `json:"arousal,omitempty"`
	ConnectionStrength *float64 `json:"connection_strength,omitempty"`
	Stage              *int     `json:"stage,omitempty"`
}

func TestSemanticizationGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readSemanticFixture(t)
	if fixture.Values.GistUnitsPerStage != values.SemanticGistUnitsPerStage ||
		fixture.Values.GistZOffsetMin != float64(values.ForceSimGistZOffsetMin) ||
		fixture.Values.GistZOffsetMax != float64(values.ForceSimGistZOffsetMax) ||
		fixture.Values.MaxStage != semanticMaxStage {
		t.Fatalf("fixture values drifted from generated constants: %+v", fixture.Values)
	}

	for _, testCase := range fixture.Cases {
		in := testCase.Inputs
		switch testCase.Function {
		case "semanticize":
			got := float64(Semanticize(derefInt(in.CurrentStage), derefInt(in.UnitsElapsed)))
			assertAlmostEqual(t, testCase.Function, got, *testCase.Expected, fixture.Tolerance)
		case "gist_units_elapsed":
			got := float64(GistUnitsElapsed(date(t, in.Now), date(t, in.TimerResetAt), derefFloat(in.Arousal), derefFloat(in.ConnectionStrength)))
			assertAlmostEqual(t, testCase.Function, got, *testCase.Expected, fixture.Tolerance)
		case "gist_z_offset":
			got := GistZOffset(derefInt(in.Stage))
			assertAlmostEqual(t, testCase.Function, got, *testCase.Expected, fixture.Tolerance)
		default:
			t.Fatalf("unknown golden function %q", testCase.Function)
		}
	}
}

func readSemanticFixture(t *testing.T) semanticFixture {
	t.Helper()
	data, err := os.ReadFile(semanticizationGoldenPath)
	if err != nil {
		t.Fatalf("read semanticization fixture: %v", err)
	}
	var fixture semanticFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode semanticization fixture: %v", err)
	}
	return fixture
}

// TestWriteSemanticizationGolden regenerates the shared fixture from the Go implementation (source of
// truth). Run with UPDATE_GOLDEN=1; the TS mirror is pinned against the committed file.
func TestWriteSemanticizationGolden(t *testing.T) {
	if os.Getenv("UPDATE_GOLDEN") == "" {
		t.Skip("set UPDATE_GOLDEN=1 to regenerate testdata/semanticization-golden.json")
	}

	iptr := func(v int) *int { return &v }
	fptr := func(v float64) *float64 { return &v }

	cases := []semanticCase{}

	// semanticize: every stage unchanged at 0 units, +1, a multi-unit crossing, and the clamp.
	semInputs := []semanticInputs{
		{CurrentStage: iptr(0), UnitsElapsed: iptr(0)},
		{CurrentStage: iptr(0), UnitsElapsed: iptr(1)},
		{CurrentStage: iptr(1), UnitsElapsed: iptr(2)},
		{CurrentStage: iptr(2), UnitsElapsed: iptr(1)},
		{CurrentStage: iptr(3), UnitsElapsed: iptr(10)},
		{CurrentStage: iptr(4), UnitsElapsed: iptr(3)},
	}
	for _, in := range semInputs {
		got := float64(Semanticize(derefInt(in.CurrentStage), derefInt(in.UnitsElapsed)))
		cases = append(cases, semanticCase{Function: "semanticize", Inputs: in, Expected: fptr(got)})
	}

	// gist_units_elapsed: anchor (0), a 25-day span, low vs high modulation, a far span hitting the cap.
	timerInputs := []semanticInputs{
		{Now: "2026-01-01", TimerResetAt: "2026-01-01", Arousal: fptr(0), ConnectionStrength: fptr(0)},
		{Now: "2026-01-26", TimerResetAt: "2026-01-01", Arousal: fptr(0), ConnectionStrength: fptr(0)},
		{Now: "2026-01-26", TimerResetAt: "2026-01-01", Arousal: fptr(0.9), ConnectionStrength: fptr(0.9)},
		{Now: "2027-01-01", TimerResetAt: "2026-01-01", Arousal: fptr(0), ConnectionStrength: fptr(0)},
		{Now: "2027-01-01", TimerResetAt: "2026-01-01", Arousal: fptr(0.5), ConnectionStrength: fptr(0.5)},
	}
	for _, in := range timerInputs {
		got := float64(GistUnitsElapsed(date(t, in.Now), date(t, in.TimerResetAt), derefFloat(in.Arousal), derefFloat(in.ConnectionStrength)))
		cases = append(cases, semanticCase{Function: "gist_units_elapsed", Inputs: in, Expected: fptr(got)})
	}

	// gist_z_offset: the per-stage lift, stage 0..max (clamped ends included via the range itself).
	for stage := 0; stage <= semanticMaxStage; stage++ {
		in := semanticInputs{Stage: iptr(stage)}
		got := GistZOffset(stage)
		cases = append(cases, semanticCase{Function: "gist_z_offset", Inputs: in, Expected: fptr(got)})
	}

	fixture := semanticFixture{
		Tolerance: 1e-9,
		Values: semanticFixtureValues{
			GistUnitsPerStage: values.SemanticGistUnitsPerStage,
			GistZOffsetMin:    float64(values.ForceSimGistZOffsetMin),
			GistZOffsetMax:    float64(values.ForceSimGistZOffsetMax),
			MaxStage:          semanticMaxStage,
		},
		Cases: cases,
	}

	out, err := json.MarshalIndent(fixture, "", "  ")
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	if err := os.WriteFile(semanticizationGoldenPath, append(out, '\n'), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
}
