package pg

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/jackc/pgx/v5/pgxpool"
)

func openQueueTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("open queue test pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func enqueueTestJobs(t *testing.T, ctx context.Context, store Store, scope platform.UserScope, prefix string, count int) {
	t.Helper()
	jobs := make([]jobqueue.Record, 0, count)
	for i := range count {
		jobs = append(jobs, jobqueue.Record{
			ID: fmt.Sprintf("%s-job-%d", prefix, i), Kind: "lane_test", Status: jobqueue.StatusPending,
			Targets: []jobqueue.Target{{Kind: jobqueue.TargetUser, ID: scope.UserID()}},
		})
	}
	if err := store.EnqueueJobs(ctx, scope, jobs); err != nil {
		t.Fatalf("EnqueueJobs failed: %v", err)
	}
}

func laneTestRunner(t *testing.T, store Store, handler jobqueue.Handler[jobqueue.Record], lanes int, drain time.Duration) jobqueue.Runner[jobqueue.Record] {
	t.Helper()
	runner, err := jobqueue.NewRunner[jobqueue.Record](store, map[string]jobqueue.Registration[jobqueue.Record]{
		"lane_test": {Handler: handler},
	}, jobqueue.Config{
		Lease: time.Minute, MaxAttempts: 3, MaxClaims: 10, BackoffBase: time.Minute, PollInterval: 5 * time.Millisecond,
		Lanes: lanes, DrainTimeout: drain,
	})
	if err != nil {
		t.Fatalf("NewRunner failed: %v", err)
	}
	return runner
}

func doneJobs(t *testing.T, ctx context.Context, pool *pgxpool.Pool, userID string) int {
	t.Helper()
	var done int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM jobs WHERE user_id = $1 AND status = 'done'`, userID).Scan(&done); err != nil {
		t.Fatalf("count done jobs: %v", err)
	}
	return done
}

// Two lanes over SKIP LOCKED claims run two slow jobs at once and clear 40 of them faster than one
// lane, and the lease fence keeps any job from completing twice. The wall-clock ratio is logged
// rather than pinned: database round trips on a shared test container make it noisy, while the
// observed concurrency is exact.
func TestTwoLanesHalveTheDrainOfSlowJobs(t *testing.T) {
	pool := openQueueTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool)

	run := func(lanes int) (time.Duration, int) {
		prefix := fmt.Sprintf("lanes-%d-%d", lanes, time.Now().UnixNano())
		scope, err := platform.NewUserScope(prefix + "-user")
		if err != nil {
			t.Fatalf("NewUserScope failed: %v", err)
		}
		enqueueTestJobs(t, ctx, store, scope, prefix, 40)
		var mu sync.Mutex
		runs := map[string]int{}
		running, peak := 0, 0
		handler := func(_ context.Context, job jobqueue.Record) error {
			mu.Lock()
			runs[job.ID]++
			running++
			peak = max(peak, running)
			mu.Unlock()
			time.Sleep(50 * time.Millisecond)
			mu.Lock()
			running--
			mu.Unlock()
			return nil
		}
		runCtx, stop := context.WithCancel(ctx)
		done := make(chan error, 1)
		start := time.Now()
		go func() { done <- laneTestRunner(t, store, handler, lanes, time.Second).Run(runCtx) }()
		for doneJobs(t, ctx, pool, scope.UserID()) < 40 {
			if ctx.Err() != nil {
				t.Fatalf("%d lanes did not finish 40 jobs", lanes)
			}
			time.Sleep(10 * time.Millisecond)
		}
		took := time.Since(start)
		stop()
		<-done
		mu.Lock()
		defer mu.Unlock()
		for id, count := range runs {
			if count != 1 {
				t.Fatalf("job %s ran %d times with %d lanes", id, count, lanes)
			}
		}
		if len(runs) != 40 {
			t.Fatalf("%d lanes ran %d distinct jobs, want 40", lanes, len(runs))
		}
		return took, peak
	}
	single, singlePeak := run(1)
	double, doublePeak := run(2)
	t.Logf("40 × 50 ms jobs: one lane %v, two lanes %v", single, double)
	if singlePeak != 1 || doublePeak != 2 {
		t.Fatalf("peak concurrent handlers = %d with one lane and %d with two, want 1 and 2", singlePeak, doublePeak)
	}
	if double >= single {
		t.Fatalf("two lanes took %v against one lane's %v", double, single)
	}
}

// A shutdown that cuts a handler off leaves its job pending and due within a second, not stranded
// until its lease expires.
func TestShutdownMidHandlerLeavesTheJobDueSoon(t *testing.T) {
	pool := openQueueTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	store := NewStore(pool)
	prefix := fmt.Sprintf("drain-%d", time.Now().UnixNano())
	scope, err := platform.NewUserScope(prefix + "-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	enqueueTestJobs(t, ctx, store, scope, prefix, 1)
	// The released job is due now and the claim is global, so it must not outlive this test.
	t.Cleanup(func() {
		for _, table := range []string{"job_targets", "jobs"} {
			if _, err := pool.Exec(context.Background(), "DELETE FROM "+table+" WHERE user_id = $1", scope.UserID()); err != nil {
				t.Errorf("cleanup %s: %v", table, err)
			}
		}
	})

	entered := make(chan struct{})
	handler := func(handlerCtx context.Context, _ jobqueue.Record) error {
		close(entered)
		<-handlerCtx.Done()
		return handlerCtx.Err()
	}
	runCtx, stop := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() { done <- laneTestRunner(t, store, handler, 1, 20*time.Millisecond).Run(runCtx) }()
	<-entered
	stop()
	<-done

	var status string
	var nextRunAt time.Time
	if err := pool.QueryRow(ctx, `SELECT status, next_run_at FROM jobs WHERE user_id = $1`, scope.UserID()).Scan(&status, &nextRunAt); err != nil {
		t.Fatalf("read job: %v", err)
	}
	if status != string(jobqueue.StatusPending) || time.Until(nextRunAt) > time.Second {
		t.Fatalf("aborted job = %s due %v, want pending and due within a second", status, nextRunAt)
	}
}
