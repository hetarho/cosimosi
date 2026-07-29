package pg

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// The schema's own refusals, asserted against a real Postgres: the two constraints that make
// "one applied ornament per kind" and "a selection belongs to its kind" facts rather than rules
// application code is trusted to keep ([P8][I11]).
func TestSchemaRefusesCrossKindAndDuplicateSelections(t *testing.T) {
	pool := openStoreTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	userID := fmt.Sprintf("test-store-%d-schema", time.Now().UnixNano())
	cleanupStoreTestRows(t, pool, userID)

	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'STAR_SHADER', 'background.grainstorm')`, userID); err == nil {
		t.Error("the schema accepted a background id in a STAR_SHADER selection")
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'PALETTE', 'palette.anything')`, userID); err == nil {
		t.Error("the schema accepted a kind outside the closed set")
	}
	// `_` is a LIKE wildcard, so a LIKE-based prefix check would let the first of these through, and
	// `%` matches the empty string, which would let the second.
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'STAR_SHADER', 'starXshader.geode')`, userID); err == nil {
		t.Error("the schema accepted an id whose prefix only matches as a LIKE wildcard")
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'BACKGROUND', 'background.')`, userID); err == nil {
		t.Error("the schema accepted a bare prefix with no registry key")
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'BACKGROUND', 'background.grainstorm')`, userID); err != nil {
		t.Fatalf("seed selection failed: %v", err)
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'BACKGROUND', 'background.lightfall')`, userID); err == nil {
		t.Error("the schema accepted a second BACKGROUND selection for one user")
	}
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO ornament_ownerships (user_id, ornament_id, acquired_via)
		VALUES ($1, 'background.lightfall', 'gift')`, userID); err == nil {
		t.Error("the schema accepted an acquisition path outside the closed set")
	}
}

func TestStoreRepositoryRoundTripAndScopedPurge(t *testing.T) {
	pool := openStoreTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	base := fmt.Sprintf("test-store-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherUserID := base + "-other"
	cleanupStoreTestRows(t, pool, userID, otherUserID)

	repo := NewStore(pool.PgxPool())
	scope := mustUserScope(t, userID)
	other := mustUserScope(t, otherUserID)

	if err := repo.InsertOrnamentOwnership(ctx, scope, "background.lightfall", store.AcquisitionPurchase); err != nil {
		t.Fatalf("InsertOrnamentOwnership failed: %v", err)
	}
	// The primary key is the dedup key: a replayed grant is a no-op, and the first acquisition path
	// stands ([P9][P11]).
	if err := repo.InsertOrnamentOwnership(ctx, scope, "background.lightfall", store.AcquisitionAchievement); err != nil {
		t.Fatalf("replayed InsertOrnamentOwnership failed: %v", err)
	}
	ownerships, err := repo.ListOrnamentOwnerships(ctx, scope)
	if err != nil {
		t.Fatalf("ListOrnamentOwnerships failed: %v", err)
	}
	if len(ownerships) != 1 ||
		ownerships[0].OrnamentID != "background.lightfall" ||
		ownerships[0].AcquiredVia != store.AcquisitionPurchase ||
		ownerships[0].AcquiredAt.IsZero() {
		t.Fatalf("ownerships = %+v, want one purchase row with a timestamp", ownerships)
	}

	applied := store.OrnamentSelection{Kind: store.KindBackground, OrnamentID: "background.lightfall"}
	if err := repo.UpsertOrnamentSelection(ctx, scope, applied); err != nil {
		t.Fatalf("UpsertOrnamentSelection failed: %v", err)
	}
	replaced := store.OrnamentSelection{Kind: store.KindBackground, OrnamentID: "background.grainstorm"}
	if err := repo.UpsertOrnamentSelection(ctx, scope, replaced); err != nil {
		t.Fatalf("UpsertOrnamentSelection(replace) failed: %v", err)
	}
	selections, err := repo.ListOrnamentSelections(ctx, scope)
	if err != nil {
		t.Fatalf("ListOrnamentSelections failed: %v", err)
	}
	if len(selections) != 1 || selections[0] != replaced {
		t.Fatalf("selections = %+v, want only the replacement", selections)
	}

	if err := repo.InsertOrnamentOwnership(ctx, other, "background.lightfall", store.AcquisitionPurchase); err != nil {
		t.Fatalf("InsertOrnamentOwnership(other) failed: %v", err)
	}
	if err := repo.UpsertOrnamentSelection(ctx, other, applied); err != nil {
		t.Fatalf("UpsertOrnamentSelection(other) failed: %v", err)
	}
	if err := repo.PurgeUser(ctx, scope); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	if rows, err := repo.ListOrnamentOwnerships(ctx, scope); err != nil || len(rows) != 0 {
		t.Fatalf("ownerships after purge = %+v, err %v, want none", rows, err)
	}
	if rows, err := repo.ListOrnamentSelections(ctx, scope); err != nil || len(rows) != 0 {
		t.Fatalf("selections after purge = %+v, err %v, want none", rows, err)
	}
	if rows, err := repo.ListOrnamentOwnerships(ctx, other); err != nil || len(rows) != 1 {
		t.Fatalf("other user's ownerships = %+v, err %v, want kept", rows, err)
	}
	if rows, err := repo.ListOrnamentSelections(ctx, other); err != nil || len(rows) != 1 {
		t.Fatalf("other user's selections = %+v, err %v, want kept", rows, err)
	}
}

func TestStoreRepositoryRefusesScopelessAndUnbuiltUse(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	if _, err := (Store{}).ListOrnamentSelections(ctx, mustUserScope(t, "any-user")); err != ErrQueriesRequired {
		t.Errorf("unbuilt repository read err = %v, want ErrQueriesRequired", err)
	}
	repo := NewStore(fakeDBTX{})
	if _, err := repo.ListOrnamentOwnerships(ctx, platform.UserScope{}); err != ErrUserScopeRequired {
		t.Errorf("scopeless read err = %v, want ErrUserScopeRequired", err)
	}
	// A repository built over a transaction handle cannot begin the purge's own transaction, and says
	// so rather than deleting half of it.
	if err := repo.PurgeUser(ctx, mustUserScope(t, "any-user")); err != ErrTxStarterRequired {
		t.Errorf("purge without a pool err = %v, want ErrTxStarterRequired", err)
	}
}

// fakeDBTX is a DBTX that never runs: the refusal tests must fail before any query is sent.
type fakeDBTX struct{}

func (fakeDBTX) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, errors.New("store test DBTX does not execute")
}

func (fakeDBTX) Query(context.Context, string, ...any) (pgx.Rows, error) {
	return nil, errors.New("store test DBTX does not execute")
}

func (fakeDBTX) QueryRow(context.Context, string, ...any) pgx.Row { return nil }

func openStoreTestPool(t *testing.T) *platformdb.Pool {
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

// cleanupStoreTestRows removes these test users' rows on teardown. Test hygiene only — the product's
// single delete path is the withdrawal sweep ([I1]).
func cleanupStoreTestRows(t *testing.T, pool *platformdb.Pool, userIDs ...string) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		for _, userID := range userIDs {
			for _, table := range []string{"ornament_selections", "ornament_ownerships"} {
				if _, err := pool.PgxPool().Exec(
					ctx,
					"DELETE FROM "+table+" WHERE user_id = $1",
					userID,
				); err != nil {
					t.Errorf("cleanup %s failed: %v", table, err)
				}
			}
		}
	})
}

func mustUserScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}
