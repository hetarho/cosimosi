package platform

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	connectcors "connectrpc.com/cors"
	platformv1connect "github.com/cosimosi/api/internal/gen/cosimosi/platform/v1/platformv1connect"
	"github.com/cosimosi/api/internal/platform/observability"
)

const requestIDHeader = "X-Request-Id"

type handlerConfig struct {
	budgets           RequestBudgets
	procedureTimeouts map[string]time.Duration
	logger            *log.Logger
	corsOrigins       []string
	authVerifier      AuthTokenVerifier
	publicProcedures  []string
	accountStatus     AccountStatusReader
	withdrawnExempt   []string
	platformService   platformv1connect.PlatformServiceHandler
	observability     observability.Reporter
	services          []RPCServiceBuilder
}

// RPCServiceBuilder mounts one Connect service: it receives the shared platform
// interceptor chain (recovery, request-id, errors, logging, auth) and returns the
// generated handler's mount path + http.Handler.
type RPCServiceBuilder func(opts ...connect.HandlerOption) (string, http.Handler)

type HandlerOption func(*handlerConfig)

func withPlatformService(service platformv1connect.PlatformServiceHandler) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.platformService = service
	}
}

func WithAuthVerifier(verifier AuthTokenVerifier) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.authVerifier = verifier
	}
}

func withPublicProcedures(procedures []string) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.publicProcedures = append([]string(nil), procedures...)
	}
}

func WithAccountStatusReader(reader AccountStatusReader) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.accountStatus = reader
	}
}

func WithWithdrawnScopeExemptProcedures(procedures []string) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.withdrawnExempt = append([]string(nil), procedures...)
	}
}

func WithObservabilityReporter(reporter observability.Reporter) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.observability = reporter
	}
}

// WithRPCService registers an additional Connect service (built at the
// composition root) on the platform mux, behind the same interceptor chain the
// platform service uses. The owning context passes the deadlines its own slow
// procedures need; every other procedure gets the default budget.
func WithRPCService(build RPCServiceBuilder, timeouts ...ProcedureTimeout) HandlerOption {
	return func(cfg *handlerConfig) {
		cfg.services = append(cfg.services, build)
		registerProcedureTimeouts(cfg.procedureTimeouts, timeouts)
	}
}

func NewHandler(logger *log.Logger, opts ...HandlerOption) http.Handler {
	cfg := handlerConfig{
		budgets:           DefaultRequestBudgets(),
		procedureTimeouts: map[string]time.Duration{},
		logger:            logger,
		corsOrigins:       defaultCORSOrigins(),
		publicProcedures:  []string{platformv1connect.PlatformServicePingProcedure},
		platformService:   PlatformService{},
		observability:     observability.NoopReporter{},
	}
	for _, opt := range opts {
		opt(&cfg)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte("hello world"))
	})

	chain := []connect.Interceptor{
		PanicRecoveryInterceptor(cfg.logger, cfg.observability),
		RequestIDInterceptor(),
		StructuredErrorInterceptor(cfg.observability),
		RequestBudgetInterceptor(cfg.budgets, cfg.procedureTimeouts),
		LoggingInterceptor(cfg.logger),
		AuthInterceptor(cfg.authVerifier, cfg.publicProcedures),
	}
	if len(cfg.services) > 0 {
		chain = append(chain, WithdrawnScopeInterceptor(cfg.accountStatus, cfg.withdrawnExempt))
	}
	options := []connect.HandlerOption{connect.WithInterceptors(chain...), connect.WithReadMaxBytes(cfg.budgets.MaxMessageBytes)}
	path, handler := platformv1connect.NewPlatformServiceHandler(cfg.platformService, options...)
	mux.Handle(path, handler)
	for _, build := range cfg.services {
		servicePath, serviceHandler := build(options...)
		mux.Handle(servicePath, serviceHandler)
	}

	return requestIDMiddleware(corsMiddleware(cfg.corsOrigins, http.MaxBytesHandler(mux, int64(cfg.budgets.MaxMessageBytes))))
}

func NewHTTPServer(addr string, logger *log.Logger, opts ...HandlerOption) *http.Server {
	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)

	return &http.Server{
		Addr:              addr,
		Handler:           NewHandler(logger, opts...),
		Protocols:         protocols,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      serverWriteTimeout,
		IdleTimeout:       2 * time.Minute,
	}
}

func defaultCORSOrigins() []string {
	if raw := os.Getenv("COSIMOSI_CORS_ORIGINS"); raw != "" {
		parts := strings.Split(raw, ",")
		origins := make([]string, 0, len(parts))
		for _, part := range parts {
			if origin := strings.TrimSpace(part); origin != "" {
				origins = append(origins, origin)
			}
		}
		return origins
	}
	return []string{
		// Web dev server (vite strictPort 1214) and the RN Metro dev server (8081).
		"http://localhost:1214",
		"http://127.0.0.1:1214",
		"http://localhost:8081",
		"http://127.0.0.1:8081",
	}
}

func corsMiddleware(allowedOrigins []string, next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	allowedHeaders := append(connectcors.AllowedHeaders(), "Authorization", requestIDHeader)
	exposedHeaders := append(connectcors.ExposedHeaders(), requestIDHeader)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, ok := allowed[origin]; origin != "" && ok {
			header := w.Header()
			header.Set("Access-Control-Allow-Origin", origin)
			header.Set("Access-Control-Expose-Headers", strings.Join(exposedHeaders, ","))
			header.Add("Vary", "Origin")
		}

		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			header := w.Header()
			header.Set("Access-Control-Allow-Methods", strings.Join(connectcors.AllowedMethods(), ","))
			header.Set("Access-Control-Allow-Headers", strings.Join(allowedHeaders, ","))
			header.Set("Access-Control-Max-Age", "7200")
			header.Add("Vary", "Access-Control-Request-Method")
			header.Add("Vary", "Access-Control-Request-Headers")
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
