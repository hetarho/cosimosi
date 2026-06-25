package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// openAICompat is the generic adapter for OpenAI-compatible chat-completions
// APIs — one implementation covers openai, deepseek, and grok (spec 20), since
// they share the request/response envelope and differ only in base URL, model,
// and structured-output capability.
type openAICompat struct {
	provider string // for error messages: openai | deepseek | grok
	url      string
	apiKey   string
	model    string
	// jsonSchema: the provider enforces response_format json_schema (strict).
	// false (DeepSeek) degrades to json_object mode with the schema embedded in
	// the system prompt — the caller's validation/fallback covers the gap.
	jsonSchema bool
	// maxTokensField is the request field naming the completion cap —
	// "max_completion_tokens" on current OpenAI models, "max_tokens" elsewhere.
	maxTokensField string
	http           *http.Client
}

func newOpenAICompat(provider, url, apiKey, model string, jsonSchema bool, maxTokensField string, httpClient *http.Client) *openAICompat {
	return &openAICompat{
		provider:       provider,
		url:            url,
		apiKey:         apiKey,
		model:          model,
		jsonSchema:     jsonSchema,
		maxTokensField: maxTokensField,
		http:           httpClient,
	}
}

func (c *openAICompat) Model() string { return c.provider + "/" + c.model }

func (c *openAICompat) Complete(ctx context.Context, req Request) (Response, error) {
	system := req.System
	body := map[string]any{"model": c.model}
	if req.Schema != nil {
		if c.jsonSchema {
			body["response_format"] = map[string]any{
				"type": "json_schema",
				"json_schema": map[string]any{
					"name":   req.Schema.Name,
					"strict": true,
					"schema": req.Schema.Raw,
				},
			}
		} else {
			// json_object mode (DeepSeek): the schema rides in the prompt, and the
			// word "JSON" must appear in it (a documented json_object requirement).
			body["response_format"] = map[string]string{"type": "json_object"}
			system += "\n\nRespond with a single JSON object conforming to this JSON Schema:\n" + string(req.Schema.Raw)
		}
	}
	body["messages"] = []map[string]string{
		{"role": "system", "content": system},
		{"role": "user", "content": req.User},
	}
	if req.MaxTokens > 0 {
		body[c.maxTokensField] = req.MaxTokens
	}

	respBody, err := postJSON(ctx, c.http, c.url, body, map[string]string{
		"Authorization": "Bearer " + c.apiKey,
	}, c.provider)
	if err != nil {
		return Response{}, err
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		// usage is best-effort metering input (spec 34) — absent fields stay 0.
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return Response{}, fmt.Errorf("%s: decode response: %w", c.provider, err)
	}
	if len(parsed.Choices) == 0 {
		return Response{}, fmt.Errorf("%s: empty choices", c.provider)
	}
	return Response{
		Text:  parsed.Choices[0].Message.Content,
		Usage: Usage{InputTokens: parsed.Usage.PromptTokens, OutputTokens: parsed.Usage.CompletionTokens},
	}, nil
}

// postJSON is the shared HTTP helper for all adapters in this package:
// marshal, POST, surface non-2xx with a truncated body for diagnosis.
func postJSON(ctx context.Context, client *http.Client, url string, body any, headers map[string]string, provider string) ([]byte, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("%s: marshal request: %w", provider, err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("%s: new request: %w", provider, err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", provider, err)
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("%s: read response: %w", provider, err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		preview := respBody
		if len(preview) > 2048 {
			preview = preview[:2048]
		}
		return nil, fmt.Errorf("%s: status %d: %s", provider, resp.StatusCode, preview)
	}
	return respBody, nil
}
