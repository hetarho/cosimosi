// Command api is the cosimosi HTTP API server.
//
// This file is the composition root: it is the only place that wires
// configuration, infrastructure clients, feature services, and HTTP
// routes together. Every other package depends inward.
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

	"github.com/labstack/echo/v4"

	"github.com/cosimosi/backend/internal/entry"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/platform/httpserver"
	"github.com/cosimosi/backend/internal/platform/postgres"
	"github.com/cosimosi/backend/internal/platform/s3"
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

	s3Client, err := s3.New(ctx, s3.Options{
		Endpoint:     cfg.S3Endpoint,
		Region:       cfg.S3Region,
		AccessKey:    cfg.S3AccessKey,
		SecretKey:    cfg.S3SecretKey,
		UsePathStyle: cfg.S3UsePathStyle,
	})
	if err != nil {
		slog.Error("s3 init failed", "err", err)
		os.Exit(1)
	}
	_ = s3Client // wired into a feature service when needed

	e := httpserver.New(cfg.CORSOrigin)

	e.GET("/health", func(c echo.Context) error {
		dbStatus := "down"
		if err := db.Ping(c.Request().Context()); err == nil {
			dbStatus = "up"
		}
		return c.JSON(http.StatusOK, echo.Map{
			"status":  "ok",
			"version": version,
			"db":      dbStatus,
		})
	})

	api := e.Group("/api")

	entryRepo := entry.NewPgRepository(db)
	entrySvc := entry.NewService(entryRepo)
	entry.RegisterRoutes(api, entrySvc)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           e,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("listen failed", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown failed", "err", err)
	}
}
