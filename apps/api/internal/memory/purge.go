package memory

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/platform"
)

var (
	ErrUserPurgeRepoRequired = errors.New("memory user purge requires a repository")
	ErrKeepJobIDRequired     = errors.New("memory purge requires the in-flight withdrawal job id")
)

// UserPurgeRepo is memory's persistence edge for the account-withdrawal purge leg.
type UserPurgeRepo interface {
	PurgeUser(ctx context.Context, scope platform.UserScope, keepJobID string) error
}

// WithdrawalPurger is memory's published account-withdrawal purge leg. It keeps the
// currently running sweep job so the shared runner can record completion afterwards.
type WithdrawalPurger struct {
	repo UserPurgeRepo
}

func NewWithdrawalPurger(repo UserPurgeRepo) WithdrawalPurger {
	return WithdrawalPurger{repo: repo}
}

func (WithdrawalPurger) PurgeName() string { return "memory" }

func (p WithdrawalPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	jobID, _ := WithdrawalSweepJobID(ctx)
	return PurgeUser(ctx, p.repo, scope, jobID)
}

// PurgeUser hard-deletes one user's memory-context footprint after account has
// re-derived the retention deadline. The in-flight withdrawal job stays until the
// shared runner records completion; its payload is empty and target is identity-only.
func PurgeUser(
	ctx context.Context,
	repo UserPurgeRepo,
	scope platform.UserScope,
	keepJobID string,
) error {
	if scope.UserID() == "" {
		return ErrScopeRequired
	}
	if repo == nil {
		return ErrUserPurgeRepoRequired
	}
	if keepJobID == "" {
		return ErrKeepJobIDRequired
	}
	return repo.PurgeUser(ctx, scope, keepJobID)
}
