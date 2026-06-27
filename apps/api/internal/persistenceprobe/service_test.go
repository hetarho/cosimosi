package persistenceprobe

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

func TestServiceRequiresStore(t *testing.T) {
	t.Parallel()

	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := (Service{}).Check(context.Background(), scope); !errors.Is(err, ErrStoreRequired) {
		t.Fatalf("Check error = %v, want ErrStoreRequired", err)
	}
}

func TestServiceDelegatesToConsumerOwnedStore(t *testing.T) {
	t.Parallel()

	store := &fakeStore{}
	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := NewService(store).Check(context.Background(), scope); err != nil {
		t.Fatalf("Check failed: %v", err)
	}
	if !store.called {
		t.Fatal("store was not called")
	}
}

type fakeStore struct {
	called bool
}

func (s *fakeStore) Check(context.Context, platform.UserScope) error {
	s.called = true
	return nil
}
