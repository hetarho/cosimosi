// Command api is the cosimosi backend entrypoint.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/observability"
)

const (
	supabaseAuthHTTPTimeout = 3 * time.Second
	apiShutdownTimeout      = 5 * time.Second
	reporterFlushTimeout    = 2 * time.Second
)

func main() {
	logger := log.Default()
	handlerOptions := authHandlerOptions(logger)
	reporter, err := observability.NewReporterFromEnv()
	if err != nil {
		logger.Fatalf("configure observability reporter: %v", err)
	}
	handlerOptions = append(handlerOptions, platform.WithObservabilityReporter(reporter))
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	memoryOption, closeMemory, err := memoryServiceOption(ctx, logger)
	if err != nil {
		logger.Fatalf("wire memory service: %v", err)
	}
	defer closeMemory()
	if memoryOption != nil {
		handlerOptions = append(handlerOptions, memoryOption)
	}
	stopWorker, err := maybeStartDevWorker(ctx, logger)
	if err != nil {
		logger.Fatalf("start dev memory worker: %v", err)
	}
	defer stopWorker()
	server := platform.NewHTTPServer(":"+port(), logger, handlerOptions...)
	logger.Printf("api listening on %s", server.Addr)
	if err := serveHTTPServer(ctx, server, logger); err != nil {
		reporter.Flush(reporterFlushTimeout)
		logger.Fatalf("serve api: %v", err)
	}
	if ok := reporter.Flush(reporterFlushTimeout); !ok {
		logger.Print("observability reporter flush timed out")
	}
}

func serveHTTPServer(ctx context.Context, server *http.Server, logger *log.Logger) error {
	errs := make(chan error, 1)
	go func() {
		errs <- server.ListenAndServe()
	}()

	select {
	case err := <-errs:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		logger.Print("api shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), apiShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			_ = server.Close()
			return fmt.Errorf("shutdown api server: %w", err)
		}
		if err := <-errs; err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}

func authHandlerOptions(logger *log.Logger) []platform.HandlerOption {
	if devVerifier, ok := devAuthVerifier(); ok {
		logger.Print("COSIMOSI_DEV_AUTH is on: accepting dev fake-token bearers — never enable in production")
		return []platform.HandlerOption{platform.WithAuthVerifier(devVerifier)}
	}
	verifier, ok, err := platform.NewSupabaseJWTVerifierFromEnv(&http.Client{
		Timeout: supabaseAuthHTTPTimeout,
	})
	if err != nil {
		logger.Fatalf("configure Supabase auth verifier: %v", err)
	}
	if !ok {
		logger.Print("Supabase auth verifier is not configured; protected RPCs will reject bearer tokens")
		return nil
	}
	return []platform.HandlerOption{platform.WithAuthVerifier(verifier)}
}

// port reads PORT from the environment (runtime config, not a tuning constant),
// defaulting to 8080.
func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}
