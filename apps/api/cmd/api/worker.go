package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/ai"

	// Blank imports register the available provider adapters into internal/ai's
	// factory (see cmd/worker for the per-capability env contract).
	_ "github.com/cosimosi/api/internal/ai/anthropic"
	_ "github.com/cosimosi/api/internal/ai/deepseek"
	_ "github.com/cosimosi/api/internal/ai/voyage"

	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

const (
	envDevWorker          = "COSIMOSI_DEV_WORKER"
	devWorkerPollInterval = time.Second
)

func maybeStartDevWorker(ctx context.Context, logger *log.Logger) (func(), error) {
	if !truthy(os.Getenv(envDevWorker)) {
		return func() {}, nil
	}
	cfg, err := platformdb.ConfigFromEnv()
	if err != nil {
		return nil, err
	}
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return nil, err
	}
	store := memorypg.NewStore(pool.PgxPool())
	adapters, err := ai.NewAdaptersFromEnv(ai.FactoryOptions{})
	if err != nil {
		pool.Close()
		return nil, err
	}
	runner, err := memory.NewDefaultJobRunner(
		store,
		adapters.Embedder,
		adapters.Semanticizer,
		devWorkerPollInterval,
		logger,
	)
	if err != nil {
		pool.Close()
		return nil, err
	}

	workerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		logger.Printf("dev memory worker starting ai_mode=%s", adapters.Mode)
		if err := runner.Run(workerCtx); err != nil && !errors.Is(err, context.Canceled) {
			logger.Printf("dev memory worker stopped: %v", err)
		}
	}()
	return func() {
		cancel()
		<-done
		pool.Close()
	}, nil
}

func truthy(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}
