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

type Config struct {
	Port        string
	DatabaseURL string
	CORSOrigin  string
	// SupabaseJWTSecret is the project's shared HS256 secret used to verify
	// access tokens (the rpcserver auth interceptor). Empty in environments
	// without auth configured — protected RPCs then fail closed (Unauthenticated).
	SupabaseJWTSecret string
	// SupabaseProjectURL is the project base URL (e.g. https://<ref>.supabase.co).
	// Unused in the MVP HS256 path; reserved for JWKS verification of asymmetric
	// signing keys in v1.
	SupabaseProjectURL string
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
