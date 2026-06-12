package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const geminiBaseURL = "https://generativelanguage.googleapis.com/v1beta/models/"

// geminiClient adapts Google's native Generative Language API ("gemini"
// provider). Structured output uses generationConfig.responseMimeType
// "application/json" + responseJsonSchema (a standard JSON Schema; unsupported
// keywords are silently ignored by the API, so code-side validation remains
// the real guarantee).
type geminiClient struct {
	apiKey string
	model  string
	http   *http.Client
}

func newGemini(apiKey, model string, httpClient *http.Client) *geminiClient {
	return &geminiClient{apiKey: apiKey, model: model, http: httpClient}
}

func (c *geminiClient) Model() string { return "gemini/" + c.model }

func (c *geminiClient) Complete(ctx context.Context, req Request) (Response, error) {
	type part struct {
		Text string `json:"text"`
	}
	body := map[string]any{
		"systemInstruction": map[string]any{"parts": []part{{Text: req.System}}},
		"contents": []map[string]any{
			{"role": "user", "parts": []part{{Text: req.User}}},
		},
	}
	genCfg := map[string]any{}
	if req.Schema != nil {
		genCfg["responseMimeType"] = "application/json"
		genCfg["responseJsonSchema"] = req.Schema.Raw
	}
	if req.MaxTokens > 0 {
		genCfg["maxOutputTokens"] = req.MaxTokens
	}
	if len(genCfg) > 0 {
		body["generationConfig"] = genCfg
	}

	url := geminiBaseURL + c.model + ":generateContent"
	respBody, err := postJSON(ctx, c.http, url, body, map[string]string{
		"x-goog-api-key": c.apiKey,
	}, "gemini")
	if err != nil {
		return Response{}, err
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		// usageMetadata is best-effort metering input (spec 34) — absent fields stay 0.
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return Response{}, fmt.Errorf("gemini: decode response: %w", err)
	}
	if len(parsed.Candidates) == 0 {
		return Response{}, fmt.Errorf("gemini: empty candidates")
	}
	var sb strings.Builder
	for _, p := range parsed.Candidates[0].Content.Parts {
		sb.WriteString(p.Text)
	}
	return Response{
		Text: sb.String(),
		Usage: Usage{
			InputTokens:  parsed.UsageMetadata.PromptTokenCount,
			OutputTokens: parsed.UsageMetadata.CandidatesTokenCount,
		},
	}, nil
}
