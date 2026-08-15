package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

func TestProductionWorkerRejectsMissingCredentialDirectory(t *testing.T) {
	t.Setenv(apperr.EnvDeployEnvironment, "production")
	t.Setenv("SUPABASE_PROJECT_URL", "")
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "")
	if _, err := newWorkerAccountDirectory(http.DefaultClient); err == nil {
		t.Fatal("production worker accepted missing Supabase Admin API credentials")
	}
}

func TestWorkerSettlementGrantersFailLoudly(t *testing.T) {
	t.Parallel()
	scope, err := platform.NewUserScope("worker-probe-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	if err := (workerNoInviteGranter{}).Grant(context.Background(), scope, "token"); !errors.Is(
		err,
		errWorkerInviteSettlementUnavailable,
	) {
		t.Fatalf("worker invite granter err = %v", err)
	}
	if err := (workerNoSignupBonusGranter{}).Grant(context.Background(), scope); !errors.Is(
		err,
		errWorkerSignupBonusUnavailable,
	) {
		t.Fatalf("worker signup bonus granter err = %v", err)
	}
	// This process settles no signup, so the recorder refuses rather than counting nothing: an
	// unexpected settlement here should be loud.
	if err := (workerNoAchievementRecorder{}).RecordProgress(
		context.Background(), scope, nil, "invite_settled", 1,
	); !errors.Is(err, errWorkerAchievementRecordingUnavailable) {
		t.Fatalf("worker achievement recorder err = %v", err)
	}
}

type withdrawalCompositionMemoryStore struct {
	scheduledDedupKey string
	cancelledDedupKey string
}

func (s *withdrawalCompositionMemoryStore) EnqueueJob(
	_ context.Context,
	_ platform.UserScope,
	job memory.Job,
) (memory.Job, error) {
	if job.DedupKey != nil {
		s.scheduledDedupKey = *job.DedupKey
	}
	return job, nil
}

func (s *withdrawalCompositionMemoryStore) CancelUserJob(
	_ context.Context,
	_ platform.UserScope,
	_ memory.JobKind,
	dedupKey string,
) error {
	s.cancelledDedupKey = dedupKey
	return nil
}

func (*withdrawalCompositionMemoryStore) PurgeUser(
	context.Context,
	platform.UserScope,
	string,
) error {
	return nil
}

type withdrawalCompositionTwinkleStore struct{}

func (withdrawalCompositionTwinkleStore) PurgeUser(
	context.Context,
	platform.UserScope,
) error {
	return nil
}

func TestWorkerWithdrawalCompositionUsesOneMemoryIdentity(t *testing.T) {
	t.Parallel()
	store := &withdrawalCompositionMemoryStore{}
	composition, err := newWithdrawalComposition(
		nil,
		store,
		store,
		withdrawalCompositionTwinkleStore{},
	)
	if err != nil {
		t.Fatalf("newWithdrawalComposition failed: %v", err)
	}
	scope, err := platform.NewUserScope("worker-withdrawal-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	identity, err := memory.WithdrawalSweepJobIdentity(scope)
	if err != nil {
		t.Fatalf("WithdrawalSweepJobIdentity failed: %v", err)
	}

	if err := composition.scheduler.Schedule(
		context.Background(),
		scope,
		time.Now().Add(time.Hour),
	); err != nil {
		t.Fatalf("Schedule failed: %v", err)
	}
	if err := composition.scheduler.Cancel(context.Background(), scope); err != nil {
		t.Fatalf("Cancel failed: %v", err)
	}
	if store.scheduledDedupKey != identity.DedupKey() ||
		store.cancelledDedupKey != store.scheduledDedupKey {
		t.Fatalf(
			"withdrawal identities = scheduled %q cancelled %q want %q",
			store.scheduledDedupKey,
			store.cancelledDedupKey,
			identity.DedupKey(),
		)
	}
	// THIS process is the production sweep, so a missing leg is not a cosmetic gap — it leaves that
	// context's rows behind a hard-deleted account ([I1][U1]). Every context owning per-user tables
	// must appear, in the order the sweep runs them.
	wantLegs := []string{"memory", "twinkle", "store", "achievement"}
	if len(composition.purgers) != len(wantLegs) {
		t.Fatalf("withdrawal purgers = %d legs, want %d (%v)", len(composition.purgers), len(wantLegs), wantLegs)
	}
	for i, want := range wantLegs {
		if got := composition.purgers[i].PurgeName(); got != want {
			t.Fatalf("purge leg %d = %q, want %q", i, got, want)
		}
	}
}

// The boot proof. `account.NewService` requires every seam unconditionally, so a root that forgets one
// dies on start rather than at the first request — and this binary is the one the container runs, so
// nothing else would have caught it: the API's own dev worker is wired separately.
func TestWorkerRunnerBootsWithEveryAccountSeamBound(t *testing.T) {
	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)

	runner, mode, err := newWorkerRunner(pool, log.New(io.Discard, "", 0))
	if err != nil {
		t.Fatalf("the worker binary cannot boot: %v", err)
	}
	if runner == nil || mode == "" {
		t.Fatalf("newWorkerRunner returned runner %v mode %q", runner, mode)
	}
}
