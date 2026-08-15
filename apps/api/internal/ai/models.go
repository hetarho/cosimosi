package ai

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
)

// The model-listing seam reports which model ids a provider currently serves per capability,
// in vendor-neutral shape. It mirrors the client registries — a provider subpackage registers its
// lister from init(), so this package never imports the vendor subpackages. The listing is
// advisory input help for the admin console; nothing here validates or persists a selection.

// ModelInfo is one model id a provider currently serves. DisplayName is optional vendor sugar;
// ID is what a capability selection's model field takes.
type ModelInfo struct {
	ID          string
	DisplayName string
}

// ModelLister fetches the models a provider currently serves for one capability. Live vendors
// query their listing endpoint with cfg.APIKey; a vendor with no listing endpoint answers from
// its adapter-owned curated set.
type ModelLister func(ctx context.Context, cfg ProviderConfig) ([]ModelInfo, error)

var (
	llmModelListers       = map[string]ModelLister{}
	embeddingModelListers = map[string]ModelLister{}
)

// RegisterLLMModelLister / RegisterEmbeddingModelLister are the driver seam, exactly like
// RegisterLLMProvider: called from a provider subpackage's init().
func RegisterLLMModelLister(name string, lister ModelLister) {
	llmModelListers[strings.ToLower(name)] = lister
}

func RegisterEmbeddingModelLister(name string, lister ModelLister) {
	embeddingModelListers[strings.ToLower(name)] = lister
}

// ListLLMModels / ListEmbeddingModels resolve a provider's lister with the same
// unknown / recognized-but-unimplemented semantics as the client factories.
func ListLLMModels(ctx context.Context, cfg CapabilityConfig, clients ...*http.Client) ([]ModelInfo, error) {
	name := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if lister, ok := llmModelListers[name]; ok {
		return lister(ctx, providerConfig(cfg, firstHTTPClient(clients)))
	}
	if slices.Contains(llmProviderSlots, name) {
		return nil, fmt.Errorf("%w: llm provider %q", ErrProviderNotImplemented, cfg.Provider)
	}
	return nil, fmt.Errorf("%w: llm provider %q", ErrUnknownProvider, cfg.Provider)
}

func ListEmbeddingModels(ctx context.Context, cfg CapabilityConfig, clients ...*http.Client) ([]ModelInfo, error) {
	name := strings.ToLower(strings.TrimSpace(cfg.Provider))
	if lister, ok := embeddingModelListers[name]; ok {
		return lister(ctx, providerConfig(cfg, firstHTTPClient(clients)))
	}
	if slices.Contains(embeddingProviderSlots, name) {
		return nil, fmt.Errorf("%w: embedding provider %q", ErrProviderNotImplemented, cfg.Provider)
	}
	return nil, fmt.Errorf("%w: embedding provider %q", ErrUnknownProvider, cfg.Provider)
}

func firstHTTPClient(clients []*http.Client) *http.Client {
	if len(clients) == 0 {
		return nil
	}
	return clients[0]
}
