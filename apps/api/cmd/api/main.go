// Command api is the cosimosi backend entrypoint.
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

const supabaseAuthHTTPTimeout = 3 * time.Second

func main() {
	logger := log.Default()
	handlerOptions := authHandlerOptions(logger)
	server := platform.NewHTTPServer(":"+port(), logger, handlerOptions...)
	logger.Printf("api listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

func authHandlerOptions(logger *log.Logger) []platform.HandlerOption {
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
