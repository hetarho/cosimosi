// Command worker runs the embedding pipeline as a standalone process.
//
// This is the optional process-split skeleton (spec 05 T018, Architecture §4.6):
// the same job.Worker the API runs as a goroutine, wrapped as its own binary for
// when the embedding load warrants scaling it independently. MVP does not require
// it — `cmd/api` already starts the worker in-process — but keeping the
// composition root here makes that split a config change, not a rewrite.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/job"
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

	worker := job.NewWorker(job.NewRepository(db), job.NewGraphStore(db), embedder, slog.Default())
	worker.Run(ctx) // blocks until ctx is cancelled by a signal
}
