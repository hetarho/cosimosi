package ai

import (
	"context"
	"testing"
)

func TestMockPredictionErrorIsDeterministicOnContentNotWording(t *testing.T) {
	t.Parallel()
	gate := NewMockPredictionError()
	ctx := context.Background()

	// Reordering, spacing, and case leave the token set unchanged → not a prediction error.
	same, err := gate.Differs(ctx, "I ate carbonara with Jinsu", "with jinsu   I ATE carbonara")
	if err != nil {
		t.Fatalf("Differs failed: %v", err)
	}
	if same {
		t.Fatal("a mere re-wording must not be a prediction error")
	}

	// Genuinely different content → a prediction error.
	differs, err := gate.Differs(ctx, "I ate carbonara with Jinsu", "I fought with my brother")
	if err != nil {
		t.Fatalf("Differs failed: %v", err)
	}
	if !differs {
		t.Fatal("a content change must be a prediction error")
	}
}

func TestRealPredictionErrorParsesSchemaForcedBool(t *testing.T) {
	t.Parallel()
	client := &fakeLLMClient{response: []byte(`{"differs": true}`)}
	gate, err := NewRealPredictionError(client)
	if err != nil {
		t.Fatalf("NewRealPredictionError failed: %v", err)
	}
	differs, err := gate.Differs(context.Background(), "current", "rewrite")
	if err != nil {
		t.Fatalf("Differs failed: %v", err)
	}
	if !differs {
		t.Fatal("differs = false, want true from the schema-forced response")
	}
	if client.lastRequest.OutputSchema == nil || client.lastRequest.CacheKey == "" {
		t.Fatal("the compare must be schema-forced and cache-keyed")
	}
}

func TestMockAdaptersProvidePredictionError(t *testing.T) {
	t.Parallel()
	adapters, err := NewAdapters(FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdapters failed: %v", err)
	}
	if adapters.PredictionError == nil {
		t.Fatal("keyless adapters must provide a PredictionError (the deterministic mock)")
	}
}
