package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/cmd/internal/wiring"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	accounttestregistry "github.com/cosimosi/api/internal/account/testregistry"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	queuepg "github.com/cosimosi/api/internal/platform/jobqueue/pg"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
	twinklepg "github.com/cosimosi/api/internal/twinkle/pg"
	"github.com/jackc/pgx/v5"
)

type unavailableWithdrawalTargets struct {
	dbgen.DBTX
	err error
}

func (d unavailableWithdrawalTargets) Query(context.Context, string, ...interface{}) (pgx.Rows, error) {
	return nil, d.err
}

func TestWithdrawalTargetReadFailurePrecedesMarkAgainstDatabase(t *testing.T) {
	pool := openWithdrawalTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	userID := fmt.Sprintf("withdrawal-target-error-%d", time.Now().UnixNano())
	scope, _ := platform.NewUserScope(userID)
	cleanupWithdrawalRows(t, pool, userID, userID, userID+"-cleanup")
	if _, err := pool.PgxPool().Exec(ctx, `INSERT INTO users(user_id,nickname,timezone,locale) VALUES($1,'target-read','UTC','en')`, userID); err != nil {
		t.Fatal(err)
	}
	readErr := errors.New("target read unavailable")
	queue := queuepg.NewStore(unavailableWithdrawalTargets{DBTX: pool.PgxPool(), err: readErr})
	scheduler, err := account.NewWithdrawalJobScheduler(queue, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	store := accountpg.NewStore(pool.PgxPool())
	failOnce := false
	markCalls := 0
	directory := accountDirectoryAdapter{source: platformsupabase.Fake{}}
	service, err := account.NewService(account.ServiceDeps{Store: store, Directory: directory, InviteSigner: account.UnavailableInviteSigner{}, InviteGranter: accountNoInviteGranter{}, SignupBonusGranter: accountNoSignupBonusGranter{}, Achievements: account.NoAchievementRecorder{}, Withdrawals: failedWithdrawalMark{WithdrawalStore: store, failOnce: &failOnce, calls: &markCalls}, Scheduler: scheduler, Purgers: mustWithdrawal(t, pool).Purgers, Credentials: directory})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = service.Withdraw(ctx, scope); !errors.Is(err, readErr) || markCalls != 0 {
		t.Fatalf("target read failure: error=%v mark calls=%d", err, markCalls)
	}
	var marker *time.Time
	if err = pool.PgxPool().QueryRow(ctx, "SELECT deleted_at FROM users WHERE user_id=$1", userID).Scan(&marker); err != nil {
		t.Fatal(err)
	}
	if marker != nil {
		t.Fatal("failed target read committed the account mark")
	}
	if trigger := readWithdrawalTrigger(t, ctx, pool, scope); trigger.status != "pending" || trigger.active != 1 {
		t.Fatal("failed post-enqueue read did not leave an inert durable trigger")
	}
}

type failedWithdrawalMark struct {
	account.WithdrawalStore
	failOnce *bool
	calls    *int
}

func (s failedWithdrawalMark) InWithdrawalTx(ctx context.Context, fn func(account.WithdrawalStore) error) error {
	return s.WithdrawalStore.InWithdrawalTx(ctx, func(tx account.WithdrawalStore) error {
		return fn(failedWithdrawalMark{WithdrawalStore: tx, failOnce: s.failOnce, calls: s.calls})
	})
}

func (s failedWithdrawalMark) MarkWithdrawn(ctx context.Context, scope platform.UserScope, at time.Time) (time.Time, bool, error) {
	*s.calls++
	if *s.failOnce {
		*s.failOnce = false
		return time.Time{}, false, errors.New("injected tx-bound withdrawal mark failure")
	}
	return s.WithdrawalStore.MarkWithdrawn(ctx, scope, at)
}

type observedWithdrawalPurger struct {
	account.UserDataPurger
	calls *int
}

func (p observedWithdrawalPurger) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	*p.calls++
	return p.UserDataPurger.PurgeUser(ctx, scope)
}

type withdrawalTriggerState struct {
	id, status string
	due        time.Time
	terminal   *time.Time
	generation int64
	active     int
}

func readWithdrawalTrigger(t *testing.T, ctx context.Context, pool *platformdb.Pool, scope platform.UserScope) withdrawalTriggerState {
	t.Helper()
	identity, err := account.WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatal(err)
	}
	var s withdrawalTriggerState
	if err = pool.PgxPool().QueryRow(ctx, `SELECT id,status,next_run_at,terminal_at,lease_generation FROM jobs WHERE user_id=$1 AND kind=$2 AND dedup_key=$3`, scope.UserID(), string(identity.Kind()), identity.DedupKey()).Scan(&s.id, &s.status, &s.due, &s.terminal, &s.generation); err != nil {
		t.Fatal(err)
	}
	if err = pool.PgxPool().QueryRow(ctx, `SELECT count(*) FROM jobs WHERE user_id=$1 AND kind=$2 AND dedup_key=$3 AND status IN ('pending','running') AND terminal_at IS NULL`, scope.UserID(), string(identity.Kind()), identity.DedupKey()).Scan(&s.active); err != nil {
		t.Fatal(err)
	}
	var targets, correct int
	if err = pool.PgxPool().QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE target_kind='user' AND target_id=$1 AND expected_revision IS NULL) FROM job_targets WHERE user_id=$1 AND job_id=$2`, scope.UserID(), s.id).Scan(&targets, &correct); err != nil {
		t.Fatal(err)
	}
	if targets != 1 || correct != 1 {
		t.Fatalf("persisted withdrawal targets: total=%d correct=%d", targets, correct)
	}
	return s
}

func TestCompletedWithdrawalTriggerRecoveryAgainstDatabase(t *testing.T) {
	pool := openWithdrawalTestPool(t)
	for _, existingMarker := range []bool{false, true} {
		t.Run(fmt.Sprintf("existing-due-marker-%v", existingMarker), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
			defer cancel()
			userID := fmt.Sprintf("completed-withdrawal-%v-%d", existingMarker, time.Now().UnixNano())
			scope, err := platform.NewUserScope(userID)
			if err != nil {
				t.Fatal(err)
			}
			cleanupWithdrawalRows(t, pool, userID, userID, userID+"-cleanup")
			if _, err = pool.PgxPool().Exec(ctx, `INSERT INTO users(user_id,nickname,timezone,locale) VALUES($1,'recovery','UTC','en')`, userID); err != nil {
				t.Fatal(err)
			}
			retention := values.AccountWithdrawalRetentionWindow()
			// The old orphan is the oldest due job; only its eventual completion uses current DB time.
			now := time.Unix(1, 0).UTC().Add(-retention)
			store := accountpg.NewStore(pool.PgxPool())
			queue := queuepg.NewStore(pool.PgxPool())
			failOnce := true
			markCalls := 0
			purgeCalls := 0
			nextID := 0
			scheduler, err := account.NewWithdrawalJobScheduler(queue, func() time.Time { return now }, func() string { nextID++; return fmt.Sprintf("%s-job-%d", userID, nextID) })
			if err != nil {
				t.Fatal(err)
			}
			withdrawal := mustWithdrawal(t, pool)
			purgers := []account.UserDataPurger{}
			for _, leg := range withdrawal.Purgers {
				purgers = append(purgers, observedWithdrawalPurger{UserDataPurger: leg, calls: &purgeCalls})
			}
			banned, deleted := map[string]bool{}, map[string]bool{}
			directory := accountDirectoryAdapter{source: platformsupabase.Fake{BannedUsers: banned, DeletedUsers: deleted}}
			service, err := account.NewService(account.ServiceDeps{Store: store, Directory: directory, InviteSigner: account.UnavailableInviteSigner{}, InviteGranter: accountNoInviteGranter{}, SignupBonusGranter: accountNoSignupBonusGranter{}, Achievements: account.NoAchievementRecorder{}, Withdrawals: failedWithdrawalMark{WithdrawalStore: store, failOnce: &failOnce, calls: &markCalls}, Scheduler: scheduler, Purgers: purgers, Credentials: directory, Now: func() time.Time { return now }})
			if err != nil {
				t.Fatal(err)
			}
			if _, err = service.Withdraw(ctx, scope); err == nil || failOnce || markCalls != 1 {
				t.Fatalf("first mark fault: error=%v pending=%v calls=%d", err, failOnce, markCalls)
			}
			pending := readWithdrawalTrigger(t, ctx, pool, scope)
			var marker *time.Time
			if err = pool.PgxPool().QueryRow(ctx, "SELECT deleted_at FROM users WHERE user_id=$1", userID).Scan(&marker); err != nil {
				t.Fatal(err)
			}
			if pending.active != 1 || marker != nil {
				t.Fatal("failed transaction did not leave a live account and committed trigger")
			}
			if err = pool.PgxPool().QueryRow(ctx, "SELECT clock_timestamp()").Scan(&now); err != nil {
				t.Fatal(err)
			}
			handler := account.NewWithdrawalSweepJobHandler(service, func() time.Time { return now })
			var claimed jobqueue.Record
			observed := func(ctx context.Context, j jobqueue.Record) error {
				claimed = j
				if j.ID != pending.id || j.UserID != userID {
					return fmt.Errorf("unexpected claimed job %s", j.ID)
				}
				return handler(ctx, j)
			}
			cleaned := jobqueue.WithTerminalCleanup[jobqueue.Record](queue, queue, jobqueue.CleanupPolicy{Interval: time.Duration(values.WorkerCleanupIntervalS) * time.Second, BatchSize: int32(values.WorkerCleanupBatchSize), Retention: time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour})
			runner, err := jobqueue.NewRunner[jobqueue.Record](cleaned, map[string]jobqueue.Registration[jobqueue.Record]{string(account.WithdrawalJobKind): {Handler: observed, RetryForever: true}}, jobqueue.Config{Lease: time.Duration(values.AiJobLeaseMs) * time.Millisecond, MaxAttempts: int32(values.AiJobMaxAttempts), MaxClaims: int32(values.AiJobMaxClaims), BackoffBase: time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond, Now: func() time.Time { return now }})
			if err != nil {
				t.Fatal(err)
			}
			ran, err := runner.RunOnce(ctx)
			if err != nil || !ran || claimed.ID != pending.id {
				t.Fatalf("inert worker: ran=%v claim=%s error=%v", ran, claimed.ID, err)
			}
			done := readWithdrawalTrigger(t, ctx, pool, scope)
			if done.status != "done" || done.terminal == nil || purgeCalls != 0 || len(banned) != 0 || len(deleted) != 0 {
				t.Fatal("inert completion purged or failed to terminalize")
			}
			if err = pool.PgxPool().QueryRow(ctx, "SELECT clock_timestamp()").Scan(&now); err != nil {
				t.Fatal(err)
			}
			cutoff := now.Add(-time.Duration(values.AiJobTerminalRetentionDays) * 24 * time.Hour)
			if done.terminal.Before(cutoff) || done.terminal.After(now) || now.Sub(*done.terminal) > time.Minute {
				t.Fatal("DB terminal timestamp is not current and retained")
			}
			if _, err = queue.PurgeTerminalJobs(ctx, cutoff, int32(values.WorkerCleanupBatchSize)); err != nil {
				t.Fatal(err)
			}
			if retained := readWithdrawalTrigger(t, ctx, pool, scope); retained.id != done.id || retained.status != "done" {
				t.Fatal("cleanup erased retained precondition")
			}
			wantMarker := now
			if existingMarker {
				wantMarker = now.Add(-retention - time.Hour)
				if err = store.InWithdrawalTx(ctx, func(tx account.WithdrawalStore) error {
					_, marked, err := tx.MarkWithdrawn(ctx, scope, wantMarker)
					if err != nil {
						return err
					}
					if !marked {
						return errors.New("fixture existing marker did not land")
					}
					return nil
				}); err != nil {
					t.Fatal(err)
				}
			}
			window, err := service.Withdraw(ctx, scope)
			if err != nil {
				t.Fatal(err)
			}
			rearmed := readWithdrawalTrigger(t, ctx, pool, scope)
			if rearmed.active != 1 || rearmed.status != "pending" || rearmed.terminal != nil || rearmed.id != done.id || rearmed.generation != done.generation+1 || !rearmed.due.Equal(wantMarker.Add(retention)) || !window.WithdrawnAt.Equal(wantMarker) || !window.RestoreDeadlineAt.Equal(wantMarker.Add(retention)) {
				t.Fatalf("recovery: trigger=%+v window=%+v", rearmed, window)
			}
			if purgeCalls != 0 || len(banned) != 0 || len(deleted) != 0 {
				t.Fatal("scheduling recovery performed product or credential purge")
			}
		})
	}
}

func TestWithdrawRestoreWithdrawSweepLifecycleAndCacheAgainstDatabase(t *testing.T) {
	pool := openWithdrawalTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-withdrawal-lifecycle-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupWithdrawalRows(t, pool, userID, userID, base+"-cleanup")
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO users (user_id, nickname, timezone, locale)
		VALUES ($1, 'withdraw', 'UTC', 'en')`,
		userID,
	); err != nil {
		t.Fatalf("seed account failed: %v", err)
	}

	banned := map[string]bool{}
	deleted := map[string]bool{}
	directory := accountDirectoryAdapter{source: platformsupabase.Fake{
		BannedUsers:  banned,
		DeletedUsers: deleted,
	}}
	t.Setenv(envInviteTokenSigningKey, "")
	_, service, err := accountServiceOption(
		pool,
		directory,
		accountNoInviteGranter{},
		accountNoSignupBonusGranter{},
		account.NoAchievementRecorder{},
		mustWithdrawal(t, pool),
	)
	if err != nil {
		t.Fatalf("accountServiceOption failed: %v", err)
	}
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}

	first, err := service.Withdraw(ctx, scope)
	if err != nil {
		t.Fatalf("Withdraw(first) failed: %v", err)
	}
	identity, err := account.WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatalf("WithdrawalSweepJobIdentity failed: %v", err)
	}
	var firstJobID string
	var firstDedupKey string
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT id, dedup_key
		FROM jobs
		WHERE user_id = $1 AND kind = $2`,
		userID,
		string(account.WithdrawalJobKind),
	).Scan(&firstJobID, &firstDedupKey); err != nil {
		t.Fatalf("read first withdrawal job failed: %v", err)
	}
	if firstDedupKey != identity.DedupKey() {
		t.Fatalf("scheduled dedup key = %q, want %q", firstDedupKey, identity.DedupKey())
	}

	if _, withdrawn, err := service.WithdrawnAt(ctx, userID); err != nil || !withdrawn {
		t.Fatalf("WithdrawnAt before restore = withdrawn %v err %v", withdrawn, err)
	}
	if _, err := service.RestoreAccount(ctx, scope); err != nil {
		t.Fatalf("RestoreAccount failed: %v", err)
	}
	if _, withdrawn, err := service.WithdrawnAt(ctx, userID); err != nil || withdrawn {
		t.Fatalf("WithdrawnAt after restore = withdrawn %v err %v", withdrawn, err)
	}
	var cancelledJobs int
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT count(*)
		FROM jobs
		WHERE user_id = $1 AND kind = $2`,
		userID,
		string(account.WithdrawalJobKind),
	).Scan(&cancelledJobs); err != nil || cancelledJobs != 0 {
		t.Fatalf("jobs after restore = %d, err %v, want zero", cancelledJobs, err)
	}

	second, err := service.Withdraw(ctx, scope)
	if err != nil {
		t.Fatalf("Withdraw(second) failed: %v", err)
	}
	if second.WithdrawnAt.Before(first.WithdrawnAt) {
		t.Fatalf("second withdrawal moved backwards: first %v second %v", first, second)
	}
	var secondJobID string
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT id
		FROM jobs
		WHERE user_id = $1 AND kind = $2 AND dedup_key = $3`,
		userID,
		string(account.WithdrawalJobKind),
		identity.DedupKey(),
	).Scan(&secondJobID); err != nil {
		t.Fatalf("read second withdrawal job failed: %v", err)
	}
	handler := account.NewWithdrawalSweepJobHandler(
		service,
		func() time.Time { return second.RestoreDeadlineAt },
	)
	if err := handler(ctx, jobqueue.Record{
		ID:      secondJobID,
		UserID:  userID,
		Kind:    account.WithdrawalJobKind,
		Payload: []byte(`{}`),
		Targets: []jobqueue.Target{{
			Kind: jobqueue.TargetUser,
			ID:   userID,
		}},
	}); err != nil {
		t.Fatalf("withdrawal sweep failed: %v", err)
	}
	var remainingUsers int
	if err := pool.PgxPool().QueryRow(
		ctx,
		"SELECT count(*) FROM users WHERE user_id = $1",
		userID,
	).Scan(&remainingUsers); err != nil || remainingUsers != 0 {
		t.Fatalf("users after sweep = %d, err %v, want zero", remainingUsers, err)
	}
	if !banned[userID] || !deleted[userID] {
		t.Fatalf("credential sequence = banned %v deleted %v, want both", banned, deleted)
	}
}

func TestWithdrawalSweepPurgesEveryMigrationDeclaredUserTable(t *testing.T) {
	pool := openWithdrawalTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-withdrawal-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherUserID := base + "-other"
	keepJobID := base + "-sweep-job"
	now := time.Date(2026, 7, 26, 0, 0, 0, 0, time.UTC)
	cleanupWithdrawalRows(t, pool, userID, otherUserID, keepJobID)

	seededTables := seedWithdrawalTables(
		t,
		ctx,
		pool,
		base,
		userID,
		otherUserID,
		keepJobID,
		now,
	)
	aggregateMood, ok := accounttestregistry.MoodColorAggregateMoodFor(
		accounttestregistry.MoodColorAggregateOwnerWithdrawalTest,
	)
	if !ok {
		t.Fatal("withdrawal mood-color aggregate claim is not registered")
	}
	aggregateColor := fmt.Sprintf("#%06x", uint64(time.Now().UnixNano())&0xffffff)
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO mood_color_counts (mood, hue_bucket, color, count)
		VALUES ($1, 5, $2, 7)`, aggregateMood, aggregateColor); err != nil {
		t.Fatalf("seed anonymous mood color aggregate failed: %v", err)
	}
	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cleanupCancel()
		if _, err := pool.PgxPool().Exec(
			cleanupCtx,
			"DELETE FROM mood_color_counts WHERE mood = $1 AND color = $2",
			aggregateMood,
			aggregateColor,
		); err != nil {
			t.Errorf("cleanup anonymous mood color aggregate failed: %v", err)
		}
	})
	productTables := migrationDeclaredUserTables(t)
	databaseTables := databaseUserTables(t, ctx, pool)
	if got, want := sortedSetKeys(productTables), sortedSetKeys(databaseTables); !equalStrings(got, want) {
		t.Fatalf(
			"migration parser and migrated schema per-user tables differ\nmigrations: %v\nschema: %v",
			got,
			want,
		)
	}
	if got, want := sortedSetKeys(seededTables), sortedSetKeys(productTables); !equalStrings(got, want) {
		t.Fatalf(
			"migration-declared per-user tables and seeded tables differ\nseeded: %v\nmigrations: %v",
			got,
			want,
		)
	}

	banned := map[string]bool{}
	deleted := map[string]bool{}
	credentialCalls := &connectionProbeDirectory{
		Fake: platformsupabase.Fake{
			Accounts: []platformsupabase.Account{{UserID: userID, Email: "withdraw@example.com"}},
			IdentitiesByUser: map[string][]string{
				userID: {"password"},
			},
			BannedUsers:  banned,
			DeletedUsers: deleted,
		},
		pool: pool,
	}
	directory := accountDirectoryAdapter{source: credentialCalls}
	t.Setenv(envInviteTokenSigningKey, "")
	_, service, err := accountServiceOption(
		pool,
		directory,
		accountNoInviteGranter{},
		accountNoSignupBonusGranter{},
		account.NoAchievementRecorder{},
		mustWithdrawal(t, pool),
	)
	if err != nil {
		t.Fatalf("accountServiceOption failed: %v", err)
	}
	sweepNow := now.Add(-time.Hour - time.Second)
	handler := account.NewWithdrawalSweepJobHandler(service, func() time.Time { return sweepNow })
	job := jobqueue.Record{
		ID:      keepJobID,
		UserID:  userID,
		Kind:    account.WithdrawalJobKind,
		Payload: []byte(`{}`),
		Targets: []jobqueue.Target{{
			Kind: jobqueue.TargetUser,
			ID:   userID,
		}},
	}
	err = handler(ctx, job)
	var retryAt interface{ RetryAt() time.Time }
	if !errors.As(err, &retryAt) || !retryAt.RetryAt().Equal(now.Add(-time.Hour)) {
		t.Fatalf("early withdrawal sweep error = %v, retry = %v", err, retryAt)
	}
	var retainedBody string
	if err := pool.PgxPool().QueryRow(
		ctx,
		"SELECT body FROM diaries WHERE user_id = $1",
		userID,
	).Scan(&retainedBody); err != nil || retainedBody != "retained diary body" {
		t.Fatalf("retained diary before deadline = %q, err %v", retainedBody, err)
	}

	sweepNow = now
	err = handler(ctx, job)
	if err != nil {
		t.Fatalf("withdrawal sweep failed: %v", err)
	}

	for table := range productTables {
		wantRows := int64(0)
		if table == "jobs" || table == "job_targets" {
			wantRows = 1
		}
		if rows := countWithdrawalRows(t, ctx, pool, table, userID); rows != wantRows {
			t.Errorf("%s rows = %d, want %d", table, rows, wantRows)
		}
	}
	for _, table := range []string{"jobs", "job_targets"} {
		var rows int64
		if err := pool.PgxPool().QueryRow(
			ctx,
			"SELECT count(*) FROM "+table+" WHERE user_id = $1 AND "+
				map[string]string{"jobs": "id", "job_targets": "job_id"}[table]+" = $2",
			userID,
			keepJobID,
		).Scan(&rows); err != nil || rows != 1 {
			t.Fatalf("%s in-flight exception = rows %d, err %v", table, rows, err)
		}
	}
	if !banned[userID] || !deleted[userID] {
		t.Fatalf("credential sequence = banned %v deleted %v, want both", banned, deleted)
	}
	// The Supabase Admin calls run with no transaction open: a slow directory must not hold the
	// users row lock or a pooled connection.
	if credentialCalls.calls != 2 || credentialCalls.maxAcquired != 0 {
		t.Fatalf("credential calls = %d with up to %d pooled connections acquired, want 2 with none",
			credentialCalls.calls, credentialCalls.maxAcquired)
	}
	var anonymousCount int64
	if err := pool.PgxPool().QueryRow(
		ctx,
		"SELECT count FROM mood_color_counts WHERE mood = $1 AND color = $2",
		aggregateMood,
		aggregateColor,
	).Scan(&anonymousCount); err != nil || anonymousCount != 7 {
		t.Fatalf(
			"anonymous historical mood color count = %d, err %v, want 7",
			anonymousCount,
			err,
		)
	}

	assertWithdrawalNegativeRows(t, ctx, pool, base, userID, otherUserID)
}

func databaseUserTables(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
) map[string]struct{} {
	t.Helper()
	rows, err := pool.PgxPool().Query(ctx, `
		SELECT table_name
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND column_name = 'user_id'
		  AND table_name <> ALL($1::text[])
		ORDER BY table_name`,
		[]string{
			"admin_users",
			"ai_provider_keys",
			"ai_provider_config",
			"admin_stardust_grants",
			"admin_audit_log",
		},
	)
	if err != nil {
		t.Fatalf("enumerate migrated user tables: %v", err)
	}
	defer rows.Close()
	tables := map[string]struct{}{}
	for rows.Next() {
		var table string
		if err := rows.Scan(&table); err != nil {
			t.Fatalf("scan migrated user table: %v", err)
		}
		tables[table] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("enumerate migrated user tables: %v", err)
	}
	return tables
}

func seedWithdrawalTables(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
	base string,
	userID string,
	otherUserID string,
	keepJobID string,
	now time.Time,
) map[string]struct{} {
	t.Helper()
	seeded := map[string]struct{}{}
	exec := func(table string, sql string, args ...any) {
		t.Helper()
		if _, err := pool.PgxPool().Exec(ctx, sql, args...); err != nil {
			t.Fatalf("seed %s failed: %v", table, err)
		}
		seeded[table] = struct{}{}
	}

	diaryID := base + "-diary"
	memoryID := base + "-memory"
	neuronA := base + "-neuron-a"
	neuronB := base + "-neuron-b"
	synapseID := base + "-synapse"
	releaseID := base + "-release"

	exec("users", `
		INSERT INTO users (user_id, nickname, timezone, locale, deleted_at)
		VALUES ($1, 'withdraw', 'UTC', 'en', $2)`,
		userID,
		now.Add(-values.AccountWithdrawalRetentionWindow()-time.Hour),
	)
	exec("auth_providers", `
		INSERT INTO auth_providers (user_id, provider, provider_user_id)
		VALUES ($1, 'PASSWORD', $2)`, userID, base+"-provider")
	exec("invites", `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
		VALUES ($1, $2, $3, $4, $5, $5)`,
		base+"-own-invite", userID, base+"-invitee", base+"-own-token", now)
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO invites (id, user_id, invitee_user_id, token, created_at, bound_at)
		VALUES ($1, $2, $3, $4, $5, $5)`,
		base+"-counter-invite", otherUserID, userID, base+"-counter-token", now); err != nil {
		t.Fatalf("seed counterpart invite failed: %v", err)
	}
	exec("mood_colors", `
		INSERT INTO mood_colors (user_id, mood, color)
		VALUES ($1, 'CALM', '#5eb093')`, userID)

	exec("ornament_ownerships", `
		INSERT INTO ornament_ownerships (user_id, ornament_id, acquired_via)
		VALUES ($1, 'background.grainstorm', 'purchase')`, userID)
	exec("ornament_selections", `
		INSERT INTO ornament_selections (user_id, kind, ornament_id)
		VALUES ($1, 'BACKGROUND', 'background.grainstorm')`, userID)

	exec("achievement_counters", `
		INSERT INTO achievement_counters (user_id, counter_key, value)
		VALUES ($1, 'diary_written', 3)`, userID)
	exec("achievement_progress", `
		INSERT INTO achievement_progress (user_id, achievement_id, claimed_at, claim_id)
		VALUES ($1, 'first_diary', $2, $3)`, userID, now, base+"-claim")

	exec("twinkle_balances", `
		INSERT INTO twinkle_balances
			(user_id, additional, basic_spent_this_window, basic_reset_window)
		VALUES ($1, 7, 0, $2)`, userID, now)
	exec("twinkle_ledger_entries", `
		INSERT INTO twinkle_ledger_entries
			(id, user_id, kind, reason, amount, from_basic, from_additional, dedup_key)
		VALUES ($1, $2, 'earn', 'invite', 7, 0, 0, $3)`,
		base+"-ledger", userID, base+"-ledger-dedup")
	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO twinkle_ledger_entries
			(id, user_id, kind, reason, amount, from_basic, from_additional, dedup_key)
		VALUES ($1, $2, 'earn', 'invite', 7, 0, 0, $3)`,
		base+"-counter-ledger", otherUserID, base+"-counter-ledger-dedup"); err != nil {
		t.Fatalf("seed counterpart ledger failed: %v", err)
	}

	exec("diaries", `
		INSERT INTO diaries (id, user_id, body, diary_date, created_at)
		VALUES ($1, $2, 'retained diary body', $3::date, $3::timestamptz)`,
		diaryID, userID, now)
	exec("episodic_memories", `
		INSERT INTO episodic_memories
			(id, user_id, diary_id, name, current_text, mood, valence, arousal,
			 intensity, base_strength, created_universe_time)
		VALUES ($1, $2, $3, 'memory', 'memory text', 'calm', 0, 0, 0.5, 0.5, $4)`,
		memoryID, userID, diaryID, now)
	exec("neurons", `
		INSERT INTO neurons (id, user_id, name, neuron_type, created_at)
		VALUES ($1, $2, 'a', 'semantic', $3), ($4, $2, 'b', 'entity', $3)`,
		neuronA, userID, now, neuronB)
	exec("neuron_activations", `
		INSERT INTO neuron_activations (episodic_memory_id, neuron_id, user_id, weight)
		VALUES ($1, $2, $3, 0.5)`, memoryID, neuronA, userID)
	exec("synapses", `
		INSERT INTO synapses
			(id, user_id, neuron_a_id, neuron_b_id, strength, co_activation_count,
			 last_activated_universe_time, created_at)
		VALUES ($1, $2, $3, $4, 0.5, 1, $5::date, $5::timestamptz)`,
		synapseID, userID, neuronA, neuronB, now)
	exec("embeddings", `
		INSERT INTO embeddings (neuron_id, user_id, vector)
		VALUES (
			$1,
			$2,
			('[' || array_to_string(array_fill('0'::text, ARRAY[1024]), ',') || ']')::vector
		)`, neuronA, userID)
	exec("universe_state", `
		INSERT INTO universe_state (user_id, current_universe_time)
		VALUES ($1, $2)`, userID, now)
	exec("universe_revisions", `
		INSERT INTO universe_revisions (user_id, revision)
		VALUES ($1, 3)`, userID)
	exec("memory_provenance", `
		INSERT INTO memory_provenance
			(id, user_id, episodic_memory_id, kind, source, text, universe_time, semantic_stage)
		VALUES ($1, $2, $3, 'semanticized', 'system', 'history', $4, 1)`,
		base+"-provenance", userID, memoryID, now)
	exec("memory_paid_action_receipts", `
		INSERT INTO memory_paid_action_receipts
			(user_id, operation_id, action_kind, request_fingerprint, diary_id, response)
		VALUES ($1, $2, 'diary_recall', 'fingerprint', $3, '{}'::jsonb)`,
		userID, base+"-receipt", diaryID)

	exec("release_groups", `
		INSERT INTO release_groups (id, user_id, diary_id, deleted_at)
		VALUES ($1, $2, $3, $4)`, releaseID, userID, diaryID, now)
	exec("release_memories", `
		INSERT INTO release_memories (release_id, user_id, episodic_memory_id)
		VALUES ($1, $2, $3)`, releaseID, userID, memoryID)
	exec("release_sealed_neurons", `
		INSERT INTO release_sealed_neurons (release_id, user_id, neuron_id, sealed_at)
		VALUES ($1, $2, $3, $4)`, releaseID, userID, neuronA, now)
	exec("release_synapse_deltas", `
		INSERT INTO release_synapse_deltas (release_id, user_id, synapse_id, applied_delta)
		VALUES ($1, $2, $3, 0.1)`, releaseID, userID, synapseID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	withdrawalIdentity, err := account.WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatalf("WithdrawalSweepJobIdentity failed: %v", err)
	}
	exec("jobs", `
		INSERT INTO jobs
			(id, user_id, kind, payload, status, next_run_at, created_at, dedup_key)
		VALUES
			($1, $2, 'withdrawal_sweep', '{}'::jsonb, 'running', $3, $3, $4),
			($5, $2, 'embed', '{}'::jsonb, 'pending', $3, $3, $6)`,
		keepJobID,
		userID,
		now,
		withdrawalIdentity.DedupKey(),
		base+"-discard-job",
		base+"-discard-dedup",
	)
	exec("job_targets", `
		INSERT INTO job_targets (job_id, user_id, target_kind, target_id, expected_revision)
		VALUES
			($1, $2, 'user', $2, NULL),
			($3, $2, 'neuron', $4, 1)`,
		keepJobID,
		userID,
		base+"-discard-job",
		neuronB,
	)

	if _, err := pool.PgxPool().Exec(ctx, `
		INSERT INTO admin_users (user_id, granted_by)
		VALUES ($1, 'operator')`, userID); err != nil {
		t.Fatalf("seed operator row failed: %v", err)
	}
	return seeded
}

func migrationDeclaredUserTables(t *testing.T) map[string]struct{} {
	t.Helper()
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test source path")
	}
	migrationFiles, err := filepath.Glob(
		filepath.Join(filepath.Dir(sourceFile), "..", "..", "db", "migrations", "*.sql"),
	)
	if err != nil || len(migrationFiles) == 0 {
		t.Fatalf("migration glob = %v, files %d", err, len(migrationFiles))
	}
	createTable := regexp.MustCompile(`(?i)^CREATE TABLE(?: IF NOT EXISTS)? ([a-z_][a-z0-9_]*) \($`)
	dropTable := regexp.MustCompile(`(?i)^DROP TABLE(?: IF EXISTS)? ([a-z_][a-z0-9_]*)\s*;`)
	userColumn := regexp.MustCompile(`(?i)^user_id\s+`)
	platformTables := map[string]struct{}{
		"admin_users":           {},
		"ai_provider_keys":      {},
		"ai_provider_config":    {},
		"admin_stardust_grants": {},
		"admin_audit_log":       {},
	}
	tables := map[string]struct{}{}
	for _, migrationFile := range migrationFiles {
		file, err := os.Open(migrationFile)
		if err != nil {
			t.Fatalf("open migration %s: %v", migrationFile, err)
		}
		currentTable := ""
		// Only the Up half declares the migrated schema. A Down block is the inverse — its CREATE
		// re-raises a table this migration just dropped — so reading it would re-add a table the
		// database no longer has. Migrations are globbed in name order, which is apply order, so
		// applying each Up in turn (including its drops) lands on the final schema.
		inUp := false
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if strings.EqualFold(line, "-- +goose Up") {
				inUp = true
				continue
			}
			if strings.EqualFold(line, "-- +goose Down") {
				inUp = false
				currentTable = ""
				continue
			}
			if !inUp {
				continue
			}
			if match := createTable.FindStringSubmatch(line); len(match) == 2 {
				currentTable = strings.ToLower(match[1])
				continue
			}
			if match := dropTable.FindStringSubmatch(line); len(match) == 2 {
				delete(tables, strings.ToLower(match[1]))
				continue
			}
			if currentTable == "" {
				continue
			}
			if userColumn.MatchString(line) {
				if _, platformOwned := platformTables[currentTable]; !platformOwned {
					tables[currentTable] = struct{}{}
				}
			}
			if line == ");" {
				currentTable = ""
			}
		}
		scanErr := scanner.Err()
		closeErr := file.Close()
		if scanErr != nil || closeErr != nil {
			t.Fatalf("scan migration %s: scan %v close %v", migrationFile, scanErr, closeErr)
		}
	}
	return tables
}

func assertWithdrawalNegativeRows(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
	base string,
	userID string,
	otherUserID string,
) {
	t.Helper()
	for _, check := range []struct {
		name string
		sql  string
		args []any
	}{
		{
			name: "invite naming withdrawn user as invitee",
			sql:  "SELECT count(*) FROM invites WHERE user_id = $1 AND invitee_user_id = $2 AND token = $3",
			args: []any{otherUserID, userID, base + "-counter-token"},
		},
		{
			name: "counterpart ledger",
			sql:  "SELECT count(*) FROM twinkle_ledger_entries WHERE user_id = $1 AND id = $2",
			args: []any{otherUserID, base + "-counter-ledger"},
		},
		{
			name: "operator row",
			sql:  "SELECT count(*) FROM admin_users WHERE user_id = $1",
			args: []any{userID},
		},
	} {
		var rows int64
		if err := pool.PgxPool().QueryRow(ctx, check.sql, check.args...).Scan(&rows); err != nil || rows != 1 {
			t.Fatalf("%s = rows %d, err %v; want one untouched row", check.name, rows, err)
		}
	}
}

func countWithdrawalRows(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
	table string,
	userID string,
) int64 {
	t.Helper()
	var rows int64
	if err := pool.PgxPool().QueryRow(
		ctx,
		"SELECT count(*) FROM "+table+" WHERE user_id = $1",
		userID,
	).Scan(&rows); err != nil {
		t.Fatalf("count %s failed: %v", table, err)
	}
	return rows
}

func openWithdrawalTestPool(t *testing.T) *platformdb.Pool {
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
		t.Fatalf("open withdrawal test database: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// mustWithdrawal binds the real purge legs, so the sweep coverage test exercises the same wiring the
// API and the worker do rather than stubs that always succeed.
func mustWithdrawal(t *testing.T, pool *platformdb.Pool) wiring.Withdrawal {
	t.Helper()
	withdrawal, err := wiring.NewWithdrawal(pool.PgxPool())
	if err != nil {
		t.Fatalf("NewWithdrawal failed: %v", err)
	}
	return withdrawal
}

func cleanupWithdrawalRows(
	t *testing.T,
	pool *platformdb.Pool,
	userID string,
	otherUserID string,
	keepJobID string,
) {
	t.Helper()
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		scope, _ := platform.NewUserScope(userID)
		_ = memory.PurgeUser(ctx, memorypg.NewStore(pool.PgxPool()), scope, keepJobID+"-none")
		_ = twinkle.PurgeUser(ctx, twinklepg.NewStore(pool.PgxPool()), scope)
		for _, statement := range []string{
			"DELETE FROM auth_providers WHERE user_id = $1",
			"DELETE FROM invites WHERE user_id = $1 OR invitee_user_id = $1",
			"DELETE FROM mood_colors WHERE user_id = $1",
			"DELETE FROM ornament_selections WHERE user_id = $1",
			"DELETE FROM ornament_ownerships WHERE user_id = $1",
			"DELETE FROM achievement_progress WHERE user_id = $1",
			"DELETE FROM achievement_counters WHERE user_id = $1",
			"DELETE FROM users WHERE user_id = $1",
			"DELETE FROM admin_users WHERE user_id = $1",
			"DELETE FROM twinkle_ledger_entries WHERE user_id = $1",
			"DELETE FROM twinkle_balances WHERE user_id = $1",
		} {
			args := []any{userID}
			if strings.Contains(statement, "twinkle_") {
				args = []any{otherUserID}
			}
			if _, err := pool.PgxPool().Exec(ctx, statement, args...); err != nil {
				t.Errorf("withdrawal cleanup %q failed: %v", statement, err)
			}
		}
	})
}

func sortedSetKeys(values map[string]struct{}) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func equalStrings(left []string, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}

// connectionProbeDirectory records how many pooled connections are checked out while the sweep calls
// the credential directory.
type connectionProbeDirectory struct {
	platformsupabase.Fake
	pool        *platformdb.Pool
	calls       int
	maxAcquired int32
}

func (d *connectionProbeDirectory) observe() {
	d.calls++
	d.maxAcquired = max(d.maxAcquired, d.pool.PgxPool().Stat().AcquiredConns())
}

func (d *connectionProbeDirectory) SetUserBanned(ctx context.Context, userID string, banned bool) error {
	d.observe()
	return d.Fake.SetUserBanned(ctx, userID, banned)
}

func (d *connectionProbeDirectory) DeleteUser(ctx context.Context, userID string) error {
	d.observe()
	return d.Fake.DeleteUser(ctx, userID)
}
