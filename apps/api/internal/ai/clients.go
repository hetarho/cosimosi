package ai

import (
	"context"
	"net/http"
)

// ProviderConfig is the vendor-neutral construction input the factory hands to a
// provider client's constructor. API keys and model ids are runtime identity; the
// HTTP client is deployment policy injected by cmd/*. Endpoints remain adapter-owned.
type ProviderConfig struct {
	APIKey     string
	Model      string // optional override; empty selects the provider's recorded default
	HTTPClient *http.Client
}

type JSONSchema map[string]any

type LLMClient interface {
	CompleteJSON(ctx context.Context, req LLMRequest) (LLMResponse, error)
}

type LLMRequest struct {
	UserID          string
	Prompt          string
	MaxOutputTokens int
	OutputSchema    JSONSchema
	CacheKey        string
	// Validate, if set, is run by the metering seam against a fresh provider response
	// before it is cached. It lets the port adapter (which owns parsing) reject a
	// schema-conforming-but-unusable response so a transient bad sample does not
	// poison the identical-input cache for later retries. It stays provider-neutral:
	// the seam only invokes it, it does not parse.
	Validate func([]byte) error
	// Cacheable, if set, decides whether a fresh response may be stored — and is the reason
	// Validate is not enough on its own. Validate REJECTS: the caller gets an error and no
	// response. This one lets the response through while keeping it out of the cache, which is
	// what a repair loop needs: it re-prompts FROM the unusable sample, so it must receive it,
	// while an identical retry later must re-draw rather than replay a sample already known not
	// to satisfy the consumer. Cache hits never reach it (they were judged when first stored).
	Cacheable func([]byte) bool
}

type LLMResponse struct {
	JSON []byte
}

type EmbeddingClient interface {
	Embed(ctx context.Context, req EmbeddingRequest) (EmbeddingResponse, error)
}

type EmbeddingRequest struct {
	UserID   string
	Texts    []string
	Dim      int
	CacheKey string
	// Validate mirrors LLMRequest.Validate — the seam runs it before caching so a
	// response the embedder would reject (wrong count or dimension) is never cached.
	Validate func([][]float32) error
}

type EmbeddingResponse struct {
	Vectors [][]float32
}
