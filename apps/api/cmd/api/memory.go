package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/internal/account"
	accountpg "github.com/cosimosi/api/internal/account/pg"
	"github.com/cosimosi/api/internal/achievement"
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
// mock), the cross-context economy seam (the transaction-bound spend and earn capabilities into memory,
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
	cfg.MaxConns, cfg.MaxConnLifetimeJitter = apiDBMaxConns, dbConnLifetimeJitter
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
	aiHTTPClients := apiAIHTTPClients()
	adapters := ai.NewResolvingAdapters(
		ai.NewRuntimeConfigSource(adminStore, decrypter), meter, logger, aiHTTPClients,
	)
	directory := newAccountDirectory(apiDirectoryHTTPClient())
	accountReads, err := account.NewReadService(accountpg.NewStore(pool.PgxPool()), accountDirectoryAdapter{source: directory})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	signalReads, err := memory.NewSpendSignalService(store, store, accountUserZone{service: accountReads}, nil)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	signals := &memorySpendSignals{service: signalReads}
	twinkleService, err := newTwinkleService(pool, signals, accountInviteResolver{service: accountReads}, accountTwinkleZone{service: accountReads})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	// One progress recorder serves every producer: memory and store report on their own
	// transactions, account on the pool.
	progress := achievement.NewRecorder()
	store = bindMemoryTransactions(store, twinkleService, progress)
	achievementRecorders := &achievementRecorderBinding{pool: pool, service: progress}
	accountOptions, accountService, err := accountServiceOption(
		pool, accountDirectoryAdapter{source: directory},
		&accountInviteRewardGranter{service: twinkleService},
		&accountSignupBonusGranter{service: twinkleService},
		accountAchievementRecorder{achievementRecorder{binding: achievementRecorders}},
		storeWithdrawalPurgerFor(pool), achievementWithdrawalPurgerFor(pool),
	)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	encoding, err := memory.NewEncodingService(memory.EncodingDeps{Extractor: adapters.Extractor, Embedder: adapters.Embedder, Candidates: store})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	commands, err := memory.NewCommandService(memory.CommandDeps{
		Launches:         store,
		Linker:           memory.NewLinkService(memory.LinkDeps{}),
		Progression:      memory.NewConsolidator(nil),
		Recalls:          store,
		SignupSettlement: accountSignupSettlement{service: accountService, logger: logger},
		PredictionError:  adapters.PredictionError,
		ViewSemantics:    store,
		Releases:         store,
		SealSuggester:    adapters.SealSuggester,
		UserZone:         accountUserZone{service: accountService},
	})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	service, err := memory.NewServiceWithCapabilities(encoding, commands, memory.ReadServiceDeps{
		Universe:   store,
		Gists:      store,
		Signals:    store,
		Provenance: store,
		Exports:    store,
		Diaries:    store,
	})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	exports, err := memory.NewExportService(store)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	server, err := memoryrpc.NewServer(service, exports)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	twinkleOption, err := twinkleServiceOption(twinkleService)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	// The store service is built after twinkle because a save's debit joins the save's transaction
	// through the economy; the withdrawal sweep takes its purge leg over the pool instead, so the two
	// contexts still meet only here.
	storeService, err := newStoreService(pool, twinkleService, progress)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	storeOption, err := storeServiceOption(storeService)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	// Settlement is built after its payout services; progress recording was independently ready first.
	achievementService, err := newAchievementService(pool, achievementDeps{
		twinkle: twinkleService,
		store:   storeService,
	})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	achievementOption, err := achievementServiceOption(achievementService)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	adminOption, err := adminServiceOption(adminDeps{
		store:   adminStore,
		twinkle: twinkleService,
		memory:  store,
		meter:   meter,
		cipher:  cipher,
		models: aiModelCatalog{
			reader: adminStore, decrypter: decrypter, httpClients: aiHTTPClients,
		},
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
	logger.Print("store service registered (ornament catalog reads)")
	logger.Print("achievement service registered (catalog + progress read)")
	memoryOption := platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return memoryv1connect.NewMemoryServiceHandler(server, opts...)
	})
	options := []platform.HandlerOption{memoryOption, twinkleOption, adminOption, storeOption, achievementOption}
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
	service interface {
		ZoneFor(context.Context, platform.UserScope) (string, error)
	}
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
