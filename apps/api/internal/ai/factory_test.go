package ai

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
)

func TestFactorySelectsProvidersIndependentlyPerCapability(t *testing.T) {
	llmStub := &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}]}`)}
	embStub := &fakeEmbeddingClient{}
	RegisterLLMProvider("teststub", func(ProviderConfig) (LLMClient, error) { return llmStub, nil })
	RegisterEmbeddingProvider("teststub", func(ProviderConfig) (EmbeddingClient, error) { return embStub, nil })

	t.Run("both keys absent select the mock per capability", func(t *testing.T) {
		adapters, err := NewAdapters(FactoryOptions{})
		if err != nil {
			t.Fatalf("NewAdapters failed: %v", err)
		}
		if adapters.Mode != "llm=mock embedding=mock" {
			t.Fatalf("mode = %q, want llm=mock embedding=mock", adapters.Mode)
		}
	})

	t.Run("one capability real, the other mock", func(t *testing.T) {
		adapters, err := NewAdapters(FactoryOptions{
			LLM:   CapabilityConfig{Provider: "teststub", APIKey: "key"},
			Meter: newMeter(10, fixedNow),
		})
		if err != nil {
			t.Fatalf("NewAdapters failed: %v", err)
		}
		if adapters.Mode != "llm=teststub embedding=mock" {
			t.Fatalf("mode = %q, want llm=teststub embedding=mock", adapters.Mode)
		}
		// The selected provider is reached through the metering seam.
		ctx := platform.ContextWithUserID(context.Background(), "user-1")
		before := llmStub.calls
		if _, err := adapters.Extractor.Split(ctx, "market", fixedNow(), nil); err != nil {
			t.Fatalf("Split failed: %v", err)
		}
		if llmStub.calls != before+1 || llmStub.lastRequest.MaxOutputTokens == 0 {
			t.Fatalf("provider not metered: calls delta wrong or token cap unset (cap=%d)", llmStub.lastRequest.MaxOutputTokens)
		}
	})

	t.Run("both capabilities real and independent", func(t *testing.T) {
		adapters, err := NewAdapters(FactoryOptions{
			LLM:       CapabilityConfig{Provider: "teststub", APIKey: "key"},
			Embedding: CapabilityConfig{Provider: "teststub", APIKey: "key"},
			Meter:     newMeter(10, fixedNow),
		})
		if err != nil {
			t.Fatalf("NewAdapters failed: %v", err)
		}
		if adapters.Mode != "llm=teststub embedding=teststub" {
			t.Fatalf("mode = %q, want llm=teststub embedding=teststub", adapters.Mode)
		}
	})

	t.Run("recognized but unimplemented slot is a startup error", func(t *testing.T) {
		_, err := NewAdapters(FactoryOptions{LLM: CapabilityConfig{Provider: "openai", APIKey: "key"}})
		if !errors.Is(err, ErrProviderNotImplemented) {
			t.Fatalf("error = %v, want ErrProviderNotImplemented", err)
		}
		_, err = NewAdapters(FactoryOptions{Embedding: CapabilityConfig{Provider: "gemini", APIKey: "key"}})
		if !errors.Is(err, ErrProviderNotImplemented) {
			t.Fatalf("embedding error = %v, want ErrProviderNotImplemented", err)
		}
	})

	t.Run("unknown provider name is a startup error, never a silent default", func(t *testing.T) {
		_, err := NewAdapters(FactoryOptions{LLM: CapabilityConfig{Provider: "acme", APIKey: "key"}})
		if !errors.Is(err, ErrUnknownProvider) {
			t.Fatalf("error = %v, want ErrUnknownProvider", err)
		}
		// A key present with no provider name is also unknown, not a silent default.
		_, err = NewAdapters(FactoryOptions{Embedding: CapabilityConfig{APIKey: "key"}})
		if !errors.Is(err, ErrUnknownProvider) {
			t.Fatalf("empty-provider error = %v, want ErrUnknownProvider", err)
		}
	})

	t.Run("injected client bypasses registry selection", func(t *testing.T) {
		adapters, err := NewAdapters(FactoryOptions{
			LLMClient:       llmStub,
			EmbeddingClient: embStub,
			Meter:           newMeter(10, fixedNow),
		})
		if err != nil {
			t.Fatalf("NewAdapters failed: %v", err)
		}
		if adapters.Mode != "llm=real embedding=real" {
			t.Fatalf("mode = %q, want llm=real embedding=real", adapters.Mode)
		}
	})
}
