package ai

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"
	"unicode/utf8"
)

const (
	openAIEmbeddingsURL = "https://api.openai.com/v1/embeddings"
	openAIModel         = "text-embedding-3-small" // 1536-d
	// text-embedding-3-small accepts ~8191 tokens. We have no tokenizer here, so we
	// cap on RUNES with a ceiling conservative enough that even dense CJK text
	// (worst case ~2 tokens/rune → 8191/2 ≈ 4095) stays under the limit. Over-long
	// input is truncated (acceptance 2.4) rather than risking a hard API rejection
	// that would just retry-then-fail. A precise tiktoken-based cap is a v1 upgrade;
	// diaries rarely exceed a few thousand characters, so truncation is seldom hit.
	maxInputRunes = 4000
)

// OpenAIEmbedder calls OpenAI's embeddings API. It validates the response
// dimension (acceptance 2.3), guards input length (2.4), and caches by text hash
// to avoid paying twice for the same diary.
type OpenAIEmbedder struct {
	apiKey  string
	model   string
	dim     int
	http    *http.Client
	metrics *Metrics

	mu    sync.RWMutex
	cache map[string][]float32
}

// NewOpenAIEmbedder builds the adapter; dim is the expected (and enforced)
// response dimension.
func NewOpenAIEmbedder(apiKey string, dim int) *OpenAIEmbedder {
	return &OpenAIEmbedder{
		apiKey:  apiKey,
		model:   openAIModel,
		dim:     dim,
		http:    &http.Client{Timeout: 30 * time.Second},
		metrics: &Metrics{},
		cache:   make(map[string][]float32),
	}
}

func (e *OpenAIEmbedder) Dim() int      { return e.dim }
func (e *OpenAIEmbedder) Model() string { return e.model }

func (e *OpenAIEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	key := cacheKey(text)
	if v, ok := e.fromCache(key); ok {
		e.metrics.CacheHits.Add(1)
		return v, nil
	}

	input := text
	runeLen := utf8.RuneCountInString(text)
	if runeLen > maxInputRunes {
		input = string([]rune(text)[:maxInputRunes])
		runeLen = maxInputRunes
		e.metrics.TokenCapHits.Add(1)
	}
	e.metrics.EmbedCalls.Add(1)
	e.metrics.ApproxTokens.Add(int64(runeLen / 4))

	reqBody, err := json.Marshal(embedRequest{Input: input, Model: e.model})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIEmbeddingsURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+e.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai embeddings: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, fmt.Errorf("openai embeddings: status %d: %s", resp.StatusCode, body)
	}

	var parsed embedResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(parsed.Data) == 0 {
		return nil, fmt.Errorf("openai embeddings: empty data")
	}
	raw := parsed.Data[0].Embedding
	if len(raw) != e.dim {
		return nil, fmt.Errorf("openai embeddings: got dim %d, want %d", len(raw), e.dim)
	}
	vec := make([]float32, len(raw))
	for i, f := range raw {
		vec[i] = float32(f)
	}

	e.toCache(key, vec)
	// Cost-guard counters (acceptance 2.4), surfaced per call as a structured line —
	// embedding metrics kept distinct from any future LLM-extraction metrics.
	slog.Debug("embedding done",
		"model", e.model,
		"embed_calls", e.metrics.EmbedCalls.Load(),
		"approx_tokens", e.metrics.ApproxTokens.Load(),
		"cache_hits", e.metrics.CacheHits.Load(),
		"token_cap_hits", e.metrics.TokenCapHits.Load(),
	)
	return vec, nil
}

func (e *OpenAIEmbedder) fromCache(key string) ([]float32, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	v, ok := e.cache[key]
	if !ok {
		return nil, false
	}
	out := make([]float32, len(v)) // defensive copy: callers must not mutate the cache
	copy(out, v)
	return out, true
}

func (e *OpenAIEmbedder) toCache(key string, vec []float32) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cache[key] = vec
}

func cacheKey(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

type embedRequest struct {
	Input string `json:"input"`
	Model string `json:"model"`
}

type embedResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
}
