package ai

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/cosimosi/api/internal/memory"
)

// Per-capability runtime selection env (A4/A8). Provider identity is an ops choice,
// not a tuning value — it never enters spec/values.yaml. The two capabilities are
// selected independently (e.g. Anthropic for LLM, Voyage for embeddings).
const (
	EnvLLMProvider = "COSIMOSI_LLM_PROVIDER"
	EnvLLMAPIKey   = "COSIMOSI_LLM_API_KEY"
	EnvLLMModel    = "COSIMOSI_LLM_MODEL"
	EnvLLMBaseURL  = "COSIMOSI_LLM_BASE_URL"

	EnvEmbeddingProvider = "COSIMOSI_EMBEDDING_PROVIDER"
	EnvEmbeddingAPIKey   = "COSIMOSI_EMBEDDING_API_KEY"
	EnvEmbeddingModel    = "COSIMOSI_EMBEDDING_MODEL"
	EnvEmbeddingBaseURL  = "COSIMOSI_EMBEDDING_BASE_URL"
)

var (
	// ErrUnknownProvider is returned at startup wiring for a provider name outside the
	// contract slots — never a silent default (A4).
	ErrUnknownProvider = errors.New("ai: unknown provider name")
	// ErrProviderNotImplemented is returned at startup for a recognized contract slot
	// that has no adapter yet (A3) — also fails fast, never a silent default.
	ErrProviderNotImplemented = errors.New("ai: provider recognized but not implemented")
)

// The contract slots name every provider the seam supports, even the ones without an
// adapter yet (A3). Adding a provider later is a new subpackage + a factory
// registration (via init), never a consumer change. Only implemented slots register.
var (
	llmProviderSlots       = []string{"anthropic", "openai", "deepseek", "glm", "gemini", "kimi"}
	embeddingProviderSlots = []string{"voyage", "openai", "gemini"}

	llmProviders       = map[string]func(ProviderConfig) (LLMClient, error){}
	embeddingProviders = map[string]func(ProviderConfig) (EmbeddingClient, error){}
)

// ProviderSlots is the union of every provider the seam supports across capabilities — the set the
// admin console offers per-provider API-key management for. Sorted, deduplicated.
func ProviderSlots() []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, list := range [][]string{llmProviderSlots, embeddingProviderSlots} {
		for _, p := range list {
			if _, ok := seen[p]; ok {
				continue
			}
			seen[p] = struct{}{}
			out = append(out, p)
		}
	}
	slices.Sort(out)
	return out
}

// SupportsLLM / SupportsEmbedding report whether a provider slot offers that capability (Anthropic
// has no embedding API, Voyage no LLM, …) — the admin console filters each capability's selectable
// providers by this.
func SupportsLLM(provider string) bool {
	return slices.Contains(llmProviderSlots, strings.ToLower(strings.TrimSpace(provider)))
}

func SupportsEmbedding(provider string) bool {
	return slices.Contains(embeddingProviderSlots, strings.ToLower(strings.TrimSpace(provider)))
}

// ImplementedLLM / ImplementedEmbedding report whether a concrete adapter is registered for the
// provider (vs a named-but-unbuilt slot). The console can offer a keyed slot but flag that
// selecting an unimplemented one will fail until its adapter ships.
func ImplementedLLM(provider string) bool {
	_, ok := llmProviders[strings.ToLower(strings.TrimSpace(provider))]
	return ok
}

func ImplementedEmbedding(provider string) bool {
	_, ok := embeddingProviders[strings.ToLower(strings.TrimSpace(provider))]
	return ok
}

// RegisterLLMProvider / RegisterEmbeddingProvider are the driver seam: a provider
// subpackage registers its constructor from init(), so this package never imports the
// vendor subpackages (that would be an import cycle). cmd/* blank-imports the
// subpackages it wants available.
func RegisterLLMProvider(name string, factory func(ProviderConfig) (LLMClient, error)) {
	llmProviders[strings.ToLower(name)] = factory
}

func RegisterEmbeddingProvider(name string, factory func(ProviderConfig) (EmbeddingClient, error)) {
	embeddingProviders[strings.ToLower(name)] = factory
}

// CapabilityConfig is one capability's runtime selection: which provider, its key,
// and optional model/base-URL overrides.
type CapabilityConfig struct {
	Provider string
	APIKey   string
	Model    string
	BaseURL  string
}

type Adapters struct {
	Extractor       memory.Extractor
	Embedder        memory.Embedder
	Semanticizer    memory.Semanticizer
	PredictionError memory.PredictionError
	SealSuggester   memory.SealSuggester
	Mode            string
}

type FactoryOptions struct {
	LLM       CapabilityConfig
	Embedding CapabilityConfig
	Meter     *Meter

	// Pre-built clients bypass registry selection — used by tests and by callers that
	// inject a client directly. When set, the matching CapabilityConfig key is ignored.
	LLMClient       LLMClient
	EmbeddingClient EmbeddingClient
}

func NewAdaptersFromEnv(opts FactoryOptions) (Adapters, error) {
	if opts.LLM == (CapabilityConfig{}) {
		opts.LLM = CapabilityConfig{
			Provider: strings.TrimSpace(os.Getenv(EnvLLMProvider)),
			APIKey:   strings.TrimSpace(os.Getenv(EnvLLMAPIKey)),
			Model:    strings.TrimSpace(os.Getenv(EnvLLMModel)),
			BaseURL:  strings.TrimSpace(os.Getenv(EnvLLMBaseURL)),
		}
	}
	if opts.Embedding == (CapabilityConfig{}) {
		opts.Embedding = CapabilityConfig{
			Provider: strings.TrimSpace(os.Getenv(EnvEmbeddingProvider)),
			APIKey:   strings.TrimSpace(os.Getenv(EnvEmbeddingAPIKey)),
			Model:    strings.TrimSpace(os.Getenv(EnvEmbeddingModel)),
			BaseURL:  strings.TrimSpace(os.Getenv(EnvEmbeddingBaseURL)),
		}
	}
	return NewAdapters(opts)
}

func NewAdapters(opts FactoryOptions) (Adapters, error) {
	meter := opts.Meter
	if meter == nil {
		meter = NewMeter()
	}

	// LLM capability drives both the Extractor and the Semanticizer; one metered
	// client is shared so the daily cap counts all LLM calls per user together.
	// An injected client is labeled "real" (its provider is not env-selected); a
	// registry-selected client is labeled by its provider name.
	llmClient := opts.LLMClient
	llmMode := "real"
	if llmClient == nil {
		if opts.LLM.APIKey != "" {
			client, err := newLLMClient(opts.LLM)
			if err != nil {
				return Adapters{}, err
			}
			llmClient = client
			llmMode = providerLabel(opts.LLM.Provider)
		} else if opts.LLM.Provider != "" {
			// A named provider with no key is a misconfiguration, not a request for the mock:
			// fail fast so a deploy can't silently serve mock extractions under a real provider.
			return Adapters{}, fmt.Errorf("ai: LLM provider %q configured without an API key (%s)", opts.LLM.Provider, EnvLLMAPIKey)
		}
	}

	embeddingClient := opts.EmbeddingClient
	embeddingMode := "real"
	if embeddingClient == nil {
		if opts.Embedding.APIKey != "" {
			client, err := newEmbeddingClient(opts.Embedding)
			if err != nil {
				return Adapters{}, err
			}
			embeddingClient = client
			embeddingMode = providerLabel(opts.Embedding.Provider)
		} else if opts.Embedding.Provider != "" {
			return Adapters{}, fmt.Errorf("ai: embedding provider %q configured without an API key (%s)", opts.Embedding.Provider, EnvEmbeddingAPIKey)
		}
	}

	var (
		extractor       memory.Extractor
		semanticizer    memory.Semanticizer
		predictionError memory.PredictionError
		sealSuggester   memory.SealSuggester
		embedder        memory.Embedder
	)

	if llmClient != nil {
		metered := newMeteredLLMClient(llmClient, meter)
		realExtractor, err := NewRealExtractor(metered)
		if err != nil {
			return Adapters{}, err
		}
		realSemanticizer, err := NewRealSemanticizer(metered)
		if err != nil {
			return Adapters{}, err
		}
		realPredictionError, err := NewRealPredictionError(metered)
		if err != nil {
			return Adapters{}, err
		}
		realSealSuggester, err := NewRealSealSuggester(metered)
		if err != nil {
			return Adapters{}, err
		}
		extractor = realExtractor
		semanticizer = realSemanticizer
		predictionError = realPredictionError
		sealSuggester = realSealSuggester
	} else {
		extractor = NewMockExtractor()
		semanticizer = NewMockSemanticizer()
		predictionError = NewMockPredictionError()
		sealSuggester = NewMockSealSuggester()
		llmMode = "mock"
	}

	if embeddingClient != nil {
		metered := newMeteredEmbeddingClient(embeddingClient, meter)
		realEmbedder, err := NewRealEmbedder(metered)
		if err != nil {
			return Adapters{}, err
		}
		embedder = realEmbedder
	} else {
		embedder = NewMockEmbedder()
		embeddingMode = "mock"
	}

	return Adapters{
		Extractor:       extractor,
		Embedder:        embedder,
		Semanticizer:    semanticizer,
		PredictionError: predictionError,
		SealSuggester:   sealSuggester,
		Mode:            fmt.Sprintf("llm=%s embedding=%s", llmMode, embeddingMode),
	}, nil
}

func newLLMClient(cfg CapabilityConfig) (LLMClient, error) {
	name := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if factory, ok := llmProviders[name]; ok {
		return factory(providerConfig(cfg))
	}
	if slices.Contains(llmProviderSlots, name) {
		return nil, fmt.Errorf("%w: llm provider %q", ErrProviderNotImplemented, cfg.Provider)
	}
	return nil, fmt.Errorf("%w: llm provider %q", ErrUnknownProvider, cfg.Provider)
}

func newEmbeddingClient(cfg CapabilityConfig) (EmbeddingClient, error) {
	name := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if factory, ok := embeddingProviders[name]; ok {
		return factory(providerConfig(cfg))
	}
	if slices.Contains(embeddingProviderSlots, name) {
		return nil, fmt.Errorf("%w: embedding provider %q", ErrProviderNotImplemented, cfg.Provider)
	}
	return nil, fmt.Errorf("%w: embedding provider %q", ErrUnknownProvider, cfg.Provider)
}

func providerConfig(cfg CapabilityConfig) ProviderConfig {
	return ProviderConfig{APIKey: cfg.APIKey, Model: cfg.Model, BaseURL: cfg.BaseURL}
}

// ValidateLLMProvider / ValidateEmbeddingProvider report whether a provider slot is known and
// implemented — the same registry semantics NewAdapters uses — WITHOUT building a client. The
// admin console (the admin console) calls them before persisting a SetAIConfig, so an unknown or
// recognized-but-unimplemented provider is refused at write time, never silently stored to fail at
// the next AI call. The embedding dimension itself is still enforced when the client is built /
// first used (the AI-provider abstraction, A7); model is accepted here for that future static check.
func ValidateLLMProvider(provider string, _ string) error {
	name := strings.ToLower(strings.TrimSpace(provider))
	if _, ok := llmProviders[name]; ok {
		return nil
	}
	if slices.Contains(llmProviderSlots, name) {
		return fmt.Errorf("%w: llm provider %q", ErrProviderNotImplemented, provider)
	}
	return fmt.Errorf("%w: llm provider %q", ErrUnknownProvider, provider)
}

func ValidateEmbeddingProvider(provider string, _ string) error {
	name := strings.ToLower(strings.TrimSpace(provider))
	if _, ok := embeddingProviders[name]; ok {
		return nil
	}
	if slices.Contains(embeddingProviderSlots, name) {
		return fmt.Errorf("%w: embedding provider %q", ErrProviderNotImplemented, provider)
	}
	return fmt.Errorf("%w: embedding provider %q", ErrUnknownProvider, provider)
}

// ProviderValidator adapts the package validators to the admin console's consumer-owned
// AIProviderValidator port (satisfied structurally at the composition root).
type ProviderValidator struct{}

func (ProviderValidator) ValidateLLM(provider string, model string) error {
	return ValidateLLMProvider(provider, model)
}

func (ProviderValidator) ValidateEmbedding(provider string, model string) error {
	return ValidateEmbeddingProvider(provider, model)
}

func providerLabel(provider string) string {
	if p := strings.ToLower(strings.TrimSpace(provider)); p != "" {
		return p
	}
	return "real"
}
