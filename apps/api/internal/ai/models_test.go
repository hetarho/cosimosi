package ai

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

// The model-listing registries carry the factory's slot semantics: a name outside the contract
// slots is unknown, a recognized slot without a registered lister is unimplemented, and a
// registered lister is dispatched with the vendor-neutral config. (No provider subpackage is
// imported in package-ai tests, so the registries start empty here.)
func TestModelListerRegistryMirrorsFactorySlotSemantics(t *testing.T) {
	ctx := context.Background()

	if _, err := ListLLMModels(ctx, CapabilityConfig{Provider: "nope"}); !errors.Is(err, ErrUnknownProvider) {
		t.Fatalf("unknown llm provider err = %v, want ErrUnknownProvider", err)
	}
	if _, err := ListLLMModels(ctx, CapabilityConfig{Provider: "kimi"}); !errors.Is(err, ErrProviderNotImplemented) {
		t.Fatalf("unimplemented llm slot err = %v, want ErrProviderNotImplemented", err)
	}
	if _, err := ListEmbeddingModels(ctx, CapabilityConfig{Provider: "gemini"}); !errors.Is(err, ErrProviderNotImplemented) {
		t.Fatalf("unimplemented embedding slot err = %v, want ErrProviderNotImplemented", err)
	}

	var got ProviderConfig
	RegisterLLMModelLister("GLM", func(_ context.Context, cfg ProviderConfig) ([]ModelInfo, error) {
		got = cfg
		return []ModelInfo{{ID: "glm-x"}}, nil
	})
	httpClient := &http.Client{}
	models, err := ListLLMModels(
		ctx,
		CapabilityConfig{Provider: " glm ", APIKey: "k", Model: "ignored-by-listing"},
		httpClient,
	)
	if err != nil {
		t.Fatalf("registered lister dispatch: %v", err)
	}
	if len(models) != 1 || models[0].ID != "glm-x" {
		t.Fatalf("models = %+v, want the lister's list", models)
	}
	if got.APIKey != "k" {
		t.Fatalf("lister config = %+v, want the API key passed through", got)
	}
	if got.HTTPClient != httpClient {
		t.Fatal("lister did not receive the composition-root HTTP client")
	}
}
