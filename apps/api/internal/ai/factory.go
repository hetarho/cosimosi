package ai

import (
	"errors"
	"os"
	"strings"

	"github.com/cosimosi/api/internal/memory"
)

const EnvAPIKey = "COSIMOSI_AI_API_KEY"

var ErrRealClientsRequired = errors.New("ai api key is set but real provider clients are not configured")

type Adapters struct {
	Extractor    memory.Extractor
	Embedder     memory.Embedder
	Semanticizer memory.Semanticizer
	Mode         string
}

type FactoryOptions struct {
	APIKey          string
	LLMClient       LLMClient
	EmbeddingClient EmbeddingClient
	Meter           *Meter
}

func NewAdaptersFromEnv(opts FactoryOptions) (Adapters, error) {
	if opts.APIKey == "" {
		opts.APIKey = strings.TrimSpace(os.Getenv(EnvAPIKey))
	}
	return NewAdapters(opts)
}

func NewAdapters(opts FactoryOptions) (Adapters, error) {
	if strings.TrimSpace(opts.APIKey) == "" {
		return Adapters{
			Extractor:    NewMockExtractor(),
			Embedder:     NewMockEmbedder(),
			Semanticizer: NewMockSemanticizer(),
			Mode:         "mock",
		}, nil
	}
	if opts.LLMClient == nil || opts.EmbeddingClient == nil {
		return Adapters{}, ErrRealClientsRequired
	}
	meter := opts.Meter
	if meter == nil {
		meter = NewMeter()
	}
	extractor, err := NewRealExtractor(opts.LLMClient, meter)
	if err != nil {
		return Adapters{}, err
	}
	embedder, err := NewRealEmbedder(opts.EmbeddingClient, meter)
	if err != nil {
		return Adapters{}, err
	}
	semanticizer, err := NewRealSemanticizer(opts.LLMClient, meter)
	if err != nil {
		return Adapters{}, err
	}
	return Adapters{
		Extractor:    extractor,
		Embedder:     embedder,
		Semanticizer: semanticizer,
		Mode:         "real",
	}, nil
}
