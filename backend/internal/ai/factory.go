package ai

import (
	"fmt"

	"github.com/cosimosi/backend/internal/llm"
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

// NewExtractor wires the admin-controlled extractor (spec 34): extraction is
// real while the admin console has an ACTIVE LLM selection and degrades to the
// keyless mock otherwise — turning AI on/off is a console action, never an env
// change (there is deliberately no env knob for it).
//
// client is the optional injected llm.Client — the composition root passes the
// admin-backed llm.NewResolver so the active provider/model/key swap at runtime
// without a restart; nil builds one over src. src=nil (standalone tooling
// without admin wiring, tests) pins the keyless mock.
func NewExtractor(cfg *config.Config, client llm.Client, src llm.ConfigSource) Extractor {
	if src == nil {
		return NewMockExtractor()
	}
	if client == nil {
		client = llm.NewResolver(src, cfg, nil)
	}
	return NewSwitchingExtractor(src, NewLLMExtractor(client), NewMockExtractor())
}
