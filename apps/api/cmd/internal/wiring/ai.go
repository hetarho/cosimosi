package wiring

import (
	"log"
	"net/http"
	"time"

	"github.com/cosimosi/api/internal/ai"

	// Blank imports register the available provider adapters into internal/ai's factory. Provider +
	// key are read per capability (COSIMOSI_LLM_* / COSIMOSI_EMBEDDING_*); a missing key selects the
	// keyless mock, an unknown provider name is a startup error. Adding a provider = a new subpackage +
	// one blank import here, no consumer change.
	_ "github.com/cosimosi/api/internal/ai/anthropic"
	_ "github.com/cosimosi/api/internal/ai/deepseek"
	_ "github.com/cosimosi/api/internal/ai/voyage"
)

const (
	// Network budgets are deployment policy, not product tuning.
	deepSeekHTTPTimeout = 60 * time.Second
	voyageHTTPTimeout   = 30 * time.Second
)

// AIHTTPClients are the per-provider network budgets every process calls providers with.
func AIHTTPClients() ai.HTTPClients {
	return ai.HTTPClients{
		LLMByProvider: map[string]*http.Client{
			"deepseek": {Timeout: deepSeekHTTPTimeout},
		},
		EmbeddingByProvider: map[string]*http.Client{
			"voyage": {Timeout: voyageHTTPTimeout},
		},
	}
}

// AIAdapters resolve the effective provider config on each call — the admin console's stored
// selection, then env, then the keyless mock — so a SetAIConfig reaches every process without a
// redeploy. The meter counts the calling process's own provider calls.
func AIAdapters(configs ai.ConfigReader, decrypter ai.KeyDecrypter, meter *ai.Meter, logger *log.Logger) ai.Adapters {
	return ai.NewResolvingAdapters(ai.NewRuntimeConfigSource(configs, decrypter), meter, logger, AIHTTPClients())
}
