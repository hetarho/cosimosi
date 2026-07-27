package twinkle

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/platform"
)

var ErrUserPurgeRepoRequired = errors.New("twinkle user purge requires a repository")

type UserPurgeRepo interface {
	PurgeUser(ctx context.Context, scope platform.UserScope) error
}

// WithdrawalPurger is Twinkle's published, idempotent account-withdrawal purge leg.
type WithdrawalPurger struct {
	repo UserPurgeRepo
}

func NewWithdrawalPurger(repo UserPurgeRepo) WithdrawalPurger {
	return WithdrawalPurger{repo: repo}
}

func (WithdrawalPurger) PurgeName() string { return "twinkle" }

func (p WithdrawalPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	return PurgeUser(ctx, p.repo, scope)
}

// PurgeUser deletes only the withdrawing user's own balance and ledger. Counterpart
// invite credits belong to their users and are never reversed.
func PurgeUser(ctx context.Context, repo UserPurgeRepo, scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if repo == nil {
		return ErrUserPurgeRepoRequired
	}
	return repo.PurgeUser(ctx, scope)
}
