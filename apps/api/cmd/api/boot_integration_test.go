package main

import (
	"context"
	"io"
	"log"
	"os"
	"testing"

	platformdb "github.com/cosimosi/api/internal/platform/db"
)

// The API's boot proof: domainServiceOptions and the dev worker compose every context over a real
// database, so a binding this root forgets fails here rather than at `pnpm dev` or in production.
func TestDomainServicesAndDevWorkerBoot(t *testing.T) {
	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}
	t.Setenv(platformdb.EnvDatabaseURL, url)
	t.Setenv(envDevWorker, "1")
	t.Setenv(envInviteTokenSigningKey, "")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	logger := log.New(io.Discard, "", 0)

	options, closeDomain, err := domainServiceOptions(ctx, logger)
	if err != nil {
		t.Fatalf("domainServiceOptions failed: %v", err)
	}
	defer closeDomain()
	if len(options) == 0 {
		t.Fatal("domainServiceOptions registered no service")
	}
	stopWorker, err := maybeStartDevWorker(ctx, logger)
	if err != nil {
		t.Fatalf("maybeStartDevWorker failed: %v", err)
	}
	stopWorker()
}
