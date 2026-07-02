package ai

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestMockAdaptersAreDeterministicOffline(t *testing.T) {
	t.Setenv(EnvAPIKey, "")

	adapters, err := NewAdaptersFromEnv(FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdaptersFromEnv failed: %v", err)
	}
	if adapters.Mode != "mock" {
		t.Fatalf("mode = %q, want mock", adapters.Mode)
	}

	ctx := context.Background()
	body := "Walked through the blue market and met Mina"
	firstSplit, err := adapters.Extractor.Split(ctx, body, time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil)
	if err != nil {
		t.Fatalf("Split failed: %v", err)
	}
	secondSplit, err := adapters.Extractor.Split(ctx, body, time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil)
	if err != nil {
		t.Fatalf("second Split failed: %v", err)
	}
	if !reflect.DeepEqual(firstSplit, secondSplit) {
		t.Fatalf("mock Split is not deterministic:\nfirst=%+v\nsecond=%+v", firstSplit, secondSplit)
	}

	firstEmbedding, err := adapters.Embedder.Embed(ctx, []string{"blue market"})
	if err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	secondEmbedding, err := adapters.Embedder.Embed(ctx, []string{"blue market"})
	if err != nil {
		t.Fatalf("second Embed failed: %v", err)
	}
	if len(firstEmbedding) != 1 || len(firstEmbedding[0]) != values.AiEmbeddingDim {
		t.Fatalf("embedding dimensions = %d vectors, %d dim", len(firstEmbedding), len(firstEmbedding[0]))
	}
	if !reflect.DeepEqual(firstEmbedding, secondEmbedding) {
		t.Fatal("mock Embed is not deterministic")
	}

	item := memory.SemanticizeMemory{Name: "Blue Market", CurrentText: "Met Mina", Mood: memory.MoodCalm}
	firstStages, err := adapters.Semanticizer.GenerateSemanticStages(ctx, item)
	if err != nil {
		t.Fatalf("GenerateSemanticStages failed: %v", err)
	}
	secondStages, err := adapters.Semanticizer.GenerateSemanticStages(ctx, item)
	if err != nil {
		t.Fatalf("second GenerateSemanticStages failed: %v", err)
	}
	if firstStages != secondStages {
		t.Fatalf("mock semantic stages are not deterministic: %v vs %v", firstStages, secondStages)
	}
}

func TestExtractorSchemaForcedDTOHasNoInvariantBreakingFields(t *testing.T) {
	banned := map[string]bool{
		"position": true,
		"color":    true,
		"strength": true,
		"time":     true,
		"delete":   true,
	}
	for _, typ := range []reflect.Type{
		reflect.TypeOf(memory.ExtractResult{}),
		reflect.TypeOf(memory.ExtractedMemory{}),
		reflect.TypeOf(memory.ExtractedNeuron{}),
	} {
		for i := 0; i < typ.NumField(); i++ {
			field := typ.Field(i)
			if banned[strings.ToLower(field.Name)] {
				t.Fatalf("%s has banned field %s", typ.Name(), field.Name)
			}
		}
	}
}

func TestRealExtractorUsesTokenCapCostLimitAndCache(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}]}`)}
	extractor, err := NewRealExtractor(client, newMeter(1, fixedNow))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}

	if _, err := extractor.Split(ctx, "market", time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil); err != nil {
		t.Fatalf("Split failed: %v", err)
	}
	if client.calls != 1 || client.lastRequest.MaxOutputTokens != values.AiPerCallTokenCap {
		t.Fatalf("client calls=%d cap=%d", client.calls, client.lastRequest.MaxOutputTokens)
	}

	if _, err := extractor.Split(ctx, "market", time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil); err != nil {
		t.Fatalf("cached Split failed: %v", err)
	}
	if client.calls != 1 {
		t.Fatalf("cached Split re-billed: calls=%d", client.calls)
	}

	_, err = extractor.Split(ctx, "different market", time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC), nil)
	if !IsCostLimitError(err) {
		t.Fatalf("different Split error = %v, want CostLimitError", err)
	}
}

func TestRealEmbedderUsesDimensionCostLimitAndCache(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeEmbeddingClient{}
	embedder, err := NewRealEmbedder(client, newMeter(1, fixedNow))
	if err != nil {
		t.Fatalf("NewRealEmbedder failed: %v", err)
	}

	if _, err := embedder.Embed(ctx, []string{"market"}); err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	if client.calls != 1 || client.lastRequest.Dim != values.AiEmbeddingDim {
		t.Fatalf("client calls=%d dim=%d", client.calls, client.lastRequest.Dim)
	}
	if _, err := embedder.Embed(ctx, []string{"market"}); err != nil {
		t.Fatalf("cached Embed failed: %v", err)
	}
	if client.calls != 1 {
		t.Fatalf("cached Embed re-billed: calls=%d", client.calls)
	}

	_, err = embedder.Embed(ctx, []string{"different market"})
	if !IsCostLimitError(err) {
		t.Fatalf("different Embed error = %v, want CostLimitError", err)
	}
}

func TestBoundedCacheEvictsOldestEntries(t *testing.T) {
	cache := newBoundedCache[string](2)
	cache.put("a", "first")
	cache.put("b", "second")
	cache.put("c", "third")

	if _, ok := cache.get("a"); ok {
		t.Fatal("oldest cache entry was not evicted")
	}
	if got, ok := cache.get("b"); !ok || got != "second" {
		t.Fatalf("cache b = %q %v, want second true", got, ok)
	}
	if got, ok := cache.get("c"); !ok || got != "third" {
		t.Fatalf("cache c = %q %v, want third true", got, ok)
	}
}

func TestRealExtractorCacheIsBounded(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}]}`)}
	extractor, err := NewRealExtractor(client, newMeter(aiAdapterCacheMaxEntries+10, fixedNow))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	for i := 0; i < aiAdapterCacheMaxEntries+1; i++ {
		if _, err := extractor.Split(ctx, fmt.Sprintf("market-%d", i), day, nil); err != nil {
			t.Fatalf("Split %d failed: %v", i, err)
		}
	}
	if _, err := extractor.Split(ctx, "market-0", day, nil); err != nil {
		t.Fatalf("evicted Split failed: %v", err)
	}
	if client.calls != aiAdapterCacheMaxEntries+2 {
		t.Fatalf("client calls = %d, want oldest entry evicted and reloaded", client.calls)
	}
}

func TestMeterPrunesOldDailyWindows(t *testing.T) {
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	meter := newMeter(10, func() time.Time { return now })
	ctx := platform.ContextWithUserID(context.Background(), "user-1")

	if _, err := meter.Charge(ctx); err != nil {
		t.Fatalf("first Charge failed: %v", err)
	}
	now = now.Add(24 * time.Hour)
	if _, err := meter.Charge(ctx); err != nil {
		t.Fatalf("second Charge failed: %v", err)
	}
	if len(meter.calls) != 1 {
		t.Fatalf("meter call windows = %d, want only current window", len(meter.calls))
	}
}

func TestFactorySelectsRealOnlyWhenKeyAndClientsArePresent(t *testing.T) {
	if _, err := NewAdapters(FactoryOptions{APIKey: "key"}); !errors.Is(err, ErrRealClientsRequired) {
		t.Fatalf("NewAdapters with key and no clients error = %v, want ErrRealClientsRequired", err)
	}
	adapters, err := NewAdapters(FactoryOptions{
		APIKey:          "key",
		LLMClient:       &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}]}`)},
		EmbeddingClient: &fakeEmbeddingClient{},
		Meter:           newMeter(10, fixedNow),
	})
	if err != nil {
		t.Fatalf("NewAdapters real failed: %v", err)
	}
	if adapters.Mode != "real" {
		t.Fatalf("mode = %q, want real", adapters.Mode)
	}
}

type fakeLLMClient struct {
	response    []byte
	calls       int
	lastRequest LLMRequest
}

func (c *fakeLLMClient) CompleteJSON(_ context.Context, req LLMRequest) (LLMResponse, error) {
	c.calls++
	c.lastRequest = req
	return LLMResponse{JSON: append([]byte(nil), c.response...)}, nil
}

type fakeEmbeddingClient struct {
	calls       int
	lastRequest EmbeddingRequest
}

func (c *fakeEmbeddingClient) Embed(_ context.Context, req EmbeddingRequest) (EmbeddingResponse, error) {
	c.calls++
	c.lastRequest = req
	vectors := make([][]float32, 0, len(req.Texts))
	for range req.Texts {
		vector := make([]float32, req.Dim)
		vector[0] = 0.5
		vectors = append(vectors, vector)
	}
	return EmbeddingResponse{Vectors: vectors}, nil
}

func fixedNow() time.Time {
	return time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
}
