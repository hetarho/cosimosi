package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"github.com/cosimosi/api/cmd/internal/wiring"
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

// domainServiceOptions opens the one shared DB pool and composes every context over it. Without
// DATABASE_URL the API still boots (matching the dev worker's opt-in posture) and only skips the
// domain services. Any composition failure closes the pool in one place.
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
	options, err := composeDomain(logger, pool)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	return options, pool.Close, nil
}

// composeDomain wires the contexts in dependency order: pg stores, the runtime-resolved AI adapters,
// the cross-context economy seam (the transaction-bound spend and earn capabilities into memory,
// memory's published reads into twinkle's quote — see twinkle.go), and every Connect handler.
func composeDomain(logger *log.Logger, pool *platformdb.Pool) ([]platform.HandlerOption, error) {
	store := memorypg.NewStore(pool.PgxPool())
	// AI provider selection is runtime config (the admin console): the resolving adapters resolve DB
	// override → env → keyless mock and rebuild when the effective config changes, so a SetAIConfig
	// applies without a redeploy. The admin store is the DB config reader; secretbox decrypts stored
	// keys. One shared meter counts real provider calls for both the daily caps and the admin usage
	// dashboard.
	meter := ai.NewMeter()
	adminStore := adminpg.NewStore(pool.PgxPool())
	cipher, decrypter := adminCipher(logger)
	adapters := wiring.AIAdapters(adminStore, decrypter, meter, logger)
	directory, err := wiring.AccountDirectory(apiDirectoryHTTPClient())
	if err != nil {
		return nil, err
	}
	accountReads, err := account.NewReadService(accountpg.NewStore(pool.PgxPool()), accountDirectoryAdapter{source: directory})
	if err != nil {
		return nil, err
	}
	signalReads, err := memory.NewSpendSignalService(store, store, accountUserZone{service: accountReads}, nil)
	if err != nil {
		return nil, err
	}
	twinkleService, err := newTwinkleService(pool, &memorySpendSignals{service: signalReads}, accountInviteResolver{service: accountReads}, wiring.TwinkleZone{Service: accountReads})
	if err != nil {
		return nil, err
	}
	// One progress recorder serves every producer: memory and store report on their own
	// transactions, account on the pool.
	progress := achievement.NewRecorder()
	store, err = bindMemoryTransactions(store, twinkleService, progress)
	if err != nil {
		return nil, err
	}
	withdrawal, err := wiring.NewWithdrawal(pool.PgxPool())
	if err != nil {
		return nil, err
	}
	accountOptions, accountService, err := accountServiceOption(
		pool, accountDirectoryAdapter{source: directory},
		&accountInviteRewardGranter{service: twinkleService},
		&accountSignupBonusGranter{service: twinkleService},
		accountAchievementRecorder{achievementRecorder{binding: &achievementRecorderBinding{pool: pool, service: progress}}},
		withdrawal,
	)
	if err != nil {
		return nil, err
	}
	memoryOption, err := memoryServiceOption(logger, store, adapters, accountService)
	if err != nil {
		return nil, err
	}
	twinkleOption, err := twinkleServiceOption(twinkleService)
	if err != nil {
		return nil, err
	}
	// The store service is built after twinkle because a save's debit joins the save's transaction
	// through the economy; the withdrawal sweep takes its purge leg over the pool instead, so the two
	// contexts still meet only here.
	storeService, err := newStoreService(pool, twinkleService, progress)
	if err != nil {
		return nil, err
	}
	storeOption, err := storeServiceOption(storeService)
	if err != nil {
		return nil, err
	}
	// Settlement is built after its payout services; progress recording was independently ready first.
	achievementService, err := newAchievementService(pool, achievementDeps{twinkle: twinkleService, store: storeService})
	if err != nil {
		return nil, err
	}
	achievementOption, err := achievementServiceOption(achievementService)
	if err != nil {
		return nil, err
	}
	adminOption, err := adminServiceOption(adminDeps{
		store:   adminStore,
		twinkle: twinkleService,
		memory:  store,
		meter:   meter,
		cipher:  cipher,
		models: aiModelCatalog{
			reader: adminStore, decrypter: decrypter, httpClients: wiring.AIHTTPClients(),
		},
		directory: adminAccountDirectory{source: directory},
	})
	if err != nil {
		return nil, err
	}
	logger.Printf("memory service registered ai_mode=%s", adapters.Mode)
	logger.Print("twinkle service registered (economy gate live)")
	logger.Print("account service registered (profile, signup, invite settlement)")
	logger.Print("admin service registered (operator console — admin-gated)")
	logger.Print("store service registered (ornament catalog reads)")
	logger.Print("achievement service registered (catalog + progress read)")
	options := []platform.HandlerOption{memoryOption, twinkleOption, adminOption, storeOption, achievementOption}
	return append(options, accountOptions...), nil
}

// memoryServiceOption builds memory's use cases over the economy-bound store and registers the
// MemoryService handler with its procedure deadlines.
func memoryServiceOption(logger *log.Logger, store memorypg.Store, adapters ai.Adapters, accountService *account.Service) (platform.HandlerOption, error) {
	encoding, err := memory.NewEncodingService(memory.EncodingDeps{Extractor: adapters.Extractor, Embedder: adapters.Embedder, Candidates: store, Logger: logger})
	if err != nil {
		return nil, err
	}
	zone := accountUserZone{service: accountService}
	// Launch and the paid actions advance the same clock through the same consolidation hook.
	progression := memory.NewConsolidator(nil)
	launches, err := memory.NewLaunchService(memory.LaunchDeps{
		Launches:         store,
		Linker:           memory.NewLinkService(memory.LinkDeps{}),
		Progression:      progression,
		SignupSettlement: accountSignupSettlement{service: accountService, logger: logger},
		UserZone:         zone,
	})
	if err != nil {
		return nil, err
	}
	paid, err := memory.NewPaidActionService(memory.PaidActionDeps{
		Recalls:         store,
		ViewSemantics:   store,
		PredictionError: adapters.PredictionError,
		Progression:     progression,
		UserZone:        zone,
	})
	if err != nil {
		return nil, err
	}
	releases, err := memory.NewReleaseService(memory.ReleaseDeps{Releases: store, SealSuggester: adapters.SealSuggester})
	if err != nil {
		return nil, err
	}
	reads, err := memory.NewReadService(memory.ReadDeps{
		Universe:   store,
		Provenance: store,
		Diaries:    store,
		Clock:      store,
		UserZone:   zone,
	})
	if err != nil {
		return nil, err
	}
	exports, err := memory.NewExportService(store)
	if err != nil {
		return nil, err
	}
	server, err := memoryrpc.NewServer(memoryrpc.Services{
		Encoding: encoding,
		Launches: launches,
		Paid:     paid,
		Releases: releases,
		Reads:    reads,
		Exports:  exports,
	})
	if err != nil {
		return nil, err
	}
	return platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return memoryv1connect.NewMemoryServiceHandler(server, opts...)
	}, memoryrpc.ProcedureTimeouts()...), nil
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
