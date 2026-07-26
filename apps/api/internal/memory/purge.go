package memory

import (
	"context"
	"errors"

	"github.com/cosimosi/api/internal/platform"
)

var (
	ErrUserPurgeRepoRequired = errors.New("memory user purge requires a repository")
	ErrKeepJobIDRequired     = errors.New("memory user purge requires the in-flight job id")
)

// UserPurgeRepo is memory's persistence edge for the account-withdrawal purge leg.
type UserPurgeRepo interface {
	PurgeUser(ctx context.Context, scope platform.UserScope, keepJobID string) error
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
