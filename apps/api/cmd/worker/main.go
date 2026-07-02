// Command worker drains the cosimosi background jobs table.
package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cosimosi/api/internal/ai"

	// Blank imports register the available provider adapters into internal/ai's
	// factory. Provider + key are read from env per capability (COSIMOSI_LLM_* /
	// COSIMOSI_EMBEDDING_*); a missing key selects the keyless mock, an unknown
	// provider name is a startup error. Adding a provider = a new subpackage + one
	// blank import here, no consumer change.
	_ "github.com/cosimosi/api/internal/ai/anthropic"
	_ "github.com/cosimosi/api/internal/ai/voyage"

	"github.com/cosimosi/api/internal/memory"
	memorypg "github.com/cosimosi/api/internal/memory/pg"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

const workerPollInterval = time.Second

func main() {
	logger := log.Default()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx, logger); err != nil && !errors.Is(err, context.Canceled) {
		logger.Fatalf("run worker: %v", err)
	}
}

func run(ctx context.Context, logger *log.Logger) error {
	cfg, err := platformdb.ConfigFromEnv()
	if err != nil {
		return err
	}
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	runner, mode, err := newWorkerRunner(pool, logger)
	if err != nil {
		return err
	}
	logger.Printf("memory worker starting ai_mode=%s", mode)
	return runner.Run(ctx)
}

func newWorkerRunner(pool *platformdb.Pool, logger *log.Logger) (interface{ Run(context.Context) error }, string, error) {
	store := memorypg.NewStore(pool.PgxPool())
	adapters, err := ai.NewAdaptersFromEnv(ai.FactoryOptions{})
	if err != nil {
		return nil, "", err
	}
	runner, err := memory.NewDefaultJobRunner(
		store,
		adapters.Embedder,
		adapters.Semanticizer,
		workerPollInterval,
		logger,
	)
	if err != nil {
		return nil, "", err
	}
	return runner, adapters.Mode, nil
}
