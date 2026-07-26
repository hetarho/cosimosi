package voyage

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

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

func TestEmbedPreservesCallerCancellation(t *testing.T) {
	started := make(chan struct{})
	client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		close(started)
		<-req.Context().Done()
		return nil, req.Context().Err()
	}))
	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() {
		_, err := client.Embed(ctx, ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim})
		errCh <- err
	}()
	<-started
	cancel()

	err := <-errCh
	if err != ctx.Err() {
		t.Fatalf("error = %v, want unchanged %v", err, ctx.Err())
	}
	if ai.IsRateLimited(err) {
		t.Fatalf("error = %v, caller cancellation must not be rate-limited", err)
	}
}

func TestEmbedPreservesCallerDeadline(t *testing.T) {
	started := make(chan struct{})
	client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		close(started)
		<-req.Context().Done()
		return nil, req.Context().Err()
	}))
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	_, err := client.Embed(ctx, ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim})
	if err != ctx.Err() {
		t.Fatalf("error = %v, want unchanged %v", err, ctx.Err())
	}
	if ai.IsRateLimited(err) {
		t.Fatalf("error = %v, caller deadline must not be rate-limited", err)
	}
	select {
	case <-started:
	default:
		t.Fatal("request deadline expired before the transport started")
	}
}

func TestEmbedPreservesGenuineTransportCause(t *testing.T) {
	cause := errors.New("connection reset")
	client := newTransportTestClient(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, cause
	}))

	_, err := client.Embed(context.Background(), ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim})
	if !ai.IsRateLimited(err) {
		t.Fatalf("error = %v, want RateLimitedError", err)
	}
	if !errors.Is(err, cause) {
		t.Fatalf("error chain = %v, want transport cause", err)
	}
}

func TestEmbedPreservesResponseBodyTransportCause(t *testing.T) {
	cause := errors.New("body connection reset")
	client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       &errorBody{err: cause},
			Request:    req,
		}, nil
	}))

	_, err := client.Embed(
		context.Background(),
		ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim},
	)
	if !ai.IsRateLimited(err) {
		t.Fatalf("error = %v, want RateLimitedError", err)
	}
	if !errors.Is(err, cause) {
		t.Fatalf("error chain = %v, want response-body transport cause", err)
	}
}

func TestEmbedPreservesCancellationDuringResponseBodyRead(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusTooManyRequests} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			started := make(chan struct{})
			client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: status,
					Header:     make(http.Header),
					Body:       &contextBody{ctx: req.Context(), started: started},
					Request:    req,
				}, nil
			}))
			ctx, cancel := context.WithCancel(context.Background())
			errCh := make(chan error, 1)
			go func() {
				_, err := client.Embed(
					ctx,
					ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim},
				)
				errCh <- err
			}()
			<-started
			cancel()

			err := <-errCh
			if err != ctx.Err() {
				t.Fatalf("status %d error = %v, want unchanged %v", status, err, ctx.Err())
			}
			if ai.IsRateLimited(err) || ai.IsAuthFailed(err) || ai.IsMalformedStructuredOutput(err) {
				t.Fatalf("status %d error = %v, body-read cancellation must stay untyped", status, err)
			}
		})
	}
}

func TestEmbedDrainsErrorBodyBeforeClose(t *testing.T) {
	cases := []struct {
		name       string
		body       string
		wantRead   int
		wantSawEOF bool
	}{
		{"small body reaches EOF", "provider details", len("provider details"), true},
		{
			"exact threshold reaches EOF",
			strings.Repeat("x", maxErrorBodyDrainBytes),
			maxErrorBodyDrainBytes,
			true,
		},
		{
			"oversized body stays bounded",
			strings.Repeat("x", maxErrorBodyDrainBytes+2),
			maxErrorBodyDrainBytes + 1,
			false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := &observedBody{reader: strings.NewReader(tc.body)}
			client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusTooManyRequests,
					Header:     make(http.Header),
					Body:       body,
					Request:    req,
				}, nil
			}))

			_, err := client.Embed(
				context.Background(),
				ai.EmbeddingRequest{Texts: []string{"a"}, Dim: values.AiEmbeddingDim},
			)
			if !ai.IsRateLimited(err) {
				t.Fatalf("error = %v, want RateLimitedError", err)
			}
			if body.bytesRead != tc.wantRead {
				t.Fatalf("bytes read = %d, want %d", body.bytesRead, tc.wantRead)
			}
			if body.sawEOF != tc.wantSawEOF {
				t.Fatalf("saw EOF = %v, want %v", body.sawEOF, tc.wantSawEOF)
			}
			if !body.closed {
				t.Fatal("error response body was not closed")
			}
			if body.bytesAtClose != tc.wantRead {
				t.Fatalf("bytes read before close = %d, want %d", body.bytesAtClose, tc.wantRead)
			}
		})
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

func newTransportTestClient(t *testing.T, transport http.RoundTripper) *Client {
	t.Helper()
	client := newTestClient(t, "https://voyage.invalid").(*Client)
	client.http = &http.Client{Transport: transport}
	return client
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type observedBody struct {
	reader       *strings.Reader
	bytesRead    int
	bytesAtClose int
	sawEOF       bool
	closed       bool
}

func (b *observedBody) Read(p []byte) (int, error) {
	n, err := b.reader.Read(p)
	b.bytesRead += n
	if errors.Is(err, io.EOF) {
		b.sawEOF = true
	}
	return n, err
}

func (b *observedBody) Close() error {
	b.bytesAtClose = b.bytesRead
	b.closed = true
	return nil
}

type contextBody struct {
	ctx     context.Context
	started chan struct{}
	once    sync.Once
}

func (b *contextBody) Read([]byte) (int, error) {
	b.once.Do(func() { close(b.started) })
	<-b.ctx.Done()
	return 0, b.ctx.Err()
}

func (*contextBody) Close() error {
	return nil
}

type errorBody struct {
	err error
}

func (b *errorBody) Read([]byte) (int, error) {
	return 0, b.err
}

func (*errorBody) Close() error {
	return nil
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

// The curated listing must only offer models New would accept for the pinned embedding
// dimension — the console never sees a model the factory would then reject.
func TestListModelsOffersOnlyDimensionCompatibleModels(t *testing.T) {
	models, err := ListModels(context.Background(), ai.ProviderConfig{})
	if err != nil {
		t.Fatalf("ListModels: %v", err)
	}
	if len(models) == 0 {
		t.Fatal("curated list is empty")
	}
	seenDefault := false
	for i, m := range models {
		if i > 0 && models[i-1].ID >= m.ID {
			t.Errorf("list not sorted: %q before %q", models[i-1].ID, m.ID)
		}
		if m.ID == defaultModel {
			seenDefault = true
		}
		if _, err := New(ai.ProviderConfig{APIKey: "k", Model: m.ID}); err != nil {
			t.Errorf("listed model %q rejected by New: %v", m.ID, err)
		}
	}
	if !seenDefault {
		t.Errorf("curated list %+v does not include the default model %q", models, defaultModel)
	}
}
