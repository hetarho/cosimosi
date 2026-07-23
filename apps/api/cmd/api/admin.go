package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/admin"
	"github.com/cosimosi/api/internal/admin/directory"
	adminpg "github.com/cosimosi/api/internal/admin/pg"
	adminrpc "github.com/cosimosi/api/internal/admin/rpc"
	"github.com/cosimosi/api/internal/ai"
	adminv1connect "github.com/cosimosi/api/internal/gen/cosimosi/admin/v1/adminv1connect"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/secretbox"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
)

// adminCipher builds the at-rest API-key cipher (admin write path) and its decrypter (the AI config
// source's read path) from LLM_KEY_ENCRYPTION_KEY. Without the key it returns the fail-closed
// disabled cipher: the console runs, but storing a provider key is refused rather than persisted in
// the clear.
func adminCipher(logger *log.Logger) (admin.Cipher, ai.KeyDecrypter) {
	box, ok, err := secretbox.NewFromEnv()
	if err != nil {
		logger.Printf("admin config cipher disabled: %v", err)
		return secretbox.Disabled{}, secretbox.Disabled{}
	}
	if !ok {
		logger.Printf("admin config cipher disabled: %s not set — provider key storage is unavailable", secretbox.EnvEncryptionKey)
		return secretbox.Disabled{}, secretbox.Disabled{}
	}
	return box, box
}

// adminDeps carries the already-built concretes the admin console composes (all visible at the
// composition root). The admin store doubles as the AI config reader (T010), and the meter is the
// same instance the resolving AI adapters count against, so the usage dashboard is truthful.
type adminDeps struct {
	store     adminpg.Store
	twinkle   *twinkle.Service
	memory    memorypg.Store
	meter     *ai.Meter
	cipher    admin.Cipher
	directory admin.AccountDirectory
}

// adminServiceOption wires the admin console (the admin console): the use-cases over their consumer-owned
// ports, behind the admin-authorization interceptor. A web-only operator surface; every method is
// admin-gated by the interceptor attached here (in addition to the shared auth chain).
func adminServiceOption(deps adminDeps) (platform.HandlerOption, error) {
	service, err := admin.NewService(admin.ServiceDeps{
		Store:      deps.store,
		Directory:  deps.directory,
		Twinkle:    adminTwinkleGranter{service: deps.twinkle},
		MemStats:   adminMemoryStats{store: deps.memory},
		Usage:      adminMeterUsage{meter: deps.meter},
		Jobs:       adminJobHealth{store: deps.memory},
		Cipher:     deps.cipher,
		Catalog:    aiProviderCatalog{},
		EnvConfig:  adminEnvConfig{},
		SeedAdmins: os.Getenv("ADMIN_USER_IDS"),
		// Dev-auth mode (COSIMOSI_DEV_AUTH) makes every signed-in user an admin so `pnpm dev`
		// reaches /admin without seeding ids — the same never-in-production flag as the dev verifier.
		DevMode: truthy(os.Getenv(envDevAuth)),
	})
	if err != nil {
		return nil, err
	}
	server, err := adminrpc.NewServer(service)
	if err != nil {
		return nil, err
	}
	authz := adminrpc.AuthorizationInterceptor(service)
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		// The shared chain (recovery/request-id/errors/logging/auth) runs first, then the admin
		// authorization gate — so a canonical user id is already in context when it checks IsAdmin.
		return adminv1connect.NewAdminServiceHandler(server, append(opts, connect.WithInterceptors(authz))...)
	}), nil
}

// newAccountDirectory selects the Supabase Auth Admin API adapter when a service-role key is
// configured, else the keyless fake (an empty dev user list rather than a hard failure).
func newAccountDirectory() admin.AccountDirectory {
	baseURL := os.Getenv("SUPABASE_PROJECT_URL")
	if baseURL == "" {
		baseURL = os.Getenv("SUPABASE_URL")
	}
	if sb, ok := directory.NewSupabase(baseURL, os.Getenv("SUPABASE_SERVICE_ROLE_KEY"), &http.Client{Timeout: 5 * time.Second}); ok {
		return sb
	}
	return directory.Fake{}
}

// adminTwinkleGranter binds admin's stardust seam to the twinkle economy (별가루 증정): balance read
// + the admin_grant earn. admin never imports twinkle types beyond this composition-root adapter.
type adminTwinkleGranter struct{ service *twinkle.Service }

func (g adminTwinkleGranter) Balance(ctx context.Context, userID string) (admin.Balance, error) {
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		return admin.Balance{}, err
	}
	balance, err := g.service.GetBalance(ctx, scope)
	if err != nil {
		return admin.Balance{}, err
	}
	return admin.Balance{Basic: balance.Basic, Additional: balance.Additional, Total: balance.Total()}, nil
}

func (g adminTwinkleGranter) Grant(ctx context.Context, targetUserID string, amount int, grantID string) (int, error) {
	scope, err := platform.NewUserScope(targetUserID)
	if err != nil {
		return 0, err
	}
	balance, err := g.service.EarnAdminGrant(ctx, scope, amount, grantID)
	if err != nil {
		return 0, err
	}
	return balance.Total(), nil
}

// adminMemoryStats binds the user list's non-content counts to memory's published aggregate read.
type adminMemoryStats struct{ store memorypg.Store }

func (a adminMemoryStats) Counts(ctx context.Context, userID string) (int, int, error) {
	diaries, stars, err := a.store.UserContentCounts(ctx, userID)
	if err != nil {
		return 0, 0, err
	}
	return int(diaries), int(stars), nil
}

// adminMeterUsage binds the usage dashboard to the shared metering snapshot. ProcessLocal=true
// reflects the the admin console limitation that the meter is in-process/in-memory.
type adminMeterUsage struct{ meter *ai.Meter }

func (a adminMeterUsage) Usage(_ context.Context) (admin.AIUsage, error) {
	snapshot := a.meter.Snapshot()
	return admin.AIUsage{
		Capabilities: []admin.CapabilityUsage{
			{Capability: admin.CapabilityLLM, CallsToday: snapshot.LLMCalls, DailyCap: snapshot.DailyCap},
			{Capability: admin.CapabilityEmbedding, CallsToday: snapshot.EmbeddingCalls, DailyCap: snapshot.DailyCap},
		},
		PerCallTokenCap: snapshot.PerCallTokens,
		WindowUTCDay:    snapshot.WindowUTCDay,
		ProcessLocal:    true,
	}, nil
}

// adminJobHealth binds the queue-health dashboard to memory's published job counts.
type adminJobHealth struct{ store memorypg.Store }

func (a adminJobHealth) Health(ctx context.Context) (admin.JobHealth, error) {
	counts, err := a.store.JobStatusCounts(ctx)
	if err != nil {
		return admin.JobHealth{}, err
	}
	dead, err := a.store.DeadLetteredJobs(ctx, int32(values.AiJobMaxAttempts))
	if err != nil {
		return admin.JobHealth{}, err
	}
	return admin.JobHealth{
		Pending:      counts["pending"],
		Running:      counts["running"],
		Done:         counts["done"],
		Failed:       counts["failed"],
		DeadLettered: dead,
	}, nil
}

// aiProviderCatalog binds the admin console's ProviderCatalog port to the AI registry (slots +
// per-capability support + adapter-implementation status), so admin imports no registry internals.
type aiProviderCatalog struct{}

func (aiProviderCatalog) Slots() []string                    { return ai.ProviderSlots() }
func (aiProviderCatalog) SupportsLLM(p string) bool          { return ai.SupportsLLM(p) }
func (aiProviderCatalog) SupportsEmbedding(p string) bool    { return ai.SupportsEmbedding(p) }
func (aiProviderCatalog) ImplementedLLM(p string) bool       { return ai.ImplementedLLM(p) }
func (aiProviderCatalog) ImplementedEmbedding(p string) bool { return ai.ImplementedEmbedding(p) }

// adminEnvConfig reports the env-configured provider selection so GetAIConfig can show the effective
// config when no DB override exists — never the plaintext key, only whether one is set.
type adminEnvConfig struct{}

func (adminEnvConfig) EnvConfig(capability admin.AICapability) (string, string, bool) {
	llm, embedding := ai.EnvCapabilityConfigs()
	cfg := llm
	if capability == admin.CapabilityEmbedding {
		cfg = embedding
	}
	return cfg.Provider, cfg.Model, cfg.APIKey != ""
}
