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
// consumers call ([G1]), the earn paths (write / invite / signup bonus /
// achievement reward, [G3]), the purchase debit ([P9]), the balance read, the ledger
// history ([G7]) and the server quote ([G4]). Every policy —
// pricing, spend order, earn reasons, idempotency, and trusted-claim validation — lives here or in
// the pure domain, never in a handler (§2.9#7). There is deliberately NO
// login/attendance earn path ([G3]): the daily SMALL reset is that role.

// Service owns the earn/spend use-cases. All concretes arrive through the
// consumer-owned ports; cross-context signals arrive as scalars.
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

// zone resolves the scoped user's SMALL reset boundary through the pool for reads that hold no
// transaction; code inside a transaction reads it through its LedgerTx instead.
func (s *Service) zone(ctx context.Context, scope platform.UserScope) (*time.Location, error) {
	return resolveZone(ctx, s.userZone, scope)
}

// resolveZone resolves the scoped user's SMALL reset boundary once per use-case ([G2][U7]). An
// empty, blank or unknown IANA name resolves to UTC without an error — the [G5] direction: a user
// whose profile is missing or whose zone the runtime cannot load still gets today's refill. Only a
// genuine port failure (the read itself broke) propagates, because that is a DB error, not an
// absent zone. time/tzdata is imported by cmd/api and cmd/worker so LoadLocation is hermetic on
// the distroless image.
func resolveZone(ctx context.Context, zones ZoneReader, scope platform.UserScope) (*time.Location, error) {
	name, err := zones.ZoneFor(ctx, scope)
	if err != nil {
		return nil, err
	}
	return LocationOf(name), nil
}

// CheckAndSpend is the real spend gate ([G1]): price the intent from its depth
// signal via the kind-split curves, derive the balance, plan the draw SMALL-first
// ([G2]), and — only when the plan fits — append the spend row and apply the guarded
// delta. An unaffordable new spend returns the canonical ErrInsufficientTwinkle
// without writes; a confirmed committed-key replay succeeds without another debit.
// Nothing is ever deleted ([I1]). ledger is the caller's transaction-bound store
// (the composition-root economy seam) so the spend commits or rolls back with the
// recall it gates; a nil ledger (the tx-less gist view) runs the spend in its own
// transaction.
func (s *Service) CheckAndSpend(ctx context.Context, scope platform.UserScope, ledger LedgerTx, intent SpendIntent) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if ledger != nil {
		return s.checkAndSpend(ctx, scope, ledger, intent)
	}
	return s.ledger.InLedgerTx(ctx, func(tx LedgerTx) error {
		return s.checkAndSpend(ctx, scope, tx, intent)
	})
}

type preparedSpend struct {
	cost int
	plan SpendPlan
	now  time.Time
	zone *time.Location
}

// CheckCanSpend performs the same authoritative planning without appending or applying a debit.
func (s *Service) CheckCanSpend(ctx context.Context, scope platform.UserScope, ledger LedgerTx, intent SpendIntent) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if ledger == nil {
		return ErrLedgerRequired
	}
	_, err := s.prepareSpend(ctx, scope, ledger, intent)
	return err
}
func (s *Service) prepareSpend(ctx context.Context, scope platform.UserScope, ledger LedgerTx, intent SpendIntent) (preparedSpend, error) {
	cost, err := spendPrice(intent)
	if err != nil {
		return preparedSpend{}, err
	}
	// The purpose comes from the reason, so the row that gets written and the tier that pays for it
	// are decided by the same value ([P9]).
	kind := intent.reason.SpendKind()
	if cost == 0 {
		// A zero-priced action spends nothing; the ledger stays clean (the log
		// CHECKs amount > 0, and a zero row would record a non-event).
		return preparedSpend{}, nil
	}
	zone, err := resolveZone(ctx, ledger, scope)
	if err != nil {
		return preparedSpend{}, err
	}
	record, err := ledger.GetBalanceRecord(ctx, scope)
	if err != nil {
		return preparedSpend{}, err
	}
	now := s.now()
	balance := DeriveBalance(now, zone, recordOrLazyBirth(record))
	plan := PlanSpend(balance.Small, balance.General, cost, kind)
	if !plan.OK {
		return preparedSpend{}, newInsufficientTwinkle(balance, cost, kind)
	}
	return preparedSpend{cost: cost, plan: plan, now: now, zone: zone}, nil
}

func (s *Service) checkAndSpend(ctx context.Context, scope platform.UserScope, ledger LedgerTx, intent SpendIntent) error {
	prepared, err := s.prepareSpend(ctx, scope, ledger, intent)
	if err != nil {
		var insufficient *InsufficientTwinkle
		if intent.dedupKey != "" && errors.As(err, &insufficient) {
			replay, lookupErr := ledger.LedgerDedupExists(ctx, scope, intent.dedupKey, intent.reason)
			if lookupErr != nil {
				return lookupErr
			}
			if replay {
				return nil
			}
		}
		return err
	}
	if prepared.cost == 0 {
		return nil
	}
	cost, plan, now, zone := prepared.cost, prepared.plan, prepared.now, prepared.zone
	// Append the dedup-keyed spend row FIRST — exactly like earn: a false means this
	// operation's spend already landed (a duplicate/replay), so skip the balance delta and the
	// draw is applied once end to end. This is the spend-side idempotency the recall/view
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

// spendPrice maps a SpendIntent to its Twinkle cost ([G4]) — the only place a metered action is
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
func (s *Service) EarnOnWrite(ctx context.Context, scope platform.UserScope, ledger LedgerTx, diaryID string) error {
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
	err := s.ledger.InLedgerTx(ctx, func(tx LedgerTx) error {
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
	err := s.ledger.InLedgerTx(ctx, func(tx LedgerTx) error {
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
	err := s.ledger.InLedgerTx(ctx, func(tx LedgerTx) error {
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
	err = s.ledger.InLedgerTx(ctx, func(tx LedgerTx) error {
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

// earn appends one dedup-keyed earn entry and, when it genuinely applied (not a
// replay), credits GENERAL balance ([G2] — SMALL is the daily reset and is never
// earned). The append goes first so a replayed pair skips the delta — end-to-end
// idempotency per key. Returns whether this call applied.
//
// The zone is resolved for the credited scope, not the caller's: ClaimInvite credits the inviter
// too, and the anchor this write rolls forward is that user's own calendar date. Passing a UTC date
// instead would push a UTC−n user's anchor a day ahead and swallow their next refill ([G5]).
func (s *Service) earn(ctx context.Context, scope platform.UserScope, ledger LedgerTx, reason EntryReason, amount int, dedupKey string) (bool, error) {
	zone, err := resolveZone(ctx, ledger, scope)
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
