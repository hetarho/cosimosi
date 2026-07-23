// Package twinkle is the 별가루 (Twinkle) recall-economy bounded context ([G1]–[G5]):
// the two-tier balance (basic daily-reset non-carrying + additional permanent carrying), the
// spend order (basic first, additional for overflow), and the two price curves (recall rises
// with decay-depth, gist view falls with gist-depth). It is standalone — it never imports
// internal/memory; memory reaches its spend through a consumer-owned SpendGate port wired at
// the composition root (CC2/CC8). Every function here is pure and IO-free, mirrored TS↔Go in
// packages/twinkle-logic and pinned by testdata/stardust-ledger-golden.json, so the FE prices
// a recall pre-spend while the balance itself stays server-authoritative (twinkle/pg).
package twinkle

import (
	"math"
	"time"

	"github.com/cosimosi/api/internal/platform/values"
)

// Balance is the two-tier Twinkle aggregate ([G2]): Basic is the daily-reset, non-carrying
// allowance (a derivation, never a stored counter); Additional is the permanent, carrying
// balance charges accumulate ([G3]). Both are whole Twinkle units.
type Balance struct {
	Basic      int
	Additional int
}

// Total is the spendable whole the client renders ([G2]): basic + additional.
func (b Balance) Total() int {
	return b.Basic + b.Additional
}

// BalanceRecord is the stored authoritative fact set the balance row holds — the permanent
// balance plus the lazy basic-reset anchor. Basic is derived from it at read (DeriveBalance),
// exactly as the universe clock stores an anchor and derives elapsed.
type BalanceRecord struct {
	Additional           int
	BasicSpentThisWindow int
	BasicResetWindow     time.Time
}

// EntryKind is the ledger-log direction: an entry either earns or spends, never both. The
// amount column stays positive; the kind gives the sign.
type EntryKind string

const (
	EntryKindEarn  EntryKind = "earn"
	EntryKindSpend EntryKind = "spend"
)

// EntryReason is the closed earn/spend source set ([G3][G1]) — a TEXT closed set like
// neuron_type, not a PG enum. Earn reasons: payment, invite, write_diary, admin_grant. Spend
// reasons: recall (회고), gist_view (요지 별 열람).
type EntryReason string

const (
	ReasonPayment    EntryReason = "payment"
	ReasonInvite     EntryReason = "invite"
	ReasonWriteDiary EntryReason = "write_diary"
	ReasonRecall     EntryReason = "recall"
	ReasonGistView   EntryReason = "gist_view"
	// ReasonAdminGrant is an operator gift (별가루 증정, the admin console): credited to additional balance
	// from the admin console, capped by the admin context (never a login/attendance bonus [G3] —
	// this is a discretionary support/promotion grant, not a recurring earn).
	ReasonAdminGrant EntryReason = "admin_grant"
)

// LedgerEntry is one append-only earn/spend log row ([I1] spirit — history is never updated
// or deleted). DedupKey makes a retried earn/spend idempotent; nil opts out of dedup.
type LedgerEntry struct {
	ID             string
	Kind           EntryKind
	Reason         EntryReason
	Amount         int
	FromBasic      int
	FromAdditional int
	DedupKey       *string
	CreatedAt      time.Time
}

// SpendPlan is PlanSpend's per-tier draw: how much of a cost comes from basic and how much
// overflows to additional, plus whether the overflow actually fits. It plans; it never writes.
type SpendPlan struct {
	FromBasic      int
	FromAdditional int
	OK             bool
}

// BasicRemaining derives the basic tier from the daily grant, the reset anchor, and the basic
// spend inside the current window ([G2]). The reset window is the REAL UTC calendar day —
// deliberately distinct from universe time, and the one intentional real-time crossing in the
// otherwise diary-driven engine (isolated to this context; the ai.daily_call_cap UTC-day
// convention reused): the economy paces the user's real-world daily recall habit ([M5][G5]),
// and a universe-time refill would never refill a user who only views. The reset is lazy —
// `now` is an argument (no clock read, no cron [T4]); a now in a later UTC day than the anchor
// simply derives as a fresh full grant (unspent prior basic is discarded, no carry), and the
// row's anchor rolls forward on the next write. A now at/before the anchor's day derives
// conservatively as the anchored window (grant − spent) — the derivation never over-grants.
func BasicRemaining(now time.Time, resetWindow time.Time, spentThisWindow int) int {
	grant := values.TwinkleBasicDailyAmount
	if utcDay(now) > utcDay(resetWindow) {
		return grant
	}
	return clampInt(grant-max(0, spentThisWindow), 0, grant)
}

// DeriveBalance reads the two-tier Balance off the stored record at `now` ([G2]): basic is the
// BasicRemaining derivation, additional the stored carrying counter. A nil record (no row yet)
// is represented by the caller as a zero BalanceRecord with today's window — lazy birth.
func DeriveBalance(now time.Time, record BalanceRecord) Balance {
	return Balance{
		Basic:      BasicRemaining(now, record.BasicResetWindow, record.BasicSpentThisWindow),
		Additional: max(0, record.Additional),
	}
}

// PlanSpend plans how a cost is drawn from the two tiers ([G2][G5]): basic is exhausted before
// additional is touched, so everyday recall inside the daily grant never spends the paid
// wallet. OK is false when the overflow exceeds additional — the use-case rejects or charges;
// this function only plans, never writes, and neither tier can go negative.
func PlanSpend(basicRemaining int, additional int, cost int) SpendPlan {
	boundedBasic := max(0, basicRemaining)
	boundedAdditional := max(0, additional)
	boundedCost := max(0, cost)
	fromBasic := min(boundedCost, boundedBasic)
	fromAdditional := boundedCost - fromBasic
	return SpendPlan{
		FromBasic:      fromBasic,
		FromAdditional: fromAdditional,
		OK:             fromAdditional <= boundedAdditional,
	}
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

// utcDay is the reset-window rule, date(now, UTC), as a comparable whole-day count. The rule
// itself is code, not a value (the values.yaml exclusion rule).
func utcDay(value time.Time) int {
	utc := value.UTC()
	return int(time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC).Unix() / 86400)
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
