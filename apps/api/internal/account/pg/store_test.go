package pg

import (
	"context"
	"errors"
	"testing"

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
	if _, _, err := empty.GetPalettePreference(ctx, scope); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("GetPalettePreference(no queries) err = %v, want ErrQueriesRequired", err)
	}
	if _, err := empty.UpsertPalettePreference(ctx, scope, "cosimosi-default"); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("UpsertPalettePreference(no queries) err = %v, want ErrQueriesRequired", err)
	}

	var anonymous platform.UserScope
	if _, _, err := empty.GetPalettePreference(ctx, anonymous); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("GetPalettePreference(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
	if _, err := empty.UpsertPalettePreference(ctx, anonymous, "cosimosi-default"); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("UpsertPalettePreference(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
}
