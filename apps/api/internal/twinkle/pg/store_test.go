package pg

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/twinkle"
)

func TestStoreRequiresScopeAndQueries(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	scope, err := platform.NewUserScope("twinkle-store-guard-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	now := time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC)

	var empty Store
	if _, err := empty.GetBalanceRecord(ctx, scope); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("GetBalanceRecord(no queries) err = %v, want ErrQueriesRequired", err)
	}
	if _, err := empty.ApplyBalanceDelta(ctx, scope, now, 1, 0); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("ApplyBalanceDelta(no queries) err = %v, want ErrQueriesRequired", err)
	}
	if _, err := empty.AppendLedgerEntry(ctx, scope, twinkle.LedgerEntry{ID: "x"}); !errors.Is(err, ErrQueriesRequired) {
		t.Fatalf("AppendLedgerEntry(no queries) err = %v, want ErrQueriesRequired", err)
	}

	var anonymous platform.UserScope
	if _, err := empty.GetBalanceRecord(ctx, anonymous); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("GetBalanceRecord(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
	if _, err := empty.ApplyBalanceDelta(ctx, anonymous, now, 1, 0); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("ApplyBalanceDelta(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
	if _, err := empty.AppendLedgerEntry(ctx, anonymous, twinkle.LedgerEntry{ID: "x"}); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("AppendLedgerEntry(anonymous) err = %v, want ErrUserScopeRequired", err)
	}
}
