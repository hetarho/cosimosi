package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
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
	intent := memory.RecallSpendIntent("op-1", "memory-1", 1.0)
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
	if want := values.TwinkleSmallDailyAmount - wantCost; balance.Small != want {
		t.Fatalf("small after spend = %d, want %d (the committed debit)", balance.Small, want)
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
	if balance.General != values.TwinkleEarnWrite {
		t.Fatalf("general = %d, want the single write grant %d", balance.General, values.TwinkleEarnWrite)
	}
}

// Narrowed to the invite resolver: payment is gone from the product, so the only external trust seam
// left is the account/signup one. The point survives — an unbound seam refuses rather than credits.
func TestProductionTwinkleInviteEarnFailsClosedWithoutItsAdapter(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-economy-%d-trust", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	scope := economyScope(t, userID)
	service := economyTwinkleService(t, pool)
	if _, err := newTwinkleService(pool, &memorySpendSignals{}, nil, staticTwinkleZone("UTC")); !errors.Is(err, twinkle.ErrInviteResolverRequired) {
		t.Fatalf("newTwinkleService without resolver err = %v, want ErrInviteResolverRequired", err)
	}
	// The [U7] day boundary is a trust boundary too: an unbound zone reader refuses to boot, so no
	// deployment can silently fall back to reading every user's day in UTC.
	if _, err := newTwinkleService(pool, &memorySpendSignals{}, twinkle.UnavailableInviteResolver{}, nil); !errors.Is(err, twinkle.ErrZoneReaderRequired) {
		t.Fatalf("newTwinkleService without zone reader err = %v, want ErrZoneReaderRequired", err)
	}

	if _, err := service.ClaimInvite(ctx, scope, "fabricated-account-id"); !errors.Is(err, twinkle.ErrInviteResolutionUnavailable) {
		t.Fatalf("ClaimInvite err = %v, want ErrInviteResolutionUnavailable", err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != 0 {
		t.Fatalf("external earn ledger rows = %d, want 0 while the adapter is unavailable", rows)
	}
}

// A4: a purchase debit commits with the transaction that caused it, or not at all. The store context's
// Decorate owns that transaction; this asserts the seam it will bind — a rolled-back caller transaction
// leaves no ledger row and no balance change ([G7][P8]).
func TestPurchaseSpendJoinsAndRollsBackWithTheCallersTransaction(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-economy-%d-purchase", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	scope := economyScope(t, userID)
	service := economyTwinkleService(t, pool)

	// Fund GENERAL through a real earn so the purchase has something to draw from.
	if err := pool.InTx(ctx, func(ctx context.Context, tx pgx.Tx) error {
		return service.EarnOnWrite(ctx, scope, twinklepg.NewStore(tx), "diary-purchase-seed")
	}); err != nil {
		t.Fatalf("seed earn failed: %v", err)
	}

	// A caller transaction that rolls back must take the debit with it.
	rollback := errors.New("the decorate that caused this failed")
	err := pool.InTx(ctx, func(ctx context.Context, tx pgx.Tx) error {
		if err := service.CheckAndSpend(ctx, scope, twinklepg.NewStore(tx), twinkle.PurchaseSpendIntent(30, "purchase:rolled-back")); err != nil {
			return err
		}
		return rollback
	})
	if !errors.Is(err, rollback) {
		t.Fatalf("InTx err = %v, want the injected rollback", err)
	}
	balance, err := service.GetBalance(ctx, scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.General != values.TwinkleEarnWrite {
		t.Fatalf("general = %d, want the seed %d — a rolled-back purchase debited anyway",
			balance.General, values.TwinkleEarnWrite)
	}

	// Committed, it lands once: a GENERAL-only spend row and the matching debit.
	if err := pool.InTx(ctx, func(ctx context.Context, tx pgx.Tx) error {
		return service.CheckAndSpend(ctx, scope, twinklepg.NewStore(tx), twinkle.PurchaseSpendIntent(30, "purchase:committed"))
	}); err != nil {
		t.Fatalf("committed purchase failed: %v", err)
	}
	balance, err = service.GetBalance(ctx, scope)
	if err != nil {
		t.Fatalf("GetBalance failed: %v", err)
	}
	if balance.General != values.TwinkleEarnWrite-30 {
		t.Fatalf("general = %d, want %d after the purchase", balance.General, values.TwinkleEarnWrite-30)
	}
	page, err := service.GetLedger(ctx, scope, 0, "")
	if err != nil {
		t.Fatalf("GetLedger failed: %v", err)
	}
	purchases := 0
	for _, view := range page.Entries {
		if view.Entry.Reason != twinkle.ReasonOrnamentPurchase {
			continue
		}
		purchases++
		if view.Entry.FromSmall != 0 || view.Entry.FromGeneral != 30 {
			t.Fatalf("purchase row = %+v, want GENERAL-only ([P9])", view.Entry)
		}
	}
	if purchases != 1 {
		t.Fatalf("purchase rows in the history = %d, want exactly 1", purchases)
	}
}

func economyTwinkleService(t *testing.T, pool *platformdb.Pool) *twinkle.Service {
	t.Helper()
	service, err := newTwinkleService(pool, &memorySpendSignals{}, twinkle.UnavailableInviteResolver{}, staticTwinkleZone("UTC"))
	if err != nil {
		t.Fatalf("newTwinkleService failed: %v", err)
	}
	return service
}

// staticTwinkleZone stands in for the account-backed adapter where the test has no profile row.
type staticTwinkleZone string

func (z staticTwinkleZone) ZoneFor(context.Context, platform.UserScope) (string, error) {
	return string(z), nil
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

// The twinkleIntent mapping is pure — assert it against twinkle's own constructors rather than by
// reading fields, which are unexported precisely so a caller cannot assemble a mixed intent.
func TestTwinkleIntentMapsKindsAndSignals(t *testing.T) {
	t.Parallel()
	recallKey := spendDedupKey(memory.RecallSpendIntent("op-1", "m1", 0))
	recall, err := twinkleIntent(memory.RecallSpendIntent("op-1", "m1", 2.5))
	if err != nil || recall != twinkle.RecallSpendIntent(2.5, recallKey) {
		t.Fatalf("recall intent = %+v (err %v), want a recall intent carrying weight 2.5 and its op key", recall, err)
	}
	// The operation id + target derive the spend's dedup key (A3) — per-action for a single
	// recall, per-member when a whole-diary recall shares one operation id across its members.
	if recallKey == "" {
		t.Fatal("the recall intent carries no dedup key")
	}
	gistKey := spendDedupKey(memory.GistViewSpendIntent("op-2", "m1", 1))
	gist, err := twinkleIntent(memory.GistViewSpendIntent("op-2", "m1", 3))
	if err != nil || gist != twinkle.GistViewSpendIntent(3, gistKey) {
		t.Fatalf("gist intent = %+v (err %v), want a gist-view intent carrying stage 3 and its op key", gist, err)
	}
	// Field boundaries are unambiguous: delimiter-like ids cannot alias another operation/target.
	if spendDedupKey(memory.RecallSpendIntent("a:b", "c", 0)) == spendDedupKey(memory.RecallSpendIntent("a", "b:c", 0)) {
		t.Fatal("length-delimited operation/target pairs must derive distinct dedup keys")
	}
	if _, err := twinkleIntent(memory.SpendIntent{Kind: "unknown"}); err == nil {
		t.Fatal("an unknown kind must be a wiring fault, not a silent free spend")
	}
}
