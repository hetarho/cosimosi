package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"

	"github.com/cosimosi/api/cmd/internal/wiring"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

const envDevWorker = "COSIMOSI_DEV_WORKER"

// maybeStartDevWorker runs the same job worker cmd/worker runs, over its own small pool, when
// COSIMOSI_DEV_WORKER is on. The returned stop cancels it, waits for it and closes the pool.
func maybeStartDevWorker(ctx context.Context, logger *log.Logger) (func(), error) {
	if !truthy(os.Getenv(envDevWorker)) {
		return func() {}, nil
	}
	cfg, err := platformdb.ConfigFromEnv()
	if err != nil {
		return nil, err
	}
	cfg.MaxConns, cfg.MaxConnLifetimeJitter = devWorkerDBMaxConns, dbConnLifetimeJitter
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return nil, err
	}
	directory, err := wiring.AccountDirectory(apiDirectoryHTTPClient())
	if err != nil {
		pool.Close()
		return nil, err
	}
	_, decrypter := adminCipher(logger)
	// The dev worker stays single-lane and stops with the API, with no drain window.
	worker, err := wiring.NewWorker(wiring.WorkerDeps{Pool: pool, Directory: directory, Decrypter: decrypter, Logger: logger, Lanes: 1})
	if err != nil {
		pool.Close()
		return nil, err
	}

	workerCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		logger.Printf("dev memory worker starting ai_mode=%s", worker.AIMode)
		if err := worker.Runner.Run(workerCtx); err != nil && !errors.Is(err, context.Canceled) {
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
