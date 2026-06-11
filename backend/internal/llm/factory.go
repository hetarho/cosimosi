package llm

import (
	"fmt"
	"net/http"
	"time"

	"github.com/cosimosi/backend/internal/platform/config"
)

// Per-provider default models, verified against official docs 2026-06
// (spec 20 공급자 매트릭스). LLM_MODEL overrides any of them.
const (
	defaultOpenAIModel    = "gpt-5.4-mini"
	defaultGeminiModel    = "gemini-3.5-flash"
	defaultAnthropicModel = "claude-opus-4-8"
	defaultDeepSeekModel  = "deepseek-v4-flash"
	defaultGrokModel      = "grok-4.3"
)

// llmTimeout bounds one completion call. LLM extraction is slower than
// embeddings (reasoning-capable models), so this is deliberately generous;
// the worker's job timeout/backoff is the outer guard.
const llmTimeout = 120 * time.Second

// New selects the provider adapter from config (LLM_PROVIDER + LLM_MODEL +
// the provider's API key), mirroring ai.NewEmbedder: missing key → fail fast
// naming the env var, unknown provider → explicit error. Swapping providers is
// env-only (constitution §7).
func New(cfg *config.Config) (Client, error) {
	httpClient := &http.Client{Timeout: llmTimeout}
	model := cfg.LLMModel
	switch cfg.LLMProvider {
	case "", "openai":
		if cfg.OpenAIAPIKey == "" {
			return nil, fmt.Errorf("LLM_PROVIDER=openai requires OPENAI_API_KEY")
		}
		return newOpenAICompat("openai", "https://api.openai.com/v1/chat/completions",
			cfg.OpenAIAPIKey, orDefault(model, defaultOpenAIModel), true, "max_completion_tokens", httpClient), nil
	case "deepseek":
		if cfg.DeepSeekAPIKey == "" {
			return nil, fmt.Errorf("LLM_PROVIDER=deepseek requires DEEPSEEK_API_KEY")
		}
		return newOpenAICompat("deepseek", "https://api.deepseek.com/chat/completions",
			cfg.DeepSeekAPIKey, orDefault(model, defaultDeepSeekModel), false, "max_tokens", httpClient), nil
	case "grok":
		if cfg.XAIAPIKey == "" {
			return nil, fmt.Errorf("LLM_PROVIDER=grok requires XAI_API_KEY")
		}
		return newOpenAICompat("grok", "https://api.x.ai/v1/chat/completions",
			cfg.XAIAPIKey, orDefault(model, defaultGrokModel), true, "max_tokens", httpClient), nil
	case "claude":
		if cfg.AnthropicAPIKey == "" {
			return nil, fmt.Errorf("LLM_PROVIDER=claude requires ANTHROPIC_API_KEY")
		}
		return newAnthropic(cfg.AnthropicAPIKey, orDefault(model, defaultAnthropicModel), httpClient), nil
	case "gemini":
		if cfg.GeminiAPIKey == "" {
			return nil, fmt.Errorf("LLM_PROVIDER=gemini requires GEMINI_API_KEY")
		}
		return newGemini(cfg.GeminiAPIKey, orDefault(model, defaultGeminiModel), httpClient), nil
	default:
		return nil, fmt.Errorf("unknown LLM_PROVIDER %q (want openai|gemini|claude|deepseek|grok)", cfg.LLMProvider)
	}
}

func orDefault(v, fallback string) string {
	if v != "" {
		return v
	}
	return fallback
}
