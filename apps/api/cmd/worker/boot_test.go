package main

import (
	"context"
	"io"
	"log"
	"os"
	"testing"
	"time"

	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// The boot proof for the binary the container runs: account.NewService refuses a missing seam, so a
// root that forgets one dies on start rather than at the first request.
func TestWorkerBootsWithEveryAccountSeamBound(t *testing.T) {
	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)

	worker, err := newWorker(pool, log.New(io.Discard, "", 0))
	if err != nil {
		t.Fatalf("the worker binary cannot boot: %v", err)
	}
	if worker.AIMode == "" {
		t.Fatal("newWorker returned no AI mode")
	}
}

// Every lane can hold a connection while the claim and the cleanup still find one.
func TestWorkerLanesLeaveAPooledConnection(t *testing.T) {
	if workerJobConcurrency >= workerDBMaxConns {
		t.Fatalf("workerJobConcurrency = %d, want fewer than workerDBMaxConns = %d", workerJobConcurrency, workerDBMaxConns)
	}
}
