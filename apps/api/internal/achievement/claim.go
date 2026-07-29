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
// RECOVERABLE rather than lost: a repeat claim falls through as a replay and pays through the same
// dedup keys, so the ledger credits once and the reward arrives. This is why a second claim is a
// replay returning the same reward and not an ALREADY_CLAIMED refusal: refusing would strand the
// reward in precisely the window this pairing exists to heal.
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
			return nil
		}
		// Zero rows changed has two causes, and only the row itself distinguishes them: no row, or a
		// row already claimed.
		record, err := tx.GetProgress(ctx, scope, row.ID)
		if err != nil {
			return fmt.Errorf("read %s progress: %w", row.ID, err)
		}
		if record != nil {
			// Already claimed — fall through as a replay and pay again through the idempotent legs.
			return nil
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
		// key, so falling through as a replay is correct rather than a conflict to report.
		return nil
	}
	return nil
}

// payReward pays the one leg the catalog set. It runs after the claim commits, so both legs can be
// idempotent on the claim id rather than transactional with the stamp.
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
		return ClaimResult{OrnamentID: row.Reward.OrnamentID}, nil
	}
	amount := row.Reward.Twinkle()
	total, err := s.twinkle.EarnAchievementReward(ctx, scope, claimID, amount)
	if err != nil {
		return ClaimResult{}, fmt.Errorf("%w: credit %s: %w", ErrRewardUnavailable, row.ID, err)
	}
	return ClaimResult{TwinkleAmount: amount, TwinkleTotal: total}, nil
}
