// Package openrouter is the OpenRouter adapter for the internal/ai LLMClient capability (AI-11).
// It owns vendor knowledge only — HTTP transport, auth, the explicit model id, native structured
// output, privacy routing, model listing and error normalization — and holds no task prompt or
// domain DTO.
package openrouter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

const providerName = "openrouter"

const (
	// Adapter-owned endpoints (AI-16): never env, DB or console configuration.
	endpoint       = "https://openrouter.ai/api/v1/chat/completions"
	modelsEndpoint = "https://openrouter.ai/api/v1/models"
	// Structural transport limits bound vendor-controlled payload memory and drain enough error
	// bytes to preserve connection reuse; they are not product tuning.
	maxResponseBytes       = 4 << 20
	maxErrorBodyDrainBytes = 64 << 10
)

func init() {
	ai.RegisterLLMProvider(providerName, New)
	ai.RegisterLLMModelLister(providerName, ListModels)
}

// Client realizes ai.LLMClient over OpenRouter's OpenAI-compatible Chat Completions API.
type Client struct {
	apiKey string
	// model is the one explicit `vendor/model` every request names; accepted answers either
	// echo it or the catalog's canonical slug for it.
	model         string
	canonicalSlug string
	endpoint      string // package endpoint in production; a field so tests can use a fake server
	http          *http.Client
}

// New builds the production adapter. There is no default LLM model: an empty or non-allowlisted
// model fails here, so a real build can only reach a model an approved evaluation admitted
// (AI-17, AI-19).
func New(cfg ai.ProviderConfig) (ai.LLMClient, error) {
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		return nil, fmt.Errorf("openrouter: an explicit allowlisted vendor/model is required")
	}
	entry, ok := approved(model)
	if !ok {
		return nil, fmt.Errorf("openrouter: model %q is not in the curated allowlist", model)
	}
	return newClient(cfg, entry.ID, entry.CanonicalSlug)
}

// newClient builds the transport for one explicit model without consulting the allowlist. Only the
// production factory and the evaluation harness (through export_test.go) reach it.
func newClient(cfg ai.ProviderConfig, model string, canonicalSlug string) (*Client, error) {
	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		return nil, fmt.Errorf("openrouter: api key is required")
	}
	if strings.TrimSpace(model) == "" {
		return nil, fmt.Errorf("openrouter: an explicit vendor/model is required")
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		// Direct package callers own their context deadline. Production roots always inject a
		// client with an explicit deployment timeout.
		httpClient = http.DefaultClient
	}
	return &Client{
		apiKey:        key,
		model:         strings.TrimSpace(model),
		canonicalSlug: strings.TrimSpace(canonicalSlug),
		endpoint:      endpoint,
		http:          httpClient,
	}, nil
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type jsonSchemaFormat struct {
	Name   string        `json:"name"`
	Strict bool          `json:"strict"`
	Schema ai.JSONSchema `json:"schema"`
}

type responseFormat struct {
	Type       string            `json:"type"`
	JSONSchema *jsonSchemaFormat `json:"json_schema,omitempty"`
}

// providerPreferences are the routing controls every completion carries (AI-20, AI-21): request-level
// zero data retention, no data-collecting endpoint, every supplied parameter required of the serving
// endpoint, and fallback only among endpoints of the one selected model.
type providerPreferences struct {
	ZDR               bool   `json:"zdr"`
	DataCollection    string `json:"data_collection"`
	RequireParameters bool   `json:"require_parameters"`
	AllowFallbacks    bool   `json:"allow_fallbacks"`
}

// chatRequestBody names exactly one model. It has no `models` list, route, preset or plugin
// field, and carries no vendor key: none of them can be sent (AI-20).
type chatRequestBody struct {
	Model          string              `json:"model"`
	Messages       []chatMessage       `json:"messages"`
	MaxTokens      int                 `json:"max_tokens"`
	ResponseFormat responseFormat      `json:"response_format"`
	Provider       providerPreferences `json:"provider"`
	User           string              `json:"user,omitempty"`
}

type chatResponseBody struct {
	Model   string `json:"model"`
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func requestBody(model string, req ai.LLMRequest) chatRequestBody {
	body := chatRequestBody{
		Model:     model,
		Messages:  []chatMessage{{Role: "user", Content: req.Prompt}},
		MaxTokens: req.MaxOutputTokens,
		Provider: providerPreferences{
			ZDR:               true,
			DataCollection:    "deny",
			RequireParameters: true,
			AllowFallbacks:    true,
		},
		User: req.UserID,
	}
	if len(req.OutputSchema) > 0 {
		body.ResponseFormat = responseFormat{
			Type: "json_schema",
			JSONSchema: &jsonSchemaFormat{
				Name:   "output",
				Strict: true,
				Schema: req.OutputSchema,
			},
		}
	} else {
		body.ResponseFormat = responseFormat{Type: "json_object"}
	}
	return body
}

func (c *Client) CompleteJSON(ctx context.Context, req ai.LLMRequest) (ai.LLMResponse, error) {
	if req.MaxOutputTokens <= 0 {
		return ai.LLMResponse{}, fmt.Errorf(
			"openrouter: MaxOutputTokens must be positive, got %d",
			req.MaxOutputTokens,
		)
	}
	// Native structured output is defense in depth, never the trust boundary (AI-7): compile the
	// whole requested schema before the billable request and validate the answer locally below.
	compiledSchema, err := compileSchema(req.OutputSchema)
	if err != nil {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{
			Provider: providerName,
			Err:      fmt.Errorf("compile output schema: %w", err),
		}
	}
	payload, err := json.Marshal(requestBody(c.model, req))
	if err != nil {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{
			Provider: providerName,
			Err:      fmt.Errorf("encode request: %w", err),
		}
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return ai.LLMResponse{}, &ai.RateLimitedError{Provider: providerName, Err: err}
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.LLMResponse{}, ctxErr
		}
		return ai.LLMResponse{}, &ai.RateLimitedError{
			Provider: providerName,
			Err:      fmt.Errorf("openrouter transport error: %w", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		drainErrorBody(resp.Body)
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.LLMResponse{}, ctxErr
		}
		return ai.LLMResponse{}, mapStatus(resp)
	}

	rawResponse, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ai.LLMResponse{}, ctxErr
		}
		return ai.LLMResponse{}, &ai.RateLimitedError{
			Provider: providerName,
			Err:      fmt.Errorf("openrouter response body read: %w", err),
		}
	}
	if len(rawResponse) > maxResponseBytes {
		return ai.LLMResponse{}, malformed(fmt.Sprintf("response exceeds %d bytes", maxResponseBytes))
	}
	var decoded chatResponseBody
	if err := json.Unmarshal(rawResponse, &decoded); err != nil {
		return ai.LLMResponse{}, malformed("response body is not JSON")
	}
	// A substituted model's answer never crosses LLMClient (AI-21): model choice decides quality,
	// behaviour and price, so a response from any other model is not this call's answer.
	if !c.answeredBy(decoded.Model) {
		return ai.LLMResponse{}, malformed("response came from a model other than the one selected")
	}
	// Exactly one finished choice (AI-7): a truncated, filtered or tool-call body can still be valid
	// JSON, so accepting it would cache a silent wrong result for identical input.
	if len(decoded.Choices) != 1 {
		return ai.LLMResponse{}, malformed(fmt.Sprintf("response carried %d choices, want 1", len(decoded.Choices)))
	}
	choice := decoded.Choices[0]
	if choice.FinishReason != "stop" {
		return ai.LLMResponse{}, malformed(fmt.Sprintf("non-stop finish reason %q", choice.FinishReason))
	}
	content := []byte(strings.TrimSpace(choice.Message.Content))
	if len(content) == 0 {
		return ai.LLMResponse{}, malformed("response content was empty")
	}
	instance, err := jsonschema.UnmarshalJSON(bytes.NewReader(content))
	if err != nil {
		return ai.LLMResponse{}, malformed("response content is not JSON")
	}
	if _, isObject := instance.(map[string]any); !isObject {
		return ai.LLMResponse{}, malformed("response was not a JSON object")
	}
	if compiledSchema != nil {
		// The validator's message can quote the answer, which can quote the diary: the cause says
		// only that it failed (AI-9).
		if err := compiledSchema.Validate(instance); err != nil {
			return ai.LLMResponse{}, malformed("response violates the requested output schema")
		}
	}
	return ai.LLMResponse{JSON: content}, nil
}

// answeredBy reports whether a completion's model field names the selected model, by its request
// id or its canonical slug. An empty field is not a match: it cannot vouch for the answer.
func (c *Client) answeredBy(returned string) bool {
	returned = strings.TrimSpace(returned)
	if returned == "" {
		return false
	}
	if strings.EqualFold(returned, c.model) {
		return true
	}
	return c.canonicalSlug != "" && strings.EqualFold(returned, c.canonicalSlug)
}

// compileSchema turns the vendor-neutral requested schema into a validator. It returns (nil, nil)
// for an empty schema (the caller keeps the JSON-object-only check). The schema map carries Go-native
// types; round-tripping through JSON canonicalizes them to the values the validator expects.
func compileSchema(schema ai.JSONSchema) (*jsonschema.Schema, error) {
	if len(schema) == 0 {
		return nil, nil
	}
	encoded, err := json.Marshal(schema)
	if err != nil {
		return nil, err
	}
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	compiler := jsonschema.NewCompiler()
	const schemaURI = "mem://openrouter/output-schema.json"
	if err := compiler.AddResource(schemaURI, doc); err != nil {
		return nil, err
	}
	return compiler.Compile(schemaURI)
}

func malformed(message string) error {
	return &ai.MalformedStructuredOutputError{
		Provider: providerName,
		Err:      fmt.Errorf("%s", message),
	}
}

func drainErrorBody(body io.Reader) {
	// The extra byte lets an exact-threshold body reach its underlying EOF while still bounding a
	// larger vendor response. The body itself never crosses the adapter (AI-22).
	_, _ = io.Copy(io.Discard, io.LimitReader(body, maxErrorBodyDrainBytes+1))
}

// mapStatus collapses every non-200 OpenRouter response into the shared typed set (AI-22). Only the
// status crosses; the envelope's message, metadata and body never do.
func mapStatus(resp *http.Response) error {
	cause := fmt.Errorf("openrouter status %d", resp.StatusCode)
	switch {
	case resp.StatusCode == http.StatusTooManyRequests,
		resp.StatusCode == http.StatusRequestTimeout,
		resp.StatusCode >= 500:
		return &ai.RateLimitedError{
			Provider:   providerName,
			RetryAfter: retryAfter(resp),
			Err:        cause,
		}
	default:
		// 401, 403 and 402 (credits exhausted) need an operator; so does any other request the
		// provider will keep rejecting. Credit exhaustion is never the local CostLimitError.
		return &ai.AuthFailedError{Provider: providerName, Err: cause}
	}
}

// retryAfter accepts only a non-negative delta-seconds value; an HTTP-date or garbage reads as none.
func retryAfter(resp *http.Response) time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(resp.Header.Get("Retry-After")))
	if err != nil || seconds < 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}
