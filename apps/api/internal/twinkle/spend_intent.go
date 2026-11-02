package twinkle

import (
	"fmt"
	"strconv"
)

// SpendIntent is what a metered action hands the gate: the spend's reason, the signal that prices it,
// and the operation-derived dedup key that makes the spend idempotent. It carries no memory type and
// no store type; the composition root maps the consumer's intent onto it.
//
// The fields are UNEXPORTED and the three constructors below are the only way to build one, because
// the mix that must be impossible is a value question, not a validation question: a recall intent has
// no field for an amount, so a caller can never set a recall's own price — pricing belongs to
// the curves alone — and a purchase intent has no field for a decay depth or a gist stage, so a curve
// can never price an ornament.
//
// An empty dedup key opts a spend out of dedup (the append then guards only backend-minted id
// collisions); a real paid action always supplies one, so a duplicate append applies no second
// balance delta.
type SpendIntent struct {
	reason            EntryReason
	accessibilityCost float64
	semanticStage     int
	amount            int
	dedupKey          string
}

// RecallSpendIntent meters a 회고: the accessibility cost weight the forgetting unit computed is the
// only signal, and RecallCost turns it into a price ([G4]).
func RecallSpendIntent(accessibilityCost float64, dedupKey string) SpendIntent {
	return SpendIntent{reason: ReasonRecall, accessibilityCost: accessibilityCost, dedupKey: dedupKey}
}

// GistViewSpendIntent meters a 요지 별 열람 at the stage the reader selected ([R8][G4]).
func GistViewSpendIntent(semanticStage int, dedupKey string) SpendIntent {
	return SpendIntent{reason: ReasonGistView, semanticStage: semanticStage, dedupKey: dedupKey}
}

// PurchaseSpendIntent meters an ornament purchase ([P9]). `amount` is the caller's AUTHORITATIVE
// catalog total — twinkle is told what it costs and never learns what was bought, so an ornament id,
// kind or color cannot reach the ledger ([I11]).
func PurchaseSpendIntent(amount int, dedupKey string) SpendIntent {
	return SpendIntent{reason: ReasonOrnamentPurchase, amount: amount, dedupKey: dedupKey}
}

// SpendKind names the PURPOSE a spend is planned against ([G4][P9]) — the recall/gist-view actions
// the gate meters, the whole-diary recall batch ([D3]), and an ornament purchase. It is what
// SmallEligible reads, and it stays distinct from EntryReason, the persisted ledger vocabulary: a
// DIARY_RECALL spend still writes one `recall` row per member memory.
//
// The set is deliberately a SUPERSET of the wire enum twinkle.v1.SpendKind, which carries no
// PURCHASE value: no client can ask the recall pricer to price an ornament, and a purchase reaches
// the economy only through the store context's internal spend gate.
type SpendKind string

const (
	SpendKindRecall      SpendKind = "recall"
	SpendKindGistView    SpendKind = "gist_view"
	SpendKindDiaryRecall SpendKind = "diary_recall"
	SpendKindPurchase    SpendKind = "purchase"
)

// Quote is the server-derived spend preview ([G4]): the priced cost, whether the
// current balance covers it, and the shortfall to charge when it does not. Advisory
// only — CheckAndSpend re-derives everything at action time.
type Quote struct {
	Cost      int
	Covered   bool
	Shortfall int
}

// InsufficientTwinkle is the denial with its arithmetic attached ([G1][P8]), so a consumer can tell
// the user HOW MUCH they are short without twinkle knowing what they were buying. Eligible is the
// balance actually usable for THIS purpose — GENERAL alone for a purchase, both kinds for the recall
// family — which is why a purchase can be refused at a balance that would have covered a recall.
//
// It wraps the canonical sentinel, so every errors.Is(err, ErrInsufficientTwinkle) site keeps working,
// including memory's gate mapping and twinklepg's raced-overdraw rejection.
type InsufficientTwinkle struct {
	Cost      int
	Eligible  int
	Shortfall int
}

func (e *InsufficientTwinkle) Error() string {
	return fmt.Sprintf("%s: cost %d exceeds the %d eligible for this purpose (short %d)",
		ErrInsufficientTwinkle.Error(), e.Cost, e.Eligible, e.Shortfall)
}

func (e *InsufficientTwinkle) Unwrap() error { return ErrInsufficientTwinkle }

// Detail is the denial as the shipped apperr metadata channel carries it — the one way this reaches a
// client. The consumer names the item; twinkle only names the numbers.
func (e *InsufficientTwinkle) Detail() map[string]string {
	return map[string]string{
		"cost":      strconv.Itoa(e.Cost),
		"eligible":  strconv.Itoa(e.Eligible),
		"shortfall": strconv.Itoa(e.Shortfall),
	}
}

func newInsufficientTwinkle(balance Balance, cost int, kind SpendKind) *InsufficientTwinkle {
	eligible := max(0, balance.General)
	if SmallEligible(kind) {
		eligible += max(0, balance.Small)
	}
	return &InsufficientTwinkle{
		Cost:      cost,
		Eligible:  eligible,
		Shortfall: ShortfallFor(balance.Small, balance.General, cost, kind),
	}
}
