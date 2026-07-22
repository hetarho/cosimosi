package twinkle

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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
// pricing, spend order, earn reasons, idempotency, and trusted-claim validation — lives here or in
// the pure domain, never in a handler (§2.9#7). There is deliberately NO
// login/attendance earn path ([G3]): the daily basic reset is that role.

var (
	ErrLedgerRequired         = errors.New("twinkle service requires a ledger repo")
	ErrVerifierRequired       = errors.New("twinkle service requires a store payment verifier")
	ErrInviteResolverRequired = errors.New("twinkle service requires an invite resolver")
	ErrSignalsRequired        = errors.New("twinkle service requires a spend-signal reader")
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
	// Invite refusals reveal no account-directory detail to the transport.
	ErrInviteInputRequired         = errors.New("invite claim requires an invite code")
	ErrInviteResolutionUnavailable = errors.New("invite verification is unavailable")
	ErrInviteBeneficiaryMismatch   = errors.New("invite claim beneficiary does not match the authenticated user")
	ErrInviteNotEligible           = errors.New("invite claim is not an eligible signup")
	ErrInviteGrantConflict         = errors.New("invite signup grant is inconsistent with existing ledger state")
	// Payment refusals reveal no provider or receipt detail to the transport.
	ErrChargeInputRequired            = errors.New("charge requires a pack, provider, and receipt")
	ErrPaymentVerificationUnavailable = errors.New("store payment verification is unavailable")
	ErrPaymentBeneficiaryMismatch     = errors.New("payment beneficiary does not match the authenticated user")
	ErrPaymentNotVerified             = errors.New("store payment transaction is not verified")
	// ErrQuoteInputRequired rejects a quote without its required action inputs.
	ErrQuoteInputRequired = errors.New("spend quote requires a kind, target id, and action inputs")
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

// SpendIntent is what a metered action hands the gate: the spend reason, the depth signal
// that prices it — the accessibility cost weight for a recall, the viewed gist stage for a gist
// view ([CC3][G4]) — and the operation-derived dedup key that makes the spend idempotent. It
// carries no price and no memory type; the composition root maps the consumer's intent onto it.
// DedupKey empty opts a spend out of dedup (the append then guards only backend-minted id
// collisions); a real paid action always supplies one, so a duplicate append applies no second
// balance delta (A3).
type SpendIntent struct {
	Reason            EntryReason
	AccessibilityCost float64
	SemanticStage     int
	DedupKey          string
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
	ledger         LedgerRepo
	verifier       StorePaymentVerifier
	inviteResolver InviteResolver
	signals        SpendSignalReader
	now            func() time.Time
	newID          func() string
}

type ServiceDeps struct {
	Ledger         LedgerRepo
	Verifier       StorePaymentVerifier
	InviteResolver InviteResolver
	Signals        SpendSignalReader
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
	if deps.InviteResolver == nil {
		return nil, ErrInviteResolverRequired
	}
	if deps.Signals == nil {
		return nil, ErrSignalsRequired
	}
	service := &Service{
		ledger:         deps.Ledger,
		verifier:       deps.Verifier,
		inviteResolver: deps.InviteResolver,
		signals:        deps.Signals,
		now:            deps.Now,
		newID:          deps.NewID,
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
	// Append the dedup-keyed spend row FIRST — exactly like earn: a false means this
	// operation's spend already landed (a duplicate/replay), so skip the balance delta and the
	// draw is applied once end to end (A3). This is the spend-side idempotency the recall/view
	// receipt layer backstops; together, no retry double-charges.
	var dedupKey *string
	if intent.DedupKey != "" {
		key := intent.DedupKey
		dedupKey = &key
	}
	applied, err := ledger.AppendLedgerEntry(ctx, scope, LedgerEntry{
		ID:             s.newID(),
		Kind:           EntryKindSpend,
		Reason:         intent.Reason,
		Amount:         cost,
		FromBasic:      plan.FromBasic,
		FromAdditional: plan.FromAdditional,
		DedupKey:       dedupKey,
		CreatedAt:      now,
	})
	if err != nil {
		return err
	}
	if !applied {
		return nil
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

// ClaimInvite resolves the opaque code through the trusted account/signup seam
// before opening the atomic ledger transaction. Only the returned signup identity
// and account ids participate in validation and deduplication; caller-shaped ids
// never carry value.
func (s *Service) ClaimInvite(ctx context.Context, scope platform.UserScope, inviteCode string) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	code := strings.TrimSpace(inviteCode)
	if code == "" {
		return Balance{}, ErrInviteInputRequired
	}
	resolved, err := s.inviteResolver.Resolve(ctx, InviteResolutionRequest{
		InviteCode:    code,
		InviteeUserID: scope.UserID(),
	})
	if err != nil {
		if errors.Is(err, ErrInviteResolutionUnavailable) {
			return Balance{}, ErrInviteResolutionUnavailable
		}
		return Balance{}, ErrInviteNotEligible
	}
	signupID := resolved.SignupID
	inviterID := resolved.InviterUserID
	inviteeID := resolved.InviteeUserID
	if inviteeID != scope.UserID() {
		return Balance{}, ErrInviteBeneficiaryMismatch
	}
	if !isCanonicalClaimID(signupID) || !isCanonicalClaimID(inviterID) ||
		!isCanonicalClaimID(inviteeID) || inviterID == inviteeID {
		return Balance{}, ErrInviteNotEligible
	}
	inviterScope, err := platform.NewUserScope(inviterID)
	if err != nil {
		return Balance{}, ErrInviteInputRequired
	}
	err = s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		inviteeApplied, err := s.earn(ctx, scope, tx, ReasonInvite, values.TwinkleEarnInviteInvitee,
			"invite_signup:"+signupID)
		if err != nil {
			return err
		}
		inviterApplied, err := s.earn(ctx, inviterScope, tx, ReasonInvite, values.TwinkleEarnInviteInviter,
			"invite:"+signupID)
		if err != nil {
			return err
		}
		if inviteeApplied != inviterApplied {
			return ErrInviteGrantConflict
		}
		return nil
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
}

// Charge credits only a verifier-authenticated claim bound to the current user,
// provider, known pack, authoritative amount, and normalized provider transaction.
// The transaction identity, not the opaque receipt, derives the global dedup key.
func (s *Service) Charge(ctx context.Context, scope platform.UserScope, packID string, provider string, receipt string) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	requestedPack := strings.TrimSpace(packID)
	requestedProvider := normalizePaymentProvider(provider)
	if requestedPack == "" || requestedProvider == "" || strings.TrimSpace(receipt) == "" {
		return Balance{}, ErrChargeInputRequired
	}
	verified, err := s.verifier.Verify(ctx, PaymentVerificationRequest{
		PackID:            requestedPack,
		Provider:          requestedProvider,
		Receipt:           receipt,
		BeneficiaryUserID: scope.UserID(),
	})
	if err != nil {
		if errors.Is(err, ErrPaymentVerificationUnavailable) {
			return Balance{}, ErrPaymentVerificationUnavailable
		}
		return Balance{}, ErrPaymentNotVerified
	}
	if verified.BeneficiaryUserID != scope.UserID() {
		return Balance{}, ErrPaymentBeneficiaryMismatch
	}
	verifiedProvider := normalizePaymentProvider(verified.Provider)
	transactionID := strings.TrimSpace(verified.ProviderTransactionID)
	if verifiedProvider == "" || verifiedProvider != requestedProvider ||
		transactionID == "" || transactionID != verified.ProviderTransactionID ||
		verified.PackID != requestedPack || verified.PackID != DefaultChargePackID ||
		verified.Amount != values.TwinkleChargePack {
		return Balance{}, ErrPaymentNotVerified
	}
	dedupKey := paymentTransactionKey(verifiedProvider, transactionID)
	err = s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		_, err := s.earn(ctx, scope, tx, ReasonPayment, verified.Amount, dedupKey)
		return err
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
}

func normalizePaymentProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

func isCanonicalClaimID(value string) bool {
	return value != "" && value == strings.TrimSpace(value)
}

func paymentTransactionKey(provider string, transactionID string) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%d:%s%s", len(provider), provider, transactionID)))
	return "payment:" + hex.EncodeToString(digest[:])
}

// QuoteSpend is CheckAndSpend's read-only twin ([G4]): resolve the authoritative
// depth signal server-side, price with the same curves, derive the same balance,
// plan the same draw — and write nothing: no ledger row, no window roll, no clock
// advance. A stale quote is simply refused later by the authoritative spend.
func (s *Service) QuoteSpend(ctx context.Context, scope platform.UserScope, kind QuoteKind, targetID string, semanticStage int) (Quote, error) {
	if scope.UserID() == "" {
		return Quote{}, ErrScopeRequired
	}
	if strings.TrimSpace(targetID) == "" {
		return Quote{}, ErrQuoteInputRequired
	}
	cost, err := s.quoteCost(ctx, scope, kind, targetID, semanticStage)
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

func (s *Service) quoteCost(ctx context.Context, scope platform.UserScope, kind QuoteKind, targetID string, semanticStage int) (int, error) {
	switch kind {
	case QuoteKindRecall:
		weight, err := s.signals.RecallAccessibility(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		return RecallCost(weight), nil
	case QuoteKindGistView:
		if semanticStage < 1 {
			return 0, fmt.Errorf("%w: gist semantic stage", ErrQuoteInputRequired)
		}
		reachedStage, err := s.signals.ViewableGistStage(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		if semanticStage > reachedStage {
			return 0, ErrQuoteTargetUnavailable
		}
		return GistViewCost(semanticStage), nil
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
