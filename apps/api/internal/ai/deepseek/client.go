// Package deepseek is the DeepSeek adapter for the internal/ai LLMClient
// capability. It owns vendor knowledge only — HTTP transport, auth, the model
// id, JSON Output, and error normalization — and holds no task prompt or domain
// DTO.
package deepseek

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
)

const providerName = "deepseek"

// deepseek-v4-flash is the current general-purpose value model. The legacy
// deepseek-chat alias is scheduled for retirement on 2026-07-24. Deployments can
// select another current DeepSeek model through COSIMOSI_LLM_MODEL.
const (
	defaultModel     = "deepseek-v4-flash"
	endpoint         = "https://api.deepseek.com/chat/completions"
	requestTimeout   = 60 * time.Second
	maxResponseBytes = 4 << 20
)

func init() {
	ai.RegisterLLMProvider(providerName, New)
}

// Client realizes ai.LLMClient over DeepSeek's OpenAI-compatible Chat
// Completions API.
type Client struct {
	apiKey   string
	model    string
	endpoint string // package endpoint in production; a field so tests can use a fake server
	http     *http.Client
}

// New builds the adapter from vendor-neutral config. The endpoint remains
// adapter-owned and cannot be changed through runtime provider configuration.
func New(cfg ai.ProviderConfig) (ai.LLMClient, error) {
	key := strings.TrimSpace(cfg.APIKey)
	if key == "" {
		return nil, fmt.Errorf("deepseek: api key is required")
	}
	model := defaultModel
	if configured := strings.TrimSpace(cfg.Model); configured != "" {
		model = configured
	}
	return &Client{
		apiKey:   key,
		model:    model,
		endpoint: endpoint,
		http:     &http.Client{Timeout: requestTimeout},
	}, nil
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequestBody struct {
	Model          string        `json:"model"`
	Messages       []chatMessage `json:"messages"`
	MaxTokens      int           `json:"max_tokens"`
	ResponseFormat struct {
		Type string `json:"type"`
	} `json:"response_format"`
	Thinking struct {
		Type string `json:"type"`
	} `json:"thinking"`
	UserID string `json:"user_id,omitempty"`
}

type chatResponseBody struct {
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Message      struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *Client) CompleteJSON(ctx context.Context, req ai.LLMRequest) (ai.LLMResponse, error) {
	if req.MaxOutputTokens <= 0 {
		return ai.LLMResponse{}, fmt.Errorf(
			"deepseek: MaxOutputTokens must be positive, got %d",
			req.MaxOutputTokens,
		)
	}

	systemPrompt, err := structuredOutputPrompt(req.OutputSchema)
	if err != nil {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{
			Provider: providerName,
			Err:      fmt.Errorf("encode output schema: %w", err),
		}
	}
	body := chatRequestBody{
		Model:     c.model,
		Messages:  []chatMessage{{Role: "system", Content: systemPrompt}, {Role: "user", Content: req.Prompt}},
		MaxTokens: req.MaxOutputTokens,
		UserID:    req.UserID,
	}
	body.ResponseFormat.Type = "json_object"
	// V4 enables thinking by default. These short structured tasks do not need
	// hidden reasoning tokens, so explicitly select the documented non-thinking mode.
	body.Thinking.Type = "disabled"

	payload, err := json.Marshal(body)
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
		return ai.LLMResponse{}, &ai.RateLimitedError{
			Provider: providerName,
			Err:      fmt.Errorf("deepseek transport error: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ai.LLMResponse{}, mapStatus(resp)
	}

	rawResponse, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{Provider: providerName, Err: err}
	}
	if len(rawResponse) > maxResponseBytes {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{
			Provider: providerName,
			Err:      fmt.Errorf("response exceeds %d bytes", maxResponseBytes),
		}
	}
	var decoded chatResponseBody
	if err := json.Unmarshal(rawResponse, &decoded); err != nil {
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{Provider: providerName, Err: err}
	}
	if len(decoded.Choices) == 0 {
		return ai.LLMResponse{}, malformed("response contained no choices")
	}

	choice := decoded.Choices[0]
	if choice.FinishReason == "insufficient_system_resource" {
		return ai.LLMResponse{}, &ai.RateLimitedError{
			Provider: providerName,
			Err:      fmt.Errorf("deepseek finish reason %q", choice.FinishReason),
		}
	}
	content := []byte(strings.TrimSpace(choice.Message.Content))
	var object map[string]json.RawMessage
	if err := json.Unmarshal(content, &object); err != nil || object == nil {
		if err == nil {
			err = fmt.Errorf("response was not a JSON object")
		}
		return ai.LLMResponse{}, &ai.MalformedStructuredOutputError{Provider: providerName, Err: err}
	}
	return ai.LLMResponse{JSON: content}, nil
}

func structuredOutputPrompt(schema ai.JSONSchema) (string, error) {
	const instruction = "Return only one valid JSON object. Do not include Markdown or commentary."
	if len(schema) == 0 {
		return instruction, nil
	}
	encoded, err := json.Marshal(schema)
	if err != nil {
		return "", err
	}
	return instruction + " The object must match this JSON Schema exactly:\n" + string(encoded), nil
}

func malformed(message string) error {
	return &ai.MalformedStructuredOutputError{
		Provider: providerName,
		Err:      fmt.Errorf("%s", message),
	}
}

// mapStatus collapses every non-200 DeepSeek response into the shared typed set.
// The documented 429 and 5xx failures are retryable; authentication, balance,
// malformed-request, and other terminal client failures require operator action.
func mapStatus(resp *http.Response) error {
	cause := fmt.Errorf("deepseek status %d", resp.StatusCode)
	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return &ai.RateLimitedError{
			Provider:   providerName,
			RetryAfter: retryAfter(resp),
			Err:        cause,
		}
	}
	return &ai.AuthFailedError{Provider: providerName, Err: cause}
}

func retryAfter(resp *http.Response) time.Duration {
	seconds, err := strconv.Atoi(strings.TrimSpace(resp.Header.Get("Retry-After")))
	if err != nil || seconds < 0 {
		return 0
	}
	return time.Duration(seconds) * time.Second
}
