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
	llmProviderSlots       = []string{"anthropic", "openai", "deepseek", "zai", "gemini"}
	embeddingProviderSlots = []string{"voyage", "openai", "gemini"}

	llmProviders       = map[string]func(ProviderConfig) (LLMClient, error){}
	embeddingProviders = map[string]func(ProviderConfig) (EmbeddingClient, error){}
)

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
	Extractor    memory.Extractor
	Embedder     memory.Embedder
	Semanticizer memory.Semanticizer
	Mode         string
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
	if llmClient == nil && opts.LLM.APIKey != "" {
		client, err := newLLMClient(opts.LLM)
		if err != nil {
			return Adapters{}, err
		}
		llmClient = client
		llmMode = providerLabel(opts.LLM.Provider)
	}

	embeddingClient := opts.EmbeddingClient
	embeddingMode := "real"
	if embeddingClient == nil && opts.Embedding.APIKey != "" {
		client, err := newEmbeddingClient(opts.Embedding)
		if err != nil {
			return Adapters{}, err
		}
		embeddingClient = client
		embeddingMode = providerLabel(opts.Embedding.Provider)
	}

	var (
		extractor    memory.Extractor
		semanticizer memory.Semanticizer
		embedder     memory.Embedder
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
		extractor = realExtractor
		semanticizer = realSemanticizer
	} else {
		extractor = NewMockExtractor()
		semanticizer = NewMockSemanticizer()
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
		Extractor:    extractor,
		Embedder:     embedder,
		Semanticizer: semanticizer,
		Mode:         fmt.Sprintf("llm=%s embedding=%s", llmMode, embeddingMode),
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

func providerLabel(provider string) string {
	if p := strings.ToLower(strings.TrimSpace(provider)); p != "" {
		return p
	}
	return "real"
}
