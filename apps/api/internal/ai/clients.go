package ai

import "context"

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
}

type EmbeddingResponse struct {
	Vectors [][]float32
}
