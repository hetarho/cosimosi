// Package anthropic is the Anthropic Claude adapter for the internal/ai LLMClient
// capability. It owns vendor knowledge only — the SDK, auth, the model id, and the
// native structured-output mechanism — and normalizes every vendor failure into the
// internal/ai typed error set. It holds no prompt text, no domain DTO, and no
// knowledge of what any call is for.
package anthropic

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	sdk "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/cosimosi/api/internal/ai"
)

const providerName = "anthropic"

// defaultModel is the recorded Claude model for this seam. It is the latest Claude
// model at implement; override per deployment with COSIMOSI_LLM_MODEL.
const defaultModel = "claude-opus-4-8"

func init() {
	ai.RegisterLLMProvider(providerName, New)
}

// Client realizes ai.LLMClient over the Anthropic Messages API. Structured output is
// forced through the API's native json_schema output format, so the response body is
// guaranteed to match the requested schema or the request fails.
type Client struct {
	api   sdk.Client
	model sdk.Model
}

// New builds the adapter from vendor-neutral config. An empty key fails here (startup
// wiring), never at call time.
func New(cfg ai.ProviderConfig) (ai.LLMClient, error) {
	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		return nil, fmt.Errorf("anthropic: api key is required")
	}
	opts := []option.RequestOption{option.WithAPIKey(key)}
	if base := strings.TrimSpace(cfg.BaseURL); base != "" {
		opts = append(opts, option.WithBaseURL(base))
	}
	model := defaultModel
	if m := strings.TrimSpace(cfg.Model); m != "" {
		model = m
	}
	return &Client{api: sdk.NewClient(opts...), model: sdk.Model(model)}, nil
}

func (c *Client) CompleteJSON(ctx context.Context, req ai.LLMRequest) (ai.LLMResponse, error) {
	maxTokens := int64(req.MaxOutputTokens)
	if maxTokens <= 0 {
		// A non-positive cap is a caller/config bug — fail loudly instead of silently issuing
		// a 1-token request that would always truncate into malformed output.
		return ai.LLMResponse{}, fmt.Errorf("anthropic: MaxOutputTokens must be positive, got %d", req.MaxOutputTokens)
	}
	params := sdk.MessageNewParams{
		Model:     c.model,
		MaxTokens: maxTokens,
		Messages:  []sdk.MessageParam{sdk.NewUserMessage(sdk.NewTextBlock(req.Prompt))},
	}
	if len(req.OutputSchema) > 0 {
		params.OutputConfig = sdk.OutputConfigParam{
			Format: sdk.JSONOutputFormatParam{Schema: map[string]any(req.OutputSchema)},
		}
	}
	if req.UserID != "" {
		params.Metadata = sdk.MetadataParam{UserID: sdk.String(req.UserID)}
	}

	msg, err := c.api.Messages.New(ctx, params)
	if err != nil {
		return ai.LLMResponse{}, mapError(err)
	}

	body := responseText(msg)
	if strings.TrimSpace(body) == "" || !json.Valid([]byte(body)) {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{
			Provider: providerName,
			Err:      errors.New("response was not valid schema-conforming json"),
		}
	}
	return ai.LLMResponse{JSON: []byte(body)}, nil
}

func responseText(msg *sdk.Message) string {
	var b strings.Builder
	for _, block := range msg.Content {
		if block.Type == "text" {
			b.WriteString(block.Text)
		}
	}
	return b.String()
}

// mapError collapses every vendor failure into the internal/ai typed set: throttling,
// overload, and transport errors are retryable (rate-limited); auth rejections and any
// other terminal client error surface to ops (auth-failed). No vendor error escapes.
func mapError(err error) error {
	var apiErr *sdk.Error
	if errors.As(err, &apiErr) {
		// Retain a sanitized cause, not the vendor *sdk.Error — no vendor error type
		// escapes internal/ai (A5).
		cause := fmt.Errorf("anthropic status %d (request %s)", apiErr.StatusCode, apiErr.RequestID)
		switch apiErr.StatusCode {
		case http.StatusTooManyRequests, http.StatusRequestTimeout, http.StatusTooEarly:
			return &ai.RateLimitedError{Provider: providerName, RetryAfter: retryAfter(apiErr), Err: cause}
		case http.StatusUnauthorized, http.StatusForbidden:
			return &ai.AuthFailedError{Provider: providerName, Err: cause}
		default:
			if apiErr.StatusCode >= 500 {
				return &ai.RateLimitedError{Provider: providerName, Err: cause}
			}
			return &ai.AuthFailedError{Provider: providerName, Err: cause}
		}
	}
	// Transport-level failure before any response (timeout, connection reset) — retry.
	return &ai.RateLimitedError{Provider: providerName, Err: fmt.Errorf("anthropic transport error: %v", err)}
}

func retryAfter(apiErr *sdk.Error) time.Duration {
	if apiErr.Response == nil {
		return 0
	}
	seconds, err := strconv.Atoi(strings.TrimSpace(apiErr.Response.Header.Get("Retry-After")))
	if err != nil || seconds < 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}
