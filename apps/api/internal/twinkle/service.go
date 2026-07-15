package twinkle

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// The earn/spend use-cases — the orchestration of the Twinkle economy over the
// pure ledger model in ledger.go: the real SpendGate the recall/gist-view
// consumers call ([CC2][G1]), the three earn paths (write / invite / verified
// payment, [G3]), the balance read, and the server quote ([G4]). Every policy —
// pricing, spend order, earn reasons, idempotency, valid-signup — lives here or in
// the pure domain, never in a handler (§2.9#7). There is deliberately NO
// login/attendance earn path ([G3]): the daily basic reset is that role.

var (
	ErrLedgerRequired      = errors.New("twinkle service requires a ledger repo")
	ErrVerifierRequired    = errors.New("twinkle service requires a store payment verifier")
	ErrValidSignupRequired = errors.New("twinkle service requires a valid-signup predicate")
	ErrSignalsRequired     = errors.New("twinkle service requires a spend-signal reader")
	// ErrScopeRequired mirrors the transport guard: every derivation, quote, earn,
	// and spend is scoped to an authenticated user (§4).
	ErrScopeRequired = errors.New("twinkle requires an authenticated user scope")
	// ErrEarnTxRequired is the wiring fault of a write grant fired outside its
	// launch transaction — the grant must commit or roll back with the launch.
	ErrEarnTxRequired = errors.New("twinkle write earn requires the launch transaction")
	// ErrInsufficientTwinkle is the canonical spend denial ([G1]): the plan does not
	// fit the two tiers, nothing is written, the caller's action is refused ([I1] —
	// refused, never erased).
	ErrInsufficientTwinkle = errors.New("insufficient twinkle for this action")
	// ErrSpendIntentInvalid rejects a SpendIntent whose reason is not a spend
	// reason — a composition fault, not a user input.
	ErrSpendIntentInvalid = errors.New("twinkle spend intent carries no spendable reason")
	// ErrInviteInputRequired / ErrInviteNotEligible are the invite claim's canonical
	// refusals: an empty code, and a pair the valid-signup predicate declines ([G6]).
	ErrInviteInputRequired = errors.New("invite claim requires an invite code")
	ErrInviteNotEligible   = errors.New("invite claim is not an eligible signup")
	// ErrChargeInputRequired / ErrPaymentNotVerified guard the payment path ([G3]):
	// nothing credits without a verified receipt for a known pack.
	ErrChargeInputRequired = errors.New("charge requires a pack, platform, and receipt")
	ErrPaymentNotVerified  = errors.New("store payment receipt is not verified")
	// ErrQuoteInputRequired rejects a quote without a kind and its target id.
	ErrQuoteInputRequired = errors.New("spend quote requires a kind and a target id")
	// ErrQuoteTargetNotFound / ErrQuoteTargetUnavailable are the canonical quote-target
	// refusals the composition root maps the signal reader's context errors onto
	// (CC8 — this context names the refusal, never the memory error): no such target
	// for the caller, and a target that exists but cannot be quoted (soft-deleted, or
	// a gist that has not risen).
	ErrQuoteTargetNotFound    = errors.New("spend quote target not found")
	ErrQuoteTargetUnavailable = errors.New("spend quote target is unavailable")
)

// DefaultChargePackID is the single v1 payment pack ([G3]); its grant size is
// twinkle.charge_pack. A multi-pack catalog is content for a later unit, not a
// scalar — new packs extend the verifier, not this contract.
const DefaultChargePackID = "twinkle_pack_default"

// SpendIntent is what a metered action hands the gate: the spend reason and the
// depth signal that prices it — the accessibility cost weight for a recall, the
// viewed gist stage for a gist view ([CC3][G4]). It carries no price and no memory
// type; the composition root maps the consumer's intent onto it.
type SpendIntent struct {
	Reason            EntryReason
	AccessibilityCost float64
	SemanticStage     int
}

// QuoteKind names the spend a quote prices ([G4]): the same recall/gist-view
// actions the gate meters, plus the whole-diary recall batch ([D3]).
type QuoteKind string

const (
	QuoteKindRecall      QuoteKind = "recall"
	QuoteKindGistView    QuoteKind = "gist_view"
	QuoteKindDiaryRecall QuoteKind = "diary_recall"
)

// Quote is the server-derived spend preview ([G4]): the priced cost, whether the
// current balance covers it, and the shortfall to charge when it does not. Advisory
// only — CheckAndSpend re-derives everything at action time.
type Quote struct {
	Cost      int
	Covered   bool
	Shortfall int
}

// Service owns the earn/spend use-cases. All concretes arrive through the
// consumer-owned ports; cross-context signals arrive as scalars (CC8).
type Service struct {
	ledger      LedgerRepo
	verifier    StorePaymentVerifier
	validSignup ValidSignup
	signals     SpendSignalReader
	now         func() time.Time
	newID       func() string
}

type ServiceDeps struct {
	Ledger   LedgerRepo
	Verifier StorePaymentVerifier
	// ValidSignup is the [G6] seam; bind DistinctSignup for the permissive default.
	ValidSignup ValidSignup
	Signals     SpendSignalReader
	// Now/NewID are test seams; nil selects the real UTC clock and the platform id.
	Now   func() time.Time
	NewID func() string
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Ledger == nil {
		return nil, ErrLedgerRequired
	}
	if deps.Verifier == nil {
		return nil, ErrVerifierRequired
	}
	if deps.ValidSignup == nil {
		return nil, ErrValidSignupRequired
	}
	if deps.Signals == nil {
		return nil, ErrSignalsRequired
	}
	service := &Service{
		ledger:      deps.Ledger,
		verifier:    deps.Verifier,
		validSignup: deps.ValidSignup,
		signals:     deps.Signals,
		now:         deps.Now,
		newID:       deps.NewID,
	}
	if service.now == nil {
		service.now = func() time.Time { return time.Now().UTC() }
	}
	if service.newID == nil {
		service.newID = platform.NewID
	}
	return service, nil
}

// GetBalance derives the two-tier balance at real now ([G2]): a read, never a
// write — no row is born, no window rolls forward, nothing is earned or spent. An
// absent row is the lazy-birth default (full basic, zero additional).
func (s *Service) GetBalance(ctx context.Context, scope platform.UserScope) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	record, err := s.ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return Balance{}, err
	}
	return DeriveBalance(s.now(), recordOrLazyBirth(record)), nil
}

// CheckAndSpend is the real spend gate ([CC2][G1]): price the intent from its depth
// signal via the kind-split curves, derive the balance, plan the draw basic-first
// ([G2]), and — only when the plan fits — append the spend row and apply the guarded
// delta. On a plan that does not fit it returns the canonical ErrInsufficientTwinkle
// and writes nothing: the caller's action is refused, not partially charged, and
// nothing is ever deleted ([I1]). ledger is the caller's transaction-bound store
// (the composition-root economy seam) so the spend commits or rolls back with the
// recall it gates; a nil ledger (the tx-less gist view) runs the spend in its own
// transaction.
func (s *Service) CheckAndSpend(ctx context.Context, scope platform.UserScope, ledger LedgerStore, intent SpendIntent) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if ledger != nil {
		return s.checkAndSpend(ctx, scope, ledger, intent)
	}
	return s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		return s.checkAndSpend(ctx, scope, tx, intent)
	})
}

func (s *Service) checkAndSpend(ctx context.Context, scope platform.UserScope, ledger LedgerStore, intent SpendIntent) error {
	cost, err := spendPrice(intent)
	if err != nil {
		return err
	}
	if cost == 0 {
		// A zero-priced action spends nothing; the ledger stays clean (the log
		// CHECKs amount > 0, and a zero row would record a non-event).
		return nil
	}
	record, err := ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return err
	}
	now := s.now()
	balance := DeriveBalance(now, recordOrLazyBirth(record))
	plan := PlanSpend(balance.Basic, balance.Additional, cost)
	if !plan.OK {
		return ErrInsufficientTwinkle
	}
	if _, err := ledger.AppendLedgerEntry(ctx, scope, LedgerEntry{
		ID:             s.newID(),
		Kind:           EntryKindSpend,
		Reason:         intent.Reason,
		Amount:         cost,
		FromBasic:      plan.FromBasic,
		FromAdditional: plan.FromAdditional,
		CreatedAt:      now,
	}); err != nil {
		return err
	}
	_, err = ledger.ApplyBalanceDelta(ctx, scope, now, -plan.FromAdditional, plan.FromBasic)
	return err
}

// spendPrice maps a SpendIntent to its Twinkle cost through the kind-split curves
// ([CC3][G4]) — the only place a spend is priced; callers never compute or carry a
// price.
func spendPrice(intent SpendIntent) (int, error) {
	switch intent.Reason {
	case ReasonRecall:
		return RecallCost(intent.AccessibilityCost), nil
	case ReasonGistView:
		return GistViewCost(intent.SemanticStage), nil
	default:
		return 0, fmt.Errorf("%w: %q", ErrSpendIntentInvalid, intent.Reason)
	}
}

// EarnOnWrite is the write grant ([G3]): one fixed earn per launched diary,
// credited to additional, dedup-keyed by the diary id so a diary can never grant
// twice — not per memory, so splitting a diary into more memories inflates nothing.
// ledger must be the launch's transaction-bound store: the grant lands atomically
// with the launch or not at all.
func (s *Service) EarnOnWrite(ctx context.Context, scope platform.UserScope, ledger LedgerStore, diaryID string) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if ledger == nil {
		return ErrEarnTxRequired
	}
	if strings.TrimSpace(diaryID) == "" {
		return fmt.Errorf("%w: write earn requires a diary id", ErrEarnTxRequired)
	}
	_, err := s.earn(ctx, scope, ledger, ReasonWriteDiary, values.TwinkleEarnWrite, "write_diary:"+diaryID)
	return err
}

// ClaimInvite credits both invite sides on a valid signup ([G3][G6]): the invitee
// (the authenticated caller redeeming a code) and the inviter the code resolves to.
// The invite code IS the inviter's user id — share links carry it; there is no
// invite-code table (the ledger pair is the economy's whole schema), so resolution
// is identity. Idempotency is two-layered: the invitee-side entry is keyed
// once-per-signup (a second claim by the same account — same or different code —
// is a replay and credits no one), and the inviter-side entry is keyed per
// (inviter, invitee), so a single signup credits each side exactly once. Replay
// returns the same balance.
func (s *Service) ClaimInvite(ctx context.Context, scope platform.UserScope, inviteCode string) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	inviterID := strings.TrimSpace(inviteCode)
	if inviterID == "" {
		return Balance{}, ErrInviteInputRequired
	}
	valid, err := s.validSignup(ctx, inviterID, scope.UserID())
	if err != nil {
		return Balance{}, err
	}
	if !valid {
		return Balance{}, ErrInviteNotEligible
	}
	inviterScope, err := platform.NewUserScope(inviterID)
	if err != nil {
		return Balance{}, ErrInviteInputRequired
	}
	err = s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		applied, err := s.earn(ctx, scope, tx, ReasonInvite, values.TwinkleEarnInviteInvitee,
			"invite_signup:"+scope.UserID())
		if err != nil {
			return err
		}
		if !applied {
			// The signup was already claimed — the whole claim is a replay, so the
			// inviter side is skipped too (exactly once per signup, both sides).
			return nil
		}
		_, err = s.earn(ctx, inviterScope, tx, ReasonInvite, values.TwinkleEarnInviteInviter,
			"invite:"+inviterID+":"+scope.UserID())
		return err
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
}

// Charge is the payment earn ([G3]): verify the store receipt through the
// StorePaymentVerifier port first, and only a verified receipt credits additional
// balance — by the verifier-returned authoritative amount, idempotent per the
// verifier-returned key, so a replayed receipt credits exactly once. No
// verification, no value.
func (s *Service) Charge(ctx context.Context, scope platform.UserScope, packID string, platformName string, receipt string) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	if strings.TrimSpace(packID) == "" || strings.TrimSpace(platformName) == "" || strings.TrimSpace(receipt) == "" {
		return Balance{}, ErrChargeInputRequired
	}
	verified, err := s.verifier.Verify(ctx, PaymentReceipt{PackID: packID, Platform: platformName, Receipt: receipt})
	if err != nil {
		return Balance{}, err
	}
	if verified.Amount <= 0 || verified.DedupKey == "" {
		return Balance{}, ErrPaymentNotVerified
	}
	err = s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		_, err := s.earn(ctx, scope, tx, ReasonPayment, verified.Amount, verified.DedupKey)
		return err
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
}

// QuoteSpend is CheckAndSpend's read-only twin ([G4]): resolve the authoritative
// depth signal server-side, price with the same curves, derive the same balance,
// plan the same draw — and write nothing: no ledger row, no window roll, no clock
// advance. A stale quote is simply refused later by the authoritative spend.
func (s *Service) QuoteSpend(ctx context.Context, scope platform.UserScope, kind QuoteKind, targetID string) (Quote, error) {
	if scope.UserID() == "" {
		return Quote{}, ErrScopeRequired
	}
	if strings.TrimSpace(targetID) == "" {
		return Quote{}, ErrQuoteInputRequired
	}
	cost, err := s.quoteCost(ctx, scope, kind, targetID)
	if err != nil {
		return Quote{}, err
	}
	record, err := s.ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return Quote{}, err
	}
	balance := DeriveBalance(s.now(), recordOrLazyBirth(record))
	plan := PlanSpend(balance.Basic, balance.Additional, cost)
	shortfall := 0
	if !plan.OK {
		shortfall = cost - balance.Basic - balance.Additional
	}
	return Quote{Cost: cost, Covered: plan.OK, Shortfall: shortfall}, nil
}

func (s *Service) quoteCost(ctx context.Context, scope platform.UserScope, kind QuoteKind, targetID string) (int, error) {
	switch kind {
	case QuoteKindRecall:
		weight, err := s.signals.RecallAccessibility(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		return RecallCost(weight), nil
	case QuoteKindGistView:
		stage, err := s.signals.ViewableGistStage(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		return GistViewCost(stage), nil
	case QuoteKindDiaryRecall:
		weights, err := s.signals.DiaryRecallAccessibilities(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		// The diary's cost is the sum of its per-memory recalls ([D3]) — the same
		// per-memory pricing RecallDiaryStars spends at action time.
		total := 0
		for _, weight := range weights {
			total += RecallCost(weight)
		}
		return total, nil
	default:
		return 0, fmt.Errorf("%w: kind %q", ErrQuoteInputRequired, kind)
	}
}

// earn appends one dedup-keyed earn entry and, when it genuinely applied (not a
// replay), credits additional balance ([G2] — basic is the daily reset and is never
// earned). The append goes first so a replayed pair skips the delta — end-to-end
// idempotency per key. Returns whether this call applied.
func (s *Service) earn(ctx context.Context, scope platform.UserScope, ledger LedgerStore, reason EntryReason, amount int, dedupKey string) (bool, error) {
	key := dedupKey
	applied, err := ledger.AppendLedgerEntry(ctx, scope, LedgerEntry{
		ID:        s.newID(),
		Kind:      EntryKindEarn,
		Reason:    reason,
		Amount:    amount,
		DedupKey:  &key,
		CreatedAt: s.now(),
	})
	if err != nil {
		return false, err
	}
	if !applied {
		return false, nil
	}
	if _, err := ledger.ApplyBalanceDelta(ctx, scope, s.now(), amount, 0); err != nil {
		return false, err
	}
	return true, nil
}

// recordOrLazyBirth is the absent-row default: a user who never earned or spent
// derives a full basic grant with zero additional (the zero record's stale window
// derives fresh).
func recordOrLazyBirth(record *BalanceRecord) BalanceRecord {
	if record == nil {
		return BalanceRecord{}
	}
	return *record
}
