package main

import (
	"testing"

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
