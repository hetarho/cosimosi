package memory

import (
	"encoding/json"
	"math"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

const forgettingGoldenPath = "testdata/forgetting-decay-golden.json"

func date(t *testing.T, value string) time.Time {
	t.Helper()
	parsed, err := time.Parse(time.DateOnly, value)
	if err != nil {
		t.Fatalf("parse date %q: %v", value, err)
	}
	return parsed
}

// TestEffectiveElapsedDays pins the CC4 clock: anchor = lastRecalled ?? created, forward-only, plus
// the signed offset floored at 0 (A1).
func TestEffectiveElapsedDays(t *testing.T) {
	t.Parallel()

	created := date(t, "2026-01-01")
	recalled := date(t, "2026-02-01")
	now := date(t, "2026-03-01")

	// Never-recalled decays from creation.
	if got := EffectiveElapsedDays(now, nil, created, 0); got != 59 {
		t.Fatalf("never-recalled elapsed = %v, want 59", got)
	}
	// Recalled decays from the last recall.
	if got := EffectiveElapsedDays(now, &recalled, created, 0); got != 28 {
		t.Fatalf("recalled elapsed = %v, want 28", got)
	}
	// Negative offset slows (subtracts) but is floored at 0.
	if got := EffectiveElapsedDays(now, &recalled, created, -1000); got != 0 {
		t.Fatalf("floored elapsed = %v, want 0", got)
	}
	// Positive offset speeds (adds).
	if got := EffectiveElapsedDays(now, &recalled, created, 5); got != 33 {
		t.Fatalf("offset elapsed = %v, want 33", got)
	}
	// A future anchor never yields negative elapsed.
	future := date(t, "2027-01-01")
	if got := EffectiveElapsedDays(now, &future, created, 0); got != 0 {
		t.Fatalf("future-anchor elapsed = %v, want 0", got)
	}
	// Time-of-day on the inputs is truncated to the UTC day, so elapsed stays whole universe-days
	// matching the date-only TS mirror (a caller passing a timestamp cannot desync parity).
	anchorTime := time.Date(2026, 2, 1, 18, 30, 0, 0, time.UTC)
	nowTime := time.Date(2026, 3, 1, 6, 15, 0, 0, time.UTC)
	if got := EffectiveElapsedDays(nowTime, &anchorTime, created, 0); got != 28 {
		t.Fatalf("timestamp elapsed = %v, want whole-day 28", got)
	}
}

// TestEffectiveBrightnessInvariants covers A2–A4: 1.0 at elapsed 0, monotone non-increasing in
// elapsed, floored (never below floor, never 0), non-decreasing in arousal and in strength.
func TestEffectiveBrightnessInvariants(t *testing.T) {
	t.Parallel()

	floor := values.ForgettingBrightnessFloor

	if got := EffectiveBrightness(0, 0, 0); got != 1.0 {
		t.Fatalf("EffectiveBrightness at elapsed 0 = %v, want 1.0", got)
	}

	previous := math.Inf(1)
	for _, days := range []float64{0, 1, 7, 30, 90, 180, 365, 3650} {
		got := EffectiveBrightness(days, 0.5, 0.5)
		if got > previous+1e-12 {
			t.Fatalf("EffectiveBrightness increased at %v days: %v > %v", days, got, previous)
		}
		if got < floor-1e-12 || got > 1+1e-12 {
			t.Fatalf("EffectiveBrightness(%v) = %v, want within [floor, 1]", days, got)
		}
		if got <= 0 {
			t.Fatalf("EffectiveBrightness(%v) = %v, must never reach 0 (silent engram)", days, got)
		}
		previous = got
	}

	// Arousal slows the fade: higher arousal → brighter at the same elapsed days.
	for _, days := range []float64{30, 180, 3650} {
		low := EffectiveBrightness(days, 0.1, 0.5)
		high := EffectiveBrightness(days, 0.9, 0.5)
		if high < low-1e-12 {
			t.Fatalf("higher arousal faded faster at %v days: %v < %v", days, high, low)
		}
	}
	// Connection strength slows the fade too.
	for _, days := range []float64{30, 180, 3650} {
		low := EffectiveBrightness(days, 0.5, 0.1)
		high := EffectiveBrightness(days, 0.5, 0.9)
		if high < low-1e-12 {
			t.Fatalf("higher strength faded faster at %v days: %v < %v", days, high, low)
		}
	}
}

// TestDecayStageInvariants covers A5: 0 at elapsed 0, monotone non-decreasing, floored at
// maxStage = len(ratios), slowed by arousal/strength.
func TestDecayStageInvariants(t *testing.T) {
	t.Parallel()

	maxStage := len(values.ForgettingStageWordRemovalRatios)

	if got := DecayStage(0, 0, 0); got != 0 {
		t.Fatalf("DecayStage at elapsed 0 = %d, want 0", got)
	}

	previous := 0
	for _, days := range []float64{0, 10, 30, 45, 60, 90, 120, 150, 100000} {
		got := DecayStage(days, 0, 0)
		if got < previous {
			t.Fatalf("DecayStage decreased at %v days: %d < %d", days, got, previous)
		}
		if got < 0 || got > maxStage {
			t.Fatalf("DecayStage(%v) = %d, want within [0, %d]", days, got, maxStage)
		}
		previous = got
	}
	if got := DecayStage(1e9, 0, 0); got != maxStage {
		t.Fatalf("DecayStage floored = %d, want maxStage %d", got, maxStage)
	}
	// A high-arousal, well-connected memory reaches a stage later (or the same), never earlier.
	slowStage := DecayStage(90, 1, 1)
	fastStage := DecayStage(90, 0, 0)
	if slowStage > fastStage {
		t.Fatalf("slowed memory reached a deeper stage: %d > %d", slowStage, fastStage)
	}
}

// TestDecayStageTextInvariants covers A6/A7/A8: determinism, nested superset across stages,
// strictly-increasing removal, structure preservation (first/last of each sentence kept), and a
// non-empty deepest stage for adversarial texts.
func TestDecayStageTextInvariants(t *testing.T) {
	t.Parallel()

	const seed = int64(1234567)
	texts := []string{
		"I went to the market today and bought fresh pasta with my friend.",
		"나는 오늘 친구랑 파스타랑 커피를 정말 맛있게 먹었다 그리고 행복했다",
		"First sentence here. Second sentence follows. Third one ends it all.",
		`She said "hello." Then walked home under the bright winter stars.`,
	}
	maxStage := len(values.ForgettingStageWordRemovalRatios)

	for _, text := range texts {
		// Determinism.
		if DecayStageText(text, 2, seed) != DecayStageText(text, 2, seed) {
			t.Fatalf("DecayStageText not deterministic for %q", text)
		}
		// Stage 0 is the vivid, unredacted text.
		if got := DecayStageText(text, 0, seed); got != strings.Join(strings.Fields(text), " ") {
			t.Fatalf("stage 0 changed the text: %q", got)
		}

		var previousRemoved map[int]bool
		var previousCount int
		for stage := 1; stage <= maxStage; stage++ {
			out := DecayStageText(text, stage, seed)
			words := strings.Fields(out)
			if len(words) == 0 {
				t.Fatalf("deepest-safe stage %d emptied %q", stage, text)
			}
			// First and last word of the whole text are always kept.
			original := strings.Fields(text)
			if words[0] != original[0] || words[len(words)-1] != original[len(original)-1] {
				t.Fatalf("stage %d removed a sentence anchor in %q -> %q", stage, text, out)
			}
			removed := map[int]bool{}
			for i, word := range words {
				if word == redactionToken && original[i] != redactionToken {
					removed[i] = true
				}
			}
			// Nested superset: every word removed at the prior stage stays removed.
			for i := range previousRemoved {
				if !removed[i] {
					t.Fatalf("stage %d un-removed word %d (not a superset of stage %d)", stage, i, stage-1)
				}
			}
			if len(removed) < previousCount {
				t.Fatalf("stage %d removed fewer words than stage %d", stage, stage-1)
			}
			previousRemoved = removed
			previousCount = len(removed)
		}
	}

	// A terminator followed by a closing quote still marks a sentence boundary, so the next
	// sentence's opening word ("Then" after `hello."`) is protected at every stage.
	quoted := `She said "hello." Then walked home under the bright winter stars.`
	for stage := 1; stage <= maxStage; stage++ {
		words := strings.Fields(DecayStageText(quoted, stage, seed))
		if words[3] != "Then" {
			t.Fatalf("stage %d removed the sentence-initial anchor after a closing quote: %q", stage, words[3])
		}
	}

	// Adversarial short texts never lose their only words.
	for _, text := range []string{"안녕", "짧은 문장", "one two"} {
		for stage := 0; stage <= maxStage; stage++ {
			if got := DecayStageText(text, stage, seed); strings.TrimSpace(got) == "" {
				t.Fatalf("short text %q emptied at stage %d", text, stage)
			}
		}
	}
}

// --- Golden fixture (TS↔Go parity, A10) ---

type forgettingFixture struct {
	Tolerance float64                 `json:"tolerance"`
	Values    forgettingFixtureValues `json:"values"`
	Cases     []forgettingCase        `json:"cases"`
}

type forgettingFixtureValues struct {
	BrightnessDecayPerDay     float64   `json:"brightness_decay_per_day"`
	BrightnessFloor           float64   `json:"brightness_floor"`
	StageIntervalDays         float64   `json:"stage_interval_days"`
	StageWordRemovalRatios    []float64 `json:"stage_word_removal_ratios"`
	ArousalSlowCoefficient    float64   `json:"arousal_slow_coefficient"`
	ConnectionSlowCoefficient float64   `json:"connection_slow_coefficient"`
}

type forgettingCase struct {
	Function     string           `json:"function"`
	Inputs       forgettingInputs `json:"inputs"`
	Expected     *float64         `json:"expected,omitempty"`
	ExpectedText *string          `json:"expected_text,omitempty"`
}

type forgettingInputs struct {
	Now                  string   `json:"now,omitempty"`
	LastRecalled         *string  `json:"last_recalled,omitempty"`
	Created              string   `json:"created,omitempty"`
	OffsetDays           *float64 `json:"offset_days,omitempty"`
	EffectiveElapsedDays *float64 `json:"effective_elapsed_days,omitempty"`
	Arousal              *float64 `json:"arousal,omitempty"`
	EffectiveStrength    *float64 `json:"effective_strength,omitempty"`
	CurrentText          string   `json:"current_text,omitempty"`
	Stage                *int     `json:"stage,omitempty"`
	// Seed is carried as a decimal string so an int64 seed above 2^53 survives JSON round-trip on
	// the TS side (BigInt(seed)) — the fixture pins seed parity across the full int64 range.
	Seed *string `json:"seed,omitempty"`
}

func TestForgettingGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readForgettingFixture(t)

	// The fixture pins the generated constants so a tuning change that would desync render from
	// gating fails loudly here (both runtimes read these same numbers).
	wantValues := forgettingFixtureValues{
		BrightnessDecayPerDay:     values.ForgettingBrightnessDecayPerDay,
		BrightnessFloor:           values.ForgettingBrightnessFloor,
		StageIntervalDays:         values.ForgettingStageIntervalDays,
		StageWordRemovalRatios:    values.ForgettingStageWordRemovalRatios,
		ArousalSlowCoefficient:    values.ForgettingArousalSlowCoefficient,
		ConnectionSlowCoefficient: values.ForgettingConnectionSlowCoefficient,
	}
	if fixture.Values.BrightnessDecayPerDay != wantValues.BrightnessDecayPerDay ||
		fixture.Values.BrightnessFloor != wantValues.BrightnessFloor ||
		fixture.Values.StageIntervalDays != wantValues.StageIntervalDays ||
		fixture.Values.ArousalSlowCoefficient != wantValues.ArousalSlowCoefficient ||
		fixture.Values.ConnectionSlowCoefficient != wantValues.ConnectionSlowCoefficient ||
		len(fixture.Values.StageWordRemovalRatios) != len(wantValues.StageWordRemovalRatios) {
		t.Fatalf("fixture values drifted from generated constants: %+v vs %+v", fixture.Values, wantValues)
	}

	for _, testCase := range fixture.Cases {
		got, gotText := runForgettingCase(t, testCase)
		if testCase.ExpectedText != nil {
			if gotText != *testCase.ExpectedText {
				t.Fatalf("%s = %q, want %q", testCase.Function, gotText, *testCase.ExpectedText)
			}
			continue
		}
		if testCase.Expected == nil {
			t.Fatalf("%s case has neither expected nor expected_text", testCase.Function)
		}
		if math.Abs(got-*testCase.Expected) > fixture.Tolerance {
			t.Fatalf("%s = %v, want %v", testCase.Function, got, *testCase.Expected)
		}
	}
}

func runForgettingCase(t *testing.T, testCase forgettingCase) (float64, string) {
	t.Helper()
	in := testCase.Inputs
	switch testCase.Function {
	case "effective_elapsed_days":
		var lastRecalled *time.Time
		if in.LastRecalled != nil {
			parsed := date(t, *in.LastRecalled)
			lastRecalled = &parsed
		}
		return EffectiveElapsedDays(date(t, in.Now), lastRecalled, date(t, in.Created), derefFloat(in.OffsetDays)), ""
	case "effective_brightness":
		return EffectiveBrightness(derefFloat(in.EffectiveElapsedDays), derefFloat(in.Arousal), derefFloat(in.EffectiveStrength)), ""
	case "decay_stage":
		return float64(DecayStage(derefFloat(in.EffectiveElapsedDays), derefFloat(in.Arousal), derefFloat(in.EffectiveStrength))), ""
	case "decay_stage_text":
		return 0, DecayStageText(in.CurrentText, derefInt(in.Stage), parseSeed(t, in.Seed))
	default:
		t.Fatalf("unknown golden function %q", testCase.Function)
		return 0, ""
	}
}

func derefFloat(value *float64) float64 {
	if value == nil {
		return 0
	}
	return *value
}

func derefInt(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func parseSeed(t *testing.T, value *string) int64 {
	t.Helper()
	if value == nil {
		return 0
	}
	seed, err := strconv.ParseInt(*value, 10, 64)
	if err != nil {
		t.Fatalf("parse seed %q: %v", *value, err)
	}
	return seed
}

func readForgettingFixture(t *testing.T) forgettingFixture {
	t.Helper()
	data, err := os.ReadFile(forgettingGoldenPath)
	if err != nil {
		t.Fatalf("read forgetting fixture: %v", err)
	}
	var fixture forgettingFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode forgetting fixture: %v", err)
	}
	return fixture
}

// TestWriteForgettingGolden regenerates the shared fixture from the Go implementation (the source of
// truth). Run with UPDATE_GOLDEN=1; the committed file is Go-generated and the TS mirror is pinned
// against it, so any TS drift fails packages/memory-logic tests.
func TestWriteForgettingGolden(t *testing.T) {
	if os.Getenv("UPDATE_GOLDEN") == "" {
		t.Skip("set UPDATE_GOLDEN=1 to regenerate testdata/forgetting-decay-golden.json")
	}

	fptr := func(v float64) *float64 { return &v }
	sptr := func(v string) *string { return &v }
	iptr := func(v int) *int { return &v }
	seedptr := func(v int64) *string { s := strconv.FormatInt(v, 10); return &s }

	cases := []forgettingCase{}

	// effective_elapsed_days: never-recalled, recalled, signed offsets, floor, future anchor.
	elapsedInputs := []forgettingInputs{
		{Now: "2026-03-01", Created: "2026-01-01", OffsetDays: fptr(0)},
		{Now: "2026-03-01", LastRecalled: sptr("2026-02-01"), Created: "2026-01-01", OffsetDays: fptr(0)},
		{Now: "2026-03-01", LastRecalled: sptr("2026-02-01"), Created: "2026-01-01", OffsetDays: fptr(5)},
		{Now: "2026-03-01", LastRecalled: sptr("2026-02-01"), Created: "2026-01-01", OffsetDays: fptr(-1000)},
		{Now: "2026-03-01", LastRecalled: sptr("2027-01-01"), Created: "2026-01-01", OffsetDays: fptr(0)},
	}
	for _, in := range elapsedInputs {
		var lastRecalled *time.Time
		if in.LastRecalled != nil {
			parsed := date(t, *in.LastRecalled)
			lastRecalled = &parsed
		}
		got := EffectiveElapsedDays(date(t, in.Now), lastRecalled, date(t, in.Created), derefFloat(in.OffsetDays))
		cases = append(cases, forgettingCase{Function: "effective_elapsed_days", Inputs: in, Expected: fptr(got)})
	}

	// effective_brightness: elapsed 0 (=1.0), a decay sweep to the floor, high vs low arousal/strength.
	brightInputs := []forgettingInputs{
		{EffectiveElapsedDays: fptr(0), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(30), Arousal: fptr(0.5), EffectiveStrength: fptr(0.5)},
		{EffectiveElapsedDays: fptr(180), Arousal: fptr(0.5), EffectiveStrength: fptr(0.5)},
		{EffectiveElapsedDays: fptr(3650), Arousal: fptr(0.5), EffectiveStrength: fptr(0.5)},
		{EffectiveElapsedDays: fptr(180), Arousal: fptr(0.1), EffectiveStrength: fptr(0.5)},
		{EffectiveElapsedDays: fptr(180), Arousal: fptr(0.9), EffectiveStrength: fptr(0.5)},
		{EffectiveElapsedDays: fptr(180), Arousal: fptr(0.5), EffectiveStrength: fptr(0.1)},
		{EffectiveElapsedDays: fptr(180), Arousal: fptr(0.5), EffectiveStrength: fptr(0.9)},
	}
	for _, in := range brightInputs {
		got := EffectiveBrightness(derefFloat(in.EffectiveElapsedDays), derefFloat(in.Arousal), derefFloat(in.EffectiveStrength))
		cases = append(cases, forgettingCase{Function: "effective_brightness", Inputs: in, Expected: fptr(got)})
	}

	// decay_stage: at each threshold boundary and floored at maxStage; a slowed memory.
	stageInputs := []forgettingInputs{
		{EffectiveElapsedDays: fptr(0), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(29), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(30), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(90), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(120), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(1000000), Arousal: fptr(0), EffectiveStrength: fptr(0)},
		{EffectiveElapsedDays: fptr(90), Arousal: fptr(1), EffectiveStrength: fptr(1)},
	}
	for _, in := range stageInputs {
		got := float64(DecayStage(derefFloat(in.EffectiveElapsedDays), derefFloat(in.Arousal), derefFloat(in.EffectiveStrength)))
		cases = append(cases, forgettingCase{Function: "decay_stage", Inputs: in, Expected: fptr(got)})
	}

	// decay_stage_text: determinism + nested superset + per-stage ratio + first/last guard, over a
	// fixed seed. Covers an English sentence, a Korean sentence, a mid-text sentence boundary with a
	// closing quote (the anchor guard), and an int64 seed above 2^53 (TS bigint-seed parity).
	textInputs := []struct {
		text string
		seed int64
	}{
		{"I went to the market today and bought fresh pasta with my friend.", 1234567},
		{"나는 오늘 친구랑 파스타랑 커피를 정말 맛있게 먹었다 그리고 행복했다", 42},
		{`She said "hello." Then walked home under the bright winter stars.`, 1234567},
		{"alpha beta gamma delta epsilon zeta eta theta iota kappa", 9007199254740995},
	}
	maxStage := len(values.ForgettingStageWordRemovalRatios)
	for _, ti := range textInputs {
		for stage := 0; stage <= maxStage; stage++ {
			in := forgettingInputs{CurrentText: ti.text, Stage: iptr(stage), Seed: seedptr(ti.seed)}
			got := DecayStageText(ti.text, stage, ti.seed)
			cases = append(cases, forgettingCase{Function: "decay_stage_text", Inputs: in, ExpectedText: sptr(got)})
		}
	}

	fixture := forgettingFixture{
		Tolerance: 1e-9,
		Values: forgettingFixtureValues{
			BrightnessDecayPerDay:     values.ForgettingBrightnessDecayPerDay,
			BrightnessFloor:           values.ForgettingBrightnessFloor,
			StageIntervalDays:         values.ForgettingStageIntervalDays,
			StageWordRemovalRatios:    values.ForgettingStageWordRemovalRatios,
			ArousalSlowCoefficient:    values.ForgettingArousalSlowCoefficient,
			ConnectionSlowCoefficient: values.ForgettingConnectionSlowCoefficient,
		},
		Cases: cases,
	}

	out, err := json.MarshalIndent(fixture, "", "  ")
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	if err := os.WriteFile(forgettingGoldenPath, append(out, '\n'), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
}
