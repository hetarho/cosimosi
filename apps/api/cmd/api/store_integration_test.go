package main

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/store"
	"github.com/cosimosi/api/internal/twinkle"
)

// The decoration save's atomicity, proven on a real database. The composition root is the only place
// that may see both contexts, so the test that a purchase and its debit are one thing lives here
// ([P8]): no ornament without the charge, no charge without the ornament.

func TestDecorateBuysAndDebitsInOneTransaction(t *testing.T) {
	pool := openEconomyTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-decorate-%d-user", time.Now().UnixNano())
	cleanupEconomyTestRows(t, pool, userID)
	cleanupStoreRows(t, pool, userID)
	scope := economyScope(t, userID)
	twinkleService := economyTwinkleService(t, pool)
	storeService, err := newStoreService(pool, twinkleService)
	if err != nil {
		t.Fatalf("newStoreService failed: %v", err)
	}
	background := mustCatalogOrnament(t, "background.lightfall")
	price := store.PriceOf(background)

	// A balance that cannot cover the sky: the save is refused whole, and it names the item.
	fundGeneral(t, ctx, twinkleService, scope, price-1)
	_, _, err = storeService.Decorate(ctx, scope, store.Selection{store.KindBackground: background.ID})
	var insufficient *store.InsufficientTwinkle
	if !errors.As(err, &insufficient) || insufficient.OrnamentID != background.ID {
		t.Fatalf("refusal = %v (%+v), want the named store refusal", err, insufficient)
	}
	if owned := countStoreRows(t, ctx, pool, "ornament_ownerships", userID); owned != 0 {
		t.Fatalf("ownership rows after a refused save = %d, want none", owned)
	}
	if applied := countStoreRows(t, ctx, pool, "ornament_selections", userID); applied != 0 {
		t.Fatalf("applied rows after a refused save = %d, want none", applied)
	}
	ledgerBefore := countLedgerRows(t, pool, userID)

	// One more Twinkle, and the same save commits: ownership, the applied row and exactly one debit.
	fundGeneral(t, ctx, twinkleService, scope, 1)
	applied, spent, err := storeService.Decorate(ctx, scope, store.Selection{
		store.KindBackground: background.ID,
	})
	if err != nil {
		t.Fatalf("Decorate failed: %v", err)
	}
	if spent != price {
		t.Errorf("spent = %d, want the catalog price %d", spent, price)
	}
	if len(applied) != 2 {
		t.Errorf("applied = %+v, want one entry per kind", applied)
	}
	if owned := countStoreRows(t, ctx, pool, "ornament_ownerships", userID); owned != 1 {
		t.Errorf("ownership rows = %d, want one", owned)
	}
	// One ledger row per SAVE, not per ornament — the history renders a purchase as a single line.
	if rows := countLedgerRows(t, pool, userID) - ledgerBefore; rows != 2 {
		t.Errorf("ledger rows added = %d, want the funding earn plus one purchase spend", rows)
	}
	if reason := latestLedgerReason(t, ctx, pool, userID); reason != string(twinkle.ReasonOrnamentPurchase) {
		t.Errorf("latest ledger reason = %q, want the ornament purchase", reason)
	}
	if small := latestLedgerFromSmall(t, ctx, pool, userID); small != 0 {
		t.Errorf("purchase drew %d from SMALL, want 0 — a purchase is GENERAL only", small)
	}

	// Re-saving the same thing is free and writes nothing: ownership is permanent.
	ledgerAfterPurchase := countLedgerRows(t, pool, userID)
	if _, spent, err = storeService.Decorate(ctx, scope, store.Selection{
		store.KindBackground: background.ID,
	}); err != nil || spent != 0 {
		t.Fatalf("re-save = spent %d, err %v, want a free no-op", spent, err)
	}
	if rows := countLedgerRows(t, pool, userID); rows != ledgerAfterPurchase {
		t.Errorf("ledger rows after a free re-save = %d, want %d", rows, ledgerAfterPurchase)
	}
}

func mustCatalogOrnament(t *testing.T, id store.OrnamentID) store.Ornament {
	t.Helper()
	ornament, ok := store.LookupOrnament(id)
	if !ok {
		t.Fatalf("the catalog does not publish %q", id)
	}
	return ornament
}

// fundGeneral credits GENERAL through the shipped admin-grant earn, so the test funds a balance the
// same way production does rather than writing the ledger by hand.
func fundGeneral(
	t *testing.T,
	ctx context.Context,
	service *twinkle.Service,
	scope platform.UserScope,
	amount int,
) {
	t.Helper()
	if amount <= 0 {
		return
	}
	if _, err := service.EarnAdminGrant(ctx, scope, amount, fmt.Sprintf("fund-%d", time.Now().UnixNano())); err != nil {
		t.Fatalf("fund GENERAL failed: %v", err)
	}
}

func countStoreRows(t *testing.T, ctx context.Context, pool *platformdb.Pool, table string, userID string) int {
	t.Helper()
	var count int
	if err := pool.PgxPool().QueryRow(
		ctx,
		"SELECT count(*) FROM "+table+" WHERE user_id = $1",
		userID,
	).Scan(&count); err != nil {
		t.Fatalf("count %s failed: %v", table, err)
	}
	return count
}

func latestLedgerReason(t *testing.T, ctx context.Context, pool *platformdb.Pool, userID string) string {
	t.Helper()
	var reason string
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT reason FROM twinkle_ledger_entries
		WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`, userID).Scan(&reason); err != nil {
		t.Fatalf("read latest ledger reason failed: %v", err)
	}
	return reason
}

func latestLedgerFromSmall(t *testing.T, ctx context.Context, pool *platformdb.Pool, userID string) int {
	t.Helper()
	var fromSmall int
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT from_basic FROM twinkle_ledger_entries
		WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`, userID).Scan(&fromSmall); err != nil {
		t.Fatalf("read latest ledger tier draw failed: %v", err)
	}
	return fromSmall
}

func cleanupStoreRows(t *testing.T, pool *platformdb.Pool, userID string) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		for _, table := range []string{"ornament_selections", "ornament_ownerships"} {
			if _, err := pool.PgxPool().Exec(
				ctx,
				"DELETE FROM "+table+" WHERE user_id = $1",
				userID,
			); err != nil {
				t.Errorf("cleanup %s failed: %v", table, err)
			}
		}
	})
}
