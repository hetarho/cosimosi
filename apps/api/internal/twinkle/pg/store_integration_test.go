package pg

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
)

func TestTwinkleBalanceLazyBirthAndDelta(t *testing.T) {
	pool := openTwinkleTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-twinkle-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupTwinkleTestRows(t, pool, userID)
	scope := mustUserScope(t, userID)
	store := NewStore(pool.PgxPool())
	today := time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC)

	// Lazy birth: no row until the first write; the caller derives a full-SMALL balance.
	record, err := store.GetBalanceRecord(ctx, scope)
	if err != nil {
		t.Fatalf("GetBalanceRecord(absent) failed: %v", err)
	}
	if record != nil {
		t.Fatalf("GetBalanceRecord(absent) = %+v, want nil", record)
	}
	born := twinkle.DeriveBalance(today, time.UTC, twinkle.BalanceRecord{SmallResetWindow: today})
	if born.Small != values.TwinkleSmallDailyAmount || born.General != 0 {
		t.Fatalf("lazy-birth balance = %+v, want full SMALL %d", born, values.TwinkleSmallDailyAmount)
	}

	// An earn births the row; a spend draws both tiers in one delta.
	if _, err := store.ApplyBalanceDelta(ctx, scope, today, 50, 0); err != nil {
		t.Fatalf("ApplyBalanceDelta(earn 50) failed: %v", err)
	}
	got, err := store.ApplyBalanceDelta(ctx, scope, today, -20, 30)
	if err != nil {
		t.Fatalf("ApplyBalanceDelta(spend) failed: %v", err)
	}
	want := twinkle.BalanceRecord{General: 30, SmallSpentThisWindow: 30, SmallResetWindow: today}
	if got != want {
		t.Fatalf("record after spend = %+v, want %+v", got, want)
	}

	// The upsert stays one row per user and rolls a stale window forward: the fresh window's
	// SMALL spend starts from just this delta (no carry of the old window's spend).
	tomorrow := today.AddDate(0, 0, 1)
	got, err = store.ApplyBalanceDelta(ctx, scope, tomorrow, 0, 5)
	if err != nil {
		t.Fatalf("ApplyBalanceDelta(rolled window) failed: %v", err)
	}
	want = twinkle.BalanceRecord{General: 30, SmallSpentThisWindow: 5, SmallResetWindow: tomorrow}
	if got != want {
		t.Fatalf("record after window roll = %+v, want %+v", got, want)
	}
	var rows int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM twinkle_balances WHERE user_id = $1", userID).Scan(&rows); err != nil {
		t.Fatalf("count balance rows failed: %v", err)
	}
	if rows != 1 {
		t.Fatalf("balance rows = %d, want exactly 1 per user", rows)
	}

	// A stale caller window never rolls the anchor backward.
	got, err = store.ApplyBalanceDelta(ctx, scope, today, 0, 7)
	if err != nil {
		t.Fatalf("ApplyBalanceDelta(stale window) failed: %v", err)
	}
	want = twinkle.BalanceRecord{General: 30, SmallSpentThisWindow: 12, SmallResetWindow: tomorrow}
	if got != want {
		t.Fatalf("record after stale-window delta = %+v, want %+v", got, want)
	}

	// The CHECK constraints and store validations are the last-line oversell/negative guard.
	if _, err := store.ApplyBalanceDelta(ctx, scope, tomorrow, -1000, 0); err == nil {
		t.Fatal("ApplyBalanceDelta(additional below zero) succeeded, want CHECK violation")
	}
	if _, err := store.ApplyBalanceDelta(ctx, scope, tomorrow, 0, -1000); !errors.Is(err, ErrDeltaOutOfRange) {
		t.Fatalf("ApplyBalanceDelta(negative basic spend) err = %v, want ErrDeltaOutOfRange", err)
	}
	if _, err := store.ApplyBalanceDelta(ctx, scope, tomorrow, math.MaxInt32+1, 0); !errors.Is(err, ErrDeltaOutOfRange) {
		t.Fatalf("ApplyBalanceDelta(int32 overflow) err = %v, want ErrDeltaOutOfRange", err)
	}

	// The grant guard refuses a basic draw past the daily grant — whether the window's spend
	// is already near the cap (a raced/stale plan) or the row does not exist yet.
	if _, err := store.ApplyBalanceDelta(ctx, scope, tomorrow, 0, values.TwinkleSmallDailyAmount); !errors.Is(err, ErrBasicGrantExceeded) {
		t.Fatalf("ApplyBalanceDelta(draw past grant) err = %v, want ErrBasicGrantExceeded", err)
	}
	unborn := mustUserScope(t, userID+"-unborn")
	cleanupTwinkleTestRows(t, pool, userID+"-unborn")
	if _, err := store.ApplyBalanceDelta(ctx, unborn, tomorrow, 0, values.TwinkleSmallDailyAmount+1); !errors.Is(err, ErrBasicGrantExceeded) {
		t.Fatalf("ApplyBalanceDelta(first-write draw past grant) err = %v, want ErrBasicGrantExceeded", err)
	}

	// Cross-user isolation: another user sees no row (§4, A2).
	intruder := mustUserScope(t, userID+"-intruder")
	cleanupTwinkleTestRows(t, pool, userID+"-intruder")
	foreign, err := store.GetBalanceRecord(ctx, intruder)
	if err != nil {
		t.Fatalf("GetBalanceRecord(intruder) failed: %v", err)
	}
	if foreign != nil {
		t.Fatalf("GetBalanceRecord(intruder) = %+v, want nil (per-user isolation)", foreign)
	}
}

func TestTwinkleConcurrentSpendsCannotOversell(t *testing.T) {
	pool := openTwinkleTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-twinkle-race-%d-user", time.Now().UnixNano())
	cleanupTwinkleTestRows(t, pool, userID)
	scope := mustUserScope(t, userID)
	store := NewStore(pool.PgxPool())
	today := time.Date(2026, 7, 14, 0, 0, 0, 0, time.UTC)

	if _, err := store.ApplyBalanceDelta(ctx, scope, today, 10, 0); err != nil {
		t.Fatalf("seed additional failed: %v", err)
	}

	// Two concurrent spends of the whole additional balance: the row lock serializes them and
	// the CHECK rejects the loser — never a negative balance, never an oversell (A9).
	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := range errs {
		wg.Add(1)
		go func(slot int) {
			defer wg.Done()
			_, errs[slot] = store.ApplyBalanceDelta(ctx, scope, today, -10, 0)
		}(i)
	}
	wg.Wait()

	failures := 0
	for _, err := range errs {
		if err != nil {
			failures++
		}
	}
	if failures != 1 {
		t.Fatalf("concurrent spends: %d failed, want exactly 1 rejected (one winner, no oversell)", failures)
	}
	var additional int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT additional FROM twinkle_balances WHERE user_id = $1", userID).Scan(&additional); err != nil {
		t.Fatalf("read additional failed: %v", err)
	}
	if additional != 0 {
		t.Fatalf("additional after race = %d, want 0", additional)
	}
}

func TestTwinkleLedgerAppendIsIdempotent(t *testing.T) {
	pool := openTwinkleTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-twinkle-ledger-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherID := base + "-other"
	cleanupTwinkleTestRows(t, pool, userID)
	cleanupTwinkleTestRows(t, pool, otherID)
	scope := mustUserScope(t, userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 14, 12, 0, 0, 0, time.UTC)

	dedup := base + "-recall-1"
	entry := twinkle.LedgerEntry{
		ID:          base + "-entry-1",
		Kind:        twinkle.EntryKindSpend,
		Reason:      twinkle.ReasonRecall,
		Amount:      15,
		FromSmall:   15,
		FromGeneral: 0,
		DedupKey:    &dedup,
		CreatedAt:   day,
	}
	applied, err := store.AppendLedgerEntry(ctx, scope, entry)
	if err != nil {
		t.Fatalf("AppendLedgerEntry failed: %v", err)
	}
	if !applied {
		t.Fatal("first append reported not applied")
	}

	// A retried append with the same dedup key is a no-op — never a double-apply (A10).
	retry := entry
	retry.ID = base + "-entry-1-retry"
	applied, err = store.AppendLedgerEntry(ctx, scope, retry)
	if err != nil {
		t.Fatalf("retried AppendLedgerEntry failed: %v", err)
	}
	if applied {
		t.Fatal("retried append reported applied, want dedup no-op")
	}
	var count int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = $1", userID).Scan(&count); err != nil {
		t.Fatalf("count entries failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("ledger entries = %d, want 1 after retry", count)
	}

	// Unqualified ON CONFLICT also catches the backend-minted primary key. A
	// different dedup key colliding on id must surface as storage corruption, not
	// masquerade as an already-applied action that silently skips its delta.
	idCollision := entry
	otherDedup := base + "-different-action"
	idCollision.DedupKey = &otherDedup
	if _, err := store.AppendLedgerEntry(ctx, scope, idCollision); !errors.Is(err, ErrUnexpectedLedgerConflict) {
		t.Fatalf("AppendLedgerEntry(id collision) err = %v, want ErrUnexpectedLedgerConflict", err)
	}

	// The dedup key is scoped per user: another user reusing the same key still appends (A2).
	otherScope := mustUserScope(t, otherID)
	otherEntry := entry
	otherEntry.ID = base + "-entry-other"
	applied, err = store.AppendLedgerEntry(ctx, otherScope, otherEntry)
	if err != nil {
		t.Fatalf("other-user AppendLedgerEntry failed: %v", err)
	}
	if !applied {
		t.Fatal("other user's append with the same dedup key was deduped across users")
	}

	// The log's reconstruction invariants are DB-enforced: a non-positive amount, a negative
	// tier draw, and a spend whose amount is not its two-tier split are all rejected.
	invalid := entry
	invalid.ID = base + "-entry-zero"
	invalid.DedupKey = nil
	invalid.Amount = 0
	invalid.FromSmall = 0
	if _, err := store.AppendLedgerEntry(ctx, scope, invalid); err == nil {
		t.Fatal("AppendLedgerEntry(amount 0) succeeded, want CHECK violation")
	}
	invalid = entry
	invalid.ID = base + "-entry-split"
	invalid.DedupKey = nil
	invalid.FromSmall = 3
	if _, err := store.AppendLedgerEntry(ctx, scope, invalid); err == nil {
		t.Fatal("AppendLedgerEntry(spend split mismatch) succeeded, want CHECK violation")
	}
	invalid = entry
	invalid.ID = base + "-entry-overflow"
	invalid.DedupKey = nil
	invalid.Amount = math.MaxInt32 + 1
	if _, err := store.AppendLedgerEntry(ctx, scope, invalid); !errors.Is(err, ErrDeltaOutOfRange) {
		t.Fatalf("AppendLedgerEntry(int32 overflow) err = %v, want ErrDeltaOutOfRange", err)
	}

	// Entries without a dedup key never dedup against each other.
	for i := range 2 {
		free := twinkle.LedgerEntry{
			ID:        fmt.Sprintf("%s-nodedup-%d", base, i),
			Kind:      twinkle.EntryKindEarn,
			Reason:    twinkle.ReasonWriteDiary,
			Amount:    10,
			CreatedAt: day,
		}
		applied, err := store.AppendLedgerEntry(ctx, scope, free)
		if err != nil {
			t.Fatalf("nil-dedup AppendLedgerEntry %d failed: %v", i, err)
		}
		if !applied {
			t.Fatalf("nil-dedup append %d was deduped, want applied", i)
		}
	}
}

// A13: payment left the product (PRD §8.3 defers it to v3), but the ledger is append-only, so the
// GLOBAL partial uniqueness index on payment dedup keys (migration 00010) is RETAINED as a historical
// guard and is asserted through the append itself rather than the removed Charge use-case. A provider
// transaction cannot be replayed across accounts, and a historical payment row still folds into the
// balance and still renders in the history.
func TestHistoricalPaymentRowsStayGloballySingleUseAndReadable(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-payment-history-%d", time.Now().UnixNano())
	firstID := base + "-first"
	secondID := base + "-second"
	for _, userID := range []string{firstID, secondID} {
		cleanupTwinkleTestRows(t, pool, userID)
	}
	store := NewStore(pool.PgxPool())
	first := mustUserScope(t, firstID)
	second := mustUserScope(t, secondID)
	key := paymentKeyForTest("app-store", base+"-transaction")

	entry := twinkle.LedgerEntry{
		ID:        base + "-row-1",
		Kind:      twinkle.EntryKindEarn,
		Reason:    twinkle.ReasonPayment,
		Amount:    100,
		DedupKey:  &key,
		CreatedAt: time.Now().UTC(),
	}
	applied, err := store.AppendLedgerEntry(ctx, first, entry)
	if err != nil || !applied {
		t.Fatalf("historical payment append = (%v, %v), want applied", applied, err)
	}
	if _, err := store.ApplyBalanceDelta(ctx, first, dateOnly(time.Now().UTC()), 100, 0); err != nil {
		t.Fatalf("fold the historical payment into the balance failed: %v", err)
	}

	// The same provider transaction under a different account: the global index refuses it, and the
	// store reports the refusal as an idempotent no-op rather than an error.
	replay := entry
	replay.ID = base + "-row-2"
	applied, err = store.AppendLedgerEntry(ctx, second, replay)
	if err != nil {
		t.Fatalf("cross-user payment replay errored: %v", err)
	}
	if applied {
		t.Fatal("one provider transaction credited two accounts — the global payment index is gone")
	}
	assertPaymentState(t, pool, firstID, base+"-transaction", 100, 1)
	assertPaymentState(t, pool, secondID, base+"-transaction", 0, 0)

	// Still readable: the retired reason folds into the balance and comes back in the history.
	record, err := store.GetBalanceRecord(ctx, first)
	if err != nil || record == nil || record.General != 100 {
		t.Fatalf("balance record = %+v (err %v), want the historical payment folded in", record, err)
	}
	page, err := store.ListLedgerPage(ctx, first, nil, 10)
	if err != nil {
		t.Fatalf("ListLedgerPage failed: %v", err)
	}
	if len(page) != 1 || page[0].Reason != twinkle.ReasonPayment {
		t.Fatalf("history = %+v, want the historical payment row", page)
	}
}

// A3: the [P9] guarantee is enforced by the schema too, not only by PlanSpend. A hand-crafted INSERT
// that funds an ornament purchase from SMALL must be refused by migration 00019's constraint — which
// is what makes the guarantee survive a caller that bypasses the use-case entirely.
func TestOrnamentPurchaseFromSmallIsRefusedByTheConstraint(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-purchase-check-%d", time.Now().UnixNano())
	cleanupTwinkleTestRows(t, pool, userID)

	_, err := pool.PgxPool().Exec(ctx,
		`INSERT INTO twinkle_ledger_entries (id, user_id, kind, reason, amount, from_basic, from_additional, created_at)
		 VALUES ($1, $2, 'spend', 'ornament_purchase', 10, 10, 0, now())`,
		userID+"-bad", userID)
	if err == nil {
		t.Fatal("an ornament_purchase funded from SMALL was accepted — the [P9] CHECK is missing")
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.ConstraintName != "twinkle_ledger_entries_purchase_general_only" {
		t.Fatalf("rejection = %v, want the purchase_general_only CHECK", err)
	}

	// The same purchase drawn from GENERAL is accepted — the constraint bans the funding source, not
	// the reason.
	if _, err := pool.PgxPool().Exec(ctx,
		`INSERT INTO twinkle_ledger_entries (id, user_id, kind, reason, amount, from_basic, from_additional, created_at)
		 VALUES ($1, $2, 'spend', 'ornament_purchase', 10, 0, 10, now())`,
		userID+"-good", userID); err != nil {
		t.Fatalf("a GENERAL-funded ornament purchase was refused: %v", err)
	}
}

// [G7]: the daily refill is a derivation, and the guard has to hold at the LAST boundary before the
// table — not only at the service, which this adapter can be called around. `payment` stays writable
// on purpose: those rows exist, and the retained global-uniqueness guard above needs to write one.
func TestTheAdapterRefusesToWriteADailyGrantRow(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-daily-grant-%d", time.Now().UnixNano())
	cleanupTwinkleTestRows(t, pool, userID)
	store := NewStore(pool.PgxPool())
	scope := mustUserScope(t, userID)
	key := userID + "-key"

	applied, err := store.AppendLedgerEntry(ctx, scope, twinkle.LedgerEntry{
		ID:        userID + "-grant",
		Kind:      twinkle.EntryKindEarn,
		Reason:    twinkle.ReasonDailyGrant,
		Amount:    100,
		DedupKey:  &key,
		CreatedAt: time.Now().UTC(),
	})
	if !errors.Is(err, ErrUnwritableReason) || applied {
		t.Fatalf("daily_grant append = (%v, %v), want ErrUnwritableReason and no row", applied, err)
	}
	var rows int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = $1", userID).Scan(&rows); err != nil {
		t.Fatalf("count rows failed: %v", err)
	}
	if rows != 0 {
		t.Fatalf("rows = %d, want 0 — the refill must never be a row", rows)
	}
}

// A11: the page is a keyset, not an offset — a row landing mid-scroll must not shift the boundary and
// duplicate or skip a neighbour. Two entries sharing a created_at prove the id half of the key.
func TestListLedgerPageIsAStableKeysetNewestFirst(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-ledger-page-%d", time.Now().UnixNano())
	cleanupTwinkleTestRows(t, pool, userID)
	store := NewStore(pool.PgxPool())
	scope := mustUserScope(t, userID)

	shared := time.Now().UTC().Truncate(time.Microsecond)
	for index, stamp := range []time.Time{shared.Add(-2 * time.Minute), shared, shared} {
		key := fmt.Sprintf("%s-key-%d", userID, index)
		applied, err := store.AppendLedgerEntry(ctx, scope, twinkle.LedgerEntry{
			ID:        fmt.Sprintf("%s-entry-%d", userID, index),
			Kind:      twinkle.EntryKindEarn,
			Reason:    twinkle.ReasonWriteDiary,
			Amount:    10,
			DedupKey:  &key,
			CreatedAt: stamp,
		})
		if err != nil || !applied {
			t.Fatalf("seed append %d = (%v, %v)", index, applied, err)
		}
	}

	page, err := store.ListLedgerPage(ctx, scope, nil, 2)
	if err != nil {
		t.Fatalf("ListLedgerPage failed: %v", err)
	}
	if len(page) != 2 {
		t.Fatalf("page = %d rows, want 2", len(page))
	}
	// Newest first, and the id breaks the created_at tie deterministically (descending).
	if page[0].ID <= page[1].ID {
		t.Fatalf("tie order = %s then %s, want descending ids", page[0].ID, page[1].ID)
	}
	next, err := store.ListLedgerPage(ctx, scope,
		&twinkle.LedgerCursor{CreatedAt: page[1].CreatedAt, ID: page[1].ID}, 2)
	if err != nil {
		t.Fatalf("ListLedgerPage(cursor) failed: %v", err)
	}
	if len(next) != 1 {
		t.Fatalf("page 2 = %d rows, want the single remaining row", len(next))
	}
	for _, seen := range page {
		if next[0].ID == seen.ID {
			t.Fatalf("page 2 repeated %s from page 1", seen.ID)
		}
	}
	// A cross-user read is unrepresentable: the scope is the query's own predicate.
	other := mustUserScope(t, userID+"-other")
	empty, err := store.ListLedgerPage(ctx, other, nil, 10)
	if err != nil {
		t.Fatalf("ListLedgerPage(other user) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("another user's page returned %d rows", len(empty))
	}
}

// utcUserZone stands in for the composition root's account adapter where the test has no profile.
type utcUserZone struct{}

func (utcUserZone) ZoneFor(context.Context, platform.UserScope) (string, error) {
	return "UTC", nil
}

func (utcUserZone) ZonesFor(_ context.Context, userIDs []string) (map[string]string, error) {
	zones := make(map[string]string, len(userIDs))
	for _, userID := range userIDs {
		zones[userID] = "UTC"
	}
	return zones, nil
}

type emptySpendSignals struct{}

func (emptySpendSignals) RecallAccessibility(context.Context, platform.UserScope, string) (float64, error) {
	return 0, nil
}

func (emptySpendSignals) DiaryRecallAccessibilities(context.Context, platform.UserScope, string) ([]float64, error) {
	return nil, nil
}

func (emptySpendSignals) ViewableGistStage(context.Context, platform.UserScope, string) (int, error) {
	return 0, nil
}

func assertPaymentState(t *testing.T, pool *platformdb.Pool, userID string, transactionID string, wantAdditional int, wantRows int) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var additional int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT COALESCE((SELECT additional FROM twinkle_balances WHERE user_id = $1), 0)", userID).Scan(&additional); err != nil {
		t.Fatalf("read payment balance failed: %v", err)
	}
	if additional != wantAdditional {
		t.Fatalf("additional for %s = %d, want %d", userID, additional, wantAdditional)
	}
	var rows int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = $1 AND reason = 'payment' AND dedup_key = $2",
		userID, paymentKeyForTest("app-store", transactionID)).Scan(&rows); err != nil {
		t.Fatalf("count payment rows failed: %v", err)
	}
	if rows != wantRows {
		t.Fatalf("payment rows for %s = %d, want %d", userID, rows, wantRows)
	}
}

func paymentKeyForTest(provider string, transactionID string) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf("%d:%s%s", len(provider), provider, transactionID)))
	return "payment:" + hex.EncodeToString(digest[:])
}

func mustUserScope(t *testing.T, userID string) platform.UserScope {
	t.Helper()

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope(%s) failed: %v", userID, err)
	}
	return scope
}

func openTwinkleTestPool(t *testing.T) *platformdb.Pool {
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

// cleanupTwinkleTestRows deletes this test user's rows on teardown. Test hygiene only — the
// system itself never deletes ledger entries ([I1]); the append-only guarantee is enforced by
// the absence of any runtime UPDATE/DELETE query (T008 audit).
func cleanupTwinkleTestRows(t *testing.T, pool *platformdb.Pool, userID string) {
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
