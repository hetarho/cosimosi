package voyage

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestNewEnforcesDimensionContractAtConstruction(t *testing.T) {
	// voyage-3-lite has a fixed 512-dim output; it cannot honor ai.embedding_dim (1024),
	// so wiring must fail here, not at row-insert time (A7).
	if _, err := New(ai.ProviderConfig{APIKey: "key", Model: "voyage-3-lite"}); err == nil {
		t.Fatal("New with dimension-incompatible model succeeded, want construction error")
	}
	// The default model does honor ai.embedding_dim.
	if _, err := New(ai.ProviderConfig{APIKey: "key"}); err != nil {
		t.Fatalf("New with default model failed: %v", err)
	}
}

func TestNewRejectsUnknownModelAndMissingKey(t *testing.T) {
	if _, err := New(ai.ProviderConfig{APIKey: "key", Model: "voyage-nonexistent"}); err == nil {
		t.Fatal("New with unknown model succeeded, want error")
	}
	if _, err := New(ai.ProviderConfig{}); err == nil {
		t.Fatal("New with empty key succeeded, want error")
	}
}

func TestEmbedReturnsVectorsOfContractDimension(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer key" {
			t.Errorf("Authorization = %q, want Bearer key", got)
		}
		writeEmbeddings(w, embedInputCount(t, r), values.AiEmbeddingDim)
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	resp, err := client.Embed(context.Background(), ai.EmbeddingRequest{Texts: []string{"a", "b"}, Dim: values.AiEmbeddingDim})
	if err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	if len(resp.Vectors) != 2 {
		t.Fatalf("vectors = %d, want 2", len(resp.Vectors))
	}
	for i, v := range resp.Vectors {
		if len(v) != values.AiEmbeddingDim {
			t.Fatalf("vector %d dim = %d, want %d", i, len(v), values.AiEmbeddingDim)
		}
	}
}

func TestEmbedRejectsWrongProviderDimension(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeEmbeddings(w, embedInputCount(t, r), values.AiEmbeddingDim/2)
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	if _, err := client.Embed(context.Background(), ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim}); !ai.IsMalformedStructuredOutput(err) {
		t.Fatalf("error = %v, want MalformedStructuredOutputError", err)
	}
}

func TestEmbedRejectsNonContiguousIndices(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// Two items, both index 0 — the count matches but the indices are not 0..n-1,
		// which would silently misalign vectors with their input text.
		type item struct {
			Embedding []float32 `json:"embedding"`
			Index     int       `json:"index"`
		}
		resp := struct {
			Data []item `json:"data"`
		}{Data: []item{
			{Embedding: make([]float32, values.AiEmbeddingDim), Index: 0},
			{Embedding: make([]float32, values.AiEmbeddingDim), Index: 0},
		}}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	if _, err := client.Embed(context.Background(), ai.EmbeddingRequest{Texts: []string{"a", "b"}, Dim: values.AiEmbeddingDim}); !ai.IsMalformedStructuredOutput(err) {
		t.Fatalf("error = %v, want MalformedStructuredOutputError", err)
	}
}

func TestEmbedMapsStatusErrors(t *testing.T) {
	cases := []struct {
		status int
		check  func(error) bool
	}{
		{http.StatusTooManyRequests, ai.IsRateLimited},
		{http.StatusUnauthorized, ai.IsAuthFailed},
		{http.StatusForbidden, ai.IsAuthFailed},
		{http.StatusInternalServerError, ai.IsRateLimited},
		{http.StatusBadRequest, ai.IsAuthFailed},
	}
	for _, tc := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(tc.status)
		}))
		client := newTestClient(t, server.URL)
		_, err := client.Embed(context.Background(), ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim})
		if !tc.check(err) {
			t.Errorf("status %d: error = %v, not the expected typed error", tc.status, err)
		}
		server.Close()
	}
}

// newTestClient builds the adapter, then points its endpoint at a fake server.
// Production New offers no endpoint override (the endpoint is adapter-owned,
// change 03), so the test reaches the unexported field directly.
func newTestClient(t *testing.T, baseURL string) ai.EmbeddingClient {
	t.Helper()
	client, err := New(ai.ProviderConfig{APIKey: "key"})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	client.(*Client).endpoint = baseURL
	return client
}

func embedInputCount(t *testing.T, r *http.Request) int {
	t.Helper()
	var body struct {
		Input []string `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		t.Fatalf("decode request: %v", err)
	}
	return len(body.Input)
}

func writeEmbeddings(w http.ResponseWriter, count, dim int) {
	type item struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	}
	resp := struct {
		Data []item `json:"data"`
	}{Data: make([]item, count)}
	for i := range resp.Data {
		resp.Data[i] = item{Embedding: make([]float32, dim), Index: i}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
