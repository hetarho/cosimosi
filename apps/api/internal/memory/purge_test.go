package memory

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

func TestWithdrawalPurgerRequiresInFlightJobIdentity(t *testing.T) {
	t.Parallel()
	purger := NewWithdrawalPurger(&fakeUserPurgeRepo{})

	if purger.PurgeName() != "memory" {
		t.Fatalf("PurgeName = %q", purger.PurgeName())
	}
	scope, err := platform.NewUserScope("withdraw-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := purger.PurgeUser(
		context.Background(),
		scope,
	); !errors.Is(err, ErrKeepJobIDRequired) {
		t.Fatalf("PurgeUser error = %v, want ErrKeepJobIDRequired", err)
	}
}

type fakeUserPurgeRepo struct{}

func (*fakeUserPurgeRepo) PurgeUser(
	context.Context,
	platform.UserScope,
	string,
) error {
	return nil
}
