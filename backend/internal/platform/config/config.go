// Package config loads runtime configuration from environment variables.
//
// Lives under internal/platform because it is cross-cutting infrastructure,
// not part of any feature's domain.
package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// EmbedDim is the fixed embedding dimension. text-embedding-3-small and the mock
// embedder both emit 1536-d vectors; the embeddings.vector(1536) column and HNSW
// index assume it. Changing it requires re-embedding + index rebuild, so it is a
// compile-time constant rather than an env var.
const EmbedDim = 1536

type Config struct {
	Port        string
	DatabaseURL string
	CORSOrigin  string
	// SupabaseJWTSecret is the project's shared HS256 secret used to verify
	// access tokens (the rpcserver auth interceptor). Empty in environments
	// without auth configured — protected RPCs then fail closed (Unauthenticated).
	SupabaseJWTSecret string
	// SupabaseProjectURL is the project base URL (e.g. https://<ref>.supabase.co),
	// used to fetch the JWKS for verifying asymmetric (ES256/RS256) tokens.
	SupabaseProjectURL string
	// AIEmbedder selects the embedding adapter (constitution §7): "mock" (keyless,
	// deterministic — the default, used for keyless E2E) or "openai".
	AIEmbedder string
	// OpenAIAPIKey authenticates the OpenAI embedder. Empty unless AIEmbedder is
	// "openai"; the factory fails fast if "openai" is selected without it.
	OpenAIAPIKey string
	// SentryDSN enables production error tracking. Empty = disabled:
	// the composition root skips sentry.Init entirely (no-op locally / in tests).
	SentryDSN string
	// SentryEnvironment tags captured events (production|staging|…); defaults to
	// "development" when unset.
	SentryEnvironment string
}

func Load() (*Config, error) {
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		CORSOrigin:         getEnv("CORS_ORIGIN", "http://localhost:1214"),
		SupabaseJWTSecret:  getEnv("SUPABASE_JWT_SECRET", ""),
		SupabaseProjectURL: getEnv("SUPABASE_PROJECT_URL", ""),
		AIEmbedder:         getEnv("AI_EMBEDDER", "mock"),
		OpenAIAPIKey:       getEnv("OPENAI_API_KEY", ""),
		SentryDSN:          getEnv("SENTRY_DSN", ""),
		SentryEnvironment:  getEnv("SENTRY_ENVIRONMENT", "development"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
