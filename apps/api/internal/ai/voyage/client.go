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
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/platform/values"
)

const providerName = "voyage"

// defaultModel is the recorded Voyage model for this seam. voyage-3.5 defaults to a
// 1024-dimension vector and supports the output_dimension parameter for others.
const (
	defaultModel   = "voyage-3.5"
	defaultBaseURL = "https://api.voyageai.com/v1/embeddings"
	requestTimeout = 30 * time.Second
	// inputTypeDocument marks these as stored (recall/search) embeddings, not queries.
	inputTypeDocument = "document"
)

// modelDimensions records, per Voyage model, the output dimensions it can honor. A
// model absent from this table is rejected at construction rather than guessed at.
// Multi-value entries support the output_dimension request parameter; single-value
// entries have a fixed native dimension and reject output_dimension.
var modelDimensions = map[string][]int{
	"voyage-3.5":      {256, 512, 1024, 2048},
	"voyage-3.5-lite": {256, 512, 1024, 2048},
	"voyage-3-large":  {256, 512, 1024, 2048},
	"voyage-3":        {1024},
	"voyage-3-lite":   {512},
}

func init() {
	ai.RegisterEmbeddingProvider(providerName, New)
}

type Client struct {
	apiKey              string
	model               string
	dim                 int
	baseURL             string
	sendOutputDimension bool
	http                *http.Client
}

// New builds the adapter and enforces the output-dimension contract at startup wiring:
// a model that cannot produce values.AiEmbeddingDim fails here, never at row-insert
// time (A7).
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
	base := defaultBaseURL
	if b := strings.TrimSpace(cfg.BaseURL); b != "" {
		base = b
	}
	return &Client{
		apiKey:              key,
		model:               model,
		dim:                 dim,
		baseURL:             base,
		sendOutputDimension: len(supported) > 1,
		http:                &http.Client{Timeout: requestTimeout},
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

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(payload))
	if err != nil {
		return ai.EmbeddingResponse{}, &ai.RateLimitedError{Provider: providerName, Err: err}
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return ai.EmbeddingResponse{}, &ai.RateLimitedError{Provider: providerName, Err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ai.EmbeddingResponse{}, mapStatus(resp)
	}

	var decoded embedResponseBody
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
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
