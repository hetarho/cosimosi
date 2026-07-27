package twinkle

import (
	"encoding/json"
	"os"
	"testing"
	"time"
	// The golden zone cases resolve real IANA names, so the test binary embeds the zone database
	// exactly as cmd/api and cmd/worker do — LoadLocation must not depend on the host image.
	_ "time/tzdata"

	"github.com/cosimosi/api/internal/platform/values"
)

const goldenFixturePath = "testdata/stardust-ledger-golden.json"

func TestTwinkleGeneratedValuesMatchGoldenFixture(t *testing.T) {
	t.Parallel()

	fixture := readLedgerFixture(t)

	assertAlmostEqual(t, "small_daily_amount", values.TwinkleSmallDailyAmount, fixture.Values.SmallDailyAmount, fixture.Tolerance)
	assertAlmostEqual(t, "recall_base_cost", values.TwinkleRecallBaseCost, fixture.Values.RecallBaseCost, fixture.Tolerance)
	assertAlmostEqual(t, "recall_depth_coefficient", values.TwinkleRecallDepthCoefficient, fixture.Values.RecallDepthCoefficient, fixture.Tolerance)
	assertAlmostEqual(t, "recall_max_cost", values.TwinkleRecallMaxCost, fixture.Values.RecallMaxCost, fixture.Tolerance)
	assertAlmostEqual(t, "gist_base_cost", values.TwinkleGistBaseCost, fixture.Values.GistBaseCost, fixture.Tolerance)
	assertAlmostEqual(t, "gist_stage_discount", values.TwinkleGistStageDiscount, fixture.Values.GistStageDiscount, fixture.Tolerance)
	assertAlmostEqual(t, "gist_min_cost", values.TwinkleGistMinCost, fixture.Values.GistMinCost, fixture.Tolerance)
}

func TestSmallRemainingInvariants(t *testing.T) {
	t.Parallel()

	window := time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC)

	// A fresh window yields the full grant regardless of the prior window's spend — unspent
	// SMALL never carries and prior spend never leaks (A3).
	nextDay := time.Date(2026, 7, 15, 0, 0, 0, 0, time.UTC)
	for _, spent := range []int{0, 1, 50, 100, 130} {
		if got := SmallRemaining(nextDay, time.UTC, window, spent); got != values.TwinkleSmallDailyAmount {
			t.Fatalf("SmallRemaining(fresh window, spent %d) = %d, want full grant %d", spent, got, values.TwinkleSmallDailyAmount)
		}
	}

	// Inside the window the derivation is grant − spent, floored at 0.
	sameDay := time.Date(2026, 7, 14, 9, 0, 0, 0, time.UTC)
	if got := SmallRemaining(sameDay, time.UTC, window, 40); got != values.TwinkleSmallDailyAmount-40 {
		t.Fatalf("SmallRemaining(same window, 40) = %d, want %d", got, values.TwinkleSmallDailyAmount-40)
	}
	if got := SmallRemaining(sameDay, time.UTC, window, values.TwinkleSmallDailyAmount); got != 0 {
		t.Fatalf("SmallRemaining(spent out) = %d, want 0", got)
	}
	if got := SmallRemaining(sameDay, time.UTC, window, values.TwinkleSmallDailyAmount+30); got != 0 {
		t.Fatalf("SmallRemaining(overspent) = %d, want 0 (never negative)", got)
	}

	// The day boundary is exact in the reading zone: 23:59:59 is still the same window, 00:00:00
	// is fresh (A4).
	if got := SmallRemaining(time.Date(2026, 7, 14, 23, 59, 59, 0, time.UTC), time.UTC, window, 30); got != values.TwinkleSmallDailyAmount-30 {
		t.Fatalf("SmallRemaining(23:59:59) = %d, want same-window %d", got, values.TwinkleSmallDailyAmount-30)
	}
	if got := SmallRemaining(nextDay, time.UTC, window, 30); got != values.TwinkleSmallDailyAmount {
		t.Fatalf("SmallRemaining(00:00:00 next day) = %d, want full grant", got)
	}

	// The boundary is the USER's calendar day, not UTC's ([G2][U7]): 2026-07-15 01:00 in Seoul is
	// still 07-14 in UTC, and it must read as a FRESH window — the shipped UTC rule read it as the
	// same window and refilled a Seoul diarist at 09:00 local.
	seoul := LocationOf("Asia/Seoul")
	seoulNextDay := time.Date(2026, 7, 15, 1, 0, 0, 0, seoul)
	if got := SmallRemaining(seoulNextDay, seoul, window, 30); got != values.TwinkleSmallDailyAmount {
		t.Fatalf("SmallRemaining(Seoul next local day) = %d, want full grant", got)
	}
	if got := SmallRemaining(seoulNextDay, time.UTC, window, 30); got != values.TwinkleSmallDailyAmount-30 {
		t.Fatalf("SmallRemaining(same instant read in UTC) = %d, want same-window %d", got, values.TwinkleSmallDailyAmount-30)
	}

	// A now before the anchor's day never over-grants (conservative same-window derivation).
	priorDay := time.Date(2026, 7, 13, 12, 0, 0, 0, time.UTC)
	if got := SmallRemaining(priorDay, time.UTC, window, 30); got != values.TwinkleSmallDailyAmount-30 {
		t.Fatalf("SmallRemaining(now before window) = %d, want conservative %d", got, values.TwinkleSmallDailyAmount-30)
	}
}

func TestResetWindowOfIsTheUsersLocalDate(t *testing.T) {
	t.Parallel()

	// One instant, three zones, three calendar dates — the boundary belongs to the user.
	instant := time.Date(2026, 7, 14, 23, 0, 0, 0, time.UTC)
	for name, want := range map[string]string{
		"UTC":                 "2026-07-14",
		"Asia/Seoul":          "2026-07-15",
		"Pacific/Kiritimati":  "2026-07-15",
		"America/Los_Angeles": "2026-07-14",
	} {
		if got := ResetWindowOf(instant, LocationOf(name)).Format(time.DateOnly); got != want {
			t.Fatalf("ResetWindowOf(%s) = %s, want %s", name, got, want)
		}
	}

	// The returned date is UTC-midnight so it is directly comparable with the stored DATE anchor.
	got := ResetWindowOf(instant, LocationOf("Asia/Seoul"))
	if got.Location() != time.UTC || got.Hour() != 0 || got.Minute() != 0 || got.Second() != 0 {
		t.Fatalf("ResetWindowOf = %v, want a UTC-midnight date", got)
	}
}

func TestLocationOfFallsBackToUTCWithoutError(t *testing.T) {
	t.Parallel()

	// [G5]: a missing or unreadable zone may never deny a refill, so every unusable name reads as
	// UTC rather than erroring.
	// "Local" is in the list on purpose: Go accepts it as the PROCESS's zone, which would make a
	// user's day depend on the deployment and would diverge from the TS mirror (Intl has no alias).
	for _, name := range []string{"", "   ", "Not/AZone", "Mars/Olympus", "Local", "local"} {
		if got := LocationOf(name); got != time.UTC {
			t.Fatalf("LocationOf(%q) = %v, want UTC", name, got)
		}
	}
	if got := LocationOf("Asia/Seoul"); got == time.UTC {
		t.Fatal("LocationOf(Asia/Seoul) = UTC, want the real zone (is time/tzdata embedded?)")
	}
	// A nil zone is the same fallback, so no caller can crash the derivation by omitting one.
	if got := ResetWindowOf(time.Date(2026, 7, 14, 23, 0, 0, 0, time.UTC), nil).Format(time.DateOnly); got != "2026-07-14" {
		t.Fatalf("ResetWindowOf(nil zone) = %s, want the UTC date", got)
	}
}

func TestDeriveBalanceReadsBothKinds(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 7, 14, 9, 0, 0, 0, time.UTC)
	record := BalanceRecord{
		General:              25,
		SmallSpentThisWindow: 40,
		SmallResetWindow:     time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC),
	}
	got := DeriveBalance(now, time.UTC, record)
	want := Balance{Small: values.TwinkleSmallDailyAmount - 40, General: 25}
	if got != want {
		t.Fatalf("DeriveBalance = %+v, want %+v", got, want)
	}
	if got := DeriveBalance(now, time.UTC, BalanceRecord{General: -5, SmallResetWindow: record.SmallResetWindow}); got.General != 0 {
		t.Fatalf("DeriveBalance(negative general) = %+v, want general 0", got)
	}
	if got := want.Of(TwinkleKindSmall); got != want.Small {
		t.Fatalf("Of(SMALL) = %d, want %d", got, want.Small)
	}
	if got := want.Of(TwinkleKindGeneral); got != want.General {
		t.Fatalf("Of(GENERAL) = %d, want %d", got, want.General)
	}
	if got := want.Of(TwinkleKind("mystery")); got != 0 {
		t.Fatalf("Of(unknown kind) = %d, want 0", got)
	}
}

func TestSmallEligibleIsClosedAndFailsClosed(t *testing.T) {
	t.Parallel()

	for _, kind := range []SpendKind{SpendKindRecall, SpendKindGistView, SpendKindDiaryRecall} {
		if !SmallEligible(kind) {
			t.Fatalf("SmallEligible(%q) = false, want true (the recall family)", kind)
		}
	}
	// A8/[I11]: the default arm returns false, so an UNLISTED kind — a purchase today, whatever is
	// added tomorrow — cannot reach today's recall allowance by omission.
	for _, kind := range []SpendKind{SpendKindPurchase, SpendKind(""), SpendKind("recall "), SpendKind("ornament_purchase"), SpendKind("a_future_kind")} {
		if SmallEligible(kind) {
			t.Fatalf("SmallEligible(%q) = true, want false (unlisted kinds are ineligible)", kind)
		}
	}
}

func TestPlanSpendInvariants(t *testing.T) {
	t.Parallel()

	// Property sweep over both eligibility branches: SMALL drains before GENERAL for the recall
	// family and is untouched otherwise, the draw always sums to the (bounded) cost, and neither
	// kind can go negative (A5, A7).
	for _, kind := range []SpendKind{SpendKindRecall, SpendKindGistView, SpendKindDiaryRecall, SpendKindPurchase, SpendKind("unknown")} {
		eligible := SmallEligible(kind)
		for _, small := range []int{0, 1, 10, 50, 100} {
			for _, general := range []int{0, 1, 25, 500} {
				for _, cost := range []int{-5, 0, 1, 10, 60, 100, 151, 700} {
					plan := PlanSpend(small, general, cost, kind)
					boundedCost := max(0, cost)
					if plan.FromSmall+plan.FromGeneral != boundedCost {
						t.Fatalf("PlanSpend(%d, %d, %d, %q) draws %d+%d, want sum %d", small, general, cost, kind, plan.FromSmall, plan.FromGeneral, boundedCost)
					}
					if plan.FromSmall < 0 || plan.FromGeneral < 0 {
						t.Fatalf("PlanSpend(%d, %d, %d, %q) = %+v, negative draw", small, general, cost, kind, plan)
					}
					if plan.FromSmall > small {
						t.Fatalf("PlanSpend(%d, %d, %d, %q) overdraws small: %+v", small, general, cost, kind, plan)
					}
					if !eligible && plan.FromSmall != 0 {
						t.Fatalf("PlanSpend(%d, %d, %d, %q) drew %d from SMALL for an ineligible kind", small, general, cost, kind, plan.FromSmall)
					}
					if eligible && plan.FromGeneral > 0 && plan.FromSmall < small {
						t.Fatalf("PlanSpend(%d, %d, %d, %q) touched GENERAL before draining SMALL: %+v", small, general, cost, kind, plan)
					}
					if plan.OK != (plan.FromGeneral <= general) {
						t.Fatalf("PlanSpend(%d, %d, %d, %q) ok = %v, want %v", small, general, cost, kind, plan.OK, plan.FromGeneral <= general)
					}
				}
			}
		}
	}

	// The tier split at ONE balance: the same cost that today's recall covers out of SMALL is
	// refused for a purchase, which is exactly [G5] — decoration cannot eat the recall budget.
	if plan := PlanSpend(100, 0, 40, SpendKindRecall); plan != (SpendPlan{FromSmall: 40, FromGeneral: 0, OK: true}) {
		t.Fatalf("PlanSpend(recall) = %+v, want SMALL-first and covered", plan)
	}
	if plan := PlanSpend(100, 0, 40, SpendKindPurchase); plan != (SpendPlan{FromSmall: 0, FromGeneral: 40, OK: false}) {
		t.Fatalf("PlanSpend(purchase) = %+v, want GENERAL-only and refused", plan)
	}

	// Negative stored inputs are bounded, never amplified.
	if plan := PlanSpend(-10, -10, 5, SpendKindRecall); plan.OK || plan.FromSmall != 0 || plan.FromGeneral != 5 {
		t.Fatalf("PlanSpend(negative kinds) = %+v, want overflow-only, not ok", plan)
	}
}

func TestShortfallForIsKindAware(t *testing.T) {
	t.Parallel()

	// A covered plan is never short.
	if got := ShortfallFor(100, 0, 40, SpendKindRecall); got != 0 {
		t.Fatalf("ShortfallFor(covered recall) = %d, want 0", got)
	}
	// A9: the same balance and cost, priced for a purpose SMALL may not pay — the whole cost is
	// short, because the recall allowance cannot be counted toward it.
	if got := ShortfallFor(100, 0, 40, SpendKindPurchase); got != 40 {
		t.Fatalf("ShortfallFor(purchase) = %d, want the full 40", got)
	}
	// A recall overflowing SMALL is short only by what GENERAL cannot absorb.
	if got := ShortfallFor(30, 10, 70, SpendKindRecall); got != 30 {
		t.Fatalf("ShortfallFor(overflowing recall) = %d, want 30", got)
	}
	if got := ShortfallFor(0, -5, 20, SpendKindRecall); got != 20 {
		t.Fatalf("ShortfallFor(negative general) = %d, want 20 (never inflated by a bad row)", got)
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
			got := RecallCost(requiredFloat(t, testCase.Inputs.AccessibilityCost))
			assertAlmostEqual(t, testCase.Function, float64(got), requiredFloat(t, testCase.Expected), fixture.Tolerance)
		case "gist_view_cost":
			got := GistViewCost(requiredInt(t, testCase.Inputs.SemanticStage))
			assertAlmostEqual(t, testCase.Function, float64(got), requiredFloat(t, testCase.Expected), fixture.Tolerance)
		case "plan_spend":
			small := requiredInt(t, testCase.Inputs.SmallRemaining)
			general := requiredInt(t, testCase.Inputs.General)
			cost := requiredInt(t, testCase.Inputs.Cost)
			kind := SpendKind(requiredString(t, testCase.Inputs.Kind))
			got := PlanSpend(small, general, cost, kind)
			plan := requiredPlan(t, testCase.ExpectedPlan)
			want := SpendPlan{FromSmall: plan.FromSmall, FromGeneral: plan.FromGeneral, OK: plan.OK}
			if got != want {
				t.Fatalf("PlanSpend(%d, %d, %d, %q) = %+v, want %+v", small, general, cost, kind, got, want)
			}
		case "small_remaining":
			now := parseFixtureTime(t, requiredString(t, testCase.Inputs.Now))
			zone := LocationOf(requiredString(t, testCase.Inputs.Zone))
			window := parseFixtureDate(t, requiredString(t, testCase.Inputs.ResetWindow))
			got := SmallRemaining(now, zone, window, requiredInt(t, testCase.Inputs.SpentThisWindow))
			assertAlmostEqual(t, testCase.Function, float64(got), requiredFloat(t, testCase.Expected), fixture.Tolerance)
		default:
			t.Fatalf("unknown golden function %q", testCase.Function)
		}
	}
}

// TestWriteStardustLedgerGolden regenerates the shared fixture from the Go implementation (the
// source of truth). Run with UPDATE_GOLDEN=1; the committed file is Go-generated and the TS mirror
// is pinned against it, so any packages/twinkle-logic drift fails there.
func TestWriteStardustLedgerGolden(t *testing.T) {
	if os.Getenv("UPDATE_GOLDEN") == "" {
		t.Skip("set UPDATE_GOLDEN=1 to regenerate " + goldenFixturePath)
	}

	fptr := func(v float64) *float64 { return &v }
	iptr := func(v int) *int { return &v }
	sptr := func(v string) *string { return &v }

	cases := []ledgerFixtureCase{}

	for _, weight := range []float64{1.0, 1.5, 2.0, 2.75, 3.5, 4.0, 0, -1} {
		cases = append(cases, ledgerFixtureCase{
			Function: "recall_cost",
			Inputs:   ledgerFixtureInputs{AccessibilityCost: fptr(weight)},
			Expected: fptr(float64(RecallCost(weight))),
		})
	}

	for _, stage := range []int{1, 2, 3, 4, 0, 6} {
		cases = append(cases, ledgerFixtureCase{
			Function: "gist_view_cost",
			Inputs:   ledgerFixtureInputs{SemanticStage: iptr(stage)},
			Expected: fptr(float64(GistViewCost(stage))),
		})
	}

	// plan_spend: the arithmetic sweep on the recall family, then the SAME balance and cost across
	// an eligible and an ineligible kind — the pair is what proves the tier split rather than the
	// arithmetic ([P9]).
	planInputs := []struct {
		small   int
		general int
		cost    int
		kind    SpendKind
	}{
		{100, 0, 100, SpendKindRecall},
		{30, 50, 70, SpendKindRecall},
		{10, 5, 20, SpendKindRecall},
		{0, 0, 0, SpendKindRecall},
		{100, 20, 15, SpendKindGistView},
		{0, 40, 25, SpendKindDiaryRecall},
		{50, 10, -5, SpendKindRecall},
		{100, 60, 40, SpendKindRecall},
		{100, 60, 40, SpendKindPurchase},
		{100, 0, 40, SpendKindRecall},
		{100, 0, 40, SpendKindPurchase},
		{100, 0, 40, SpendKind("a_future_kind")},
	}
	for _, in := range planInputs {
		plan := PlanSpend(in.small, in.general, in.cost, in.kind)
		cases = append(cases, ledgerFixtureCase{
			Function: "plan_spend",
			Inputs: ledgerFixtureInputs{
				SmallRemaining: iptr(in.small),
				General:        iptr(in.general),
				Cost:           iptr(in.cost),
				Kind:           sptr(string(in.kind)),
			},
			ExpectedPlan: &ledgerFixturePlan{
				FromSmall:   plan.FromSmall,
				FromGeneral: plan.FromGeneral,
				OK:          plan.OK,
			},
		})
	}

	// small_remaining: the UTC ladder, then the zone cases — Seoul, a UTC+14 zone, a UTC−11 zone,
	// an empty name and an unknown one. The UTC+14/−11 pair at one instant is what pins the
	// boundary to the user's date rather than the server's.
	windowInputs := []struct {
		now    string
		zone   string
		window string
		spent  int
	}{
		{"2026-07-14T09:00:00Z", "UTC", "2026-07-13", 40},
		{"2026-07-14T09:00:00Z", "UTC", "2026-07-14", 40},
		{"2026-07-14T23:59:59Z", "UTC", "2026-07-14", 100},
		{"2026-07-14T23:59:59Z", "UTC", "2026-07-14", 130},
		{"2026-07-14T23:59:59Z", "UTC", "2026-07-14", 30},
		{"2026-07-15T00:00:00Z", "UTC", "2026-07-14", 30},
		{"2026-07-13T12:00:00Z", "UTC", "2026-07-14", 30},
		{"2026-07-14T09:00:00Z", "UTC", "2026-07-14", -10},
		{"2026-07-14T16:00:00Z", "Asia/Seoul", "2026-07-14", 30},
		{"2026-07-14T14:00:00Z", "Asia/Seoul", "2026-07-14", 30},
		{"2026-07-14T11:00:00Z", "Pacific/Kiritimati", "2026-07-14", 30},
		{"2026-07-14T11:00:00Z", "Pacific/Niue", "2026-07-14", 30},
		{"2026-07-14T11:00:00Z", "", "2026-07-14", 30},
		{"2026-07-14T11:00:00Z", "Not/AZone", "2026-07-14", 30},
		{"2026-07-14T16:00:00Z", "Local", "2026-07-14", 30},
		{"2026-07-15T05:00:00Z", "Pacific/Niue", "2026-07-14", 30},
	}
	for _, in := range windowInputs {
		now := parseFixtureTime(t, in.now)
		window := parseFixtureDate(t, in.window)
		cases = append(cases, ledgerFixtureCase{
			Function: "small_remaining",
			Inputs: ledgerFixtureInputs{
				Now:             sptr(in.now),
				Zone:            sptr(in.zone),
				ResetWindow:     sptr(in.window),
				SpentThisWindow: iptr(in.spent),
			},
			Expected: fptr(float64(SmallRemaining(now, LocationOf(in.zone), window, in.spent))),
		})
	}

	fixture := ledgerFixture{
		Tolerance: 1e-9,
		Values: ledgerFixtureValues{
			SmallDailyAmount:       float64(values.TwinkleSmallDailyAmount),
			RecallBaseCost:         float64(values.TwinkleRecallBaseCost),
			RecallDepthCoefficient: float64(values.TwinkleRecallDepthCoefficient),
			RecallMaxCost:          float64(values.TwinkleRecallMaxCost),
			GistBaseCost:           float64(values.TwinkleGistBaseCost),
			GistStageDiscount:      float64(values.TwinkleGistStageDiscount),
			GistMinCost:            float64(values.TwinkleGistMinCost),
		},
		Cases: cases,
	}
	encoded, err := json.MarshalIndent(fixture, "", "  ")
	if err != nil {
		t.Fatalf("encode stardust-ledger fixture: %v", err)
	}
	if err := os.WriteFile(goldenFixturePath, append(encoded, '\n'), 0o644); err != nil {
		t.Fatalf("write stardust-ledger fixture: %v", err)
	}
}

type ledgerFixture struct {
	Tolerance float64             `json:"tolerance"`
	Values    ledgerFixtureValues `json:"values"`
	Cases     []ledgerFixtureCase `json:"cases"`
}

type ledgerFixtureValues struct {
	SmallDailyAmount       float64 `json:"small_daily_amount"`
	RecallBaseCost         float64 `json:"recall_base_cost"`
	RecallDepthCoefficient float64 `json:"recall_depth_coefficient"`
	RecallMaxCost          float64 `json:"recall_max_cost"`
	GistBaseCost           float64 `json:"gist_base_cost"`
	GistStageDiscount      float64 `json:"gist_stage_discount"`
	GistMinCost            float64 `json:"gist_min_cost"`
}

// The input/expected fields are pointers so the generated fixture carries exactly the inputs a case
// uses — a zero-valued `cost: 0` is a real input, while an absent `zone` must not serialize as one.
type ledgerFixtureCase struct {
	Function     string              `json:"function"`
	Inputs       ledgerFixtureInputs `json:"inputs"`
	Expected     *float64            `json:"expected,omitempty"`
	ExpectedPlan *ledgerFixturePlan  `json:"expected_plan,omitempty"`
}

type ledgerFixtureInputs struct {
	AccessibilityCost *float64 `json:"accessibility_cost,omitempty"`
	SemanticStage     *int     `json:"semantic_stage,omitempty"`
	SmallRemaining    *int     `json:"small_remaining,omitempty"`
	General           *int     `json:"general,omitempty"`
	Cost              *int     `json:"cost,omitempty"`
	Kind              *string  `json:"kind,omitempty"`
	Now               *string  `json:"now,omitempty"`
	Zone              *string  `json:"zone,omitempty"`
	ResetWindow       *string  `json:"reset_window,omitempty"`
	SpentThisWindow   *int     `json:"spent_this_window,omitempty"`
}

type ledgerFixturePlan struct {
	FromSmall   int  `json:"from_small"`
	FromGeneral int  `json:"from_general"`
	OK          bool `json:"ok"`
}

func readLedgerFixture(t *testing.T) ledgerFixture {
	t.Helper()

	data, err := os.ReadFile(goldenFixturePath)
	if err != nil {
		t.Fatalf("read stardust-ledger fixture: %v", err)
	}
	var fixture ledgerFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("decode stardust-ledger fixture: %v", err)
	}
	return fixture
}

func requiredFloat(t *testing.T, value *float64) float64 {
	t.Helper()

	if value == nil {
		t.Fatal("golden fixture case is missing a required number")
	}
	return *value
}

func requiredInt(t *testing.T, value *int) int {
	t.Helper()

	if value == nil {
		t.Fatal("golden fixture case is missing a required integer")
	}
	return *value
}

func requiredString(t *testing.T, value *string) string {
	t.Helper()

	if value == nil {
		t.Fatal("golden fixture case is missing a required string")
	}
	return *value
}

func requiredPlan(t *testing.T, value *ledgerFixturePlan) ledgerFixturePlan {
	t.Helper()

	if value == nil {
		t.Fatal("golden fixture plan case is missing its expected_plan")
	}
	return *value
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
