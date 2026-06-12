package llm

import (
	"fmt"
	"net/http"
	"time"

	"github.com/cosimosi/backend/internal/platform/config"
)

// llmTimeout bounds one completion call. LLM extraction is slower than
// embeddings (reasoning-capable models), so this is deliberately generous;
// the worker's job timeout/backoff is the outer guard.
const llmTimeout = 120 * time.Second

// New selects the provider adapter from config (LLM_PROVIDER + LLM_MODEL +
// the provider's API key) via the provider matrix (providers.go), mirroring
// ai.NewEmbedder: missing key → fail fast naming the env var, unknown provider
// → explicit error. Swapping providers is env-only (constitution §7); the
// admin-console DB path layers on top via the Resolver (resolver.go).
func New(cfg *config.Config) (Client, error) {
	provider := orDefault(cfg.LLMProvider, DefaultProvider)
	spec, ok := Provider(provider)
	if !ok {
		return nil, fmt.Errorf("unknown LLM_PROVIDER %q (want openai|gemini|claude|deepseek|grok)", cfg.LLMProvider)
	}
	key := keyFromConfig(cfg, provider)
	if key == "" {
		return nil, fmt.Errorf("LLM_PROVIDER=%s requires %s", provider, spec.KeyEnv)
	}
	return NewForProvider(provider, cfg.LLMModel, key, &http.Client{Timeout: llmTimeout})
}

// keyFromConfig maps a matrix provider to its config key field (the env vars
// named by ProviderSpec.KeyEnv, already loaded by config.Load).
func keyFromConfig(cfg *config.Config, provider string) string {
	switch provider {
	case "openai":
		return cfg.OpenAIAPIKey
	case "gemini":
		return cfg.GeminiAPIKey
	case "claude":
		return cfg.AnthropicAPIKey
	case "deepseek":
		return cfg.DeepSeekAPIKey
	case "grok":
		return cfg.XAIAPIKey
	default:
		return ""
	}
}

func orDefault(v, fallback string) string {
	if v != "" {
		return v
	}
	return fallback
}
