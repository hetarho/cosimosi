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

	server := rpcserver.New(cfg, db, version)

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
}
