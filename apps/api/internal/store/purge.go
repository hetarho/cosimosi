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
// account context's UserDataPurger port. It is bound at the composition root because the store
// tables did not exist when the withdrawal sweep shipped.
type WithdrawalPurger struct {
	service *Service
}

func NewWithdrawalPurger(service *Service) WithdrawalPurger {
	return WithdrawalPurger{service: service}
}

func (WithdrawalPurger) PurgeName() string { return "store" }

func (p WithdrawalPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	if p.service == nil {
		return ErrStoreRequired
	}
	return p.service.PurgeUser(ctx, scope)
}
