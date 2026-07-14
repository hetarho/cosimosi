package twinkle

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

func TestTwinkleGeneratedValuesMatchGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readLedgerFixture(t)

	assertAlmostEqual(t, "basic_daily_amount", values.TwinkleBasicDailyAmount, fixture.Values.BasicDailyAmount, fixture.Tolerance)
	assertAlmostEqual(t, "recall_base_cost", values.TwinkleRecallBaseCost, fixture.Values.RecallBaseCost, fixture.Tolerance)
	assertAlmostEqual(t, "recall_depth_coefficient", values.TwinkleRecallDepthCoefficient, fixture.Values.RecallDepthCoefficient, fixture.Tolerance)
	assertAlmostEqual(t, "recall_max_cost", values.TwinkleRecallMaxCost, fixture.Values.RecallMaxCost, fixture.Tolerance)
	assertAlmostEqual(t, "gist_base_cost", values.TwinkleGistBaseCost, fixture.Values.GistBaseCost, fixture.Tolerance)
	assertAlmostEqual(t, "gist_stage_discount", values.TwinkleGistStageDiscount, fixture.Values.GistStageDiscount, fixture.Tolerance)
	assertAlmostEqual(t, "gist_min_cost", values.TwinkleGistMinCost, fixture.Values.GistMinCost, fixture.Tolerance)
}

func TestBasicRemainingInvariants(t *testing.T) {
	t.Parallel()

	window := time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC)

	// A fresh window yields the full grant regardless of the prior window's spend — unspent
	// basic never carries and prior spend never leaks (A3).
	nextDay := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	for _, spent := range []int{0, 1, 50, 100, 130} {
		if got := BasicRemaining(nextDay, window, spent); got != values.TwinkleBasicDailyAmount {
			t.Fatalf("BasicRemaining(fresh window, spent %d) = %d, want full grant %d", spent, got, values.TwinkleBasicDailyAmount)
		}
	}

	// Inside the window the derivation is grant − spent, floored at 0.
	sameDay := time.Date(2026, 7, 14, 9, 0, 0, 0, time.UTC)
	if got := BasicRemaining(sameDay, window, 40); got != values.TwinkleBasicDailyAmount-40 {
		t.Fatalf("BasicRemaining(same window, 40) = %d, want %d", got, values.TwinkleBasicDailyAmount-40)
	}
	if got := BasicRemaining(sameDay, window, values.TwinkleBasicDailyAmount); got != 0 {
		t.Fatalf("BasicRemaining(spent out) = %d, want 0", got)
	}
	if got := BasicRemaining(sameDay, window, values.TwinkleBasicDailyAmount+30); got != 0 {
		t.Fatalf("BasicRemaining(overspent) = %d, want 0 (never negative)", got)
	}

	// The UTC-day boundary is exact: 23:59:59 is still the same window, 00:00:00 is fresh (A4).
	lastSecond := time.Date(2026, 7, 14, 23, 59, 59, 0, time.UTC)
	if got := BasicRemaining(lastSecond, window, 30); got != values.TwinkleBasicDailyAmount-30 {
		t.Fatalf("BasicRemaining(23:59:59) = %d, want same-window %d", got, values.TwinkleBasicDailyAmount-30)
	}
	midnight := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	if got := BasicRemaining(midnight, window, 30); got != values.TwinkleBasicDailyAmount {
		t.Fatalf("BasicRemaining(00:00:00 next day) = %d, want full grant", got)
	}

	// The boundary is the UTC day, not the local one: a wall-clock next-day instant that is
	// still the same UTC day derives as the same window.
	seoul := time.FixedZone("KST", 9*60*60)
	sameUTCDay := time.Date(2026, 7, 15, 1, 0, 0, 0, seoul) // 2026-07-14T16:00:00Z
	if got := BasicRemaining(sameUTCDay, window, 30); got != values.TwinkleBasicDailyAmount-30 {
		t.Fatalf("BasicRemaining(KST next day, same UTC day) = %d, want same-window %d", got, values.TwinkleBasicDailyAmount-30)
	}

	// A now before the anchor's day never over-grants (conservative same-window derivation).
	priorDay := time.Date(2026, 7, 13, 12, 0, 0, 0, time.UTC)
	if got := BasicRemaining(priorDay, window, 30); got != values.TwinkleBasicDailyAmount-30 {
		t.Fatalf("BasicRemaining(now before window) = %d, want conservative %d", got, values.TwinkleBasicDailyAmount-30)
	}
}

func TestDeriveBalanceReadsBothTiers(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 14, 9, 0, 0, 0, time.UTC)
	record := BalanceRecord{
		Additional:           25,
		BasicSpentThisWindow: 40,
		BasicResetWindow:     time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC),
	}
	got := DeriveBalance(now, record)
	want := Balance{Basic: values.TwinkleBasicDailyAmount - 40, Additional: 25}
	if got != want {
		t.Fatalf("DeriveBalance = %+v, want %+v", got, want)
	}
	if got := DeriveBalance(now, BalanceRecord{Additional: -5, BasicResetWindow: record.BasicResetWindow}); got.Additional != 0 {
		t.Fatalf("DeriveBalance(negative additional) = %+v, want additional 0", got)
	}
}

func TestPlanSpendInvariants(t *testing.T) {
	t.Parallel()

	// Property sweep: basic drains before additional, the draw always sums to the (bounded)
	// cost, and neither tier can go negative (A5).
	for _, basic := range []int{0, 1, 10, 50, 100} {
		for _, additional := range []int{0, 1, 25, 500} {
			for _, cost := range []int{-5, 0, 1, 10, 60, 100, 151, 700} {
				plan := PlanSpend(basic, additional, cost)
				boundedCost := max(0, cost)
				if plan.FromBasic+plan.FromAdditional != boundedCost {
					t.Fatalf("PlanSpend(%d, %d, %d) draws %d+%d, want sum %d", basic, additional, cost, plan.FromBasic, plan.FromAdditional, boundedCost)
				}
				if plan.FromBasic < 0 || plan.FromAdditional < 0 {
					t.Fatalf("PlanSpend(%d, %d, %d) = %+v, negative draw", basic, additional, cost, plan)
				}
				if plan.FromBasic > basic {
					t.Fatalf("PlanSpend(%d, %d, %d) overdraws basic: %+v", basic, additional, cost, plan)
				}
				if plan.FromAdditional > 0 && plan.FromBasic < basic {
					t.Fatalf("PlanSpend(%d, %d, %d) touched additional before draining basic: %+v", basic, additional, cost, plan)
				}
				if plan.OK != (plan.FromAdditional <= additional) {
					t.Fatalf("PlanSpend(%d, %d, %d) ok = %v, want %v", basic, additional, cost, plan.OK, plan.FromAdditional <= additional)
				}
				if plan.OK && plan.FromAdditional > additional {
					t.Fatalf("PlanSpend(%d, %d, %d) ok but oversells additional: %+v", basic, additional, cost, plan)
				}
			}
		}
	}

	// Negative stored inputs are bounded, never amplified.
	if plan := PlanSpend(-10, -10, 5); plan.OK || plan.FromBasic != 0 || plan.FromAdditional != 5 {
		t.Fatalf("PlanSpend(negative tiers) = %+v, want overflow-only, not ok", plan)
	}
}

func TestRecallCostInvariants(t *testing.T) {
	t.Parallel()

	// Non-decreasing over the accessibility sweep, capped, and never below the base price (A6).
	previous := 0
	for _, weight := range []float64{0, 0.5, 1, 1.25, 2, 2.75, 3.5, 4, 6, 100} {
		got := RecallCost(weight)
		if got < previous {
			t.Fatalf("RecallCost(%v) = %d, decreased from %d", weight, got, previous)
		}
		if got > values.TwinkleRecallMaxCost {
			t.Fatalf("RecallCost(%v) = %d, exceeds cap %d", weight, got, values.TwinkleRecallMaxCost)
		}
		if got < values.TwinkleRecallBaseCost {
			t.Fatalf("RecallCost(%v) = %d, below base %d", weight, got, values.TwinkleRecallBaseCost)
		}
		previous = got
	}
	if got := RecallCost(1e18); got != values.TwinkleRecallMaxCost {
		t.Fatalf("RecallCost(huge) = %d, want cap %d", got, values.TwinkleRecallMaxCost)
	}
}

func TestGistViewCostInvariants(t *testing.T) {
	t.Parallel()

	// Non-increasing over the gist ladder, floored, and never free (A7).
	previous := values.TwinkleGistBaseCost + 1
	for stage := 1; stage <= 8; stage++ {
		got := GistViewCost(stage)
		if got > previous {
			t.Fatalf("GistViewCost(%d) = %d, increased from %d", stage, got, previous)
		}
		if got < values.TwinkleGistMinCost {
			t.Fatalf("GistViewCost(%d) = %d, below floor %d", stage, got, values.TwinkleGistMinCost)
		}
		if got <= 0 {
			t.Fatalf("GistViewCost(%d) = %d, a gist view is cheap but never free", stage, got)
		}
		previous = got
	}
	if got := GistViewCost(1); got != values.TwinkleGistBaseCost {
		t.Fatalf("GistViewCost(1) = %d, want base %d", got, values.TwinkleGistBaseCost)
	}
	if got := GistViewCost(0); got != GistViewCost(1) {
		t.Fatalf("GistViewCost(0) = %d, want stage-1 price %d", got, GistViewCost(1))
	}
}

func TestStardustLedgerGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readLedgerFixture(t)
	for _, testCase := range fixture.Cases {
		switch testCase.Function {
		case "recall_cost":
			got := RecallCost(testCase.Inputs.AccessibilityCost)
			assertAlmostEqual(t, testCase.Function, float64(got), testCase.Expected, fixture.Tolerance)
		case "gist_view_cost":
			got := GistViewCost(testCase.Inputs.SemanticStage)
			assertAlmostEqual(t, testCase.Function, float64(got), testCase.Expected, fixture.Tolerance)
		case "plan_spend":
			got := PlanSpend(testCase.Inputs.BasicRemaining, testCase.Inputs.Additional, testCase.Inputs.Cost)
			want := SpendPlan{
				FromBasic:      testCase.ExpectedPlan.FromBasic,
				FromAdditional: testCase.ExpectedPlan.FromAdditional,
				OK:             testCase.ExpectedPlan.OK,
			}
			if got != want {
				t.Fatalf("PlanSpend(%d, %d, %d) = %+v, want %+v", testCase.Inputs.BasicRemaining, testCase.Inputs.Additional, testCase.Inputs.Cost, got, want)
			}
		case "basic_remaining":
			now := parseFixtureTime(t, testCase.Inputs.Now)
			window := parseFixtureDate(t, testCase.Inputs.ResetWindow)
			got := BasicRemaining(now, window, testCase.Inputs.SpentThisWindow)
			assertAlmostEqual(t, testCase.Function, float64(got), testCase.Expected, fixture.Tolerance)
		default:
			t.Fatalf("unknown golden function %q", testCase.Function)
		}
	}
}

type ledgerFixture struct {
	Tolerance float64             `json:"tolerance"`
	Values    ledgerFixtureValues `json:"values"`
	Cases     []ledgerFixtureCase `json:"cases"`
}

type ledgerFixtureValues struct {
	BasicDailyAmount       float64 `json:"basic_daily_amount"`
	RecallBaseCost         float64 `json:"recall_base_cost"`
	RecallDepthCoefficient float64 `json:"recall_depth_coefficient"`
	RecallMaxCost          float64 `json:"recall_max_cost"`
	GistBaseCost           float64 `json:"gist_base_cost"`
	GistStageDiscount      float64 `json:"gist_stage_discount"`
	GistMinCost            float64 `json:"gist_min_cost"`
}

type ledgerFixtureCase struct {
	Function     string              `json:"function"`
	Inputs       ledgerFixtureInputs `json:"inputs"`
	Expected     float64             `json:"expected"`
	ExpectedPlan ledgerFixturePlan   `json:"expected_plan"`
}

type ledgerFixtureInputs struct {
	AccessibilityCost float64 `json:"accessibility_cost"`
	SemanticStage     int     `json:"semantic_stage"`
	BasicRemaining    int     `json:"basic_remaining"`
	Additional        int     `json:"additional"`
	Cost              int     `json:"cost"`
	Now               string  `json:"now"`
	ResetWindow       string  `json:"reset_window"`
	SpentThisWindow   int     `json:"spent_this_window"`
}

type ledgerFixturePlan struct {
	FromBasic      int  `json:"from_basic"`
	FromAdditional int  `json:"from_additional"`
	OK             bool `json:"ok"`
}

func readLedgerFixture(t *testing.T) ledgerFixture {
	t.Helper()

	data, err := os.ReadFile("testdata/stardust-ledger-golden.json")
	if err != nil {
		t.Fatalf("read stardust-ledger fixture: %v", err)
	}
	var fixture ledgerFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode stardust-ledger fixture: %v", err)
	}
	return fixture
}

func parseFixtureTime(t *testing.T, value string) time.Time {
	t.Helper()

	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		t.Fatalf("parse fixture time %q: %v", value, err)
	}
	return parsed
}

func parseFixtureDate(t *testing.T, value string) time.Time {
	t.Helper()

	parsed, err := time.Parse(time.DateOnly, value)
	if err != nil {
		t.Fatalf("parse fixture date %q: %v", value, err)
	}
	return parsed
}

func assertAlmostEqual(t *testing.T, label string, got float64, want float64, tolerance float64) {
	t.Helper()

	diff := got - want
	if diff < 0 {
		diff = -diff
	}
	if diff > tolerance {
		t.Fatalf("%s = %v, want %v", label, got, want)
	}
}
