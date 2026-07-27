package account

import (
	"container/list"
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

const (
	withdrawalStatusCacheTTL        = 5 * time.Second
	withdrawalStatusCacheMaxEntries = 4096
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
		entry.expiresAt = now.Add(withdrawalStatusCacheTTL)
		c.recency.MoveToFront(entry.recency)
		return
	}
	if len(c.entries) >= withdrawalStatusCacheMaxEntries {
		oldest := c.recency.Back()
		if oldest != nil {
			oldestUserID := oldest.Value.(string)
			c.removeLocked(oldestUserID, c.entries[oldestUserID])
		}
	}
	entry := &withdrawalStatusCacheEntry{
		withdrawnAt: withdrawnAt,
		withdrawn:   withdrawn,
		expiresAt:   now.Add(withdrawalStatusCacheTTL),
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
	if err := s.withdrawalReady(); err != nil {
		return WithdrawalWindow{}, err
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
	// The account is live once the transaction commits. Invalidate before cancellation,
	// whose failure must not strand the next request behind a stale withdrawn entry.
	s.withdrawalStatuses.invalidate(scope.UserID())
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
