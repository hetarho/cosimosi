// Package voyage is the Voyage AI adapter for the internal/ai EmbeddingClient
// capability (Anthropic has no embedding API; Voyage is its recommended partner).
// It owns vendor knowledge only — HTTP transport, auth, the model id, and the
// output-dimension contract — and normalizes every vendor failure into the
// internal/ai typed error set. There is no official Voyage Go SDK, so this is plain
// HTTP.
package voyage

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/platform/values"
)

const providerName = "voyage"

// defaultModel is the recorded Voyage model for this seam. voyage-4 defaults to a
// 1024-dimension vector and supports the output_dimension parameter for others.
// endpoint is adapter-owned vendor knowledge: it is not config — not env,
// not DB, not admin-editable. A self-hosted/proxy override, if ever needed, would be
// this adapter's own deliberate env seam.
const (
	defaultModel = "voyage-4"
	endpoint     = "https://api.voyageai.com/v1/embeddings"
	// Structural drain bound preserves connection reuse without buffering an
	// unbounded vendor error body; it is not product tuning.
	maxErrorBodyDrainBytes = 64 << 10
	// inputTypeDocument marks these as stored (recall/search) embeddings, not queries.
	inputTypeDocument = "document"
)

// modelDimensions records, per Voyage model, the output dimensions it can honor. A
// model absent from this table is rejected at construction rather than guessed at.
// Multi-value entries support the output_dimension request parameter; single-value
// entries have a fixed native dimension and reject output_dimension.
//
// The catalog is deliberately ONE GENERATION WIDE. Cosine similarity is only meaningful
// within a single embedding space, and `embeddings` stores one vector per neuron with no
// model column — so a catalog spanning generations lets a config change quietly seed
// incomparable vectors into the same HNSW index, silently degrading the [E10] dedup kNN
// and the encode.dedup_similarity_threshold tuned against it. The voyage-4 family shares
// one embedding space across its three sizes, so switching among THESE is safe. Widening
// this table to another generation is not a catalog edit — it requires re-embedding every
// stored row and re-tuning the threshold.
var modelDimensions = map[string][]int{
	"voyage-4-large": {256, 512, 1024, 2048},
	"voyage-4":       {256, 512, 1024, 2048},
	"voyage-4-lite":  {256, 512, 1024, 2048},
}

func init() {
	ai.RegisterEmbeddingProvider(providerName, New)
	ai.RegisterEmbeddingModelLister(providerName, ListModels)
}

// ListModels answers from the adapter-owned modelDimensions catalog — Voyage has no public
// model-listing endpoint — filtered to the models New would accept for values.AiEmbeddingDim,
// so the console never offers a model the factory would then reject.
func ListModels(_ context.Context, _ ai.ProviderConfig) ([]ai.ModelInfo, error) {
	out := make([]ai.ModelInfo, 0, len(modelDimensions))
	for model, supported := range modelDimensions {
		if !contains(supported, values.AiEmbeddingDim) {
			continue
		}
		out = append(out, ai.ModelInfo{ID: model})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

type Client struct {
	apiKey              string
	model               string
	dim                 int
	endpoint            string // always the package endpoint const; a field only so tests can point at a fake server
	sendOutputDimension bool
	http                *http.Client
}

// New builds the adapter and enforces the output-dimension contract at startup wiring:
// a model that cannot produce values.AiEmbeddingDim fails here, never at row-insert
// time.
func New(cfg ai.ProviderConfig) (ai.EmbeddingClient, error) {
	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		return nil, fmt.Errorf("voyage: api key is required")
	}
	model := defaultModel
	if m := strings.TrimSpace(cfg.Model); m != "" {
		model = m
	}
	supported, ok := modelDimensions[model]
	if !ok {
		return nil, fmt.Errorf("voyage: model %q is not a known embedding model", model)
	}
	dim := values.AiEmbeddingDim
	if !contains(supported, dim) {
		return nil, fmt.Errorf("voyage: model %q cannot produce dimension %d", model, dim)
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		// Direct package callers own their context deadline. Production roots always inject
		// a client with an explicit deployment timeout.
		httpClient = http.DefaultClient
	}
	return &Client{
		apiKey:              key,
		model:               model,
		dim:                 dim,
		endpoint:            endpoint,
		sendOutputDimension: len(supported) > 1,
		http:                httpClient,
	}, nil
}

type embedRequestBody struct {
	Input           []string `json:"input"`
	Model           string   `json:"model"`
	InputType       string   `json:"input_type"`
	OutputDimension int      `json:"output_dimension,omitempty"`
}

type embedResponseBody struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
}

func (c *Client) Embed(ctx context.Context, req ai.EmbeddingRequest) (ai.EmbeddingResponse, error) {
	body := embedRequestBody{
		Input:     req.Texts,
		Model:     c.model,
		InputType: inputTypeDocument,
	}
	if c.sendOutputDimension {
		body.OutputDimension = c.dim
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return ai.EmbeddingResponse{}, &ai.MalformedStructuredOutputError{Provider: providerName, Err: err}
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return ai.EmbeddingResponse{}, &ai.RateLimitedError{Provider: providerName, Err: err}
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.EmbeddingResponse{}, ctxErr
		}
		return ai.EmbeddingResponse{}, &ai.RateLimitedError{Provider: providerName, Err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		drainErrorBody(resp.Body)
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.EmbeddingResponse{}, ctxErr
		}
		return ai.EmbeddingResponse{}, mapStatus(resp)
	}

	reader := &errorRecordingReader{reader: resp.Body}
	var decoded embedResponseBody
	if err := json.NewDecoder(reader).Decode(&decoded); err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.EmbeddingResponse{}, ctxErr
		}
		if reader.err != nil {
			return ai.EmbeddingResponse{}, &ai.RateLimitedError{
				Provider: providerName,
				Err:      fmt.Errorf("voyage response body read: %w", reader.err),
			}
		}
		return ai.EmbeddingResponse{}, &ai.MalformedStructuredOutputError{Provider: providerName, Err: err}
	}
	if len(decoded.Data) != len(req.Texts) {
		return ai.EmbeddingResponse{}, &ai.MalformedStructuredOutputError{
			Provider: providerName,
			Err:      fmt.Errorf("voyage returned %d vectors for %d inputs", len(decoded.Data), len(req.Texts)),
		}
	}

	sort.Slice(decoded.Data, func(i, j int) bool { return decoded.Data[i].Index < decoded.Data[j].Index })
	vectors := make([][]float32, len(decoded.Data))
	for i, item := range decoded.Data {
		// The count matched, but a duplicated or gapped index would misalign vectors
		// with their input text — after sorting the indices must be exactly 0..n-1.
		if item.Index != i {
			return ai.EmbeddingResponse{}, &ai.MalformedStructuredOutputError{
				Provider: providerName,
				Err:      fmt.Errorf("voyage returned non-contiguous vector indices"),
			}
		}
		if len(item.Embedding) != c.dim {
			return ai.EmbeddingResponse{}, &ai.MalformedStructuredOutputError{
				Provider: providerName,
				Err:      fmt.Errorf("voyage vector %d has dimension %d, want %d", i, len(item.Embedding), c.dim),
			}
		}
		vectors[i] = item.Embedding
	}
	return ai.EmbeddingResponse{Vectors: vectors}, nil
}

func drainErrorBody(body io.Reader) {
	// The extra byte lets an exact-threshold body reach its underlying EOF while
	// still bounding a larger vendor response.
	_, _ = io.Copy(io.Discard, io.LimitReader(body, maxErrorBodyDrainBytes+1))
}

type errorRecordingReader struct {
	reader io.Reader
	err    error
}

func (r *errorRecordingReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	if err != nil && !errors.Is(err, io.EOF) {
		r.err = err
	}
	return n, err
}

// mapStatus collapses a non-200 Voyage response into the typed set: throttling and
// server errors are retryable; auth rejections and other client errors are terminal.
func mapStatus(resp *http.Response) error {
	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return &ai.RateLimitedError{Provider: providerName, RetryAfter: retryAfter(resp)}
	case http.StatusUnauthorized, http.StatusForbidden:
		return &ai.AuthFailedError{Provider: providerName, Err: fmt.Errorf("voyage status %d", resp.StatusCode)}
	default:
		if resp.StatusCode >= 500 {
			return &ai.RateLimitedError{Provider: providerName, Err: fmt.Errorf("voyage status %d", resp.StatusCode)}
		}
		return &ai.AuthFailedError{Provider: providerName, Err: fmt.Errorf("voyage status %d", resp.StatusCode)}
	}
}

func retryAfter(resp *http.Response) time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(resp.Header.Get("Retry-After")))
	if err != nil || seconds < 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}

func contains(values []int, want int) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}
