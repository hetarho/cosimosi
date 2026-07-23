package ai

import "context"

// ProviderConfig is the vendor-neutral construction input the factory hands to a
// provider client's constructor. It carries only runtime identity/config — never a
// spec/values.yaml key (A8): API keys and model ids are env/secrets. The endpoint is
// NOT config — each adapter owns its own endpoint (change 03).
type ProviderConfig struct {
	APIKey string
	Model  string // optional override; empty selects the provider's recorded default
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
