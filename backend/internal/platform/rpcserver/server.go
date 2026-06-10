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

// maxRequestBytes caps a single unary request message (17, acceptance 2.6). The
// largest legitimate payload is a RecordMemory body (≤4000 runes ≈ 16KB UTF-8),
// so 256KB is generous headroom while shutting down cheap large-POST DoS /
// embedding-cost amplification on the 1GB Lightsail box. It also stays coherent
// with the client's 64KB keepalive flush cap (spec 11).
const maxRequestBytes = 256 << 10 // 256 KiB

// Server hardening timeouts (17): ReadTimeout bounds slow-body uploads (a
// trickled POST would otherwise park a goroutine forever — ReadHeaderTimeout
// covers headers only), WriteTimeout bounds slow-reader responses, IdleTimeout
// reaps abandoned keep-alive connections. Unary handlers finish in milliseconds,
// so generous values only bound abuse, not real traffic.
const (
	readTimeout  = 30 * time.Second
	writeTimeout = 30 * time.Second
	idleTimeout  = 120 * time.Second
)

// New builds the fully-wired HTTP server: the given MemoryService Connect handler
// (the real implementation from internal/memory, injected by cmd/api) behind
// logging→auth interceptors, a /health endpoint that reports DB reachability, all
// wrapped in CORS and h2c. panicCapture (nil-safe) forwards recovered RPC panics
// to the composition root's tracker. The caller owns the listen/shutdown lifecycle.
func New(cfg *config.Config, db *pgxpool.Pool, version string, memorySvc cosimosiv1connect.MemoryServiceHandler, panicCapture PanicCapture) *http.Server {
	mux := http.NewServeMux()

	// Logging is outermost, auth innermost (onion order): every request — even
	// auth-rejected ones — is logged, and the handler only runs once authenticated.
	// WithRecover (17, 2.7): panic → stack-logged + captured + CodeInternal (recover.go).
	path, handler := cosimosiv1connect.NewMemoryServiceHandler(
		memorySvc,
		connect.WithReadMaxBytes(maxRequestBytes),
		connect.WithInterceptors(
			NewLoggingInterceptor(slog.Default()),
			NewAuthInterceptor(cfg.SupabaseJWTSecret, cfg.SupabaseProjectURL),
		),
		connect.WithRecover(newRecoverHandler(slog.Default(), panicCapture)),
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
	// Read/WriteTimeout DO reach h2c streams (x/net arms per-stream deadlines from
	// the BaseConfig *http.Server) — only IdleTimeout doesn't propagate, so the
	// http2.Server mirrors it for stream-less h2c connections.
	root := h2c.NewHandler(withCORS(mux, cfg.CORSOrigin), &http2.Server{
		IdleTimeout: idleTimeout,
	})

	return &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           root,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       readTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
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
