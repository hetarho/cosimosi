package twinkle

import (
	"context"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

func TestWithdrawalPurgerPublishesTwinkleLeg(t *testing.T) {
	t.Parallel()
	repo := &fakeUserPurgeRepo{}
	purger := NewWithdrawalPurger(repo)
	scope, err := platform.NewUserScope("withdraw-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	if purger.PurgeName() != "twinkle" {
		t.Fatalf("PurgeName = %q", purger.PurgeName())
	}
	if err := purger.PurgeUser(context.Background(), scope); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	if repo.userID != scope.UserID() {
		t.Fatalf("purged user = %q, want %q", repo.userID, scope.UserID())
	}
}

type fakeUserPurgeRepo struct {
	userID string
}

func (f *fakeUserPurgeRepo) PurgeUser(
	_ context.Context,
	scope platform.UserScope,
) error {
	f.userID = scope.UserID()
	return nil
}
