package main

import (
	"context"
	"errors"
	"log"
	"net/http"

	"connectrpc.com/connect"
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
	adapters, err := ai.NewAdaptersFromEnv(ai.FactoryOptions{})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	// The twinkle service is built first (memory's gate and earn port wrap it); its
	// spend-signal reader binds back to the memory service just below — the one
	// two-way seam, closed here where every concrete is visible.
	signals := &memorySpendSignals{}
	twinkleService, err := newTwinkleService(pool, signals)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
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
		Recalls:         store,
		SpendGate:       twinkleSpendGate{service: twinkleService},
		Earn:            twinkleEarnPort{service: twinkleService},
		PredictionError: adapters.PredictionError,
		// The gist-view read shares the same store and the same SpendGate
		// instance as recall — one spend-and-check seam for both metered actions.
		Gists: store,
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
	logger.Printf("memory service registered ai_mode=%s", adapters.Mode)
	logger.Print("twinkle service registered (economy gate live)")
	memoryOption := platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return memoryv1connect.NewMemoryServiceHandler(server, opts...)
	})
	return []platform.HandlerOption{memoryOption, twinkleOption}, pool.Close, nil
}
