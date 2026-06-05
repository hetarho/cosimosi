// Command api is the cosimosi HTTP/RPC API server.
//
// This file is the composition root: the only place that wires configuration,
// infrastructure clients, and the server together. Every other package depends
// inward. The Connect server itself (mux, h2c, CORS, interceptors, /health) is
// assembled in internal/platform/rpcserver.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/job"
	"github.com/cosimosi/backend/internal/link"
	"github.com/cosimosi/backend/internal/memory"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/postgres"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
)

const version = "0.0.1"

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := postgres.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("postgres init failed", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	// Compose the feature graph: link read service feeds the memory service's
	// GetUniverse; the memory handler is the real MemoryService implementation
	// mounted by rpcserver (replacing spec 02's stub).
	linkSvc := link.NewService(link.NewRepository(db))
	memorySvc := memory.NewService(memory.NewRepository(db), linkSvc)
	memoryHandler := memory.NewHandler(memorySvc)

	// Async embedding worker (spec 05): consumes the jobs the RecordMemory
	// transaction enqueues, fills embeddings, and writes initial semantic synapses.
	// MVP runs it as a goroutine in this process (Architecture §4.6); it shares the
	// signal-cancelled ctx so it stops on shutdown.
	embedder, err := ai.NewEmbedder(cfg)
	if err != nil {
		slog.Error("embedder init failed", "err", err)
		os.Exit(1)
	}
	worker := job.NewWorker(job.NewRepository(db), job.NewGraphStore(db), embedder, slog.Default())
	workerDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(workerDone)
	}()

	server := rpcserver.New(cfg, db, version, memoryHandler)

	// A serve error (e.g. the port is already bound) must NOT exit 0 — an
	// orchestrator would read a clean exit as success and never restart us.
	// Surface it on a channel so the startup path can exit non-zero.
	serveErr := make(chan error, 1)
	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
		}
	}()

	select {
	case <-ctx.Done():
		slog.Info("shutting down")
	case err := <-serveErr:
		slog.Error("listen failed", "err", err)
		os.Exit(1)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown failed", "err", err)
	}

	// Wait for the worker goroutine to observe the cancelled ctx and stop before
	// the deferred db.Close() runs, so it never closes the pool out from under an
	// in-flight job. Run returns promptly (its DB calls fail fast on the cancelled
	// ctx); a bounded wait guards against a stuck call, with the ClaimJob lease as
	// the safety net for any job left mid-flight.
	select {
	case <-workerDone:
	case <-time.After(5 * time.Second):
		slog.Warn("worker did not stop in time; proceeding to shutdown")
	}
}
