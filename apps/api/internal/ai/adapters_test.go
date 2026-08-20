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
	clearProviderEnv(t)

	adapters, err := NewAdaptersFromEnv(FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdaptersFromEnv failed: %v", err)
	}
	if adapters.Mode != "llm=mock embedding=mock" {
		t.Fatalf("mode = %q, want llm=mock embedding=mock", adapters.Mode)
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
	if len(firstEmbedding) != 1 || len(firstEmbedding[0]) != values.AiEmbeddingDim {
		t.Fatalf("embedding dimensions = %d vectors, %d dim", len(firstEmbedding), len(firstEmbedding[0]))
	}
}

// The mock adapters bypass the metering seam — repeated calls beyond the daily cap
// never trip a cost limit and never require a user scope (A6: the mock is unmetered).
func TestMockAdaptersAreUnmetered(t *testing.T) {
	clearProviderEnv(t)
	adapters, err := NewAdaptersFromEnv(FactoryOptions{Meter: newMeter(1, fixedNow)})
	if err != nil {
		t.Fatalf("NewAdaptersFromEnv failed: %v", err)
	}
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		if _, err := adapters.Extractor.Split(ctx, fmt.Sprintf("market-%d", i), fixedNow(), nil); err != nil {
			t.Fatalf("mock Split %d failed: %v", i, err)
		}
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

// mood and neuron type are closed domain sets; the schema must pin them so a real
// provider cannot answer outside what normalizeMood/normalizeNeuronType accept.
func TestExtractorSchemaPinsMoodAndNeuronTypeEnums(t *testing.T) {
	schema := ExtractOutputSchema()
	memoryItem := schema["properties"].(map[string]any)["memories"].(map[string]any)["items"].(map[string]any)
	memoryProps := memoryItem["properties"].(map[string]any)

	moodEnum := memoryProps["mood"].(map[string]any)["enum"].([]string)
	for _, value := range moodEnum {
		if _, err := normalizeMood(value); err != nil {
			t.Fatalf("schema mood %q rejected by normalizeMood: %v", value, err)
		}
	}
	if len(moodEnum) != len(memory.AllMoods()) {
		t.Fatalf("schema mood enum has %d entries, domain has %d", len(moodEnum), len(memory.AllMoods()))
	}

	neuronProps := memoryProps["neurons"].(map[string]any)["items"].(map[string]any)["properties"].(map[string]any)
	typeEnum := neuronProps["type"].(map[string]any)["enum"].([]string)
	for _, value := range typeEnum {
		if _, err := normalizeNeuronType(value); err != nil {
			t.Fatalf("schema neuron type %q rejected by normalizeNeuronType: %v", value, err)
		}
	}
	if len(typeEnum) != len(memory.AllNeuronTypes()) {
		t.Fatalf("schema neuron type enum has %d entries, domain has %d", len(typeEnum), len(memory.AllNeuronTypes()))
	}
}

// A sample the use-case is about to re-prompt from must reach the caller AND stay out of the cache:
// caching it would make the writer's second press on the same diary replay the split that already
// failed, so the retry could never differ from the first try. (The shipped seam cached it, which is
// how a one-scene diary produced the same refusal forever at zero provider cost.)
func TestMeteredLLMSeamReturnsButDoesNotCacheASampleTheDomainWouldRepair(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	// A passage the diary does not contain: repairable, so the loop needs the sample back.
	client := &fakeLLMClient{response: []byte(`{"memories":[{"name":"Market","mood":"CALM","source_text":"market","neurons":[{"name":"market","type":"semantic"}]},{"name":"Moon","mood":"JOY","source_text":"moon","neurons":[{"name":"moon","type":"semantic"}]}]}`)}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(10, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}

	first, err := extractor.Split(ctx, cacheableSplitDiary, fixedNow(), nil)
	if err != nil {
		t.Fatalf("Split failed: %v", err)
	}
	if len(first.Memories) != 2 {
		t.Fatalf("the violating sample must still reach the repair loop, got %d memories", len(first.Memories))
	}
	if _, err := extractor.Split(ctx, cacheableSplitDiary, fixedNow(), nil); err != nil {
		t.Fatalf("second Split failed: %v", err)
	}
	if client.calls != 2 {
		t.Fatalf("client calls = %d, want the identical retry to re-sample rather than replay", client.calls)
	}
}

// The metering seam only caches a sample the consumer would keep, so a cache test needs a split the
// domain calls final: on target for the count, one semantic neuron each, and passages that quote the
// whole body between them. An under-target fixture would exercise the opposite property.
const cacheableSplitDiary = "market lunch"

var cacheableSplitJSON = []byte(`{"memories":[{"name":"Market","mood":"CALM","source_text":"market","neurons":[{"name":"market","type":"semantic"}]},{"name":"Lunch","mood":"JOY","source_text":"lunch","neurons":[{"name":"lunch","type":"semantic"}]}]}`)

// The metering seam wraps every real LLM path: the per-call token cap is applied to the
// vendor request, the daily cap trips on distinct inputs, and an identical input is
// served from cache without re-billing.
func TestMeteredLLMSeamAppliesTokenCapCostLimitAndCache(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeLLMClient{response: cacheableSplitJSON}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(1, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}

	if _, err := extractor.Split(ctx, cacheableSplitDiary, fixedNow(), nil); err != nil {
		t.Fatalf("Split failed: %v", err)
	}
	if client.calls != 1 || client.lastRequest.MaxOutputTokens != values.AiPerCallTokenCap {
		t.Fatalf("client calls=%d cap=%d", client.calls, client.lastRequest.MaxOutputTokens)
	}
	if client.lastRequest.UserID != "user-1" {
		t.Fatalf("seam did not scope request to caller, userID=%q", client.lastRequest.UserID)
	}

	if _, err := extractor.Split(ctx, cacheableSplitDiary, fixedNow(), nil); err != nil {
		t.Fatalf("cached Split failed: %v", err)
	}
	if client.calls != 1 {
		t.Fatalf("cached Split re-billed: calls=%d", client.calls)
	}

	// The cap crosses the port in memory's vocabulary while staying an ai.CostLimitError underneath,
	// so the RPC mapping and the worker's RetryAt backoff read the same one failure.
	_, err = extractor.Split(ctx, "different market", fixedNow(), nil)
	if !IsCostLimitError(err) {
		t.Fatalf("different Split error = %v, want CostLimitError", err)
	}
	if !errors.Is(err, memory.ErrAiCallCapReached) {
		t.Fatalf("different Split error = %v, want memory.ErrAiCallCapReached", err)
	}
	var retryable interface{ RetryAt() time.Time }
	if !errors.As(err, &retryable) || retryable.RetryAt().IsZero() {
		t.Fatalf("cap error lost its retry hint through the port wrap: %v", err)
	}
}

func TestMeteredLLMSeamRequiresUserScope(t *testing.T) {
	client := &fakeLLMClient{response: []byte(`{}`)}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(10, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}
	if _, err := extractor.Split(context.Background(), "market", fixedNow(), nil); err == nil {
		t.Fatal("Split without user scope succeeded, want ErrUserScopeRequired")
	}
}

func TestMeteredEmbeddingSeamAppliesDimensionCostLimitAndCache(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeEmbeddingClient{}
	embedder, err := NewRealEmbedder(newMeteredEmbeddingClient(client, newMeter(1, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealEmbedder failed: %v", err)
	}

	vectors, err := embedder.Embed(ctx, []string{"market"})
	if err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	if len(vectors) != 1 || len(vectors[0]) != values.AiEmbeddingDim {
		t.Fatalf("embedding shape = %d vectors dim %d", len(vectors), len(vectors[0]))
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

	if _, err := embedder.Embed(ctx, []string{"different market"}); !IsCostLimitError(err) {
		t.Fatalf("different Embed error = %v, want CostLimitError", err)
	}
}

// A response the consumer rejects must not be cached, so an identical retry re-invokes
// the provider (and can re-sample) rather than being served a poisoned cache entry.
func TestMeteredSeamDoesNotCacheRejectedResponses(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	reject := errors.New("consumer rejected the response")

	llm := &fakeLLMClient{response: []byte(`{"valid":"but unusable"}`)}
	llmSeam := newMeteredLLMClient(llm, newMeter(10, fixedNow))
	llmReq := LLMRequest{CacheKey: "k", Validate: func([]byte) error { return reject }}
	for i := 0; i < 2; i++ {
		if _, err := llmSeam.CompleteJSON(ctx, llmReq); !errors.Is(err, reject) {
			t.Fatalf("llm attempt %d error = %v, want rejection", i, err)
		}
	}
	if llm.calls != 2 {
		t.Fatalf("llm inner calls = %d, want 2 (rejected response must not be cached)", llm.calls)
	}

	emb := &fakeEmbeddingClient{}
	embSeam := newMeteredEmbeddingClient(emb, newMeter(10, fixedNow))
	embReq := EmbeddingRequest{Texts: []string{"x"}, Dim: values.AiEmbeddingDim, CacheKey: "k", Validate: func([][]float32) error { return reject }}
	for i := 0; i < 2; i++ {
		if _, err := embSeam.Embed(ctx, embReq); !errors.Is(err, reject) {
			t.Fatalf("embedding attempt %d error = %v, want rejection", i, err)
		}
	}
	if emb.calls != 2 {
		t.Fatalf("embedding inner calls = %d, want 2 (rejected response must not be cached)", emb.calls)
	}
}

// A provider ERROR (not a consumer rejection) is never cached: an identical retry must reach the
// provider again, and the first subsequent success is then cached normally. This guards the seam
// against a truncated/filtered DeepSeek completion (now a typed error) poisoning the cache.
func TestMeteredSeamDoesNotCacheProviderErrors(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	providerErr := &MalformedStructuredOutputError{Provider: "deepseek", Err: errors.New("non-stop finish reason")}

	llm := &fakeLLMClient{
		response:   []byte(`{"ok":true}`),
		failFirstN: 1,
		failErr:    providerErr,
	}
	seam := newMeteredLLMClient(llm, newMeter(10, fixedNow))
	req := LLMRequest{CacheKey: "k"}

	// First call: provider fails — the error surfaces and nothing is cached.
	if _, err := seam.CompleteJSON(ctx, req); !IsMalformedStructuredOutput(err) {
		t.Fatalf("first call error = %v, want the provider error", err)
	}
	// Second identical call: the failure was not cached, so the provider is invoked again and
	// now succeeds; that success is cached.
	resp, err := seam.CompleteJSON(ctx, req)
	if err != nil {
		t.Fatalf("second call failed: %v", err)
	}
	if string(resp.JSON) != `{"ok":true}` {
		t.Fatalf("second call JSON = %q, want the success body", string(resp.JSON))
	}
	// Third identical call: served from cache, provider not invoked a third time.
	if _, err := seam.CompleteJSON(ctx, req); err != nil {
		t.Fatalf("third call failed: %v", err)
	}
	if llm.calls != 2 {
		t.Fatalf("provider calls = %d, want 2 (error not cached, success cached)", llm.calls)
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

func TestMeteredLLMSeamCacheIsBounded(t *testing.T) {
	ctx := platform.ContextWithUserID(context.Background(), "user-1")
	client := &fakeLLMClient{response: cacheableSplitJSON}
	extractor, err := NewRealExtractor(newMeteredLLMClient(client, newMeter(values.AiAdapterCacheMaxEntries+10, fixedNow)))
	if err != nil {
		t.Fatalf("NewRealExtractor failed: %v", err)
	}
	// The diary DATE varies rather than the body: distinct cache keys, while the one fixed sample
	// stays a valid split of the same diary and therefore stays cacheable.
	day := fixedNow()
	for i := 0; i < values.AiAdapterCacheMaxEntries+1; i++ {
		if _, err := extractor.Split(ctx, cacheableSplitDiary, day.AddDate(0, 0, i), nil); err != nil {
			t.Fatalf("Split %d failed: %v", i, err)
		}
	}
	if _, err := extractor.Split(ctx, cacheableSplitDiary, day, nil); err != nil {
		t.Fatalf("evicted Split failed: %v", err)
	}
	if client.calls != values.AiAdapterCacheMaxEntries+2 {
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

func clearProviderEnv(t *testing.T) {
	t.Helper()
	for _, key := range []string{
		EnvLLMProvider, EnvLLMAPIKey, EnvLLMModel,
		EnvEmbeddingProvider, EnvEmbeddingAPIKey, EnvEmbeddingModel,
	} {
		t.Setenv(key, "")
	}
}

type fakeLLMClient struct {
	response    []byte
	calls       int
	lastRequest LLMRequest
	// failFirstN fails the first N calls with failErr, then serves response.
	failFirstN int
	failErr    error
}

func (c *fakeLLMClient) CompleteJSON(_ context.Context, req LLMRequest) (LLMResponse, error) {
	c.calls++
	c.lastRequest = req
	if c.calls <= c.failFirstN {
		return LLMResponse{}, c.failErr
	}
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
