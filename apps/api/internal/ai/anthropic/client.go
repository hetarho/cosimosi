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

// modelListLimit is one page's worth of the vendor's model catalog — far above the number of
// models Anthropic serves, so a single request covers the full set.
const modelListLimit = 100

func init() {
	ai.RegisterLLMProvider(providerName, New)
	ai.RegisterLLMModelLister(providerName, ListModels)
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
	// No endpoint option: the SDK default is the adapter-owned endpoint.
	model := defaultModel
	if m := strings.TrimSpace(cfg.Model); m != "" {
		model = m
	}
	return &Client{api: sdk.NewClient(option.WithAPIKey(key)), model: sdk.Model(model)}, nil
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
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.LLMResponse{}, ctxErr
		}
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
		// escapes internal/ai.
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
	return &ai.RateLimitedError{Provider: providerName, Err: fmt.Errorf("anthropic transport error: %w", err)}
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

// ListModels fetches the model ids Anthropic currently serves through the SDK's model-listing
// API, with the same vendor-error normalization as CompleteJSON.
func ListModels(ctx context.Context, cfg ai.ProviderConfig) ([]ai.ModelInfo, error) {
	return listModels(ctx, cfg)
}

func listModels(ctx context.Context, cfg ai.ProviderConfig, opts ...option.RequestOption) ([]ai.ModelInfo, error) {
	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		return nil, fmt.Errorf("anthropic: api key is required")
	}
	client := sdk.NewClient(append([]option.RequestOption{option.WithAPIKey(key)}, opts...)...)
	page, err := client.Models.List(ctx, sdk.ModelListParams{Limit: sdk.Int(modelListLimit)})
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return nil, ctxErr
		}
		return nil, mapError(err)
	}
	out := make([]ai.ModelInfo, 0, len(page.Data))
	for _, m := range page.Data {
		id := strings.TrimSpace(m.ID)
		if id == "" {
			continue
		}
		// CompleteJSON forces the native structured-output format, so a model the vendor
		// reports as not supporting it would fail every call — never offer it (the same
		// only-what-the-adapter-accepts rule as voyage's dimension filter).
		if !m.Capabilities.StructuredOutputs.Supported {
			continue
		}
		out = append(out, ai.ModelInfo{ID: id, DisplayName: m.DisplayName})
	}
	return out, nil
}
