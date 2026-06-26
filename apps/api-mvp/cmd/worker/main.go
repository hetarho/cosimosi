// Command worker runs the embedding pipeline as a standalone process.
//
// This is the optional process-split binary: the same job.Worker the API runs as
// a goroutine, wrapped as its own binary for when the embedding load warrants
// scaling it independently. cmd/api already starts the worker in-process.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cosimosi/backend/internal/admin"
	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/job"
	"github.com/cosimosi/backend/internal/llm"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/postgres"
)

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

	embedder, err := ai.NewEmbedder(cfg)
	if err != nil {
		slog.Error("embedder init failed", "err", err)
		os.Exit(1)
	}

	// Standalone worker follows the SAME admin-controlled extractor selection as
	// cmd/api (spec 34): an active console selection → real LLM extraction, none
	// → keyless mock. Without this the two binaries would extract differently
	// for the same admin state.
	adminCipher, err := admin.NewCipher(cfg.LLMKeyEncryptionKey)
	if err != nil {
		slog.Error("admin cipher init failed", "err", err)
		os.Exit(1)
	}
	adminSvc := admin.NewService(admin.NewRepository(db), adminCipher, cfg)
	extractor := ai.NewExtractor(cfg, llm.NewResolver(adminSvc, cfg, adminSvc), adminSvc)
	// Reconsolidation content rewriter (spec 54) — same admin-followed switch as the extractor.
	rewriter := ai.NewRewriter(cfg, llm.NewResolver(adminSvc, cfg, adminSvc), adminSvc)

	// Nightly consolidation ticker (spec 27): once a day enqueue a consolidate job
	// per active user; the worker below claims/runs them. Shares the signal-cancelled
	// ctx, so it stops on shutdown. Enqueue is idempotent, so this co-existing with
	// cmd/api's ticker (single-binary deploy runs the worker there too) never duplicates.
	tickerDone := make(chan struct{})
	go func() {
		job.StartNightlyConsolidation(ctx, job.NewScheduler(db), slog.Default())
		close(tickerDone)
	}()

	worker := job.NewWorker(job.NewRepository(db), job.NewGraphStore(db), embedder, extractor, rewriter, slog.Default())
	worker.Run(ctx) // blocks until ctx is cancelled by a signal

	// ctx is cancelled (signal) by the time Run returns. Wait for the ticker to observe it
	// and stop before the deferred db.Close() runs, so the pool isn't closed under an
	// in-flight enqueue (bounded — the ticker is idle between daily wake-ups).
	select {
	case <-tickerDone:
	case <-time.After(2 * time.Second):
		slog.Warn("nightly ticker did not stop in time; proceeding to shutdown")
	}
}
