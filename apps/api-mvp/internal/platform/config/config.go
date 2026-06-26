// Package config loads runtime configuration from environment variables.
//
// Lives under internal/platform because it is cross-cutting infrastructure,
// not part of any feature's domain.
package config

import (
	"fmt"
	"os"
	"strings"

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
	// There is deliberately NO extractor env knob (spec 34): extraction follows
	// the admin console — real while an LLM selection is ACTIVE, keyless mock
	// otherwise. Turning AI on/off is a console action, not an env change.
	//
	// LLMProvider selects the LLM provider behind the llm.Client port (spec 20):
	// openai | gemini | claude | deepseek | grok. Only consulted by the llm
	// resolver's env fallback when the console has nothing configured.
	LLMProvider string
	// LLMModel overrides the selected provider's default model. Empty = use the
	// provider default (see internal/llm).
	LLMModel string
	// OpenAIAPIKey authenticates the OpenAI adapters (embedder + llm provider
	// share it). The factories fail fast when an OpenAI adapter is selected
	// without it.
	OpenAIAPIKey string
	// Per-provider LLM API keys (spec 20). Only the selected LLM_PROVIDER's key
	// is required; llm.New fails fast naming the missing env var.
	GeminiAPIKey    string
	AnthropicAPIKey string
	DeepSeekAPIKey  string
	XAIAPIKey       string
	// SentryDSN enables production error tracking. Empty = disabled:
	// the composition root skips sentry.Init entirely (no-op locally / in tests).
	SentryDSN string
	// SentryEnvironment tags captured events (production|staging|…); defaults to
	// "development" when unset.
	SentryEnvironment string
	// AdminUserIDs is the AdminService allowlist (spec 34): comma-separated
	// Supabase user UUIDs and/or account emails, matched (case-insensitively)
	// against the JWT sub/email claims. Empty = every caller is rejected
	// (fail-closed) — the admin console is opt-in per environment.
	AdminUserIDs []string
	// LLMKeyEncryptionKey is the base64-encoded 32-byte master key for the
	// AES-256-GCM envelope around stored LLM provider API keys (spec 34).
	// Lives ONLY in the server env — a DB dump alone cannot decrypt the keys.
	// Empty = key writes are rejected with FailedPrecondition.
	LLMKeyEncryptionKey string
	// InviteGateEnabled toggles the closed-beta invite membership gate (spec 41).
	// true (default): the membership interceptor guards the core universe services and
	// non-members are routed to /invite to redeem a code. false: the gate is transparent
	// (every authenticated user is a member) — the removable beta gate is switched off
	// without deleting its code/tables.
	InviteGateEnabled bool
}

func Load() (*Config, error) {
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := &Config{
		Port:                getEnv("PORT", "8080"),
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		CORSOrigin:          getEnv("CORS_ORIGIN", "http://localhost:1214"),
		SupabaseJWTSecret:   getEnv("SUPABASE_JWT_SECRET", ""),
		SupabaseProjectURL:  getEnv("SUPABASE_PROJECT_URL", ""),
		AIEmbedder:          getEnv("AI_EMBEDDER", "mock"),
		LLMProvider:         getEnv("LLM_PROVIDER", "openai"),
		LLMModel:            getEnv("LLM_MODEL", ""),
		OpenAIAPIKey:        getEnv("OPENAI_API_KEY", ""),
		GeminiAPIKey:        getEnv("GEMINI_API_KEY", ""),
		AnthropicAPIKey:     getEnv("ANTHROPIC_API_KEY", ""),
		DeepSeekAPIKey:      getEnv("DEEPSEEK_API_KEY", ""),
		XAIAPIKey:           getEnv("XAI_API_KEY", ""),
		SentryDSN:           getEnv("SENTRY_DSN", ""),
		SentryEnvironment:   getEnv("SENTRY_ENVIRONMENT", "development"),
		AdminUserIDs:        splitCSV(getEnv("ADMIN_USER_IDS", "")),
		LLMKeyEncryptionKey: getEnv("LLM_KEY_ENCRYPTION_KEY", ""),
		InviteGateEnabled:   getEnvBool("INVITE_GATE_ENABLED", true),
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

// getEnvBool parses a boolean env var (1/true/yes/on vs 0/false/no/off, case-insensitive);
// an unset or unrecognized value yields the fallback.
func getEnvBool(key string, fallback bool) bool {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "1", "true", "yes", "on":
			return true
		case "0", "false", "no", "off":
			return false
		}
	}
	return fallback
}

// splitCSV splits a comma-separated env value into trimmed non-empty entries.
func splitCSV(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
