package anthropic

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	sdk "github.com/anthropics/anthropic-sdk-go"

	"github.com/cosimosi/api/internal/ai"
)

func TestMapErrorNormalizesVendorFailures(t *testing.T) {
	cases := []struct {
		name    string
		err     error
		check   func(error) bool
		checkID string
	}{
		{"rate limited", &sdk.Error{StatusCode: http.StatusTooManyRequests}, ai.IsRateLimited, "rate-limited"},
		{"auth 401", &sdk.Error{StatusCode: http.StatusUnauthorized}, ai.IsAuthFailed, "auth-failed"},
		{"auth 403", &sdk.Error{StatusCode: http.StatusForbidden}, ai.IsAuthFailed, "auth-failed"},
		{"server error retryable", &sdk.Error{StatusCode: http.StatusInternalServerError}, ai.IsRateLimited, "rate-limited"},
		{"other client error terminal", &sdk.Error{StatusCode: http.StatusBadRequest}, ai.IsAuthFailed, "auth-failed"},
		{"transport error retryable", errors.New("connection reset"), ai.IsRateLimited, "rate-limited"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mapped := mapError(tc.err)
			if !tc.check(mapped) {
				t.Fatalf("mapError(%v) = %v, want %s", tc.err, mapped, tc.checkID)
			}
			var vendor *sdk.Error
			if errors.As(mapped, &vendor) {
				t.Fatalf("vendor *sdk.Error escaped internal/ai: %v", mapped)
			}
		})
	}
}

func TestMapErrorCarriesRetryAfter(t *testing.T) {
	mapped := mapError(&sdk.Error{
		StatusCode: http.StatusTooManyRequests,
		Response:   &http.Response{Header: http.Header{"Retry-After": []string{"5"}}},
	})
	var rl *ai.RateLimitedError
	if !errors.As(mapped, &rl) {
		t.Fatalf("mapped = %v, want RateLimitedError", mapped)
	}
	if rl.RetryAfter.Seconds() != 5 {
		t.Fatalf("RetryAfter = %v, want 5s", rl.RetryAfter)
	}
}

func TestCompleteJSONReturnsSchemaConformingBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-4-8","content":[{"type":"text","text":"{\"ok\":true}"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}`))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	resp, err := client.CompleteJSON(context.Background(), ai.LLMRequest{
		Prompt:          "irrelevant",
		OutputSchema:    ai.JSONSchema{"type": "object"},
		MaxOutputTokens: 1200,
	})
	if err != nil {
		t.Fatalf("CompleteJSON failed: %v", err)
	}
	if string(resp.JSON) != `{"ok":true}` {
		t.Fatalf("body = %q, want structured json", string(resp.JSON))
	}
}

func TestCompleteJSONRejectsMalformedStructuredOutput(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-4-8","content":[{"type":"text","text":"not json"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}`))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	if _, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200}); !ai.IsMalformedStructuredOutput(err) {
		t.Fatalf("error = %v, want MalformedStructuredOutputError", err)
	}
}

func newTestClient(t *testing.T, baseURL string) ai.LLMClient {
	t.Helper()
	client, err := New(ai.ProviderConfig{APIKey: "test-key", BaseURL: baseURL})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	return client
}

func TestNewRequiresAPIKey(t *testing.T) {
	if _, err := New(ai.ProviderConfig{}); err == nil {
		t.Fatal("New with empty key succeeded, want error")
	}
}
