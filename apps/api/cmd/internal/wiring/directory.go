package wiring

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/cosimosi/api/internal/platform/apperr"
	platformsupabase "github.com/cosimosi/api/internal/platform/supabase"
)

const (
	envSupabaseProjectURL     = "SUPABASE_PROJECT_URL"
	envSupabaseURL            = "SUPABASE_URL"
	envSupabaseServiceRoleKey = "SUPABASE_SERVICE_ROLE_KEY"
)

// ErrProductionDirectoryRequired refuses a production boot without Supabase Admin API credentials.
var ErrProductionDirectoryRequired = errors.New("production account withdrawal requires Supabase Admin API credentials")

// DirectorySource is the platform account directory: account binds its identity and credential
// reads, admin its user listing, each through its own adapter.
type DirectorySource interface {
	ListUserPage(ctx context.Context, page int, pageSize int) ([]platformsupabase.Account, error)
	EmailFor(ctx context.Context, userID string) (string, error)
	EmailVerifiedAt(ctx context.Context, userID string) (time.Time, error)
	Identities(ctx context.Context, userID string) ([]string, error)
	SetUserBanned(ctx context.Context, userID string, banned bool) error
	DeleteUser(ctx context.Context, userID string) error
}

// AccountDirectory selects the Supabase Admin API directory from the environment. Without credentials
// it selects the in-memory fake, except in production, which refuses to boot: the withdrawal sweep
// bans and deletes auth users through this directory.
func AccountDirectory(httpClient *http.Client) (DirectorySource, error) {
	baseURL := os.Getenv(envSupabaseProjectURL)
	if baseURL == "" {
		baseURL = os.Getenv(envSupabaseURL)
	}
	if directory, ok := platformsupabase.NewDirectory(baseURL, os.Getenv(envSupabaseServiceRoleKey), httpClient); ok {
		return directory, nil
	}
	if apperr.ProductionDeployment() {
		return nil, ErrProductionDirectoryRequired
	}
	return platformsupabase.Fake{}, nil
}
