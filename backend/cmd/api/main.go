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

	sentry "github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"

	"github.com/cosimosi/backend/internal/admin"
	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/job"
	"github.com/cosimosi/backend/internal/link"
	"github.com/cosimosi/backend/internal/llm"
	"github.com/cosimosi/backend/internal/memory"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/postgres"
	"github.com/cosimosi/backend/internal/platform/rpcserver"
	"github.com/cosimosi/backend/internal/settings"
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

	// Production error tracking. No DSN → skipped entirely, so local/dev
	// and tests are unaffected. Handler panics are captured by the sentryhttp wrap below.
	sentryEnabled := false
	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:         cfg.SentryDSN,
			Environment: cfg.SentryEnvironment,
			Release:     version,
		}); err != nil {
			slog.Warn("sentry init failed; continuing without it", "err", err)
		} else {
			sentryEnabled = true
			defer sentry.Flush(2 * time.Second)
			defer sentry.Recover()
			slog.Info("sentry enabled", "environment", cfg.SentryEnvironment)
		}
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
	// mounted by rpcserver.
	linkSvc := link.NewService(link.NewRepository(db))
	memorySvc := memory.NewService(memory.NewRepository(db), linkSvc)
	memoryHandler := memory.NewHandler(memorySvc)
	settingsHandler := settings.NewHandler(settings.NewService(settings.NewRepository(db)))

	// Admin console (spec 34): LLM provider/key management + ops dashboard.
	// A nil cipher (LLM_KEY_ENCRYPTION_KEY unset) is a valid degraded state —
	// reads work, key writes return FailedPrecondition; an INVALID key is a
	// boot error (a typo silently disabling encryption would be worse).
	adminCipher, err := admin.NewCipher(cfg.LLMKeyEncryptionKey)
	if err != nil {
		slog.Error("admin cipher init failed", "err", err)
		os.Exit(1)
	}
	adminSvc := admin.NewService(admin.NewRepository(db), adminCipher, cfg)
	adminHandler := admin.NewHandler(adminSvc)

	// Async extraction + embedding worker (specs 05/21): consumes the extract job
	// the RecordMemory transaction enqueues, fans the diary out into fragment
	// stars, then embeds each fragment and writes initial semantic synapses.
	// It runs as a goroutine in this process and shares the
	// signal-cancelled ctx so it stops on shutdown.
	embedder, err := ai.NewEmbedder(cfg)
	if err != nil {
		slog.Error("embedder init failed", "err", err)
		os.Exit(1)
	}
	// The extractor's llm client is the admin-backed resolver (spec 34): the
	// active provider/model/key swap at runtime without a restart. The mock path
	// (AI_EXTRACTOR unset) never touches it.
	extractor, err := ai.NewExtractor(cfg, llm.NewResolver(adminSvc, cfg, adminSvc))
	if err != nil {
		slog.Error("extractor init failed", "err", err)
		os.Exit(1)
	}
	worker := job.NewWorker(job.NewRepository(db), job.NewGraphStore(db), embedder, extractor, slog.Default())
	workerDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(workerDone)
	}()

	// RPC panics are recovered INSIDE connect (rpcserver recover handler, 17) and
	// no longer propagate to the sentryhttp wrap below — this hook is how they
	// still reach Sentry. Keeps Sentry in the composition root (rpcserver stays
	// infra-only; nil hook = log-only).
	var panicCapture rpcserver.PanicCapture
	if sentryEnabled {
		panicCapture = func(ctx context.Context, _ string, p any) {
			hub := sentry.GetHubFromContext(ctx) // request-scoped hub from the sentryhttp wrap
			if hub == nil {
				hub = sentry.CurrentHub()
			}
			hub.RecoverWithContext(ctx, p)
		}
	}
	server := rpcserver.New(cfg, db, version, memoryHandler, settingsHandler, adminHandler, panicCapture)

	// The sentryhttp wrap still earns its keep after 17: it attaches the
	// request-scoped hub the capture hook reads, and catches panics from non-RPC
	// mux handlers (/health). Repanic so net/http still returns 500 on those.
	if sentryEnabled {
		server.Handler = sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle(server.Handler)
	}

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
