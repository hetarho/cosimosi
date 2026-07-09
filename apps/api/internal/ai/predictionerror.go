package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/cosimosi/api/internal/memory"
)

// RealPredictionError is the prediction-error gate's LLM adapter ([R6]): a single
// schema-forced semantic compare answering "is the rewrite meaningfully different in
// CONTENT from the current text, ignoring wording, spacing, and word order?". It owns task
// knowledge only — the prompt and the bool schema; metering, caching, and the per-call cap
// live in the wrapped client (§2.4). The boundary is a semantic judgment carried in the
// prompt, so the port is a bool and there is no similarity threshold to tune — a numeric
// cutoff would be a false knob.
type RealPredictionError struct {
	client LLMClient
}

func NewRealPredictionError(client LLMClient) (*RealPredictionError, error) {
	if client == nil {
		return nil, ErrLLMClientRequired
	}
	return &RealPredictionError{client: client}, nil
}

func (a *RealPredictionError) Differs(ctx context.Context, currentText string, rewrite string) (bool, error) {
	resp, err := a.client.CompleteJSON(ctx, LLMRequest{
		Prompt:       predictionErrorPrompt(currentText, rewrite),
		OutputSchema: PredictionErrorOutputSchema(),
		CacheKey:     stableHash("prediction-error", currentText, rewrite),
		Validate:     func(body []byte) error { _, err := parsePredictionError(body); return err },
	})
	if err != nil {
		return false, err
	}
	return parsePredictionError(resp.JSON)
}

type predictionErrorJSON struct {
	Differs *bool `json:"differs"`
}

func parsePredictionError(raw []byte) (bool, error) {
	var envelope predictionErrorJSON
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return false, err
	}
	if envelope.Differs == nil {
		return false, errors.New("prediction-error response missing 'differs'")
	}
	return *envelope.Differs, nil
}

func PredictionErrorOutputSchema() JSONSchema {
	return JSONSchema{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"differs"},
		"properties": map[string]any{
			"differs": map[string]any{"type": "boolean"},
		},
	}
}

func predictionErrorPrompt(currentText string, rewrite string) string {
	return fmt.Sprintf(
		"Compare a remembered account against a person's rewrite of it. Answer only whether the rewrite is "+
			"meaningfully different in CONTENT — what happened, who was there, how it felt — and NOT merely "+
			"different in wording, spacing, or word order. Return only JSON matching the provided schema "+
			"({\"differs\": true|false}). Current: %q. Rewrite: %q",
		currentText, rewrite,
	)
}

// MockPredictionError is the keyless deterministic fallback so the recall loop is testable
// offline (matching the other mock adapters, which bypass metering). It approximates the
// content-vs-wording boundary with a set comparison of normalized word tokens: reordering,
// spacing, and case changes leave the token set unchanged (differs = false), while genuinely
// different words change it (differs = true). Deterministic in the inputs.
type MockPredictionError struct{}

func NewMockPredictionError() MockPredictionError {
	return MockPredictionError{}
}

func (MockPredictionError) Differs(_ context.Context, currentText string, rewrite string) (bool, error) {
	return tokenSignature(currentText) != tokenSignature(rewrite), nil
}

func tokenSignature(text string) string {
	tokens := bodyTokens(text)
	sort.Strings(tokens)
	return strings.Join(tokens, " ")
}

// Static assertions: both adapters satisfy the consumer-owned prediction-error port.
var (
	_ memory.PredictionError = (*RealPredictionError)(nil)
	_ memory.PredictionError = MockPredictionError{}
)
