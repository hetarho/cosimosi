package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	adminpg "github.com/cosimosi/api/internal/admin/pg"
	"github.com/cosimosi/api/internal/ai"
	memoryv1connect "github.com/cosimosi/api/internal/gen/cosimosi/memory/v1/memoryv1connect"
	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	memoryrpc "github.com/cosimosi/api/internal/memory/rpc"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// domainServiceOptions wires the memory + twinkle contexts at the composition root
// over ONE shared DB pool: pg stores, env-selected AI adapters (real or keyless
// mock), the cross-context economy seam (the real SpendGate + EarnPort into memory,
// memory's published reads into twinkle's quote — see twinkle.go), and both Connect
// handlers registered on the platform mux. Without DATABASE_URL the API still boots
// (matching the dev worker's opt-in posture) and only skips the domain services.
func domainServiceOptions(ctx context.Context, logger *log.Logger) ([]platform.HandlerOption, func(), error) {
	noop := func() {}
	cfg, err := platformdb.ConfigFromEnv()
	if errors.Is(err, platformdb.ErrDatabaseURLRequired) {
		logger.Print("DATABASE_URL is not set; memory and twinkle services are not registered")
		return nil, noop, nil
	}
	if err != nil {
		return nil, noop, err
	}
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return nil, noop, err
	}
	store := memorypg.NewStore(pool.PgxPool())
	// AI provider selection is runtime config (the admin console, the change to the AI-provider abstraction's env-only stance):
	// the resolving adapters resolve DB override → env → keyless mock and rebuild when the
	// effective config changes, so a SetAIConfig from the admin console applies WITHOUT a redeploy.
	// The admin store is the DB config reader; secretbox decrypts stored keys. One shared meter
	// counts real provider calls for both the daily caps and the admin usage dashboard.
	meter := ai.NewMeter()
	adminStore := adminpg.NewStore(pool.PgxPool())
	cipher, decrypter := adminCipher(logger)
	adapters := ai.NewResolvingAdapters(ai.NewRuntimeConfigSource(adminStore, decrypter), meter, logger)
	directory := newAccountDirectory()
	inviteGranter := &accountInviteRewardGranter{}
	signupBonusGranter := &accountSignupBonusGranter{}
	accountOptions, accountService, err := accountServiceOption(
		pool,
		accountDirectoryAdapter{source: directory},
		inviteGranter,
		signupBonusGranter,
	)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	// The twinkle service is built first (memory's gate and earn port wrap it); its
	// spend-signal reader binds back to the memory service just below — the one
	// two-way seam, closed here where every concrete is visible.
	signals := &memorySpendSignals{}
	twinkleService, err := newTwinkleService(
		pool,
		signals,
		accountInviteResolver{service: accountService},
		accountTwinkleZone{service: accountService},
	)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	inviteGranter.service = twinkleService
	signupBonusGranter.service = twinkleService
	service, err := memory.NewService(memory.ServiceDeps{
		Extractor:  adapters.Extractor,
		Embedder:   adapters.Embedder,
		Candidates: store,
		Launches:   store,
		Universe:   store,
		// Link runs as the last step of PersistEncoded's transaction,
		// wiring synapses over the launch's own store handle.
		Linker: memory.NewLinkService(memory.LinkDeps{}),
		// The real advance-triggered handler ([T4]): consolidation (우주의 잠)
		// runs inside every launch/sync advance transaction — no cron anywhere.
		Progression: memory.NewConsolidator(nil),
		// The recall transaction runs over the same store. SpendGate is the REAL
		// twinkle balance-check + deduct ([CC2] — the Epic-C allow-all no-op is
		// replaced here); Earn is the write grant fired inside the launch
		// transaction ([G3]); PredictionError is the LLM semantic-compare (keyless
		// mock when no key). All bound here, the only place that sees the concretes.
		Recalls:          store,
		SpendGate:        twinkleSpendGate{service: twinkleService},
		Earn:             twinkleEarnPort{service: twinkleService},
		SignupSettlement: accountSignupSettlement{service: accountService, logger: logger},
		PredictionError:  adapters.PredictionError,
		// The gist-view read shares the same store and the same SpendGate
		// instance as recall — one spend-and-check seam for both metered actions.
		Gists: store,
		// The paid gist-view transaction (target read + receipt + spend + receipt insert atomic,
		// A3) runs over the same store.
		ViewSemantics: store,
		// The published spend-signal reads run over the same store (standalone,
		// no transaction).
		Signals: store,
		// The read-only provenance + export reads run over the same store; both are
		// pure reads (no clock, no economy seam).
		Provenance: store,
		Exports:    store,
		// The diary-reader archive read runs over the same store (free, per-user scoped).
		Diaries: store,
		// The release/restore/letting-go/sweep transaction + letting-go candidate reads run over
		// the same store; SealSuggester is the AI seal-candidate suggester (keyless mock when no
		// key). The sweep is triggered opportunistically at the start of every Release (no cron) —
		// no worker registration is needed.
		Releases:      store,
		SealSuggester: adapters.SealSuggester,
		UserZone:      accountUserZone{service: accountService},
	})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	signals.bind(service)
	server, err := memoryrpc.NewServer(service)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	twinkleOption, err := twinkleServiceOption(twinkleService)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	adminOption, err := adminServiceOption(adminDeps{
		store:     adminStore,
		twinkle:   twinkleService,
		memory:    store,
		meter:     meter,
		cipher:    cipher,
		models:    aiModelCatalog{reader: adminStore, decrypter: decrypter},
		directory: adminAccountDirectory{source: directory},
	})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	logger.Printf("memory service registered ai_mode=%s", adapters.Mode)
	logger.Print("twinkle service registered (economy gate live)")
	logger.Print("account service registered (profile, signup, invite settlement)")
	logger.Print("admin service registered (operator console — admin-gated)")
	memoryOption := platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return memoryv1connect.NewMemoryServiceHandler(server, opts...)
	})
	options := []platform.HandlerOption{memoryOption, twinkleOption, adminOption}
	options = append(options, accountOptions...)
	return options, pool.Close, nil
}

// accountSignupSettlement is memory's post-commit observer. A settlement error is observable but
// can never turn an already-committed episodic-memory launch into a failure.
type accountSignupSettlement struct {
	service *account.Service
	logger  *log.Logger
}

func (s accountSignupSettlement) OnEngramsLaunched(ctx context.Context, scope platform.UserScope) {
	if err := s.service.SettleSignup(ctx, scope); err != nil {
		s.logger.Printf("settle signup after episodic-memory launch user_id=%s: %v", scope.UserID(), err)
	}
}

type accountUserZone struct {
	service *account.Service
}

func (a accountUserZone) ZoneFor(ctx context.Context, scope platform.UserScope) (*time.Location, error) {
	name, err := a.service.ZoneFor(ctx, scope)
	if err != nil {
		return nil, err
	}
	location, err := time.LoadLocation(name)
	if err != nil {
		return time.UTC, nil
	}
	return location, nil
}
