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

// NewExtractor selects the extraction adapter from config (AI_EXTRACTOR):
// unset/"auto" (admin-controlled switch — the default), "mock" (force keyless),
// or "llm" (force real). Mirrors NewEmbedder (constitution §7).
//
// client is the optional injected llm.Client — the composition root passes the
// admin-backed llm.NewResolver (spec 34) so the active provider/model/key swap
// at runtime without a restart; nil preserves the spec-20 env-only path
// (llm.New). src is the admin ConfigSource the default "auto" mode follows:
// with an ACTIVE console selection extraction is real, without one it degrades
// to the keyless mock — turning AI on/off is a console action, not an env
// change. src=nil (standalone worker without admin wiring, tests) keeps "auto"
// at the keyless mock, exactly the old default.
func NewExtractor(cfg *config.Config, client llm.Client, src llm.ConfigSource) (Extractor, error) {
	switch cfg.AIExtractor {
	case "", "auto":
		if src == nil {
			return NewMockExtractor(), nil
		}
		if client == nil {
			client = llm.NewResolver(src, cfg, nil)
		}
		return NewSwitchingExtractor(src, NewLLMExtractor(client), NewMockExtractor()), nil
	case "mock":
		return NewMockExtractor(), nil
	case "llm":
		if client == nil {
			c, err := llm.New(cfg)
			if err != nil {
				return nil, fmt.Errorf("AI_EXTRACTOR=llm: %w", err)
			}
			client = c
		}
		return NewLLMExtractor(client), nil
	default:
		return nil, fmt.Errorf("unknown AI_EXTRACTOR %q (want auto|mock|llm)", cfg.AIExtractor)
	}
}
