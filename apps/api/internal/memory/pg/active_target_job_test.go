package pg

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
)

// The repair pass asks which regenerations are already queued; only a pending or running job of the
// same kind, target and revision counts, and a batch-enqueued job counts like a single one.
func TestActiveTargetIDsSeeOnlyUnfinishedWorkAtTheRevision(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-active-target-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	target := jobqueue.Target{Kind: jobqueue.TargetMemory, ID: base + "-memory", ExpectedRevision: 3}
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	if _, err := store.EnqueueJob(ctx, scope, jobqueue.Record{
		ID: base + "-job", Kind: memory.JobKindSemanticize, Payload: []byte(`{}`),
		Status: jobqueue.StatusPending, NextRunAt: now, CreatedAt: now, Targets: []jobqueue.Target{target},
	}); err != nil {
		t.Fatalf("EnqueueJob failed: %v", err)
	}

	check := func(kind jobqueue.Kind, candidate jobqueue.Target, want bool) {
		t.Helper()
		active, err := store.ActiveTargetIDs(ctx, scope, kind, []jobqueue.Target{candidate})
		if err != nil {
			t.Fatalf("ActiveTargetIDs failed: %v", err)
		}
		if got := len(active) == 1 && active[0] == candidate.ID; got != want {
			t.Fatalf("ActiveTargetIDs(%s, %+v) = %v, want active %v", kind, candidate, active, want)
		}
	}
	check(memory.JobKindSemanticize, target, true)
	newer := target
	newer.ExpectedRevision = 4
	check(memory.JobKindSemanticize, newer, false)
	check(memory.JobKindEmbed, target, false)

	if _, err := pool.PgxPool().Exec(ctx,
		"UPDATE jobs SET status = 'failed', terminal_at = now() WHERE user_id = $1", userID); err != nil {
		t.Fatalf("finish job failed: %v", err)
	}
	check(memory.JobKindSemanticize, target, false)

	batched := jobqueue.Target{Kind: jobqueue.TargetMemory, ID: base + "-batched", ExpectedRevision: 2}
	if err := store.EnqueueJobs(ctx, scope, []jobqueue.Record{{
		ID: base + "-batch-job", Kind: memory.JobKindSemanticize, Status: jobqueue.StatusPending,
		Targets: []jobqueue.Target{batched},
	}}); err != nil {
		t.Fatalf("EnqueueJobs failed: %v", err)
	}
	check(memory.JobKindSemanticize, batched, true)
}
