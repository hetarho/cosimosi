package account

import (
	"container/list"
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

type withdrawalStatusCacheEntry struct {
	withdrawnAt time.Time
	withdrawn   bool
	expiresAt   time.Time
	recency     *list.Element
}

type withdrawalStatusCache struct {
	mu         sync.Mutex
	entries    map[string]*withdrawalStatusCacheEntry
	recency    list.List
	generation uint64
}

func (c *withdrawalStatusCache) read(
	userID string,
	now time.Time,
) (time.Time, bool, bool, uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[userID]
	if !ok {
		return time.Time{}, false, false, c.generation
	}
	if !now.Before(entry.expiresAt) {
		c.removeLocked(userID, entry)
		return time.Time{}, false, false, c.generation
	}
	c.recency.MoveToFront(entry.recency)
	return entry.withdrawnAt, entry.withdrawn, true, c.generation
}

func (c *withdrawalStatusCache) writeIfCurrent(
	userID string,
	withdrawnAt time.Time,
	withdrawn bool,
	now time.Time,
	version uint64,
) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.generation != version {
		return false
	}
	c.setLocked(userID, withdrawnAt, withdrawn, now)
	return true
}

func (c *withdrawalStatusCache) replace(
	userID string,
	withdrawnAt time.Time,
	withdrawn bool,
	now time.Time,
) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	c.setLocked(userID, withdrawnAt, withdrawn, now)
}

func (c *withdrawalStatusCache) invalidate(userID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.generation++
	if entry, ok := c.entries[userID]; ok {
		c.removeLocked(userID, entry)
	}
}

func (c *withdrawalStatusCache) setLocked(
	userID string,
	withdrawnAt time.Time,
	withdrawn bool,
	now time.Time,
) {
	if c.entries == nil {
		c.entries = make(map[string]*withdrawalStatusCacheEntry)
	}
	if entry, ok := c.entries[userID]; ok {
		entry.withdrawnAt = withdrawnAt
		entry.withdrawn = withdrawn
		entry.expiresAt = now.Add(time.Duration(values.AccountWithdrawalStatusCacheTtlMs) * time.Millisecond)
		c.recency.MoveToFront(entry.recency)
		return
	}
	if len(c.entries) >= values.AccountWithdrawalStatusCacheMaxEntries {
		oldest := c.recency.Back()
		if oldest != nil {
			oldestUserID := oldest.Value.(string)
			c.removeLocked(oldestUserID, c.entries[oldestUserID])
		}
	}
	entry := &withdrawalStatusCacheEntry{
		withdrawnAt: withdrawnAt,
		withdrawn:   withdrawn,
		expiresAt:   now.Add(time.Duration(values.AccountWithdrawalStatusCacheTtlMs) * time.Millisecond),
	}
	entry.recency = c.recency.PushFront(userID)
	c.entries[userID] = entry
}

func (c *withdrawalStatusCache) removeLocked(
	userID string,
	entry *withdrawalStatusCacheEntry,
) {
	delete(c.entries, userID)
	if entry != nil && entry.recency != nil {
		c.recency.Remove(entry.recency)
	}
}

func withdrawalRetentionWindow() time.Duration {
	return values.AccountWithdrawalRetentionWindow()
}

// Withdraw confirms the account exists before pairing the durable sweep trigger with the
// account soft-delete. A trigger without a mark remains harmless because the worker always
// re-derives due-ness.
func (s *Service) Withdraw(ctx context.Context, scope platform.UserScope) (WithdrawalWindow, error) {
	if scope.UserID() == "" {
		return WithdrawalWindow{}, ErrScopeRequired
	}
	_, found, err := s.withdrawals.WithdrawalStatus(ctx, scope)
	if err != nil {
		return WithdrawalWindow{}, err
	}
	if !found {
		return WithdrawalWindow{}, ErrSignupRequired
	}
	now := s.now().UTC()
	if err := s.scheduler.Schedule(ctx, scope, now.Add(withdrawalRetentionWindow())); err != nil {
		return WithdrawalWindow{}, err
	}

	var withdrawnAt time.Time
	err = s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
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
	s.withdrawalStatuses.replace(scope.UserID(), withdrawnAt, true, s.now().UTC())
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
	// The account is live once the transaction commits. Invalidate before cancellation,
	// whose failure must not strand the next request behind a stale withdrawn entry.
	s.withdrawalStatuses.invalidate(scope.UserID())
	if err := s.scheduler.Cancel(ctx, scope); err != nil {
		return time.Time{}, err
	}
	return now, nil
}

// AccountStatus publishes the account-status facts the platform admission gate relays: whether the
// account is withdrawn and, if so, when it can last be restored.
func (s *Service) AccountStatus(ctx context.Context, userID string) (platform.AccountStatus, error) {
	withdrawnAt, withdrawn, err := s.WithdrawnAt(ctx, userID)
	if err != nil || !withdrawn {
		return platform.AccountStatus{}, err
	}
	withdrawnAt = withdrawnAt.UTC()
	return platform.AccountStatus{
		Withdrawn:         true,
		WithdrawnAt:       withdrawnAt,
		RestoreDeadlineAt: withdrawnAt.Add(withdrawalRetentionWindow()),
	}, nil
}

// WithdrawnAt reads the withdrawal status behind AccountStatus.
// An absent User row and a live row are both not-withdrawn; persistence failures propagate.
func (s *Service) WithdrawnAt(ctx context.Context, userID string) (time.Time, bool, error) {
	if s.withdrawals == nil {
		return time.Time{}, false, ErrWithdrawalStoreRequired
	}
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		return time.Time{}, false, err
	}
	for {
		now := s.now().UTC()
		withdrawnAt, withdrawn, ok, version := s.withdrawalStatuses.read(userID, now)
		if ok {
			return withdrawnAt, withdrawn, nil
		}
		withdrawnAt, found, err := s.withdrawals.WithdrawalStatus(ctx, scope)
		if err != nil {
			return time.Time{}, false, err
		}
		withdrawn = found && !withdrawnAt.IsZero()
		if s.withdrawalStatuses.writeIfCurrent(userID, withdrawnAt, withdrawn, now, version) {
			return withdrawnAt, withdrawn, nil
		}
	}
}

// errSweepRestoredMidway is the sweep finding its completion marker cleared after it claimed: only a
// restore racing the deadline across process clocks can do that.
var errSweepRestoredMidway = errors.New("account was restored while its withdrawal sweep was running")

// SweepWithdrawnAccount is reachable only from the withdrawal_sweep worker handler. No transaction
// or row lock is held across a leg or a credential call, so a slow context or a slow Supabase Admin
// API never extends a lock or pins a pooled connection:
//
//  1. claim: due-ness is re-derived from deleted_at under the users row lock, in a transaction that
//     commits before anything is deleted. A restore is refused from the deadline on, so a claimed
//     sweep cannot be undone by one;
//  2. each owning-context leg commits its own idempotent transaction;
//  3. account dependents commit in a short transaction of their own;
//  4. the credential is banned and deleted with no transaction open;
//  5. the users row, the completion marker, is removed last under its lock.
//
// Every step is idempotent, so a crash anywhere completes on replay: the marker survives until the
// last step, and the replay's claim finds it again.
func (s *Service) SweepWithdrawnAccount(ctx context.Context, scope platform.UserScope, now time.Time) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	due, err := s.claimSweep(ctx, scope, now)
	if err != nil || !due {
		return err
	}
	for _, purger := range s.purgers {
		if err := purger.PurgeUser(ctx, scope); err != nil {
			return fmt.Errorf("purge %s user data: %w", purger.PurgeName(), err)
		}
	}
	if err := s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
		return tx.PurgeAccountDependents(ctx, scope)
	}); err != nil {
		return err
	}
	if err := s.credentials.SetUserBanned(ctx, scope.UserID(), true); err != nil {
		return err
	}
	if err := s.credentials.DeleteUser(ctx, scope.UserID()); err != nil {
		return err
	}
	return s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
		withdrawnAt, found, err := tx.WithdrawalStatusForUpdate(ctx, scope)
		if err != nil || !found {
			return err
		}
		if withdrawnAt.IsZero() {
			return errSweepRestoredMidway
		}
		_, err = tx.PurgeAccountUser(ctx, scope)
		return err
	})
}

// claimSweep reports whether the sweep should run now: an absent or cleared marker completes as a
// no-op, an early one retries at the deadline.
func (s *Service) claimSweep(ctx context.Context, scope platform.UserScope, now time.Time) (bool, error) {
	due := false
	err := s.withdrawals.InWithdrawalTx(ctx, func(tx WithdrawalStore) error {
		withdrawnAt, found, err := tx.WithdrawalStatusForUpdate(ctx, scope)
		if err != nil || !found || withdrawnAt.IsZero() {
			return err
		}
		deadline := withdrawnAt.Add(withdrawalRetentionWindow())
		if now.UTC().Before(deadline) {
			return withdrawalNotDueError{deadline: deadline}
		}
		due = true
		return nil
	})
	return due, err
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
