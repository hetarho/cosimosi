package pg

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// The store's own guarantees, asserted against a real Postgres: monotonic counters, first-touch
// semantics, the second-claim zero-rows guard, and the per-user purge ([I1][A4][U1]).
func TestCountersAreMonotonicAndFirstTouchSignals(t *testing.T) {
	pool := openAchievementTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	scope := newTestScope(t, "counters")
	cleanupAchievementTestRows(t, pool, scope.UserID())
	repo := NewStore(pool.PgxPool())

	created, err := repo.TouchCounter(ctx, scope, achievement.CounterDiaryWritten)
	if err != nil || !created {
		t.Fatalf("first TouchCounter = %v, %v; want created", created, err)
	}
	created, err = repo.TouchCounter(ctx, scope, achievement.CounterDiaryWritten)
	if err != nil || created {
		t.Fatalf("second TouchCounter = %v, %v; want not created", created, err)
	}

	if _, err := repo.AddCounter(ctx, scope, achievement.CounterDiaryWritten, 0); !errors.Is(err, achievement.ErrNonPositiveDelta) {
		t.Fatalf("AddCounter(0) = %v, want ErrNonPositiveDelta", err)
	}
	if _, err := repo.AddCounter(ctx, scope, achievement.CounterDiaryWritten, -3); !errors.Is(err, achievement.ErrNonPositiveDelta) {
		t.Fatalf("AddCounter(-3) = %v, want ErrNonPositiveDelta", err)
	}
	value, err := repo.AddCounter(ctx, scope, achievement.CounterDiaryWritten, 2)
	if err != nil || value != 2 {
		t.Fatalf("AddCounter = %d, %v; want 2", value, err)
	}
	value, err = repo.AddCounter(ctx, scope, achievement.CounterDiaryWritten, 3)
	if err != nil || value != 5 {
		t.Fatalf("AddCounter = %d, %v; want the accumulated 5", value, err)
	}

	if _, err := repo.TouchCounter(ctx, scope, achievement.CounterSemanticStageDepth); err != nil {
		t.Fatalf("TouchCounter(reach) failed: %v", err)
	}
	value, err = repo.RaiseCounter(ctx, scope, achievement.CounterSemanticStageDepth, 3)
	if err != nil || value != 3 {
		t.Fatalf("RaiseCounter = %d, %v; want 3", value, err)
	}
	// A reach counter never decreases: raising to a lower level keeps the high-water mark.
	value, err = repo.RaiseCounter(ctx, scope, achievement.CounterSemanticStageDepth, 1)
	if err != nil || value != 3 {
		t.Fatalf("RaiseCounter(lower) = %d, %v; want the kept 3", value, err)
	}

	if _, err := repo.TouchCounter(ctx, scope, achievement.CounterKey("streak_days")); !errors.Is(err, achievement.ErrUnknownCounterKey) {
		t.Fatalf("TouchCounter(unknown) = %v, want ErrUnknownCounterKey", err)
	}
	if _, err := repo.AddCounter(ctx, scope, achievement.CounterKey("streak_days"), 1); !errors.Is(err, achievement.ErrUnknownCounterKey) {
		t.Fatalf("AddCounter(unknown) = %v, want ErrUnknownCounterKey", err)
	}
	// The statement is bound to the key's mode, so a reach counter cannot be accumulated into
	// (four stage-1 views must not reach stage 4) and an accumulate counter cannot be raised.
	if _, err := repo.AddCounter(ctx, scope, achievement.CounterSemanticStageDepth, 1); !errors.Is(err, achievement.ErrCounterModeMismatch) {
		t.Fatalf("AddCounter(reach key) = %v, want ErrCounterModeMismatch", err)
	}
	if _, err := repo.RaiseCounter(ctx, scope, achievement.CounterDiaryWritten, 9); !errors.Is(err, achievement.ErrCounterModeMismatch) {
		t.Fatalf("RaiseCounter(accumulate key) = %v, want ErrCounterModeMismatch", err)
	}
	counterAfterRefusals, err := repo.ListCounters(ctx, scope)
	if err != nil {
		t.Fatalf("ListCounters failed: %v", err)
	}
	if counterAfterRefusals[achievement.CounterSemanticStageDepth] != 3 ||
		counterAfterRefusals[achievement.CounterDiaryWritten] != 5 {
		t.Fatalf("a refused write still moved a counter: %v", counterAfterRefusals)
	}

	counters, err := repo.ListCounters(ctx, scope)
	if err != nil {
		t.Fatalf("ListCounters failed: %v", err)
	}
	if counters[achievement.CounterDiaryWritten] != 5 || counters[achievement.CounterSemanticStageDepth] != 3 {
		t.Fatalf("ListCounters = %v", counters)
	}
}

// A counter write must land even when no row exists yet — both writes are `:one` UPDATEs, so
// without the create-and-retry a user's FIRST diary/launch/save would surface pgx.ErrNoRows and roll
// back the very thing it was reporting.
func TestCounterWritesCreateTheirRowWhenAbsent(t *testing.T) {
	pool := openAchievementTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	scope := newTestScope(t, "absent")
	cleanupAchievementTestRows(t, pool, scope.UserID())
	repo := NewStore(pool.PgxPool())

	value, err := repo.AddCounter(ctx, scope, achievement.CounterDiaryWritten, 1)
	if err != nil || value != 1 {
		t.Fatalf("AddCounter with no row = %d, %v; want 1", value, err)
	}
	value, err = repo.RaiseCounter(ctx, scope, achievement.CounterNeuronShareDepth, 4)
	if err != nil || value != 4 {
		t.Fatalf("RaiseCounter with no row = %d, %v; want 4", value, err)
	}
	// A reach level of zero is a fact a producer can legitimately observe (a user owning nothing yet),
	// and GREATEST(value, 0) can only be a no-op — refusing it would roll back the save reporting it.
	value, err = repo.RaiseCounter(ctx, scope, achievement.CounterOrnamentOwned, 0)
	if err != nil || value != 0 {
		t.Fatalf("RaiseCounter(0) = %d, %v; want 0 without error", value, err)
	}
	if _, err := repo.RaiseCounter(ctx, scope, achievement.CounterOrnamentOwned, -1); !errors.Is(err, achievement.ErrNonPositiveDelta) {
		t.Fatalf("RaiseCounter(-1) = %v, want ErrNonPositiveDelta", err)
	}
}

func TestMarkAndClaimAreIdempotent(t *testing.T) {
	pool := openAchievementTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	scope := newTestScope(t, "claim")
	cleanupAchievementTestRows(t, pool, scope.UserID())
	repo := NewStore(pool.PgxPool())

	marked, err := repo.MarkAchieved(ctx, scope, "first_diary")
	if err != nil || !marked {
		t.Fatalf("first MarkAchieved = %v, %v; want marked", marked, err)
	}
	record, err := repo.GetProgress(ctx, scope, "first_diary")
	if err != nil || record == nil || record.AchievedAt.IsZero() {
		t.Fatalf("GetProgress after mark = %+v, %v", record, err)
	}
	achievedAt := record.AchievedAt

	// A re-crossed threshold marks nothing and achieved_at keeps its first value ([I1]).
	marked, err = repo.MarkAchieved(ctx, scope, "first_diary")
	if err != nil || marked {
		t.Fatalf("second MarkAchieved = %v, %v; want not marked", marked, err)
	}
	record, err = repo.GetProgress(ctx, scope, "first_diary")
	if err != nil || !record.AchievedAt.Equal(achievedAt) {
		t.Fatalf("achieved_at moved: %v -> %v (%v)", achievedAt, record.AchievedAt, err)
	}

	claimed, err := repo.MarkClaimed(ctx, scope, "first_diary", "claim-1")
	if err != nil || !claimed {
		t.Fatalf("first MarkClaimed = %v, %v; want claimed", claimed, err)
	}
	// The second claim affects zero rows BEFORE any credit moves ([A4]).
	claimed, err = repo.MarkClaimed(ctx, scope, "first_diary", "claim-2")
	if err != nil || claimed {
		t.Fatalf("second MarkClaimed = %v, %v; want zero rows", claimed, err)
	}
	record, err = repo.GetProgress(ctx, scope, "first_diary")
	if err != nil || record.ClaimedAt == nil || record.ClaimID != "claim-1" {
		t.Fatalf("claim record = %+v, %v; want the first claim kept", record, err)
	}

	// Claiming an unachieved row touches nothing: there is no row to claim.
	claimed, err = repo.MarkClaimed(ctx, scope, "first_recall", "claim-3")
	if err != nil || claimed {
		t.Fatalf("claim without achievement = %v, %v; want zero rows", claimed, err)
	}

	if missing, err := repo.GetProgress(ctx, scope, "first_recall"); err != nil || missing != nil {
		t.Fatalf("GetProgress(absent) = %+v, %v; want nil without error", missing, err)
	}

	// An unpublished id would otherwise leave a durable row no read can answer for, and an empty
	// claim id satisfies the DDL pairing CHECK while collapsing every claim's dedup identity.
	if _, err := repo.MarkAchieved(ctx, scope, "diary_first"); !errors.Is(err, achievement.ErrUnknownAchievementID) {
		t.Fatalf("MarkAchieved(unpublished) = %v, want ErrUnknownAchievementID", err)
	}
	if _, err := repo.MarkClaimed(ctx, scope, "diary_first", "claim-x"); !errors.Is(err, achievement.ErrUnknownAchievementID) {
		t.Fatalf("MarkClaimed(unpublished) = %v, want ErrUnknownAchievementID", err)
	}
	if _, err := repo.MarkClaimed(ctx, scope, "first_recall", ""); !errors.Is(err, achievement.ErrClaimIDRequired) {
		t.Fatalf("MarkClaimed(empty claim id) = %v, want ErrClaimIDRequired", err)
	}
	orphan, err := repo.GetProgress(ctx, scope, "diary_first")
	if err != nil || orphan != nil {
		t.Fatalf("a refused write left a row: %+v, %v", orphan, err)
	}
}

// The settle stamp and the DDL CHECK that keeps the lifecycle one-directional, against a real
// Postgres: a claimed row settles once, a replay changes nothing, and no statement or hand-written
// UPDATE can produce a paid row that was never claimed.
func TestSettleClaimStampsOnceAndCannotPrecedeTheClaim(t *testing.T) {
	pool := openAchievementTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	scope := newTestScope(t, "settle")
	cleanupAchievementTestRows(t, pool, scope.UserID())
	repo := NewStore(pool.PgxPool())

	if _, err := repo.MarkAchieved(ctx, scope, "first_diary"); err != nil {
		t.Fatalf("MarkAchieved failed: %v", err)
	}
	// An achieved-but-unclaimed row has nothing to settle.
	settled, err := repo.SettleClaim(ctx, scope, "first_diary", "first_diary")
	if err != nil || settled {
		t.Fatalf("SettleClaim before the claim = %v, %v; want zero rows", settled, err)
	}
	if _, err := repo.MarkClaimed(ctx, scope, "first_diary", "first_diary"); err != nil {
		t.Fatalf("MarkClaimed failed: %v", err)
	}
	record, err := repo.GetProgress(ctx, scope, "first_diary")
	if err != nil || record.PaidAt != nil {
		t.Fatalf("a fresh claim = %+v, %v; want unsettled", record, err)
	}

	settled, err = repo.SettleClaim(ctx, scope, "first_diary", "first_diary")
	if err != nil || !settled {
		t.Fatalf("first SettleClaim = %v, %v; want settled", settled, err)
	}
	record, err = repo.GetProgress(ctx, scope, "first_diary")
	if err != nil || record.PaidAt == nil {
		t.Fatalf("settled record = %+v, %v", record, err)
	}
	paidAt := *record.PaidAt

	// A replay reads as zero rows rather than an error, and never moves the stamp.
	settled, err = repo.SettleClaim(ctx, scope, "first_diary", "first_diary")
	if err != nil || settled {
		t.Fatalf("second SettleClaim = %v, %v; want zero rows", settled, err)
	}
	record, err = repo.GetProgress(ctx, scope, "first_diary")
	if err != nil || !record.PaidAt.Equal(paidAt) {
		t.Fatalf("paid_at moved: %v -> %v (%v)", paidAt, record.PaidAt, err)
	}

	// A settle under a different claim id belongs to a different claim and must not land.
	if _, err := repo.MarkAchieved(ctx, scope, "first_recall"); err != nil {
		t.Fatalf("MarkAchieved failed: %v", err)
	}
	if _, err := repo.MarkClaimed(ctx, scope, "first_recall", "first_recall"); err != nil {
		t.Fatalf("MarkClaimed failed: %v", err)
	}
	settled, err = repo.SettleClaim(ctx, scope, "first_recall", "someone-elses-claim")
	if err != nil || settled {
		t.Fatalf("SettleClaim with a foreign claim id = %v, %v; want zero rows", settled, err)
	}

	// The DDL CHECK is the last word: even a statement written by hand cannot pay an unclaimed row.
	if _, err := repo.MarkAchieved(ctx, scope, "first_gist_view"); err != nil {
		t.Fatalf("MarkAchieved failed: %v", err)
	}
	_, err = pool.PgxPool().Exec(ctx,
		"UPDATE achievement_progress SET paid_at = now() WHERE user_id = $1 AND achievement_id = $2",
		scope.UserID(), "first_gist_view",
	)
	if err == nil {
		t.Fatal("the DDL accepted a paid row that was never claimed")
	}
}

func TestPurgeUserTouchesOnlyTheCaller(t *testing.T) {
	pool := openAchievementTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	scope := newTestScope(t, "purge")
	other := newTestScope(t, "purge-other")
	cleanupAchievementTestRows(t, pool, scope.UserID(), other.UserID())
	repo := NewStore(pool.PgxPool())

	for _, s := range []platform.UserScope{scope, other} {
		if _, err := repo.TouchCounter(ctx, s, achievement.CounterDiaryWritten); err != nil {
			t.Fatalf("TouchCounter failed: %v", err)
		}
		if _, err := repo.MarkAchieved(ctx, s, "first_diary"); err != nil {
			t.Fatalf("MarkAchieved failed: %v", err)
		}
	}

	if err := repo.PurgeUser(ctx, scope); err != nil {
		t.Fatalf("PurgeUser failed: %v", err)
	}
	counters, err := repo.ListCounters(ctx, scope)
	if err != nil || len(counters) != 0 {
		t.Fatalf("purged user's counters = %v, %v", counters, err)
	}
	progress, err := repo.ListProgress(ctx, scope)
	if err != nil || len(progress) != 0 {
		t.Fatalf("purged user's progress = %v, %v", progress, err)
	}
	otherCounters, err := repo.ListCounters(ctx, other)
	if err != nil || len(otherCounters) != 1 {
		t.Fatalf("other user's counters = %v, %v; want untouched", otherCounters, err)
	}
	otherProgress, err := repo.ListProgress(ctx, other)
	if err != nil || len(otherProgress) != 1 {
		t.Fatalf("other user's progress = %v, %v; want untouched", otherProgress, err)
	}
}

// newTestScope derives its user id from the test's own name plus a process-wide counter rather than
// from a clock, so `grep -rn 'time.Now' internal/achievement` stays empty — the no-clock rule this
// context is built around is checked by that grep, and an exception for tests would blunt it. Ids
// are stable across runs, which is why every test pre-cleans its rows as well as deferring cleanup.
func newTestScope(t *testing.T, suffix string) platform.UserScope {
	t.Helper()
	scope, err := platform.NewUserScope(fmt.Sprintf(
		"test-achievement-%s-%s-%d",
		t.Name(),
		suffix,
		testScopeSequence.Add(1),
	))
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

var testScopeSequence atomic.Int64

func openAchievementTestPool(t *testing.T) *platformdb.Pool {
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

// cleanupAchievementTestRows removes these test users' rows on teardown. Test hygiene only — the
// product's single delete path is the withdrawal sweep ([I1]).
func cleanupAchievementTestRows(t *testing.T, pool *platformdb.Pool, userIDs ...string) {
	t.Helper()
	cleanup := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		for _, table := range []string{"achievement_progress", "achievement_counters"} {
			for _, userID := range userIDs {
				if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID); err != nil {
					t.Logf("cleanup %s for %s: %v", table, userID, err)
				}
			}
		}
	}
	cleanup()
	t.Cleanup(cleanup)
}
