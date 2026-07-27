package main

import (
	"context"
	"errors"
	"testing"

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
