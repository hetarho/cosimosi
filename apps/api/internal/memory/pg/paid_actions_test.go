package pg

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// End-to-end paid-action idempotency + consent against the real store (job 70, A1–A5): the receipt
// makes a response-loss retry replay the committed result without a second recall, a mismatched
// input under the same id conflicts, and an unconsented sync is refused before any effect.

func TestRecallReceiptReplayIsIdempotentEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := "test-receipt-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	seedRecallGraph(t, ctx, store, scope, base, time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))
	service := newRecallService(t, store, store, store, store)

	op := base + "-op-1"
	first, err := service.Recall(ctx, scope, op, base+"-m1", "a wholly different account", true)
	if err != nil {
		t.Fatalf("first recall failed: %v", err)
	}
	if !first.Reconsolidated {
		t.Fatal("first recall should reconsolidate a content change")
	}

	readRecallCount := func() int32 {
		var count int32
		if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, base+"-m1").Scan(&count); err != nil {
			t.Fatalf("read recall_count failed: %v", err)
		}
		return count
	}
	readProvenanceCount := func() int {
		var count int
		if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM memory_provenance WHERE user_id = $1 AND episodic_memory_id = $2`, userID, base+"-m1").Scan(&count); err != nil {
			t.Fatalf("read provenance count failed: %v", err)
		}
		return count
	}

	countAfterFirst := readRecallCount()
	provAfterFirst := readProvenanceCount()

	// Response-loss retry: same operation id + same input replays the committed result and does no
	// second recall — recall_count and provenance are unchanged (A2/A3).
	second, err := service.Recall(ctx, scope, op, base+"-m1", "a wholly different account", true)
	if err != nil {
		t.Fatalf("replay recall failed: %v", err)
	}
	if second.Reconsolidated != first.Reconsolidated || second.CurrentText != first.CurrentText || second.Seed != first.Seed || second.RecallCount != first.RecallCount {
		t.Fatalf("replay result = %+v, want the committed first result %+v", second, first)
	}
	if readRecallCount() != countAfterFirst {
		t.Fatalf("recall_count moved on replay: %d → %d, want unchanged", countAfterFirst, readRecallCount())
	}
	if readProvenanceCount() != provAfterFirst {
		t.Fatalf("provenance rows moved on replay: %d → %d, want unchanged", provAfterFirst, readProvenanceCount())
	}
	var receiptCount int
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM memory_paid_action_receipts WHERE user_id = $1 AND operation_id = $2`, userID, op).Scan(&receiptCount); err != nil {
		t.Fatalf("read receipt count failed: %v", err)
	}
	if receiptCount != 1 {
		t.Fatalf("receipt rows = %d, want exactly 1 for the operation", receiptCount)
	}

	// Same operation id, different input → conflict, not a wrong-result hit.
	if _, err := service.Recall(ctx, scope, op, base+"-m1", "a THIRD different account", true); !errors.Is(err, memory.ErrOperationConflict) {
		t.Fatalf("mismatched-input replay err = %v, want ErrOperationConflict", err)
	}
}

func TestConcurrentRecallDuplicateCommitsOneEffectEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := "test-receipt-concurrent-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	seedRecallGraph(t, ctx, store, scope, base, time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))
	service := newRecallService(t, store, store, store, store)

	start := make(chan struct{})
	errs := make(chan error, 2)
	var workers sync.WaitGroup
	for range 2 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			<-start
			_, callErr := service.Recall(ctx, scope, base+"-op", base+"-m1", "one concurrent rewrite", true)
			errs <- callErr
		}()
	}
	close(start)
	workers.Wait()
	close(errs)
	for callErr := range errs {
		if callErr != nil {
			t.Fatalf("concurrent recall failed: %v", callErr)
		}
	}

	var recallCount, receiptCount, provenanceCount int
	if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, base+"-m1").Scan(&recallCount); err != nil {
		t.Fatalf("read recall_count failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM memory_paid_action_receipts WHERE user_id = $1 AND operation_id = $2`, userID, base+"-op").Scan(&receiptCount); err != nil {
		t.Fatalf("read receipt count failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM memory_provenance WHERE user_id = $1 AND episodic_memory_id = $2`, userID, base+"-m1").Scan(&provenanceCount); err != nil {
		t.Fatalf("read provenance count failed: %v", err)
	}
	if recallCount != 1 || receiptCount != 1 || provenanceCount != 1 {
		t.Fatalf("concurrent duplicate committed recall=%d receipt=%d provenance=%d, want 1/1/1", recallCount, receiptCount, provenanceCount)
	}
}

func TestGistAndDiaryReceiptsReplayAgainstRealStore(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := "test-other-paid-replay-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	seedRecallGraph(t, ctx, store, scope, base, time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))
	if _, err := pool.PgxPool().Exec(ctx, `
		UPDATE episodic_memories
		SET semantic_stage = 3, semantic_stages = '["gist one", "gist two", "gist three", "gist four"]'::jsonb
		WHERE user_id = $1 AND id = $2`, userID, base+"-m1"); err != nil {
		t.Fatalf("seed gist ladder failed: %v", err)
	}
	service := newRecallService(t, store, store, store, store)

	firstView, err := service.ViewSemantic(ctx, scope, base+"-view-op", base+"-m1", 2)
	if err != nil {
		t.Fatalf("first ViewSemantic failed: %v", err)
	}
	replayedView, err := service.ViewSemantic(ctx, scope, base+"-view-op", base+"-m1", 2)
	if err != nil {
		t.Fatalf("replayed ViewSemantic failed: %v", err)
	}
	if replayedView != firstView {
		t.Fatalf("replayed view = %+v, want %+v", replayedView, firstView)
	}

	firstDiary, err := service.RecallDiaryStars(ctx, scope, base+"-diary-op", base+"-diary", true)
	if err != nil {
		t.Fatalf("first diary recall failed: %v", err)
	}
	replayedDiary, err := service.RecallDiaryStars(ctx, scope, base+"-diary-op", base+"-diary", true)
	if err != nil {
		t.Fatalf("replayed diary recall failed: %v", err)
	}
	if len(firstDiary.EpisodicMemoryIDs) != 2 || len(replayedDiary.EpisodicMemoryIDs) != 2 {
		t.Fatalf("diary results = %+v / %+v, want two members", firstDiary, replayedDiary)
	}

	var receipts, recalledOnce int
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM memory_paid_action_receipts WHERE user_id = $1`, userID).Scan(&receipts); err != nil {
		t.Fatalf("read receipt count failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND diary_id = $2 AND recall_count = 1`, userID, base+"-diary").Scan(&recalledOnce); err != nil {
		t.Fatalf("read recalled member count failed: %v", err)
	}
	if receipts != 2 || recalledOnce != 2 {
		t.Fatalf("after replay receipts=%d recalled-once=%d, want 2/2", receipts, recalledOnce)
	}
}

func TestRecallRefusesUnconsentedSyncEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := "test-consent-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	// The graph is seeded behind the service's "today", so a recall would advance the clock.
	seedRecallGraph(t, ctx, store, scope, base, time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))
	service := newRecallService(t, store, store, store, store)

	if _, err := service.Recall(ctx, scope, base+"-op-1", base+"-m1", "reworded", false); !errors.Is(err, memory.ErrSyncConsentRequired) {
		t.Fatalf("unconsented recall err = %v, want ErrSyncConsentRequired", err)
	}
	// Nothing committed: no receipt, recall_count still zero, clock unborn.
	var receipts, recallCount, clockRows int
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM memory_paid_action_receipts WHERE user_id = $1`, userID).Scan(&receipts); err != nil {
		t.Fatalf("read receipts failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT recall_count FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, base+"-m1").Scan(&recallCount); err != nil {
		t.Fatalf("read recall_count failed: %v", err)
	}
	if err := pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM universe_state WHERE user_id = $1`, userID).Scan(&clockRows); err != nil {
		t.Fatalf("read clock failed: %v", err)
	}
	if receipts != 0 || recallCount != 0 || clockRows != 0 {
		t.Fatalf("after refusal: receipts=%d recall_count=%d clock_rows=%d, want all zero (nothing committed)", receipts, recallCount, clockRows)
	}

	// With consent the same operation id proceeds (no blind receipt was written by the refusal).
	if _, err := service.Recall(ctx, scope, base+"-op-1", base+"-m1", "reworded", true); err != nil {
		t.Fatalf("consented recall failed: %v", err)
	}
}
