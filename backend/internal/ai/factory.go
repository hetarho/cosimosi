package ai

import (
	"fmt"

	"github.com/cosimosi/backend/internal/platform/config"
)

// NewEmbedder selects the embedding adapter from config (AI_EMBEDDER): "mock"
// (keyless, deterministic — the default) or "openai" (requires OPENAI_API_KEY).
// Any embedder is swappable behind the port (constitution §7).
func NewEmbedder(cfg *config.Config) (Embedder, error) {
	switch cfg.AIEmbedder {
	case "", "mock":
		return NewMockEmbedder(config.EmbedDim), nil
	case "openai":
		if cfg.OpenAIAPIKey == "" {
			return nil, fmt.Errorf("AI_EMBEDDER=openai requires OPENAI_API_KEY")
		}
		return NewOpenAIEmbedder(cfg.OpenAIAPIKey, config.EmbedDim), nil
	default:
		return nil, fmt.Errorf("unknown AI_EMBEDDER %q (want mock|openai)", cfg.AIEmbedder)
	}
}
