package pg

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/jackc/pgx/v5/pgxpool"
)

type recoverySnapshot struct {
	columns map[string]any
	targets []map[string]any
}

func readRecoverySnapshot(t *testing.T, ctx context.Context, pool *pgxpool.Pool, scope platform.UserScope, kind jobqueue.Kind, key string) recoverySnapshot {
	t.Helper()
	var data []byte
	if err := pool.QueryRow(ctx, "SELECT to_jsonb(j) FROM jobs j WHERE user_id=$1 AND kind=$2 AND dedup_key=$3", scope.UserID(), string(kind), key).Scan(&data); err != nil {
		t.Fatal(err)
	}
	var result recoverySnapshot
	if err := json.Unmarshal(data, &result.columns); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, "SELECT coalesce(json_agg(to_jsonb(jt) ORDER BY target_kind,target_id),'[]'::json) FROM job_targets jt WHERE user_id=$1 AND job_id=$2", scope.UserID(), result.columns["id"]).Scan(&data); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &result.targets); err != nil {
		t.Fatal(err)
	}
	return result
}

func recoveryInput(scope platform.UserScope, kind jobqueue.Kind, key, id string, due time.Time) jobqueue.Record {
	return jobqueue.Record{ID: id, UserID: scope.UserID(), Kind: kind, DedupKey: &key, Payload: []byte(`{}`), Status: jobqueue.StatusPending,
		CreatedAt: time.Unix(1, 0).UTC(), NextRunAt: due, Targets: []jobqueue.Target{{Kind: jobqueue.TargetUser, ID: scope.UserID()}}}
}

// The epoch due makes this named fixture older than the other integration tests' current-time jobs.
func seedRecoveryState(t *testing.T, ctx context.Context, pool *pgxpool.Pool, store Store, scope platform.UserScope, kind jobqueue.Kind, key, id, state string) jobqueue.Record {
	t.Helper()
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_, err := pool.Exec(cleanup, "DELETE FROM jobs WHERE user_id=$1", scope.UserID())
		if err != nil {
			t.Error(err)
		}
	})
	input := recoveryInput(scope, kind, key, id, time.Unix(1, 0).UTC())
	input.Attempts = 3
	if _, err := store.EnqueueJob(ctx, scope, input); err != nil {
		t.Fatal(err)
	}
	if state == "pending" {
		return jobqueue.Record{}
	}
	claimed, err := store.ClaimDue(ctx, time.Now().UTC(), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if claimed.ID != id {
		t.Fatalf("claimed %s, want named fixture %s", claimed.ID, id)
	}
	switch state {
	case "running":
	case "done":
		err = store.Complete(ctx, claimed)
	case "failed":
		err = store.Fail(ctx, claimed, 4)
	case "dead_letter":
		err = store.DeadLetter(ctx, claimed, jobqueue.DeadLetterUnhandledKind)
	case "cancelled":
		// User-job cancellation normally deletes; this valid defensive row must still stay inactive.
		_, err = pool.Exec(ctx, "UPDATE jobs SET status='cancelled',terminal_at=clock_timestamp() WHERE user_id=$1 AND id=$2", scope.UserID(), id)
	default:
		t.Fatalf("unknown fixture state %s", state)
	}
	if err != nil {
		t.Fatal(err)
	}
	return claimed
}

func TestCompletedUserJobRecoveryPreservesStatesAndEnvelope(t *testing.T) {
	pool := openQueueTestPool(t)
	store := NewStore(pool)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	for _, state := range []string{"pending", "running", "done", "failed", "dead_letter", "cancelled"} {
		t.Run(state, func(t *testing.T) {
			prefix := fmt.Sprintf("recovery-state-%s-%d", state, time.Now().UnixNano())
			scope, _ := platform.NewUserScope(prefix)
			kind := jobqueue.Kind("recovery_test")
			key := "fixed"
			seedRecoveryState(t, ctx, pool, store, scope, kind, key, prefix+"-old", state)
			before := readRecoverySnapshot(t, ctx, pool, scope, kind, key)
			due := time.Now().UTC().Truncate(time.Microsecond).Add(time.Hour)
			if state == "done" {
				ordinary, err := jobqueue.NewUserScheduler(store, nil, func() string { return prefix + "-ordinary" })
				if err != nil {
					t.Fatal(err)
				}
				identity, _ := jobqueue.NewUserJobIdentity(kind, key)
				if err = ordinary.Schedule(ctx, scope, identity, due); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(before, readRecoverySnapshot(t, ctx, pool, scope, kind, key)) {
					t.Fatal("ordinary enqueue changed terminal dedup")
				}
			}
			inputID := prefix + "-new"
			if state == "done" {
				// A valid repeated minted ID must not change an existing target on conflict.
				inputID = before.columns["id"].(string)
			}
			got, err := store.EnqueueOrRearmCompletedUserJob(ctx, scope, recoveryInput(scope, kind, key, inputID, due))
			if err != nil {
				t.Fatal(err)
			}
			after := readRecoverySnapshot(t, ctx, pool, scope, kind, key)
			if state == "done" {
				changed := map[string]bool{"status": true, "attempts": true, "terminal_at": true, "next_run_at": true, "lease_generation": true}
				for name, value := range before.columns {
					if !changed[name] && !reflect.DeepEqual(value, after.columns[name]) {
						t.Fatalf("rearm changed %s", name)
					}
				}
				if got.Status != jobqueue.StatusPending || got.Attempts != 0 || got.TerminalAt != nil || !got.NextRunAt.Equal(due) || got.LeaseGeneration != int64(before.columns["lease_generation"].(float64))+1 {
					t.Fatalf("rearmed lifecycle = %+v", got)
				}
				if !reflect.DeepEqual(before.targets, after.targets) {
					t.Fatal("rearm changed persisted targets")
				}
			} else if !reflect.DeepEqual(before, after) {
				t.Fatalf("%s row changed: before=%+v after=%+v", state, before, after)
			}
			scheduler, err := jobqueue.NewRearmingUserScheduler(store, nil, func() string { return prefix + "-scheduler" })
			if err != nil {
				t.Fatal(err)
			}
			identity, _ := jobqueue.NewUserJobIdentity(kind, key)
			err = scheduler.Schedule(ctx, scope, identity, due)
			inactive := state == "failed" || state == "dead_letter" || state == "cancelled"
			if (err != nil) != inactive {
				t.Fatalf("Schedule(%s) = %v", state, err)
			}
			if !reflect.DeepEqual(after, readRecoverySnapshot(t, ctx, pool, scope, kind, key)) {
				t.Fatal("duplicate scheduling changed existing state")
			}
			if _, err := store.EnqueueOrRearmCompletedUserJob(ctx, scope, recoveryInput(scope, kind, key, got.ID, due.Add(time.Hour))); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(after, readRecoverySnapshot(t, ctx, pool, scope, kind, key)) {
				t.Fatal("repeated ID and dedup changed the retained envelope or target")
			}
		})
	}
}

func TestCompletedUserJobRecoveryScopesUserAndKind(t *testing.T) {
	pool := openQueueTestPool(t)
	store := NewStore(pool)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	prefix := fmt.Sprintf("recovery-scope-%d", time.Now().UnixNano())
	a, _ := platform.NewUserScope(prefix + "-a")
	b, _ := platform.NewUserScope(prefix + "-b")
	kind := jobqueue.Kind("recovery_test")
	key := "same-key"
	seedRecoveryState(t, ctx, pool, store, a, kind, key, prefix+"-old", "done")
	before := readRecoverySnapshot(t, ctx, pool, a, kind, key)
	t.Cleanup(func() { _, _ = pool.Exec(context.Background(), "DELETE FROM jobs WHERE user_id=$1", b.UserID()) })
	due := time.Now().UTC().Truncate(time.Microsecond).Add(time.Hour)
	for _, input := range []jobqueue.Record{recoveryInput(b, kind, key, prefix+"-b", due), recoveryInput(a, "other_recovery_test", key, prefix+"-kind", due)} {
		scope, _ := platform.NewUserScope(input.UserID)
		if _, err := store.EnqueueOrRearmCompletedUserJob(ctx, scope, input); err != nil {
			t.Fatal(err)
		}
	}
	if !reflect.DeepEqual(before, readRecoverySnapshot(t, ctx, pool, a, kind, key)) {
		t.Fatal("another user/kind revived the completed row")
	}
	if _, err := store.EnqueueOrRearmCompletedUserJob(ctx, a, recoveryInput(a, kind, key, prefix+"-new", due)); err != nil {
		t.Fatal(err)
	}
	for _, input := range []jobqueue.Record{recoveryInput(b, kind, key, "", due), recoveryInput(a, "other_recovery_test", key, "", due)} {
		scope, _ := platform.NewUserScope(input.UserID)
		s := readRecoverySnapshot(t, ctx, pool, scope, input.Kind, key)
		if s.columns["status"] != "pending" || s.columns["lease_generation"] != float64(0) {
			t.Fatal("unrelated identity changed")
		}
	}
}

func TestCompletedUserJobRecoveryRejectsMalformedPersistedTarget(t *testing.T) {
	pool := openQueueTestPool(t)
	store := NewStore(pool)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	prefix := fmt.Sprintf("recovery-target-%d", time.Now().UnixNano())
	scope, _ := platform.NewUserScope(prefix)
	kind := jobqueue.Kind("recovery_test")
	key := "fixed"
	input := recoveryInput(scope, kind, key, prefix+"-old", time.Now().Add(time.Hour))
	input.Targets = []jobqueue.Target{{Kind: jobqueue.TargetMemory, ID: prefix + "-memory", ExpectedRevision: 1}}
	if _, err := store.EnqueueJob(ctx, scope, input); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_, err := pool.Exec(cleanup, "DELETE FROM jobs WHERE user_id=$1", scope.UserID())
		if err != nil {
			t.Error(err)
		}
	})
	before := readRecoverySnapshot(t, ctx, pool, scope, kind, key)
	scheduler, err := jobqueue.NewRearmingUserScheduler(store, nil, func() string { return prefix + "-new" })
	if err != nil {
		t.Fatal(err)
	}
	identity, _ := jobqueue.NewUserJobIdentity(kind, key)
	if err = scheduler.Schedule(ctx, scope, identity, time.Now().Add(time.Hour)); err == nil {
		t.Fatal("malformed persisted target was accepted as a user trigger")
	}
	if !reflect.DeepEqual(before, readRecoverySnapshot(t, ctx, pool, scope, kind, key)) {
		t.Fatal("recovery modified a malformed active envelope or its targets")
	}
}

func TestCompletedUserJobRecoverySerializesAndFencesStaleTransitions(t *testing.T) {
	pool := openQueueTestPool(t)
	store := NewStore(pool)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	prefix := fmt.Sprintf("recovery-fence-%d", time.Now().UnixNano())
	scope, _ := platform.NewUserScope(prefix)
	kind := jobqueue.Kind("recovery_test")
	key := "fixed"
	old := seedRecoveryState(t, ctx, pool, store, scope, kind, key, prefix+"-old", "done")
	due := time.Unix(2, 0).UTC()
	start := make(chan struct{})
	results := make(chan jobqueue.Record, 2)
	failures := make(chan error, 2)
	var wg sync.WaitGroup
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			row, err := store.EnqueueOrRearmCompletedUserJob(ctx, scope, recoveryInput(scope, kind, key, fmt.Sprintf("%s-new-%d", prefix, i), due))
			results <- row
			failures <- err
		}()
	}
	close(start)
	wg.Wait()
	for range 2 {
		if err := <-failures; err != nil {
			t.Fatal(err)
		}
		row := <-results
		if row.ID != old.ID || row.LeaseGeneration != old.LeaseGeneration+1 || row.Status != jobqueue.StatusPending {
			t.Fatalf("concurrent rearm = %+v", row)
		}
	}
	claimed, err := store.ClaimDue(ctx, time.Now().UTC(), time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if claimed.ID != old.ID || claimed.LeaseGeneration != old.LeaseGeneration+2 {
		t.Fatalf("fresh claim = %+v", claimed)
	}
	before := readRecoverySnapshot(t, ctx, pool, scope, kind, key)
	for _, transition := range []func() error{func() error { return store.Complete(ctx, old) }, func() error { return store.Retry(ctx, old, 99, time.Now().Add(time.Hour)) }, func() error { return store.Fail(ctx, old, 99) }} {
		if err := transition(); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(before, readRecoverySnapshot(t, ctx, pool, scope, kind, key)) {
			t.Fatal("stale transition changed the fresh attempt")
		}
	}
}

func TestCompletedUserJobRecoverySurvivesConcurrentCleanup(t *testing.T) {
	pool := openQueueTestPool(t)
	store := NewStore(pool)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	prefix := fmt.Sprintf("recovery-cleanup-%d", time.Now().UnixNano())
	scope, _ := platform.NewUserScope(prefix)
	kind := jobqueue.Kind("recovery_test")
	key := "fixed"
	seedRecoveryState(t, ctx, pool, store, scope, kind, key, prefix+"-old", "done")
	due := time.Now().UTC().Truncate(time.Microsecond).Add(time.Hour)
	start := make(chan struct{})
	failures := make(chan error, 2)
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		_, err := store.EnqueueOrRearmCompletedUserJob(ctx, scope, recoveryInput(scope, kind, key, prefix+"-new", due))
		failures <- err
	}()
	go func() {
		defer wg.Done()
		<-start
		_, err := store.PurgeTerminalJobs(ctx, time.Now().Add(time.Second), 100)
		failures <- err
	}()
	close(start)
	wg.Wait()
	for range 2 {
		if err := <-failures; err != nil {
			t.Fatal(err)
		}
	}
	after := readRecoverySnapshot(t, ctx, pool, scope, kind, key)
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM jobs WHERE user_id=$1 AND kind=$2 AND dedup_key=$3", scope.UserID(), string(kind), key).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 || after.columns["status"] != "pending" || after.columns["terminal_at"] != nil || len(after.targets) != 1 {
		t.Fatalf("cleanup/rearm result = %+v count=%d", after, count)
	}
}

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
