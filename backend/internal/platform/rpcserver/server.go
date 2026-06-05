// Package rpcserver is server plumbing only: it wires the Connect handler onto a
// net/http mux with h2c (cleartext HTTP/2), CORS, and the auth + logging
// interceptors, plus a /health endpoint. It holds NO business logic — the real
// MemoryService implementation lives in internal/memory and is injected into New
// by the composition root (cmd/api).
package rpcserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/connect"
	connectcors "connectrpc.com/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"github.com/cosimosi/backend/internal/gen/cosimosi/v1/cosimosiv1connect"
	"github.com/cosimosi/backend/internal/platform/config"
)

// New builds the fully-wired HTTP server: the given MemoryService Connect handler
// (the real implementation from internal/memory, injected by cmd/api) behind
// logging→auth interceptors, a /health endpoint that reports DB reachability, all
// wrapped in CORS and h2c. The caller owns the listen/shutdown lifecycle (cmd/api).
func New(cfg *config.Config, db *pgxpool.Pool, version string, memorySvc cosimosiv1connect.MemoryServiceHandler) *http.Server {
	mux := http.NewServeMux()

	// Logging is outermost, auth innermost (onion order): every request — even
	// auth-rejected ones — is logged, and the handler only runs once authenticated.
	path, handler := cosimosiv1connect.NewMemoryServiceHandler(
		memorySvc,
		connect.WithInterceptors(
			NewLoggingInterceptor(slog.Default()),
			NewAuthInterceptor(cfg.SupabaseJWTSecret, cfg.SupabaseProjectURL),
		),
	)
	mux.Handle(path, handler)

	// /health is mounted directly on the mux, so it bypasses the interceptors.
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "down"
		if err := db.Ping(r.Context()); err == nil {
			dbStatus = "up"
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"version": version,
			"db":      dbStatus,
		})
	})

	// h2c wraps the outermost handler so the cleartext HTTP/2 upgrade applies to
	// all traffic (we terminate TLS at the edge — Cloudflare/Hetzner — per §7).
	root := h2c.NewHandler(withCORS(mux, cfg.CORSOrigin), &http2.Server{})

	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           root,
		ReadHeaderTimeout: 10 * time.Second,
	}
}

// withCORS allows the configured browser origin, using connect's recommended
// method/header sets plus Authorization (the Bearer token) on requests.
func withCORS(h http.Handler, origin string) http.Handler {
	return cors.New(cors.Options{
		AllowedOrigins: []string{origin},
		AllowedMethods: connectcors.AllowedMethods(),
		AllowedHeaders: append(connectcors.AllowedHeaders(), "Authorization"),
		ExposedHeaders: connectcors.ExposedHeaders(),
		MaxAge:         7200, // cache preflight (seconds)
	}).Handler(h)
}
