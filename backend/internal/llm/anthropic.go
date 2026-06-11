package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const (
	anthropicURL     = "https://api.anthropic.com/v1/messages"
	anthropicVersion = "2023-06-01"
	// Anthropic requires max_tokens on every request; used when Request.MaxTokens is 0.
	anthropicDefaultMaxTokens = 4096
)

// anthropicClient adapts the Anthropic Messages API ("claude" provider).
// Structured output uses output_config.format json_schema (GA on Opus 4.8 /
// Sonnet 4.6 / Haiku 4.5). Note Anthropic's structured outputs reject numeric
// and complex array constraints — the portable-schema rule in llm.Schema exists
// largely because of this adapter.
type anthropicClient struct {
	apiKey string
	model  string
	http   *http.Client
}

func newAnthropic(apiKey, model string, httpClient *http.Client) *anthropicClient {
	return &anthropicClient{apiKey: apiKey, model: model, http: httpClient}
}

func (c *anthropicClient) Model() string { return "claude/" + c.model }

func (c *anthropicClient) Complete(ctx context.Context, req Request) (Response, error) {
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = anthropicDefaultMaxTokens
	}
	body := map[string]any{
		"model":      c.model,
		"max_tokens": maxTokens,
		"system":     req.System,
		"messages": []map[string]string{
			{"role": "user", "content": req.User},
		},
	}
	if req.Schema != nil {
		body["output_config"] = map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"schema": req.Schema.Raw,
			},
		}
	}

	respBody, err := postJSON(ctx, c.http, anthropicURL, body, map[string]string{
		"x-api-key":         c.apiKey,
		"anthropic-version": anthropicVersion,
	}, "claude")
	if err != nil {
		return Response{}, err
	}

	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return Response{}, fmt.Errorf("claude: decode response: %w", err)
	}
	for _, block := range parsed.Content {
		if block.Type == "text" {
			return Response{Text: block.Text}, nil
		}
	}
	// No text block (e.g. a refusal): hand back empty text — the caller's
	// content validation treats it as unusable and falls back (concept §4.6).
	return Response{Text: ""}, nil
}
