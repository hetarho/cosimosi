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

// memoryServiceOption wires the memory context at the composition root: DB pool →
// pg store, env-selected AI adapters (real or keyless mock) → memory.Service →
// Connect handler registered on the platform mux. Without DATABASE_URL the API
// still boots (matching the dev worker's opt-in posture) and only skips the
// memory service.
func memoryServiceOption(ctx context.Context, logger *log.Logger) (platform.HandlerOption, func(), error) {
	noop := func() {}
	cfg, err := platformdb.ConfigFromEnv()
	if errors.Is(err, platformdb.ErrDatabaseURLRequired) {
		logger.Print("DATABASE_URL is not set; memory service is not registered")
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
		// The recall transaction runs over the same store. SpendGate is the
		// allow-all no-op default until the economy rebinds the real balance-check
		// + deduct (§CC2); PredictionError is the LLM semantic-compare (keyless mock
		// when no key). All bound here, the only place that sees the concretes.
		Recalls:         store,
		SpendGate:       memory.AllowAllSpendGate{},
		PredictionError: adapters.PredictionError,
		// The gist-view read shares the same store and the same SpendGate
		// instance as recall — one spend-and-check seam for both metered actions.
		Gists: store,
	})
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	server, err := memoryrpc.NewServer(service)
	if err != nil {
		pool.Close()
		return nil, noop, err
	}
	logger.Printf("memory service registered ai_mode=%s", adapters.Mode)
	option := platform.WithRPCService(func(opts ...connect.HandlerOption) (string, http.Handler) {
		return memoryv1connect.NewMemoryServiceHandler(server, opts...)
	})
	return option, pool.Close, nil
}
