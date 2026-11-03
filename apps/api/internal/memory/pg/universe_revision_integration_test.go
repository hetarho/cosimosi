package pg

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
)

// TestUniverseRevisionAdvancesPerGraphMutation pins MEM-21 against the database: every
// transaction that takes the graph lock — through each transaction kind the MEM-14 takers open,
// and through the worker's semanticize completion — advances the user's revision by one, a
// rolled-back transaction leaves it where it was, and the snapshot read and the standalone read
// agree after every write.
func TestUniverseRevisionAdvancesPerGraphMutation(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	userID := fmt.Sprintf("test-universe-revision-%d-user", time.Now().UnixNano())
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())

	assertRevision := func(step string, want int64) {
		t.Helper()
		alone, err := store.GetUniverseRevision(ctx, scope)
		if err != nil {
			t.Fatalf("%s: GetUniverseRevision failed: %v", step, err)
		}
		facts, err := store.GetUniverse(ctx, scope)
		if err != nil {
			t.Fatalf("%s: GetUniverse failed: %v", step, err)
		}
		if alone != want || facts.Revision != want {
			t.Fatalf("%s: revision alone=%d snapshot=%d, want %d", step, alone, facts.Revision, want)
		}
	}

	assertRevision("never mutated", 0)

	lock := func(tx interface {
		LockGraphMutation(context.Context, platform.UserScope) error
	}) error {
		return tx.LockGraphMutation(ctx, scope)
	}
	takers := []struct {
		name string
		run  func() error
	}{
		{"launch", func() error {
			return store.InLaunchTx(ctx, func(tx memory.LaunchTx) error { return lock(tx) })
		}},
		{"recall", func() error {
			return store.InRecallTx(ctx, func(tx memory.RecallTx) error { return lock(tx) })
		}},
		{"view semantic", func() error {
			return store.InViewSemanticTx(ctx, func(tx memory.ViewSemanticTx) error { return lock(tx) })
		}},
		{"release", func() error {
			return store.InReleaseTx(ctx, func(tx memory.ReleaseTx) error { return lock(tx) })
		}},
		// A completion whose fence is lost changes nothing, yet still took the lock: the revision
		// moves anyway, which costs a client one refetch and nothing else.
		{"semanticize completion", func() error {
			return store.CompleteSemanticizeJob(ctx, jobqueue.Record{
				ID:              userID + "-absent-job",
				UserID:          userID,
				LeaseGeneration: 1,
			}, userID+"-absent-memory", 1, memory.SemanticStages{})
		}},
	}
	for index, taker := range takers {
		if err := taker.run(); err != nil {
			t.Fatalf("%s: transaction failed: %v", taker.name, err)
		}
		assertRevision(taker.name, int64(index+1))
	}

	rollback := errors.New("roll back")
	err = store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
		if err := lock(tx); err != nil {
			return err
		}
		return rollback
	})
	if !errors.Is(err, rollback) {
		t.Fatalf("rolled-back transaction returned %v, want the rollback cause", err)
	}
	assertRevision("after a rollback", int64(len(takers)))

	if err := store.PurgeUser(ctx, scope, userID+"-keep-job"); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	assertRevision("after the withdrawal purge", 0)
}
