// Package twinkle is the 별가루 (Twinkle) recall-economy bounded context ([G1]–[G5]): Twinkle is
// the product's single currency, and its two kinds are distinguished by WHAT THEY MAY BUY, not by
// how they were obtained ([G2a]) — SMALL pays only for the recall family and refills on the user's
// own calendar day, GENERAL pays for anything and carries forever. That purpose restriction is the
// point of the split ([G5]): decoration spending must be structurally incapable of eating today's
// recall budget. The context also owns the spend order (SMALL first for a recall) and the two price
// curves (recall rises with decay-depth, gist view falls with gist-depth). It is standalone — it
// never imports internal/memory; memory reaches its spend through a consumer-owned SpendGate port
// wired at the composition root (CC2/CC8). Every function here is pure and IO-free, mirrored TS↔Go
// in packages/twinkle-logic and pinned by testdata/stardust-ledger-golden.json, so the FE prices a
// recall pre-spend while the balance itself stays server-authoritative (twinkle/pg).
package twinkle

import (
	"math"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

// TwinkleKind names the two purposes a Twinkle unit may serve ([G2][G2a]). A TEXT-style closed set
// like EntryKind, never persisted as a column value: the balance row stores the GENERAL counter and
// the SMALL window anchor, so the kind is a way of reading a row, not a value inside one.
type TwinkleKind string

const (
	TwinkleKindSmall   TwinkleKind = "small"
	TwinkleKindGeneral TwinkleKind = "general"
)

// Balance is the two-kind Twinkle aggregate ([G2]): Small is the recall-only daily allowance (a
// derivation, never a stored counter, never earned, credited or refunded — no cron, no daily_grant
// row); General is the permanent carrying balance every earn path credits. Both are whole Twinkle
// units.
type Balance struct {
	Small   int
	General int
}

// Total is the spendable whole the client renders ([G2]): small + general.
func (b Balance) Total() int {
	return b.Small + b.General
}

// Of reads one kind off the balance. An unknown kind reads as 0 rather than a tier — the same
// fail-closed direction SmallEligible takes.
func (b Balance) Of(kind TwinkleKind) int {
	switch kind {
	case TwinkleKindSmall:
		return b.Small
	case TwinkleKindGeneral:
		return b.General
	default:
		return 0
	}
}

// BalanceRecord is the stored authoritative fact set the balance row holds — the permanent balance
// plus the lazy SMALL-reset anchor. Small is derived from it at read (DeriveBalance), exactly as the
// universe clock stores an anchor and derives elapsed.
type BalanceRecord struct {
	General              int
	SmallSpentThisWindow int
	SmallResetWindow     time.Time
}

// EntryKind is the ledger-log direction: an entry either earns or spends, never both. The
// amount column stays positive; the kind gives the sign.
type EntryKind string

const (
	EntryKindEarn  EntryKind = "earn"
	EntryKindSpend EntryKind = "spend"
)

// EntryReason is the closed earn/spend source set ([G3][G1]) — a TEXT closed set like
// neuron_type, not a PG enum. Earn reasons: payment, invite, write_diary, signup_bonus,
// admin_grant. Spend reasons: recall (회고), gist_view (요지 별 열람).
type EntryReason string

const (
	ReasonPayment     EntryReason = "payment"
	ReasonInvite      EntryReason = "invite"
	ReasonWriteDiary  EntryReason = "write_diary"
	ReasonSignupBonus EntryReason = "signup_bonus"
	ReasonRecall      EntryReason = "recall"
	ReasonGistView    EntryReason = "gist_view"
	// ReasonAdminGrant is an operator gift (별가루 증정, the admin console): credited to GENERAL
	// balance from the admin console, capped by the admin context (never a login/attendance bonus
	// [G3] — this is a discretionary support/promotion grant, not a recurring earn).
	ReasonAdminGrant EntryReason = "admin_grant"
)

// LedgerEntry is one append-only earn/spend log row ([I1] spirit — history is never updated
// or deleted). DedupKey makes a retried earn/spend idempotent; nil opts out of dedup.
type LedgerEntry struct {
	ID          string
	Kind        EntryKind
	Reason      EntryReason
	Amount      int
	FromSmall   int
	FromGeneral int
	DedupKey    *string
	CreatedAt   time.Time
}

// SpendPlan is PlanSpend's per-kind draw: how much of a cost comes from SMALL and how much from
// GENERAL, plus whether the GENERAL part actually fits. It plans; it never writes.
type SpendPlan struct {
	FromSmall   int
	FromGeneral int
	OK          bool
}

// ResetWindowOf is the SMALL refill boundary: the user's own LOCAL calendar date ([G2][U7]),
// returned as that date at UTC midnight so it is directly comparable with — and writable as — the
// stored DATE anchor. A nil or unresolved zone reads as UTC, deterministically and without error:
// [G5] forbids a missing zone from denying a refill, so the fallback is today's shipped behavior,
// never a block.
func ResetWindowOf(now time.Time, zone *time.Location) time.Time {
	local := now.In(zoneOrUTC(zone))
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

// SmallRemaining derives the SMALL kind from the daily grant, the reset anchor, and the SMALL spend
// inside the current window ([G2]). The window is the user's local calendar day — the one
// intentional real-time crossing in the otherwise diary-driven engine (real time may PACE a grant
// here; it is never a measured condition), because the economy paces the user's real-world daily
// recall habit ([M5][G5]) and a universe-time refill would never refill a user who only views. The
// reset is lazy — `now` is an argument (no clock read, no cron [T4]): a local date later than the
// anchor simply derives a fresh full grant (unspent prior SMALL is discarded, no carry), and the
// row's anchor rolls forward on the next write. A local date at or before the anchor derives
// conservatively as the anchored window (grant − spent), so the derivation never over-grants — that
// is also what makes a westward timezone change unable to mint a second grant.
func SmallRemaining(now time.Time, zone *time.Location, resetWindow time.Time, spentThisWindow int) int {
	grant := values.TwinkleSmallDailyAmount
	if ResetWindowOf(now, zone).After(ResetWindowOf(resetWindow, time.UTC)) {
		return grant
	}
	return clampInt(grant-max(0, spentThisWindow), 0, grant)
}

// DeriveBalance reads the two-kind Balance off the stored record at `now` ([G2]): Small is the
// SmallRemaining derivation, General the stored carrying counter. A nil record (no row yet) is
// represented by the caller as a zero BalanceRecord, whose stale anchor derives a full grant —
// lazy birth.
func DeriveBalance(now time.Time, zone *time.Location, record BalanceRecord) Balance {
	return Balance{
		Small:   SmallRemaining(now, zone, record.SmallResetWindow, record.SmallSpentThisWindow),
		General: max(0, record.General),
	}
}

// SmallEligible answers the one question the SMALL kind exists to answer ([G5][P9]): may this
// purpose be paid from today's recall allowance? A closed switch over the recall family with a
// FALSE default arm — an unlisted or later-added SpendKind is ineligible by construction, so
// decoration spending can never reach the recall budget by omission ([I11]). The eligible set is
// not a new judgment: it is the shipped paid-read set (memory.PaidActionKind), and [G4] prices a
// diary jump as the sum of its per-memory recalls, so a diary recall IS a recall.
func SmallEligible(kind SpendKind) bool {
	switch kind {
	case SpendKindRecall, SpendKindGistView, SpendKindDiaryRecall:
		return true
	default:
		return false
	}
}

// PlanSpend plans how a cost is drawn from the two kinds ([G2][G5][P9]). For the recall family
// SMALL is exhausted before GENERAL is touched, so everyday recall inside the daily grant never
// spends the permanent balance; for every other purpose FromSmall is 0 — that zero, not a caller's
// discipline, is what makes "SMALL bought an ornament" unrepresentable. OK is false when the
// GENERAL part exceeds the GENERAL balance — the use-case refuses; this function only plans, never
// writes, and neither kind can go negative.
func PlanSpend(smallRemaining int, general int, cost int, kind SpendKind) SpendPlan {
	boundedGeneral := max(0, general)
	boundedCost := max(0, cost)
	fromSmall := 0
	if SmallEligible(kind) {
		fromSmall = min(boundedCost, max(0, smallRemaining))
	}
	fromGeneral := boundedCost - fromSmall
	return SpendPlan{
		FromSmall:   fromSmall,
		FromGeneral: fromGeneral,
		OK:          fromGeneral <= boundedGeneral,
	}
}

// ShortfallFor is how much a spend is short of the kinds that may actually pay for it ([G4][P9]):
// SMALL counts only for an eligible purpose, so a quote for a SMALL-ineligible purpose never
// reports itself covered by an allowance it cannot spend. 0 when the plan fits.
func ShortfallFor(smallRemaining int, general int, cost int, kind SpendKind) int {
	plan := PlanSpend(smallRemaining, general, cost, kind)
	if plan.OK {
		return 0
	}
	return plan.FromGeneral - max(0, general)
}

// RecallCost prices a 회고 (recall) from the accessibility/cost weight the forgetting unit
// computes ([F4][G4]) — CC3: D computes "how decayed → how inaccessible", this context alone
// computes "how inaccessible → how many Twinkle"; no decay math and no price constant cross
// that line. Non-decreasing in the weight (deeper decay never costs less) and clamped to
// twinkle.recall_max_cost so a silent engram stays recallable within a plausible balance
// ([G5]). The curve shape (base + linear depth term, rounded) is code; only the coefficients
// are values.
func RecallCost(accessibilityCost float64) int {
	depth := math.Max(0, accessibilityCost)
	cost := math.Round(values.TwinkleRecallBaseCost + values.TwinkleRecallDepthCoefficient*depth)
	// Clamp in float space before the int conversion: a deep-enough weight drives the linear
	// term past int64's range, and a raw float→int of that overflows to a negative value that
	// would floor to 0 rather than the cap. Any cost at or above the ceiling is the ceiling.
	if cost >= float64(values.TwinkleRecallMaxCost) {
		return values.TwinkleRecallMaxCost
	}
	return clampInt(int(cost), 0, values.TwinkleRecallMaxCost)
}

// GistViewCost prices a 요지 별 열람 from the semantic_stage the semanticization unit computes
// ([R8][G4]): the deeper the gist, the cheaper the skim — non-increasing in stage, floored at
// twinkle.gist_min_cost (cheap but never free; the free surface is meta info and the forgotten
// current text [G1], not a gist read). Defined over the gistified stages 1..max (stage 0 has
// no gist representation to view); inputs below 1 price as stage 1.
func GistViewCost(semanticStage int) int {
	stage := max(1, semanticStage)
	cost := values.TwinkleGistBaseCost - values.TwinkleGistStageDiscount*(stage-1)
	return max(values.TwinkleGistMinCost, cost)
}

// LocationOf resolves an IANA zone NAME to the location the boundary is read in. Empty, blank and
// unknown names all resolve to UTC without an error — the [G5] direction, since a refill may never
// be denied for want of a resolvable profile. It lives here rather than in the service so the golden
// fixture can carry zone names and both language mirrors read them by the same rule; cmd/api and
// cmd/worker import time/tzdata, which is what makes this hermetic on the distroless image.
//
// "Local" is rejected explicitly: time.LoadLocation accepts it as a Go-specific alias for the
// PROCESS's zone, which would read a user's day in whatever zone the server happens to run in — and
// the TS mirror, which resolves through Intl, has no such alias and would read UTC. Treating it as
// unusable keeps the two sides identical and keeps the boundary the user's, not the deployment's.
func LocationOf(name string) *time.Location {
	trimmed := strings.TrimSpace(name)
	if strings.EqualFold(trimmed, "Local") {
		return time.UTC
	}
	location, err := time.LoadLocation(trimmed)
	if err != nil {
		return time.UTC
	}
	return location
}

// zoneOrUTC is the deterministic zone fallback ([G5]): an unbound zone reads as UTC rather than
// erroring, because a refill may never be denied for want of a profile.
func zoneOrUTC(zone *time.Location) *time.Location {
	if zone == nil {
		return time.UTC
	}
	return zone
}

func clampInt(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}
