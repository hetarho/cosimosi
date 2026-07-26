package account

import (
	"context"
	"fmt"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func withdrawalRetentionWindow() time.Duration {
	return time.Duration(values.ReleaseSoftDeleteRetentionDays) * 24 * time.Hour
}

// Withdraw pairs the durable sweep trigger first with the account soft-delete second.
// A trigger without a mark is harmless because the worker always re-derives due-ness.
func (s *Service) Withdraw(ctx context.Context, scope platform.UserScope) (WithdrawalWindow, error) {
	if scope.UserID() == "" {
		return WithdrawalWindow{}, ErrScopeRequired
	}
	if err := s.withdrawalReady(); err != nil {
		return WithdrawalWindow{}, err
	}
	now := s.now().UTC()
	if err := s.scheduler.Schedule(ctx, scope, now.Add(withdrawalRetentionWindow())); err != nil {
		return WithdrawalWindow{}, err
	}

	var withdrawnAt time.Time
	err := s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
		stamped, marked, err := tx.MarkWithdrawn(ctx, scope, now)
		if err != nil {
			return err
		}
		if marked {
			withdrawnAt = stamped
			return nil
		}
		existing, found, err := tx.WithdrawalStatusForUpdate(ctx, scope)
		if err != nil {
			return err
		}
		if !found || existing.IsZero() {
			return ErrSignupRequired
		}
		withdrawnAt = existing
		return nil
	})
	if err != nil {
		return WithdrawalWindow{}, err
	}
	return WithdrawalWindow{
		WithdrawnAt:       withdrawnAt,
		RestoreDeadlineAt: withdrawnAt.Add(withdrawalRetentionWindow()),
	}, nil
}

// RestoreAccount clears the sole withdrawn-state fact while holding the User row lock.
// Cancellation follows the commit: a cancellation failure leaves only an inert job whose
// sweep re-reads the now-null deleted_at and completes without deleting anything.
func (s *Service) RestoreAccount(ctx context.Context, scope platform.UserScope) (time.Time, error) {
	if scope.UserID() == "" {
		return time.Time{}, ErrScopeRequired
	}
	if err := s.withdrawalReady(); err != nil {
		return time.Time{}, err
	}
	now := s.now().UTC()
	err := s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
		withdrawnAt, found, err := tx.WithdrawalStatusForUpdate(ctx, scope)
		if err != nil {
			return err
		}
		if !found || withdrawnAt.IsZero() {
			return ErrNotWithdrawn
		}
		if !now.Before(withdrawnAt.Add(withdrawalRetentionWindow())) {
			return ErrRestoreWindowExpired
		}
		cleared, err := tx.ClearWithdrawal(ctx, scope, withdrawnAt)
		if err != nil {
			return err
		}
		if !cleared {
			return ErrNotWithdrawn
		}
		return nil
	})
	if err != nil {
		return time.Time{}, err
	}
	if err := s.scheduler.Cancel(ctx, scope); err != nil {
		return time.Time{}, err
	}
	return now, nil
}

// WithdrawnAt publishes the one account-status fact the platform admission gate consumes.
// An absent User row and a live row are both not-withdrawn; persistence failures propagate.
func (s *Service) WithdrawnAt(ctx context.Context, userID string) (time.Time, bool, error) {
	if s.withdrawals == nil {
		return time.Time{}, false, ErrWithdrawalStoreRequired
	}
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		return time.Time{}, false, err
	}
	withdrawnAt, found, err := s.withdrawals.WithdrawalStatus(ctx, scope)
	return withdrawnAt, found && !withdrawnAt.IsZero(), err
}

// SweepWithdrawnAccount is reachable only from the withdrawal_sweep worker handler.
// The locked User row serializes it with RestoreAccount. Each registered context leg
// owns and commits its own idempotent transaction; account dependents, credentials, and
// finally the User completion marker follow in that order.
func (s *Service) SweepWithdrawnAccount(ctx context.Context, scope platform.UserScope, now time.Time) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if err := s.withdrawalReady(); err != nil {
		return err
	}
	return s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
		withdrawnAt, found, err := tx.WithdrawalStatusForUpdate(ctx, scope)
		if err != nil || !found || withdrawnAt.IsZero() {
			return err
		}
		deadline := withdrawnAt.Add(withdrawalRetentionWindow())
		if now.UTC().Before(deadline) {
			return withdrawalNotDueError{deadline: deadline}
		}
		for _, purger := range s.purgers {
			if err := purger.PurgeUser(ctx, scope); err != nil {
				return fmt.Errorf("purge %s user data: %w", purger.PurgeName(), err)
			}
		}
		if err := tx.PurgeAccountDependents(ctx, scope); err != nil {
			return err
		}
		if err := s.credentials.SetUserBanned(ctx, scope.UserID(), true); err != nil {
			return err
		}
		if err := s.credentials.DeleteUser(ctx, scope.UserID()); err != nil {
			return err
		}
		deleted, err := tx.PurgeAccountUser(ctx, scope)
		if err != nil {
			return err
		}
		if !deleted {
			return fmt.Errorf("account user completion marker disappeared before purge completed")
		}
		return nil
	})
}

func (s *Service) withdrawalReady() error {
	switch {
	case s.withdrawals == nil:
		return ErrWithdrawalStoreRequired
	case s.scheduler == nil:
		return ErrWithdrawalSchedulerRequired
	case s.credentials == nil:
		return ErrCredentialDirectoryRequired
	case len(s.purgers) == 0:
		return ErrPurgersRequired
	default:
		return nil
	}
}

type withdrawalNotDueError struct {
	deadline time.Time
}

func (e withdrawalNotDueError) Error() string {
	return "withdrawal sweep claimed before its retention deadline"
}

func (e withdrawalNotDueError) RetryAt() time.Time {
	return e.deadline
}
