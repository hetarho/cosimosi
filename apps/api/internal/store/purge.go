package store

import (
	"context"

	"github.com/cosimosi/api/internal/platform"
)

// UserPurgeRepo is the withdrawal sweep's leg: one call, so the two tables' deletes commit together
// rather than leaving a selection behind an already-purged ownership history. It is the ONLY delete
// this context has — the single exception [I1] names, and the user's own.
type UserPurgeRepo interface {
	PurgeUser(ctx context.Context, scope platform.UserScope) error
}

// WithdrawalPurger is store's published, idempotent account-withdrawal purge leg, satisfying the
// account context's UserDataPurger port. It is bound at the composition root because the store tables
// did not exist when the withdrawal sweep shipped.
//
// It takes the repository rather than the service (twinkle's shipped shape): a sweep needs nothing the
// service composes — no catalog, no economy — and the worker that runs the sweep should not have to
// build a save path to delete rows.
type WithdrawalPurger struct {
	repo UserPurgeRepo
}

func NewWithdrawalPurger(repo UserPurgeRepo) WithdrawalPurger {
	return WithdrawalPurger{repo: repo}
}

func (WithdrawalPurger) PurgeName() string { return "store" }

func (p WithdrawalPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	return purgeUser(ctx, p.repo, scope)
}

// purgeUser is the one guard both entry points share: the service's published behavior and the sweep's
// leg refuse the same way.
func purgeUser(ctx context.Context, repo UserPurgeRepo, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if repo == nil {
		return ErrStoreRequired
	}
	return repo.PurgeUser(ctx, scope)
}
