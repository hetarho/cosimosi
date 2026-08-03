package achievement

import (
	"context"
	"fmt"

	"github.com/cosimosi/api/internal/platform"
)

// ClaimResult is what a claim paid: exactly one leg is set, mirroring the catalog's XOR Reward.
// TwinkleTotal is the GENERAL balance after the credit, for the reveal — it is the economy's own
// number, never recomputed here.
type ClaimResult struct {
	TwinkleAmount int
	OrnamentID    string
	TwinkleTotal  int
}

// ClaimAchievement is the explicit claim ([A4]): a met condition pays NOTHING until this is called.
//
// The order is the whole design. `claimed_at` is stamped and committed BEFORE any credit moves, so
// double payout is impossible: the claim is a conditional update on a single row, concurrent claims
// serialize on it, and exactly one of them sees a row change. The payout then runs after the commit
// as an idempotent pairing keyed on the claim id — not as one cross-context transaction, which would
// make this context the transaction owner of the ledger's and the ornament catalog's tables.
//
// That leaves exactly one intermediate state — claimed but uncredited, after a crash — and it is
// RECOVERABLE rather than lost, by two mechanisms that need no one to notice the gap. The row can
// SAY it: paid_at is stamped only once a leg returns, so the read answers claimed-and-unsettled and
// the client keeps a retry affordance instead of hiding the row. And a drain is armed INSIDE this
// transaction, so a process death between the commit and the payout leaves a job enqueued that
// replays both idempotent legs. A repeat claim is therefore a replay returning the same reward and
// not an ALREADY_CLAIMED refusal: refusing would strand the reward in precisely the window this
// pairing exists to heal.
//
// The claim id is DERIVED, not minted: it is the achievement id, already unique per user under the
// progress table's primary key and the ledger's UNIQUE (user_id, dedup_key). A random id would buy no
// uniqueness the pair does not already have, and every replay would recompute a different key.
func (s *Service) ClaimAchievement(
	ctx context.Context,
	scope platform.UserScope,
	achievementID string,
) (ClaimResult, error) {
	if scope.UserID() == "" {
		return ClaimResult{}, ErrScopeRequired
	}
	row, published := LookupAchievement(achievementID)
	if !published {
		return ClaimResult{}, fmt.Errorf("%w: %s", ErrUnknownAchievementID, achievementID)
	}
	claimID := row.ID

	if err := s.repo.InAchievementTx(ctx, func(tx Store) error {
		claimed, err := tx.MarkClaimed(ctx, scope, row.ID, claimID)
		if err != nil {
			return fmt.Errorf("mark %s claimed: %w", row.ID, err)
		}
		if claimed {
			return s.settlements.ScheduleSettlement(ctx, scope, tx, row.ID)
		}
		// Zero rows changed has two causes, and only the row itself distinguishes them: no row, or a
		// row already claimed.
		record, err := tx.GetProgress(ctx, scope, row.ID)
		if err != nil {
			return fmt.Errorf("read %s progress: %w", row.ID, err)
		}
		if record != nil {
			// Already claimed — fall through as a replay and pay again through the idempotent legs.
			// A settled row needs no drain; an unsettled one re-arms it, because the press may be
			// arriving long after the original job drained itself out of the queue.
			if record.Settled() {
				return nil
			}
			return s.settlements.ScheduleSettlement(ctx, scope, tx, row.ID)
		}
		// No row, but the READ derives `achieved` from the counter, so a counter that already meets
		// this target is displayed as achieved and must therefore be claimable. The two can legitimately
		// disagree: a release that adds a tier on an existing counter, or lowers a target, leaves every
		// qualifying user achieved-by-derivation with no row, because rows are written only when a
		// counter is next reported. Promote it here rather than refusing what the UI already offered.
		return s.promoteAndClaim(ctx, scope, tx, row, claimID)
	}); err != nil {
		return ClaimResult{}, err
	}

	return s.payReward(ctx, scope, row, claimID)
}

// promoteAndClaim marks a row whose counter already meets its target, then claims it — both inside the
// caller's transaction, so a promotion that cannot be claimed leaves neither. A counter still short of
// the target is the genuine refusal: nothing is credited, because a met condition is a PRECONDITION for
// the reward and an unmet one is not a payout waiting to happen ([A4]).
func (s *Service) promoteAndClaim(
	ctx context.Context,
	scope platform.UserScope,
	tx Store,
	row Achievement,
	claimID string,
) error {
	counters, err := tx.ListCounters(ctx, scope)
	if err != nil {
		return fmt.Errorf("read counters for %s: %w", row.ID, err)
	}
	if !Achieved(counters[row.Condition.Counter], row.Condition.Target) {
		return fmt.Errorf("%w: %s", ErrAchievementNotAchieved, row.ID)
	}
	if _, err := tx.MarkAchieved(ctx, scope, row.ID); err != nil {
		return fmt.Errorf("mark %s achieved: %w", row.ID, err)
	}
	claimed, err := tx.MarkClaimed(ctx, scope, row.ID, claimID)
	if err != nil {
		return fmt.Errorf("mark %s claimed: %w", row.ID, err)
	}
	if !claimed {
		// A concurrent claim won the row between the two statements. It pays through the same dedup
		// key and armed its own drain, so falling through as a replay is correct rather than a
		// conflict to report.
		return nil
	}
	return s.settlements.ScheduleSettlement(ctx, scope, tx, row.ID)
}

// payReward pays the one leg the catalog set. It runs after the claim commits, so both legs can be
// idempotent on the claim id rather than transactional with the stamp; the settle stamp closes the
// pair, turning "we believe this was paid" into a stored fact.
func (s *Service) payReward(
	ctx context.Context,
	scope platform.UserScope,
	row Achievement,
	claimID string,
) (ClaimResult, error) {
	if row.Reward.OrnamentID != "" {
		if err := s.ornaments.Grant(ctx, scope, claimID, row.Reward.OrnamentID); err != nil {
			return ClaimResult{}, fmt.Errorf("%w: grant ornament %s: %w", ErrRewardUnavailable, row.Reward.OrnamentID, err)
		}
		s.stampSettled(ctx, scope, row.ID, claimID)
		return ClaimResult{OrnamentID: row.Reward.OrnamentID}, nil
	}
	amount := row.Reward.Twinkle()
	total, err := s.twinkle.EarnAchievementReward(ctx, scope, claimID, amount)
	if err != nil {
		return ClaimResult{}, fmt.Errorf("%w: credit %s: %w", ErrRewardUnavailable, row.ID, err)
	}
	s.stampSettled(ctx, scope, row.ID, claimID)
	return ClaimResult{TwinkleAmount: amount, TwinkleTotal: total}, nil
}

// stampSettled records that the leg above landed, and deliberately returns NOTHING.
//
// A settle failure after a successful credit is not a payout failure: the reward is in the user's
// balance or catalog and only the stamp is missing. Reporting it as ErrRewardUnavailable would tell
// a user who already has their reward that it could not be paid, and invite a press that credits
// nothing. Leaving the row unsettled is the safe half of the pair — the drain re-runs an idempotent
// leg and re-stamps, so the two facts converge without anyone being told a false one.
func (s *Service) stampSettled(ctx context.Context, scope platform.UserScope, achievementID, claimID string) {
	_, _ = s.repo.SettleClaim(ctx, scope, achievementID, claimID)
}

// SettleClaims drains every claim this user has stamped but not been paid for — the worker leg of
// the at-least-once claim. It is user-scoped by construction: the job that calls it names one user,
// and every statement underneath is conjunctively scoped, so no cross-user scan of a product table
// is introduced.
//
// The drain is unbounded on purpose and cannot spin forever on an unpayable row: the composition
// root refuses to boot on a reward naming an unpublished ornament, and on a reward with neither leg
// or both, so every claimable row has exactly one payable leg. What remains is transient — a pooler
// blip, a restart — which is what retrying is for.
func (s *Service) SettleClaims(ctx context.Context, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	records, err := s.repo.ListProgress(ctx, scope)
	if err != nil {
		return fmt.Errorf("list achievement progress: %w", err)
	}
	// Every unsettled row is attempted before the first failure is reported. Returning early would let
	// one row that happens to fail this round starve the rest of the user's rewards for as long as it
	// keeps failing, because the retry re-reads the same list in the same order.
	var failed error
	for _, record := range records {
		if !record.Claimed() || record.Settled() {
			continue
		}
		row, published := LookupAchievement(record.AchievementID)
		if !published {
			// A progress write refuses an unpublished id, so this can only be a row whose achievement
			// left the catalog after it was claimed — reachable only across a deploy. Note the reward
			// itself may well have LANDED: stampSettled swallows its error, so a paid leg with a failed
			// settle stamp leaves exactly this row shape. Either way no leg is left to pay from here and
			// no retry would make one appear.
			//
			// Skipping IS closing it, which is not obvious from here: ListAchievements iterates the
			// catalog, so a row whose id has left it is projected into no Entry at all and cannot be
			// answered as claimed-and-still-owed. There is no third state to represent and no affordance
			// left pointing at it. (Pinned by TestSettleSkipsAnAchievementThatLeftTheCatalog.)
			continue
		}
		if _, err := s.payReward(ctx, scope, row, record.ClaimID); err != nil && failed == nil {
			failed = fmt.Errorf("settle %s: %w", record.AchievementID, err)
		}
	}
	return failed
}
