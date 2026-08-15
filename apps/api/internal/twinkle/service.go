package twinkle

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// The earn/spend use-cases — the orchestration of the Twinkle economy over the
// pure ledger model in ledger.go: the real SpendGate the recall/gist-view
// consumers call ([CC2][G1]), the earn paths (write / invite / signup bonus /
// achievement reward, [G3]), the purchase debit ([P9]), the balance read, the ledger
// history ([G7]) and the server quote ([G4]). Every policy —
// pricing, spend order, earn reasons, idempotency, and trusted-claim validation — lives here or in
// the pure domain, never in a handler (§2.9#7). There is deliberately NO
// login/attendance earn path ([G3]): the daily SMALL reset is that role.

var (
	ErrLedgerRequired         = errors.New("twinkle service requires a ledger repo")
	ErrInviteResolverRequired = errors.New("twinkle service requires an invite resolver")
	ErrSignalsRequired        = errors.New("twinkle service requires a spend-signal reader")
	// ErrZoneReaderRequired keeps the [U7] day boundary bound: production may not boot with an
	// unresolved SMALL reset window. The package deliberately exports no permissive UTC adapter
	// for a composition root to bind here by accident.
	ErrZoneReaderRequired = errors.New("twinkle service requires a user zone reader")
	// ErrScopeRequired mirrors the transport guard: every derivation, quote, earn,
	// and spend is scoped to an authenticated user (§4).
	ErrScopeRequired = errors.New("twinkle requires an authenticated user scope")
	// ErrEarnTxRequired is the wiring fault of a write grant fired outside its
	// launch transaction — the grant must commit or roll back with the launch.
	ErrEarnTxRequired = errors.New("twinkle write earn requires the launch transaction")
	// ErrGrantAmountInvalid rejects a non-positive admin grant amount ([G3] admin_grant,
	// the admin console). The per-grant cap is the admin context's policy; twinkle only refuses a
	// zero/negative gift.
	ErrGrantAmountInvalid = errors.New("twinkle admin grant amount must be positive")
	// ErrInsufficientTwinkle is the canonical spend denial ([G1]): the plan does not
	// fit the two tiers, nothing is written, the caller's action is refused ([I1] —
	// refused, never erased).
	ErrInsufficientTwinkle = errors.New("insufficient twinkle for this action")
	// ErrSpendIntentInvalid rejects a SpendIntent whose reason is not a spend
	// reason — a composition fault, not a user input.
	ErrSpendIntentInvalid = errors.New("twinkle spend intent carries no spendable reason")
	// ErrPurchaseAmountInvalid rejects a non-positive purchase total. The catalog owns the price; this
	// only refuses a total that cannot be one.
	ErrPurchaseAmountInvalid = errors.New("twinkle purchase amount must be positive")
	// ErrRewardClaimRequired rejects an achievement reward with no claim identity — without one the
	// credit has no idempotency key and a retried claim would pay twice.
	ErrRewardClaimRequired = errors.New("twinkle achievement reward requires a claim id")
	// ErrLedgerCursorInvalid rejects a page token the client did not get from a previous page. Cursors
	// are opaque and echoed, never constructed.
	ErrLedgerCursorInvalid = errors.New("twinkle ledger page token is not a valid cursor")
	// Invite refusals reveal no account-directory detail to the transport.
	ErrInviteInputRequired         = errors.New("invite claim requires an invite code")
	ErrInviteResolutionUnavailable = errors.New("invite verification is unavailable")
	ErrInviteBeneficiaryMismatch   = errors.New("invite claim beneficiary does not match the authenticated user")
	ErrInviteNotEligible           = errors.New("invite claim is not an eligible signup")
	ErrInviteGrantConflict         = errors.New("invite signup grant is inconsistent with existing ledger state")
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

// SpendIntent is what a metered action hands the gate: the spend's reason, the signal that prices it,
// and the operation-derived dedup key that makes the spend idempotent. It carries no memory type and
// no store type; the composition root maps the consumer's intent onto it.
//
// The fields are UNEXPORTED and the three constructors below are the only way to build one, because
// the mix that must be impossible is a value question, not a validation question: a recall intent has
// no field for an amount, so a caller can never set a recall's own price ([CC3] — pricing belongs to
// the curves alone), and a purchase intent has no field for a decay depth or a gist stage, so a curve
// can never price an ornament.
//
// An empty dedup key opts a spend out of dedup (the append then guards only backend-minted id
// collisions); a real paid action always supplies one, so a duplicate append applies no second
// balance delta (A3).
type SpendIntent struct {
	reason            EntryReason
	accessibilityCost float64
	semanticStage     int
	amount            int
	dedupKey          string
}

// RecallSpendIntent meters a 회고: the accessibility cost weight the forgetting unit computed is the
// only signal, and RecallCost turns it into a price ([CC3][G4]).
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

// Service owns the earn/spend use-cases. All concretes arrive through the
// consumer-owned ports; cross-context signals arrive as scalars (CC8).
type Service struct {
	ledger         LedgerRepo
	inviteResolver InviteResolver
	signals        SpendSignalReader
	userZone       UserZoneReader
	now            func() time.Time
	newID          func() string
}

type ServiceDeps struct {
	Ledger         LedgerRepo
	InviteResolver InviteResolver
	Signals        SpendSignalReader
	UserZone       UserZoneReader
	// Now/NewID are test seams; nil selects the real UTC clock and the platform id.
	Now   func() time.Time
	NewID func() string
}

func NewService(deps ServiceDeps) (*Service, error) {
	if deps.Ledger == nil {
		return nil, ErrLedgerRequired
	}
	if deps.InviteResolver == nil {
		return nil, ErrInviteResolverRequired
	}
	if deps.Signals == nil {
		return nil, ErrSignalsRequired
	}
	if deps.UserZone == nil {
		return nil, ErrZoneReaderRequired
	}
	service := &Service{
		ledger:         deps.Ledger,
		inviteResolver: deps.InviteResolver,
		signals:        deps.Signals,
		userZone:       deps.UserZone,
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

// GetBalance derives the two-kind balance at real now ([G2]): a read, never a
// write — no row is born, no window rolls forward, nothing is earned or spent. An
// absent row is the lazy-birth default (full SMALL, zero GENERAL).
func (s *Service) GetBalance(ctx context.Context, scope platform.UserScope) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	zone, err := s.zone(ctx, scope)
	if err != nil {
		return Balance{}, err
	}
	record, err := s.ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return Balance{}, err
	}
	return DeriveBalance(s.now(), zone, recordOrLazyBirth(record)), nil
}

// GetBalances is the admin-list batch read. Production obtains every timezone and stored balance
// in one query per owning context, then applies exactly the same lazy-birth/day-boundary derivation
// as GetBalance.
func (s *Service) GetBalances(ctx context.Context, userIDs []string) (map[string]Balance, error) {
	balances := make(map[string]Balance, len(userIDs))
	if len(userIDs) == 0 {
		return balances, nil
	}
	zones, err := s.userZone.ZonesFor(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	records, err := s.ledger.GetBalanceRecords(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	now := s.now()
	for _, userID := range userIDs {
		record, found := records[userID]
		var stored *BalanceRecord
		if found {
			stored = &record
		}
		balances[userID] = DeriveBalance(now, LocationOf(zones[userID]), recordOrLazyBirth(stored))
	}
	return balances, nil
}

// zone resolves the scoped user's SMALL reset boundary once per use-case ([G2][U7]). An empty,
// blank or unknown IANA name resolves to UTC without an error — the [G5] direction: a user whose
// profile is missing or whose zone the runtime cannot load still gets today's refill. Only a
// genuine port failure (the read itself broke) propagates, because that is a DB error, not an
// absent zone. time/tzdata is imported by cmd/api and cmd/worker so LoadLocation is hermetic on
// the distroless image.
func (s *Service) zone(ctx context.Context, scope platform.UserScope) (*time.Location, error) {
	name, err := s.userZone.ZoneFor(ctx, scope)
	if err != nil {
		return nil, err
	}
	return LocationOf(name), nil
}

// CheckAndSpend is the real spend gate ([CC2][G1]): price the intent from its depth
// signal via the kind-split curves, derive the balance, plan the draw SMALL-first
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
	// The purpose comes from the reason, so the row that gets written and the tier that pays for it
	// are decided by the same value ([P9]).
	kind := intent.reason.SpendKind()
	if cost == 0 {
		// A zero-priced action spends nothing; the ledger stays clean (the log
		// CHECKs amount > 0, and a zero row would record a non-event).
		return nil
	}
	zone, err := s.zone(ctx, scope)
	if err != nil {
		return err
	}
	record, err := ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return err
	}
	now := s.now()
	balance := DeriveBalance(now, zone, recordOrLazyBirth(record))
	plan := PlanSpend(balance.Small, balance.General, cost, kind)
	if !plan.OK {
		return newInsufficientTwinkle(balance, cost, kind)
	}
	// Append the dedup-keyed spend row FIRST — exactly like earn: a false means this
	// operation's spend already landed (a duplicate/replay), so skip the balance delta and the
	// draw is applied once end to end (A3). This is the spend-side idempotency the recall/view
	// receipt layer backstops; together, no retry double-charges.
	var dedupKey *string
	if intent.dedupKey != "" {
		key := intent.dedupKey
		dedupKey = &key
	}
	applied, err := ledger.AppendLedgerEntry(ctx, scope, LedgerEntry{
		ID:          s.newID(),
		Kind:        EntryKindSpend,
		Reason:      intent.reason,
		Amount:      cost,
		FromSmall:   plan.FromSmall,
		FromGeneral: plan.FromGeneral,
		DedupKey:    dedupKey,
		CreatedAt:   now,
	})
	if err != nil {
		return err
	}
	if !applied {
		return nil
	}
	_, err = ledger.ApplyBalanceDelta(ctx, scope, ResetWindowOf(now, zone), -plan.FromGeneral, plan.FromSmall)
	return err
}

// spendPrice maps a SpendIntent to its Twinkle cost ([CC3][G4]) — the only place a metered action is
// priced; callers never compute or carry a price. The one exception is a purchase, whose price is not
// a curve at all but the catalog total another context already computed: twinkle validates that it
// could be a price and passes it through.
func spendPrice(intent SpendIntent) (int, error) {
	switch intent.reason {
	case ReasonRecall:
		return RecallCost(intent.accessibilityCost), nil
	case ReasonGistView:
		return GistViewCost(intent.semanticStage), nil
	case ReasonOrnamentPurchase:
		if intent.amount <= 0 {
			return 0, fmt.Errorf("%w: %d", ErrPurchaseAmountInvalid, intent.amount)
		}
		return intent.amount, nil
	default:
		return 0, fmt.Errorf("%w: %q", ErrSpendIntentInvalid, intent.reason)
	}
}

// EarnOnWrite is the write grant ([G3]): one fixed earn per launched diary,
// credited to GENERAL, dedup-keyed by the diary id so a diary can never grant
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

// EarnSignupBonus credits the one-time onboarding grant to GENERAL Twinkle. The authenticated account id is the idempotency identity, so repeated
// settlement hooks can safely converge through the ledger's unique dedup key.
func (s *Service) EarnSignupBonus(ctx context.Context, scope platform.UserScope) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	err := s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		_, err := s.earn(ctx, scope, tx, ReasonSignupBonus, values.TwinkleEarnSignupBonus, "signup_bonus:"+scope.UserID())
		return err
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
}

// EarnAdminGrant credits `amount` GENERAL Twinkle to the scoped user as an operator gift
// (별가루 증정, the admin console). It runs in its own ledger transaction and is idempotent by dedupKey —
// the admin console's grant id — so a replay returns the current balance without double-crediting.
// It is the twinkle side of the grant only: the admin context validates the per-grant cap and
// writes its own audit rows; twinkle refuses only a non-positive amount and credits a validated
// gift to GENERAL balance ([G2] — SMALL is the daily reset, never earned).
func (s *Service) EarnAdminGrant(ctx context.Context, scope platform.UserScope, amount int, dedupKey string) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	if amount <= 0 {
		return Balance{}, ErrGrantAmountInvalid
	}
	err := s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		_, err := s.earn(ctx, scope, tx, ReasonAdminGrant, amount, dedupKey)
		return err
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
}

// EarnAchievementReward credits an achievement's reward to GENERAL, keyed by the CLAIM rather than by
// the achievement: claiming is an explicit act ([A3]), so a user who has met a condition twice over
// still earns once per claim, and a replayed claim credits nothing more.
//
// It is a credit PRIMITIVE and decides no eligibility — whether the achievement is achieved, and what
// its reward is worth, belong to the achievement context. It runs in its own ledger transaction rather
// than the claim's: a claim stamped with its reward uncredited heals on replay, whereas a shared
// transaction would make achievement the owner of twinkle's tables.
func (s *Service) EarnAchievementReward(ctx context.Context, scope platform.UserScope, claimID string, amount int) (Balance, error) {
	if scope.UserID() == "" {
		return Balance{}, ErrScopeRequired
	}
	if strings.TrimSpace(claimID) == "" {
		return Balance{}, ErrRewardClaimRequired
	}
	if amount <= 0 {
		return Balance{}, ErrGrantAmountInvalid
	}
	err := s.ledger.InLedgerTx(ctx, func(tx LedgerStore) error {
		_, err := s.earn(ctx, scope, tx, ReasonAchievementClaim, amount, "achievement:"+claimID)
		return err
	})
	if err != nil {
		return Balance{}, err
	}
	return s.GetBalance(ctx, scope)
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
		inviterDedupKey := "invite:" + signupID
		if err := tx.LockInviteRewardsByInviter(ctx, inviterScope); err != nil {
			return err
		}
		rewardCount, replay, err := tx.GetInviteRewardState(ctx, inviterScope, inviterDedupKey)
		if err != nil {
			return err
		}
		if !replay && rewardCount >= int64(values.TwinkleInviteRewardMaxPerInviter) {
			return ErrInviteNotEligible
		}
		inviteeApplied, err := s.earn(ctx, scope, tx, ReasonInviteSignup, values.TwinkleEarnInviteInvitee,
			"invite_signup:"+signupID)
		if err != nil {
			return err
		}
		inviterApplied, err := s.earn(ctx, inviterScope, tx, ReasonInvite, values.TwinkleEarnInviteInviter,
			inviterDedupKey)
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

func isCanonicalClaimID(value string) bool {
	return value != "" && value == strings.TrimSpace(value)
}

// QuoteSpend is CheckAndSpend's read-only twin ([G4]): resolve the authoritative
// depth signal server-side, price with the same curves, derive the same balance,
// plan the same draw — and write nothing: no ledger row, no window roll, no clock
// advance. A stale quote is simply refused later by the authoritative spend.
func (s *Service) QuoteSpend(ctx context.Context, scope platform.UserScope, kind SpendKind, targetID string) (Quote, error) {
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
	zone, err := s.zone(ctx, scope)
	if err != nil {
		return Quote{}, err
	}
	record, err := s.ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return Quote{}, err
	}
	balance := DeriveBalance(s.now(), zone, recordOrLazyBirth(record))
	plan := PlanSpend(balance.Small, balance.General, cost, kind)
	return Quote{
		Cost:    cost,
		Covered: plan.OK,
		// Tier-aware ([G4][P9]): counting SMALL against a purpose that may not spend it would
		// report a purchase as covered by an allowance it cannot touch.
		Shortfall: ShortfallFor(balance.Small, balance.General, cost, kind),
	}, nil
}

func (s *Service) quoteCost(ctx context.Context, scope platform.UserScope, kind SpendKind, targetID string) (int, error) {
	switch kind {
	case SpendKindRecall:
		weight, err := s.signals.RecallAccessibility(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		return RecallCost(weight), nil
	case SpendKindGistView:
		// The depth is the memory's own, never the caller's: the quote prices the same rung
		// ViewSemantic will serve, from the same derivation, so a client cannot ask to be
		// quoted at a cheaper depth than the one it is then charged and shown.
		reachedStage, err := s.signals.ViewableGistStage(ctx, scope, targetID)
		if err != nil {
			return 0, err
		}
		return GistViewCost(reachedStage), nil
	case SpendKindDiaryRecall:
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
	// SpendKindPurchase deliberately has NO arm and the wire enum carries no PURCHASE value: an
	// ornament is catalog-priced by the store context, never by the recall pricer, so it falls to
	// the ErrQuoteInputRequired default below.
	default:
		return 0, fmt.Errorf("%w: kind %q", ErrQuoteInputRequired, kind)
	}
}

// GetLedger reads one page of the user's history, newest first ([G7][U9]) — the single surface where
// 구매·수령·적립·소모 are all readable in one chronological list. Read-only: no row, no delta, no clock
// advance.
//
// Each entry carries the calendar date it belongs to in the USER's zone, resolved here rather than on
// the device ([U7]): the same boundary the SMALL refill uses, so the history's day headers and the
// user's daily allowance agree about when a day turned.
//
// pageSize is clamped to twinkle.ledger_page_size as both the default AND the hard cap, so a client
// cannot ask for an unbounded slice of its own history.
func (s *Service) GetLedger(ctx context.Context, scope platform.UserScope, pageSize int, pageToken string) (LedgerPage, error) {
	if scope.UserID() == "" {
		return LedgerPage{}, ErrScopeRequired
	}
	var cursor *LedgerCursor
	if strings.TrimSpace(pageToken) != "" {
		decoded, err := decodeLedgerCursor(pageToken)
		if err != nil {
			return LedgerPage{}, ErrLedgerCursorInvalid
		}
		cursor = &decoded
	}
	// The cap is the default and the ceiling both: an unset size gets the full page, an oversized one
	// is clamped rather than refused (a client asking for too much wants a page, not an error).
	limit := values.TwinkleLedgerPageSize
	if pageSize > 0 && pageSize < limit {
		limit = pageSize
	}
	zone, err := s.zone(ctx, scope)
	if err != nil {
		return LedgerPage{}, err
	}
	// One row beyond the page: its existence is what distinguishes "the history continues" from "the
	// page happened to end exactly here", without a second count query.
	entries, err := s.ledger.ListLedgerPage(ctx, scope, cursor, limit+1)
	if err != nil {
		return LedgerPage{}, err
	}
	next := ""
	if len(entries) > limit {
		last := entries[limit-1]
		next = encodeLedgerCursor(LedgerCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		entries = entries[:limit]
	}
	views := make([]LedgerView, 0, len(entries))
	for _, entry := range entries {
		views = append(views, LedgerView{Entry: entry, OccurredOn: ResetWindowOf(entry.CreatedAt, zone)})
	}
	return LedgerPage{Entries: views, NextPageToken: next}, nil
}

// The cursor is an opaque "<created_at>|<id>" pair, base64url-encoded — an internal keyset position the
// client only echoes back, never parses. RFC3339Nano because two entries written in one transaction
// can share a microsecond-truncated timestamp, and the id is what breaks that tie.
func encodeLedgerCursor(cursor LedgerCursor) string {
	raw := cursor.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + cursor.ID
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeLedgerCursor(token string) (LedgerCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return LedgerCursor{}, err
	}
	stamp, id, found := strings.Cut(string(raw), "|")
	if !found || id == "" {
		return LedgerCursor{}, errors.New("malformed twinkle ledger cursor")
	}
	parsed, err := time.Parse(time.RFC3339Nano, stamp)
	if err != nil {
		return LedgerCursor{}, err
	}
	return LedgerCursor{CreatedAt: parsed, ID: id}, nil
}

// earn appends one dedup-keyed earn entry and, when it genuinely applied (not a
// replay), credits GENERAL balance ([G2] — SMALL is the daily reset and is never
// earned). The append goes first so a replayed pair skips the delta — end-to-end
// idempotency per key. Returns whether this call applied.
//
// The zone is resolved for the credited scope, not the caller's: ClaimInvite credits the inviter
// too, and the anchor this write rolls forward is that user's own calendar date. Passing a UTC date
// instead would push a UTC−n user's anchor a day ahead and swallow their next refill ([G5]).
func (s *Service) earn(ctx context.Context, scope platform.UserScope, ledger LedgerStore, reason EntryReason, amount int, dedupKey string) (bool, error) {
	zone, err := s.zone(ctx, scope)
	if err != nil {
		return false, err
	}
	// One clock read for the pair: the entry's timestamp and the window it anchors must describe the
	// same instant, or an earn landing on a local midnight could log itself into one day and roll the
	// window into another.
	now := s.now()
	key := dedupKey
	applied, err := ledger.AppendLedgerEntry(ctx, scope, LedgerEntry{
		ID:        s.newID(),
		Kind:      EntryKindEarn,
		Reason:    reason,
		Amount:    amount,
		DedupKey:  &key,
		CreatedAt: now,
	})
	if err != nil {
		return false, err
	}
	if !applied {
		return false, nil
	}
	if _, err := ledger.ApplyBalanceDelta(ctx, scope, ResetWindowOf(now, zone), amount, 0); err != nil {
		return false, err
	}
	return true, nil
}

// recordOrLazyBirth is the absent-row default: a user who never earned or spent
// derives a full SMALL grant with zero GENERAL (the zero record's stale window
// derives fresh).
func recordOrLazyBirth(record *BalanceRecord) BalanceRecord {
	if record == nil {
		return BalanceRecord{}
	}
	return *record
}
