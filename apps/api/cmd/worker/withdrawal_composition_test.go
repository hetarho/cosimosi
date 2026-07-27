package main

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/apperr"
)

func TestProductionWorkerRejectsMissingCredentialDirectory(t *testing.T) {
	t.Setenv(apperr.EnvDeployEnvironment, "production")
	t.Setenv("SUPABASE_PROJECT_URL", "")
	t.Setenv("SUPABASE_URL", "")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "")
	if _, err := newWorkerAccountDirectory(); err == nil {
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
	if len(composition.purgers) != 2 ||
		composition.purgers[0].PurgeName() != "memory" ||
		composition.purgers[1].PurgeName() != "twinkle" {
		t.Fatalf("withdrawal purgers = %#v", composition.purgers)
	}
}
