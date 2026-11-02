package main

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/twinkle"
)

// Every economy path that runs inside a transaction must finish on a pool of ONE connection. The
// pool-side zone reader below really reads through the pool, so a path that read it while holding
// its transaction would wait on a second connection until the deadline.
func TestEconomyPathsCompleteOnASingleConnection(t *testing.T) {
	pool := openSingleConnectionPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-single-connection-%d-user", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	scope := economyScope(t, userID)

	twinkleService, err := newTwinkleService(pool, &memorySpendSignals{}, twinkle.UnavailableInviteResolver{},
		poolZoneReader{zones: account.NewZoneReader(accountpg.NewStore(pool.PgxPool()))})
	if err != nil {
		t.Fatalf("newTwinkleService failed: %v", err)
	}

	// Twinkle's own ledger transaction (admin grants, rewards, invite claims).
	if _, err := twinkleService.EarnAdminGrant(ctx, scope, 200, "grant-"+userID); err != nil {
		t.Fatalf("EarnAdminGrant on one connection failed: %v", err)
	}

	memoryStore := bindMemoryTransactions(memorypg.NewStore(pool.PgxPool()), twinkleService, noProgress{})
	// The write grant inside a launch transaction.
	if err := memoryStore.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
		return tx.EarnDiary(ctx, scope, "diary-"+userID)
	}); err != nil {
		t.Fatalf("launch earn on one connection failed: %v", err)
	}
	// The paid check and debit inside a recall transaction (the gist view uses the same seam).
	intent := memory.RecallSpendIntent("op-"+userID, "memory-"+userID, 1.0)
	if err := memoryStore.InRecallTx(ctx, func(tx memory.RecallTx) error {
		if err := tx.CheckMemorySpend(ctx, scope, intent); err != nil {
			return err
		}
		return tx.SpendMemory(ctx, scope, intent)
	}); err != nil {
		t.Fatalf("recall spend on one connection failed: %v", err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != 3 {
		t.Fatalf("ledger rows = %d, want the grant, the write earn and the recall spend", rows)
	}
}

// poolZoneReader reads the zone through the pool, as production's pool-side reader does.
type poolZoneReader struct {
	zones account.ZoneReader
}

func (r poolZoneReader) ZoneFor(ctx context.Context, scope platform.UserScope) (string, error) {
	return r.zones.ZoneFor(ctx, scope)
}

func (r poolZoneReader) ZonesFor(ctx context.Context, userIDs []string) (map[string]string, error) {
	zones := make(map[string]string, len(userIDs))
	for _, userID := range userIDs {
		scope, err := platform.NewUserScope(userID)
		if err != nil {
			return nil, err
		}
		if zones[userID], err = r.zones.ZoneFor(ctx, scope); err != nil {
			return nil, err
		}
	}
	return zones, nil
}

func openSingleConnectionPool(t *testing.T) *platformdb.Pool {
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
	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url, MaxConns: 1})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)
	if got := pool.MaxConns(); got != 1 {
		t.Fatalf("pool MaxConns = %d, want 1", got)
	}
	return pool
}
