// Command api is the cosimosi backend entrypoint.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/observability"
)

const (
	// Network and shutdown budgets are deployment policy, not product tuning:
	// they stay named at the composition root and are passed to the adapters.
	supabaseAuthHTTPTimeout      = 3 * time.Second
	supabaseDirectoryHTTPTimeout = 5 * time.Second
	apiShutdownTimeout           = 5 * time.Second
	reporterFlushTimeout         = 2 * time.Second
	// The database budget is shared with the worker and the other stack on one session pooler
	// (DEPLOY.md). The dev worker's pool is a separate, smaller budget used only in development.
	apiDBMaxConns        = 4
	devWorkerDBMaxConns  = 2
	dbConnLifetimeJitter = 10 * time.Minute
)

func main() {
	logger := log.Default()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, logger); err != nil {
		stop()
		logger.Fatalf("api: %v", err)
	}
}

// run owns every resource the API opens, so each one is released by the time it returns — on a
// startup failure, a clean shutdown and a shutdown that timed out alike.
func run(ctx context.Context, logger *log.Logger) error {
	handlerOptions := authHandlerOptions(logger, &http.Client{Timeout: supabaseAuthHTTPTimeout})
	reporter, err := observability.NewReporterFromEnv()
	if err != nil {
		return fmt.Errorf("configure observability reporter: %w", err)
	}
	defer func() {
		if ok := reporter.Flush(reporterFlushTimeout); !ok {
			logger.Print("observability reporter flush timed out")
		}
	}()
	handlerOptions = append(handlerOptions, platform.WithObservabilityReporter(reporter))
	domainOptions, closeDomain, err := domainServiceOptions(ctx, logger)
	if err != nil {
		return fmt.Errorf("wire domain services: %w", err)
	}
	handlerOptions = append(handlerOptions, domainOptions...)
	stopWorker, err := maybeStartDevWorker(ctx, logger)
	if err != nil {
		closeDomain()
		return fmt.Errorf("start dev memory worker: %w", err)
	}
	// The dev worker stops before the domain pool closes; both run after the server stops.
	cleanup := func() {
		stopWorker()
		closeDomain()
	}
	server := platform.NewHTTPServer(":"+port(), logger, handlerOptions...)
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		cleanup()
		return fmt.Errorf("listen on %s: %w", server.Addr, err)
	}
	logger.Printf("api listening on %s", server.Addr)
	return serveHTTPServer(ctx, server, listener, logger, apiShutdownTimeout, cleanup)
}

// serveHTTPServer serves until ctx ends, then gives in-flight requests shutdownTimeout and closes
// whatever is left. A paid action cut off there is receipt-protected: the client retries it with the
// same operation id. cleanup runs after the server has stopped, on every path.
func serveHTTPServer(
	ctx context.Context,
	server *http.Server,
	listener net.Listener,
	logger *log.Logger,
	shutdownTimeout time.Duration,
	cleanup func(),
) error {
	defer cleanup()
	errs := make(chan error, 1)
	go func() {
		errs <- server.Serve(listener)
	}()

	select {
	case err := <-errs:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		logger.Print("api shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			closeErr := server.Close()
			<-errs
			return errors.Join(fmt.Errorf("shutdown api server: %w", err), closeErr)
		}
		if err := <-errs; err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}

func authHandlerOptions(logger *log.Logger, httpClient *http.Client) []platform.HandlerOption {
	if devVerifier, ok := devAuthVerifier(); ok {
		logger.Print("COSIMOSI_DEV_AUTH is on: accepting dev fake-token bearers — never enable in production")
		return []platform.HandlerOption{platform.WithAuthVerifier(devVerifier)}
	}
	verifier, ok, err := platform.NewSupabaseJWTVerifierFromEnv(httpClient)
	if err != nil {
		logger.Fatalf("configure Supabase auth verifier: %v", err)
	}
	if !ok {
		logger.Print("Supabase auth verifier is not configured; protected RPCs will reject bearer tokens")
		return nil
	}
	return []platform.HandlerOption{platform.WithAuthVerifier(verifier)}
}

func apiDirectoryHTTPClient() *http.Client {
	return &http.Client{Timeout: supabaseDirectoryHTTPTimeout}
}

// port reads PORT from the environment (runtime config, not a tuning constant),
// defaulting to 8080.
func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}
