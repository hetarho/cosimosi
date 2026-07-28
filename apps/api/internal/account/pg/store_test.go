package pg

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/platform"
)

func TestStoreRequiresScopeAndQueries(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	scope, err := platform.NewUserScope("account-store-guard-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	var empty Store
	if _, err := empty.ListMoodColors(ctx, scope); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("ListMoodColors(no queries) err = %v, want ErrQueriesRequired", err)
	}
	if _, err := empty.SetMoodColor(ctx, scope, account.MoodColor{Mood: "CALM", Color: "#4eb9ad"}, 0); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("SetMoodColor(no queries) err = %v, want ErrQueriesRequired", err)
	}

	var anonymous platform.UserScope
	if _, err := empty.ListMoodColors(ctx, anonymous); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("ListMoodColors(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
	if _, err := empty.SetMoodColor(ctx, anonymous, account.MoodColor{Mood: "CALM", Color: "#4eb9ad"}, 0); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("SetMoodColor(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
}
