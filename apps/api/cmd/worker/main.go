// Command worker drains the cosimosi background jobs table.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/cosimosi/api/cmd/internal/wiring"
	"github.com/cosimosi/api/internal/ai"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/secretbox"
)

const (
	// These are deployment budgets, kept in the worker composition root.
	workerDirectoryHTTPTimeout = 5 * time.Second
	// The database budget is shared with the API and the other stack on one session pooler
	// (DEPLOY.md).
	workerDBMaxConns     = 3
	dbConnLifetimeJitter = 10 * time.Minute
	// workerJobConcurrency lanes share the queue, so one slow provider call no longer holds every
	// other job behind it. It stays below the pool size: a lane holds at most one connection at a
	// time, and the claim and cleanup need one more.
	workerJobConcurrency = 2
	// workerDrainTimeout is how long in-flight jobs may finish after SIGTERM; it stays inside the
	// container's stop grace (docker-compose.prod.yml) so the drain ends before the kill.
	workerDrainTimeout = 20 * time.Second
)

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
	cfg.MaxConns, cfg.MaxConnLifetimeJitter = workerDBMaxConns, dbConnLifetimeJitter
	pool, err := platformdb.Open(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()

	worker, err := newWorker(pool, logger)
	if err != nil {
		return err
	}
	logger.Printf("memory worker starting ai_mode=%s", worker.AIMode)
	return worker.Runner.Run(ctx)
}

// newWorker binds this process's environment into the shared job worker. A malformed key-encryption
// key is a boot failure here: the worker has no console to degrade to, and running on the env provider
// while the operator selected a stored one would be a silent provider switch.
func newWorker(pool *platformdb.Pool, logger *log.Logger) (wiring.Worker, error) {
	var decrypter ai.KeyDecrypter = secretbox.Disabled{}
	if box, ok, err := secretbox.NewFromEnv(); err != nil {
		return wiring.Worker{}, err
	} else if ok {
		decrypter = box
	}
	directory, err := wiring.AccountDirectory(&http.Client{Timeout: workerDirectoryHTTPTimeout})
	if err != nil {
		return wiring.Worker{}, err
	}
	return wiring.NewWorker(wiring.WorkerDeps{
		Pool: pool, Directory: directory, Decrypter: decrypter, Logger: logger,
		Lanes: workerJobConcurrency, DrainTimeout: workerDrainTimeout,
	})
}
