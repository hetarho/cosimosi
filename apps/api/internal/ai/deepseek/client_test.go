package deepseek

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/cosimosi/api/internal/ai"
)

func TestCompleteJSONUsesDeepSeekJSONOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer key" {
			t.Errorf("Authorization = %q, want Bearer key", got)
		}
		var request chatRequestBody
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if request.Model != defaultModel {
			t.Errorf("model = %q, want %q", request.Model, defaultModel)
		}
		if request.MaxTokens != 1200 {
			t.Errorf("max_tokens = %d, want 1200", request.MaxTokens)
		}
		if request.ResponseFormat.Type != "json_object" {
			t.Errorf("response_format = %q, want json_object", request.ResponseFormat.Type)
		}
		if request.Thinking.Type != "disabled" {
			t.Errorf("thinking = %q, want disabled", request.Thinking.Type)
		}
		if request.UserID != "user-1" {
			t.Errorf("user_id = %q, want user-1", request.UserID)
		}
		if len(request.Messages) != 2 ||
			request.Messages[0].Role != "system" ||
			request.Messages[1] != (chatMessage{Role: "user", Content: "prompt"}) {
			t.Fatalf("messages = %#v, want system + original user prompt", request.Messages)
		}
		if !strings.Contains(request.Messages[0].Content, `"required":["ok"]`) {
			t.Errorf("system message does not carry output schema: %q", request.Messages[0].Content)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"{\"ok\":true}"}}]}`))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	resp, err := client.CompleteJSON(context.Background(), ai.LLMRequest{
		UserID:          "user-1",
		Prompt:          "prompt",
		MaxOutputTokens: 1200,
		OutputSchema: ai.JSONSchema{
			"type":       "object",
			"required":   []string{"ok"},
			"properties": map[string]any{"ok": map[string]any{"type": "boolean"}},
		},
	})
	if err != nil {
		t.Fatalf("CompleteJSON failed: %v", err)
	}
	if string(resp.JSON) != `{"ok":true}` {
		t.Fatalf("JSON = %q, want structured object", string(resp.JSON))
	}
}

func TestCompleteJSONRejectsMalformedResponses(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{"invalid envelope", `not json`},
		{"no choices", `{"choices":[]}`},
		{"empty content", `{"choices":[{"finish_reason":"stop","message":{"content":""}}]}`},
		{"non-object content", `{"choices":[{"finish_reason":"stop","message":{"content":"[]"}}]}`},
		{"invalid json content", `{"choices":[{"finish_reason":"stop","message":{"content":"no"}}]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()

			client := newTestClient(t, server.URL)
			_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{
				Prompt:          "prompt",
				MaxOutputTokens: 1200,
			})
			if !ai.IsMalformedStructuredOutput(err) {
				t.Fatalf("error = %v, want MalformedStructuredOutputError", err)
			}
		})
	}
}

func TestCompleteJSONMapsInsufficientSystemResourceAsRetryable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"insufficient_system_resource","message":{"content":""}}]}`))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
	if !ai.IsRateLimited(err) {
		t.Fatalf("error = %v, want RateLimitedError", err)
	}
}

func TestCompleteJSONMapsStatusErrors(t *testing.T) {
	cases := []struct {
		status int
		check  func(error) bool
	}{
		{http.StatusBadRequest, ai.IsAuthFailed},
		{http.StatusUnauthorized, ai.IsAuthFailed},
		{http.StatusPaymentRequired, ai.IsAuthFailed},
		{http.StatusUnprocessableEntity, ai.IsAuthFailed},
		{http.StatusTooManyRequests, ai.IsRateLimited},
		{http.StatusInternalServerError, ai.IsRateLimited},
		{http.StatusServiceUnavailable, ai.IsRateLimited},
	}
	for _, tc := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(tc.status)
		}))
		client := newTestClient(t, server.URL)
		_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
		if !tc.check(err) {
			t.Errorf("status %d: error = %v, not the expected typed error", tc.status, err)
		}
		server.Close()
	}
}

func TestMapStatusCarriesRetryAfterWithoutLeakingHTTPResponse(t *testing.T) {
	mapped := mapStatus(&http.Response{
		StatusCode: http.StatusTooManyRequests,
		Header:     http.Header{"Retry-After": []string{"5"}},
	})
	var rateLimited *ai.RateLimitedError
	if !errors.As(mapped, &rateLimited) {
		t.Fatalf("mapped = %v, want RateLimitedError", mapped)
	}
	if rateLimited.RetryAfter.Seconds() != 5 {
		t.Fatalf("RetryAfter = %v, want 5s", rateLimited.RetryAfter)
	}
}

func TestNewRequiresAPIKeyAndSelectsModel(t *testing.T) {
	if _, err := New(ai.ProviderConfig{}); err == nil {
		t.Fatal("New with empty key succeeded, want error")
	}
	client, err := New(ai.ProviderConfig{APIKey: " key "})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	if got := client.(*Client).model; got != defaultModel {
		t.Fatalf("model = %q, want default %q", got, defaultModel)
	}
	client, err = New(ai.ProviderConfig{APIKey: "key", Model: " deepseek-v4-pro "})
	if err != nil {
		t.Fatalf("New with model override failed: %v", err)
	}
	if got := client.(*Client).model; got != "deepseek-v4-pro" {
		t.Fatalf("model = %q, want override", got)
	}
}

func TestProviderRegistersWithFactory(t *testing.T) {
	if !ai.ImplementedLLM(providerName) {
		t.Fatal("deepseek adapter did not register with the LLM factory")
	}
	if err := ai.ValidateLLMProvider(providerName, defaultModel); err != nil {
		t.Fatalf("factory rejected registered deepseek provider: %v", err)
	}
}

func newTestClient(t *testing.T, baseURL string) *Client {
	t.Helper()
	client, err := New(ai.ProviderConfig{APIKey: "key"})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	deepseek := client.(*Client)
	deepseek.endpoint = baseURL
	return deepseek
}
