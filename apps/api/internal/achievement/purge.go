package achievement

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
)

// UserPurgeRepo is the withdrawal sweep's leg: one call, both tables, this user only. It is the
// ONLY delete this context has — the single exception [I1] names, and the user's own.
type UserPurgeRepo interface {
	PurgeUser(ctx context.Context, scope platform.UserScope) error
}

// WithdrawalPurger is achievement's published, idempotent account-withdrawal purge leg, satisfying
// the account context's UserDataPurger port. It is bound at the composition root because the
// achievement tables postdate the sweep — whose test fails until this leg is registered.
//
// It takes the repository rather than the service (store's shipped shape): a sweep needs nothing
// the service composes.
type WithdrawalPurger struct {
	repo UserPurgeRepo
}

func NewWithdrawalPurger(repo UserPurgeRepo) WithdrawalPurger {
	return WithdrawalPurger{repo: repo}
}

func (WithdrawalPurger) PurgeName() string { return "achievement" }

func (p WithdrawalPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	return purgeUser(ctx, p.repo, scope)
}

// purgeUser is the one guard both entry points share: the service's published behavior and the
// sweep's leg refuse the same way.
func purgeUser(ctx context.Context, repo UserPurgeRepo, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if repo == nil {
		return ErrRepoRequired
	}
	return repo.PurgeUser(ctx, scope)
}
