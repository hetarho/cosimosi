package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
)

// The cross-context economy seam, proven on a real database (the composition root
// is the only place that may see both contexts, so the atomicity test lives here):
// a spend fired through the SpendGate adapter inside a memory transaction commits
// and rolls back WITH that transaction — no charge without the recall, no recall
// without the charge (plan 44 A3).

func TestEconomySpendJoinsTheMemoryTransaction(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-economy-%d-user", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	scope := economyScope(t, userID)

	memoryStore := memorypg.NewStore(pool.PgxPool())
	twinkleService := economyTwinkleService(t, pool)
	gate := twinkleSpendGate{service: twinkleService}
	intent := memory.RecallSpendIntent("memory-1", 1.0)
	wantCost := twinkle.RecallCost(1.0)

	// Roll back: the gate's ledger write vanishes with the enclosing transaction.
	injected := errors.New("injected recall failure after the spend")
	err := memoryStore.InRecallTx(ctx, func(tx memory.RecallTx) error {
		if err := gate.CheckAndSpend(ctx, scope, tx, intent); err != nil {
			return err
		}
		return injected
	})
	if !errors.Is(err, injected) {
		t.Fatalf("recall tx err = %v, want the injected failure", err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != 0 {
		t.Fatalf("ledger rows after rollback = %d, want 0 — no charge without the recall", rows)
	}

	// Commit: the same spend lands atomically with the transaction.
	err = memoryStore.InRecallTx(ctx, func(tx memory.RecallTx) error {
		return gate.CheckAndSpend(ctx, scope, tx, intent)
	})
	if err != nil {
		t.Fatalf("recall tx failed: %v", err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != 1 {
		t.Fatalf("ledger rows after commit = %d, want 1", rows)
	}
	balance, err := twinkleService.GetBalance(ctx, scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if want := values.TwinkleBasicDailyAmount - wantCost; balance.Basic != want {
		t.Fatalf("basic after spend = %d, want %d (the committed debit)", balance.Basic, want)
	}
}

func TestEconomyEarnOnWriteJoinsTheLaunchTransaction(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-economy-%d-earn", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	scope := economyScope(t, userID)

	memoryStore := memorypg.NewStore(pool.PgxPool())
	twinkleService := economyTwinkleService(t, pool)
	earn := twinkleEarnPort{service: twinkleService}

	// Roll back: a failed launch leaves no grant.
	injected := errors.New("injected launch failure after the grant")
	err := memoryStore.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
		if err := earn.OnDiaryLaunched(ctx, scope, tx, "diary-rollback"); err != nil {
			return err
		}
		return injected
	})
	if !errors.Is(err, injected) {
		t.Fatalf("launch tx err = %v, want the injected failure", err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != 0 {
		t.Fatalf("ledger rows after rollback = %d, want 0 — no grant without the launch", rows)
	}

	// Commit: one grant per diary, replay-proof across transactions.
	for range 2 {
		err = memoryStore.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
			return earn.OnDiaryLaunched(ctx, scope, tx, "diary-commit")
		})
		if err != nil {
			t.Fatalf("launch tx failed: %v", err)
		}
	}
	if rows := countLedgerRows(t, pool, userID); rows != 1 {
		t.Fatalf("ledger rows = %d, want 1 — the diary grant is idempotent", rows)
	}
	balance, err := twinkleService.GetBalance(ctx, scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.Additional != values.TwinkleEarnWrite {
		t.Fatalf("additional = %d, want the single write grant %d", balance.Additional, values.TwinkleEarnWrite)
	}
}

func TestProductionTwinkleExternalEarnsFailClosedWithoutAdapters(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-economy-%d-trust", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	scope := economyScope(t, userID)
	service := economyTwinkleService(t, pool)

	if _, err := service.Charge(ctx, scope, twinkle.DefaultChargePackID, "app-store", "arbitrary-non-empty-receipt"); !errors.Is(err, twinkle.ErrPaymentVerificationUnavailable) {
		t.Fatalf("Charge err = %v, want ErrPaymentVerificationUnavailable", err)
	}
	if _, err := service.ClaimInvite(ctx, scope, "fabricated-account-id"); !errors.Is(err, twinkle.ErrInviteResolutionUnavailable) {
		t.Fatalf("ClaimInvite err = %v, want ErrInviteResolutionUnavailable", err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != 0 {
		t.Fatalf("external earn ledger rows = %d, want 0 while adapters are unavailable", rows)
	}
}

func economyTwinkleService(t *testing.T, pool *platformdb.Pool) *twinkle.Service {
	t.Helper()
	service, err := newTwinkleService(pool, &memorySpendSignals{})
	if err != nil {
		t.Fatalf("newTwinkleService failed: %v", err)
	}
	return service
}

func countLedgerRows(t *testing.T, pool *platformdb.Pool, userID string) int {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var count int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = $1", userID).Scan(&count); err != nil {
		t.Fatalf("count ledger rows failed: %v", err)
	}
	return count
}

func economyScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope(%s) failed: %v", userID, err)
	}
	return scope
}

func openEconomyTestPool(t *testing.T) *platformdb.Pool {
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

// cleanupEconomyTestRows deletes this test user's rows on teardown. Test hygiene
// only — the system itself never deletes ledger entries ([I1]).
func cleanupEconomyTestRows(t *testing.T, pool *platformdb.Pool, userID string) {
	t.Helper()
	if strings.TrimSpace(userID) == "" {
		t.Fatal("cleanup requires a user id")
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, table := range []string{"twinkle_ledger_entries", "twinkle_balances"} {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID); err != nil {
				t.Fatalf("cleanup %s failed: %v", table, err)
			}
		}
	})
}

// The twinkleIntent mapping is pure — assert the kind→reason and signal carry
// without a database.
func TestTwinkleIntentMapsKindsAndSignals(t *testing.T) {
	t.Parallel()
	recall, err := twinkleIntent(memory.RecallSpendIntent("m1", 2.5))
	if err != nil || recall.Reason != twinkle.ReasonRecall || recall.AccessibilityCost != 2.5 {
		t.Fatalf("recall intent = %+v (err %v), want reason recall carrying weight 2.5", recall, err)
	}
	gist, err := twinkleIntent(memory.GistViewSpendIntent("m1", 3))
	if err != nil || gist.Reason != twinkle.ReasonGistView || gist.SemanticStage != 3 {
		t.Fatalf("gist intent = %+v (err %v), want reason gist_view carrying stage 3", gist, err)
	}
	if _, err := twinkleIntent(memory.SpendIntent{Kind: "unknown"}); err == nil {
		t.Fatal("an unknown kind must be a wiring fault, not a silent free spend")
	}
}
