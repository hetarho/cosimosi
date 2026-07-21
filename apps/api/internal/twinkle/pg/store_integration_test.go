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

	// Lazy birth: no row until the first write; the caller derives a full-basic balance.
	record, err := store.GetBalanceRecord(ctx, scope)
	if err != nil {
		t.Fatalf("GetBalanceRecord(absent) failed: %v", err)
	}
	if record != nil {
		t.Fatalf("GetBalanceRecord(absent) = %+v, want nil", record)
	}
	born := twinkle.DeriveBalance(today, twinkle.BalanceRecord{BasicResetWindow: today})
	if born.Basic != values.TwinkleBasicDailyAmount || born.Additional != 0 {
		t.Fatalf("lazy-birth balance = %+v, want full basic %d", born, values.TwinkleBasicDailyAmount)
	}

	// An earn births the row; a spend draws both tiers in one delta.
	if _, err := store.ApplyBalanceDelta(ctx, scope, today, 50, 0); err != nil {
		t.Fatalf("ApplyBalanceDelta(earn 50) failed: %v", err)
	}
	got, err := store.ApplyBalanceDelta(ctx, scope, today, -20, 30)
	if err != nil {
		t.Fatalf("ApplyBalanceDelta(spend) failed: %v", err)
	}
	want := twinkle.BalanceRecord{Additional: 30, BasicSpentThisWindow: 30, BasicResetWindow: today}
	if got != want {
		t.Fatalf("record after spend = %+v, want %+v", got, want)
	}

	// The upsert stays one row per user and rolls a stale window forward: the fresh window's
	// basic spend starts from just this delta (no carry of the old window's spend).
	tomorrow := today.AddDate(0, 0, 1)
	got, err = store.ApplyBalanceDelta(ctx, scope, tomorrow, 0, 5)
	if err != nil {
		t.Fatalf("ApplyBalanceDelta(rolled window) failed: %v", err)
	}
	want = twinkle.BalanceRecord{Additional: 30, BasicSpentThisWindow: 5, BasicResetWindow: tomorrow}
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
	want = twinkle.BalanceRecord{Additional: 30, BasicSpentThisWindow: 12, BasicResetWindow: tomorrow}
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
	if _, err := store.ApplyBalanceDelta(ctx, scope, tomorrow, 0, values.TwinkleBasicDailyAmount); !errors.Is(err, ErrBasicGrantExceeded) {
		t.Fatalf("ApplyBalanceDelta(draw past grant) err = %v, want ErrBasicGrantExceeded", err)
	}
	unborn := mustUserScope(t, userID+"-unborn")
	cleanupTwinkleTestRows(t, pool, userID+"-unborn")
	if _, err := store.ApplyBalanceDelta(ctx, unborn, tomorrow, 0, values.TwinkleBasicDailyAmount+1); !errors.Is(err, ErrBasicGrantExceeded) {
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
		ID:             base + "-entry-1",
		Kind:           twinkle.EntryKindSpend,
		Reason:         twinkle.ReasonRecall,
		Amount:         15,
		FromBasic:      15,
		FromAdditional: 0,
		DedupKey:       &dedup,
		CreatedAt:      day,
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
	invalid.FromBasic = 0
	if _, err := store.AppendLedgerEntry(ctx, scope, invalid); err == nil {
		t.Fatal("AppendLedgerEntry(amount 0) succeeded, want CHECK violation")
	}
	invalid = entry
	invalid.ID = base + "-entry-split"
	invalid.DedupKey = nil
	invalid.FromBasic = 3
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

func TestPaymentTransactionIsSingleUseAcrossRetriesAndUsers(t *testing.T) {
	pool := openTwinkleTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-payment-replay-%d", time.Now().UnixNano())
	firstID := base + "-first"
	secondID := base + "-second"
	concurrentID := base + "-concurrent"
	for _, userID := range []string{firstID, secondID, concurrentID} {
		cleanupTwinkleTestRows(t, pool, userID)
	}
	verifier := &echoPaymentVerifier{}
	service, err := twinkle.NewService(twinkle.ServiceDeps{
		Ledger:         NewStore(pool.PgxPool()),
		Verifier:       verifier,
		InviteResolver: twinkle.UnavailableInviteResolver{},
		Signals:        emptySpendSignals{},
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}

	first := mustUserScope(t, firstID)
	verifier.transactionID = base + "-same-user"
	for range 2 {
		if _, err := service.Charge(ctx, first, twinkle.DefaultChargePackID, "app-store", "opaque-receipt"); err != nil {
			t.Fatalf("same-user Charge failed: %v", err)
		}
	}
	assertPaymentState(t, pool, firstID, verifier.transactionID, values.TwinkleChargePack, 1)

	concurrent := mustUserScope(t, concurrentID)
	verifier.transactionID = base + "-concurrent"
	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i := range errs {
		wg.Add(1)
		go func(slot int) {
			defer wg.Done()
			_, errs[slot] = service.Charge(ctx, concurrent, twinkle.DefaultChargePackID, "app-store", "opaque-receipt")
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatalf("concurrent Charge failed: %v", err)
		}
	}
	assertPaymentState(t, pool, concurrentID, verifier.transactionID, values.TwinkleChargePack, 1)

	verifier.transactionID = base + "-cross-user"
	if _, err := service.Charge(ctx, first, twinkle.DefaultChargePackID, "app-store", "opaque-receipt"); err != nil {
		t.Fatalf("first cross-user Charge failed: %v", err)
	}
	second := mustUserScope(t, secondID)
	if _, err := service.Charge(ctx, second, twinkle.DefaultChargePackID, "app-store", "same-transaction-new-account"); err != nil {
		t.Fatalf("cross-user replay Charge failed: %v", err)
	}
	assertPaymentState(t, pool, secondID, verifier.transactionID, 0, 0)
	var globalRows int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM twinkle_ledger_entries WHERE reason = 'payment' AND dedup_key = $1",
		paymentKeyForTest("app-store", verifier.transactionID)).Scan(&globalRows); err != nil {
		t.Fatalf("count global payment rows failed: %v", err)
	}
	if globalRows != 1 {
		t.Fatalf("global payment rows = %d, want exactly 1", globalRows)
	}
}

type echoPaymentVerifier struct {
	transactionID string
}

func (v *echoPaymentVerifier) Verify(_ context.Context, request twinkle.PaymentVerificationRequest) (twinkle.VerifiedPayment, error) {
	return twinkle.VerifiedPayment{
		ProviderTransactionID: v.transactionID,
		Provider:              request.Provider,
		PackID:                request.PackID,
		Amount:                values.TwinkleChargePack,
		BeneficiaryUserID:     request.BeneficiaryUserID,
	}, nil
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
