package llm

import (
	"fmt"
	"net/http"
	"sort"
)

// adapter family — which Complete implementation a provider uses. Most
// providers are OpenAI-compatible; Anthropic and Gemini have their own shapes.
type family int

const (
	familyOpenAICompat family = iota
	familyAnthropic
	familyGemini
)

// ProviderSpec is one row of the provider matrix: everything needed to build a
// client for (and describe) a provider. The matrix is the single source of
// truth shared by factory.New (env path), the Resolver (DB path), and the admin
// console's TestProviderKey (ephemeral-key path) — and its key set is the value
// domain AdminService accepts for "provider".
type ProviderSpec struct {
	Name         string
	DefaultModel string
	// KeyEnv names the env var holding this provider's API key (factory
	// fail-fast messages + admin console docs).
	KeyEnv string
	// Endpoint is the chat-completions URL for OpenAI-compatible providers;
	// Anthropic/Gemini adapters own their URLs internally.
	Endpoint string
	// JSONSchema: the provider enforces response_format json_schema (strict);
	// false degrades to json_object + schema-in-prompt (openai_compat.go).
	JSONSchema bool
	// MaxTokensField is the request field naming the completion cap
	// (OpenAI-compatible providers only).
	MaxTokensField string

	family family
}

// DefaultProvider is the provider used when LLM_PROVIDER is unset — shared by
// factory.New, the Resolver's env fallback, and the admin console's active
// display so the rule has exactly one home.
const DefaultProvider = "openai"

// Per-provider default models, verified against official docs 2026-06
// (spec 20 공급자 매트릭스). LLM_MODEL / admin console selection override them.
const (
	defaultOpenAIModel    = "gpt-5.4-mini"
	defaultGeminiModel    = "gemini-3.5-flash"
	defaultAnthropicModel = "claude-opus-4-8"
	defaultDeepSeekModel  = "deepseek-v4-flash"
	defaultGrokModel      = "grok-4.3"
)

// providers is the matrix (spec 20 §공급자 매트릭스, datafied in 34).
var providers = map[string]ProviderSpec{
	"openai": {
		Name: "openai", DefaultModel: defaultOpenAIModel, KeyEnv: "OPENAI_API_KEY",
		Endpoint:   "https://api.openai.com/v1/chat/completions",
		JSONSchema: true, MaxTokensField: "max_completion_tokens",
		family: familyOpenAICompat,
	},
	"gemini": {
		Name: "gemini", DefaultModel: defaultGeminiModel, KeyEnv: "GEMINI_API_KEY",
		family: familyGemini,
	},
	"claude": {
		Name: "claude", DefaultModel: defaultAnthropicModel, KeyEnv: "ANTHROPIC_API_KEY",
		family: familyAnthropic,
	},
	"deepseek": {
		Name: "deepseek", DefaultModel: defaultDeepSeekModel, KeyEnv: "DEEPSEEK_API_KEY",
		Endpoint:   "https://api.deepseek.com/chat/completions",
		JSONSchema: false, MaxTokensField: "max_tokens",
		family: familyOpenAICompat,
	},
	"grok": {
		Name: "grok", DefaultModel: defaultGrokModel, KeyEnv: "XAI_API_KEY",
		Endpoint:   "https://api.x.ai/v1/chat/completions",
		JSONSchema: true, MaxTokensField: "max_tokens",
		family: familyOpenAICompat,
	},
}

// Provider looks up one matrix row. ok=false → unknown provider (the caller's
// InvalidArgument / unknown-LLM_PROVIDER error).
func Provider(name string) (ProviderSpec, bool) {
	spec, ok := providers[name]
	return spec, ok
}

// ProviderNames returns the matrix keys in stable (sorted) order — the admin
// console's always-rendered provider set.
func ProviderNames() []string {
	names := make([]string, 0, len(providers))
	for name := range providers {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// NewForProvider builds the adapter for one (provider, model, apiKey) triple —
// the shared constructor behind factory.New, the Resolver, and TestProviderKey.
// model "" = the provider's default; apiKey must be non-empty (callers own the
// "which env var / DB row is missing" message).
func NewForProvider(provider, model, apiKey string, hc *http.Client) (Client, error) {
	spec, ok := providers[provider]
	if !ok {
		return nil, fmt.Errorf("unknown LLM provider %q (want one of %v)", provider, ProviderNames())
	}
	if apiKey == "" {
		return nil, fmt.Errorf("provider %q requires an API key", provider)
	}
	model = orDefault(model, spec.DefaultModel)
	switch spec.family {
	case familyAnthropic:
		return newAnthropic(apiKey, model, hc), nil
	case familyGemini:
		return newGemini(apiKey, model, hc), nil
	default:
		return newOpenAICompat(spec.Name, spec.Endpoint, apiKey, model, spec.JSONSchema, spec.MaxTokensField, hc), nil
	}
}
