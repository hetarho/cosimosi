package pg

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

func TestPalettePreferenceUpsertAndUserScope(t *testing.T) {
	pool := openAccountTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-account-%d", time.Now().UnixNano())
	userA := base + "-a"
	userB := base + "-b"
	cleanupAccountTestRows(t, pool, userA, userB)
	scopeA := mustUserScope(t, userA)
	scopeB := mustUserScope(t, userB)
	store := NewStore(pool.PgxPool())

	// Unset: no row for a fresh user (the use-case resolves this to the default id).
	if _, found, err := store.GetPalettePreference(ctx, scopeA); err != nil || found {
		t.Fatalf("GetPalettePreference(absent) = found %v err %v, want found=false", found, err)
	}

	// Upsert stores and echoes the chosen id.
	if got, err := store.UpsertPalettePreference(ctx, scopeA, "muted-dusk"); err != nil || got != "muted-dusk" {
		t.Fatalf("UpsertPalettePreference = %q err %v, want muted-dusk", got, err)
	}
	if got, found, err := store.GetPalettePreference(ctx, scopeA); err != nil || !found || got != "muted-dusk" {
		t.Fatalf("GetPalettePreference(set) = %q found %v err %v, want muted-dusk", got, found, err)
	}

	// A second upsert replaces the prior choice — one row per user.
	if got, err := store.UpsertPalettePreference(ctx, scopeA, "cosimosi-default"); err != nil || got != "cosimosi-default" {
		t.Fatalf("UpsertPalettePreference(replace) = %q err %v, want cosimosi-default", got, err)
	}
	if got, _, err := store.GetPalettePreference(ctx, scopeA); err != nil || got != "cosimosi-default" {
		t.Fatalf("GetPalettePreference(replaced) = %q err %v, want cosimosi-default", got, err)
	}

	// Per-user isolation: user A's preference is invisible to user B ([U1]).
	if _, found, err := store.GetPalettePreference(ctx, scopeB); err != nil || found {
		t.Fatalf("GetPalettePreference(other user) = found %v err %v, want found=false", found, err)
	}

	var rows int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM palette_preferences WHERE user_id = $1", userA).Scan(&rows); err != nil {
		t.Fatalf("count rows failed: %v", err)
	}
	if rows != 1 {
		t.Fatalf("palette_preferences rows for user = %d, want 1", rows)
	}
}

func mustUserScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope(%s) failed: %v", userID, err)
	}
	return scope
}

func openAccountTestPool(t *testing.T) *platformdb.Pool {
	t.Helper()

	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func cleanupAccountTestRows(t *testing.T, pool *platformdb.Pool, userIDs ...string) {
	t.Helper()

	for _, userID := range userIDs {
		if strings.TrimSpace(userID) == "" {
			t.Fatal("cleanup requires a user id")
		}
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		for _, userID := range userIDs {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM palette_preferences WHERE user_id = $1", userID); err != nil {
				t.Fatalf("cleanup palette_preferences failed: %v", err)
			}
		}
	})
}
