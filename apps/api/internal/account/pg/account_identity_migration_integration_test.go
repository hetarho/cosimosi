package pg

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

func TestAccountIdentityMigrationEnforcesInviteStatesAndBoundaries(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-account-identity-%d", time.Now().UnixNano())
	cleanupAccountIdentityRows(t, pool, base)

	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
		VALUES ($1, $2, $2, $3, now(), now())`,
		base+"-self", base+"-inviter", base+"-token-self"); err == nil {
		t.Fatal("self invite was accepted")
	}

	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at)
		VALUES ($1, $2, $3, $4, now())`,
		base+"-unbound", base+"-inviter", base+"-unbound-invitee", base+"-token-unbound"); err == nil {
		t.Fatal("unbound invite was accepted")
	}

	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
		VALUES ($1, $2, $3, $4, now(), now())`,
		base+"-first", base+"-inviter", base+"-invitee", base+"-token"); err != nil {
		t.Fatalf("insert valid invite failed: %v", err)
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
		VALUES ($1, $2, $3, $4, now(), now())`,
		base+"-duplicate-invitee", base+"-other-inviter", base+"-invitee", base+"-other-token"); err == nil {
		t.Fatal("an invitee was bound twice")
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
		VALUES ($1, $2, $3, $4, now(), now())`,
		base+"-duplicate-token", base+"-inviter", base+"-other-invitee", base+"-token"); err == nil {
		t.Fatal("an invite token was consumed twice")
	}

	var forbiddenColumns int
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT count(*)
		FROM information_schema.columns
		WHERE table_schema = 'public'
		  AND ((table_name = 'users' AND column_name = 'email')
		    OR (table_name = 'invites' AND column_name = 'deleted_at'))`).Scan(&forbiddenColumns); err != nil {
		t.Fatalf("inspect forbidden columns: %v", err)
	}
	if forbiddenColumns != 0 {
		t.Fatalf("forbidden account columns = %d, want 0", forbiddenColumns)
	}

	var userForeignKeys int
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT count(*)
		FROM information_schema.table_constraints tc
		JOIN information_schema.constraint_column_usage ccu
		  ON ccu.constraint_name = tc.constraint_name
		 AND ccu.constraint_schema = tc.constraint_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND ccu.table_name = 'users'
		  AND tc.table_name IN ('auth_providers', 'invites')`).Scan(&userForeignKeys); err != nil {
		t.Fatalf("inspect account foreign keys: %v", err)
	}
	if userForeignKeys != 0 {
		t.Fatalf("foreign keys to users = %d, want 0", userForeignKeys)
	}
}

func TestProfileStoreLeavesUnprovisionedAbsentAndUpdatesOnlyUsers(t *testing.T) {
	pool := openAccountTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-account-profile-%d", time.Now().UnixNano())
	cleanupAccountIdentityRows(t, pool, userID)
	store := NewStore(pool.PgxPool())
	scope := mustUserScope(t, userID)

	if _, found, err := store.GetUserProfile(ctx, scope); err != nil || found {
		t.Fatalf("GetUserProfile(unprovisioned) = found %v, err %v", found, err)
	}
	var usersBefore int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM users WHERE user_id = $1", userID).Scan(&usersBefore); err != nil {
		t.Fatalf("count unprovisioned users: %v", err)
	}
	if usersBefore != 0 {
		t.Fatalf("unprovisioned read created %d users rows", usersBefore)
	}

	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO users (user_id, nickname, timezone, locale)
		VALUES ($1, 'before', 'UTC', 'en')`, userID); err != nil {
		t.Fatalf("insert profile fixture: %v", err)
	}
	profile, found, err := store.UpdateUserProfile(ctx, scope, accountUpdateFixture())
	if err != nil || !found {
		t.Fatalf("UpdateUserProfile = %#v, found %v, err %v", profile, found, err)
	}
	if profile.Nickname != "after" || profile.Timezone != "Asia/Seoul" || profile.Locale != "ko" {
		t.Fatalf("updated profile = %#v", profile)
	}

	for _, table := range []string{"twinkle_balances", "twinkle_ledger_entries", "universe_state"} {
		var rows int
		if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM "+table+" WHERE user_id = $1", userID).Scan(&rows); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		if rows != 0 {
			t.Fatalf("profile update wrote %d rows to %s", rows, table)
		}
	}
}

func accountUpdateFixture() account.UpdateProfileInput {
	return account.UpdateProfileInput{
		Nickname: "after",
		Timezone: "Asia/Seoul",
		Locale:   "ko",
	}
}

func cleanupAccountIdentityRows(t *testing.T, pool *platformdb.Pool, marker string) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := pool.PgxPool().Exec(ctx,
			"DELETE FROM invites WHERE user_id LIKE $1 OR invitee_user_id LIKE $1 OR id LIKE $1", marker+"%"); err != nil {
			t.Fatalf("cleanup invites: %v", err)
		}
		for _, table := range []string{"auth_providers", "users"} {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM "+table+" WHERE user_id LIKE $1", marker+"%"); err != nil {
				t.Fatalf("cleanup %s: %v", table, err)
			}
		}
	})
}
