package openrouter

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
)

const testModel = "anthropic/claude-opus-4.8"

// A vendor message that must never cross the adapter, in any cause.
const vendorSecret = "diary text leaked by the vendor"

var testSchema = ai.JSONSchema{
	"type":                 "object",
	"required":             []string{"name"},
	"additionalProperties": false,
	"properties": map[string]any{
		"name": map[string]any{"type": "string", "minLength": 1},
	},
}

func testClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	client, err := newClient(ai.ProviderConfig{APIKey: "sk-test"}, testModel, "anthropic/claude-opus-4.8-20260801")
	if err != nil {
		t.Fatalf("newClient: %v", err)
	}
	client.endpoint = server.URL
	return client
}

func completion(model string, finish string, content string) string {
	body := map[string]any{
		"model": model,
		"choices": []map[string]any{{
			"finish_reason": finish,
			"message":       map[string]any{"content": content},
		}},
	}
	encoded, _ := json.Marshal(body)
	return string(encoded)
}

func request() ai.LLMRequest {
	return ai.LLMRequest{
		UserID:          "user-1",
		Prompt:          "split this diary",
		MaxOutputTokens: 512,
		OutputSchema:    testSchema,
	}
}

func TestCompleteJSONSendsOneModelWithTheWholeSchemaAndPrivacyRouting(t *testing.T) {
	var sent map[string]any
	client := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer sk-test" {
			t.Errorf("Authorization = %q", got)
		}
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &sent); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_, _ = io.WriteString(w, completion(testModel, "stop", `{"name":"market"}`))
	})

	response, err := client.CompleteJSON(context.Background(), request())
	if err != nil {
		t.Fatalf("CompleteJSON: %v", err)
	}
	if string(response.JSON) != `{"name":"market"}` {
		t.Fatalf("JSON = %s", response.JSON)
	}

	if sent["model"] != testModel {
		t.Fatalf("model = %v, want %s", sent["model"], testModel)
	}
	// Exactly one model, and nothing that could route to another (AI-20).
	for _, forbidden := range []string{"models", "route", "preset", "plugins", "transforms"} {
		if _, present := sent[forbidden]; present {
			t.Fatalf("request carries %q", forbidden)
		}
	}
	format := sent["response_format"].(map[string]any)
	schema := format["json_schema"].(map[string]any)
	if format["type"] != "json_schema" || schema["strict"] != true {
		t.Fatalf("response_format = %v", format)
	}
	wantSchema, _ := json.Marshal(testSchema)
	gotSchema, _ := json.Marshal(schema["schema"])
	if string(gotSchema) != string(wantSchema) {
		t.Fatalf("schema = %s, want the whole requested schema %s", gotSchema, wantSchema)
	}
	provider := sent["provider"].(map[string]any)
	if provider["zdr"] != true || provider["data_collection"] != "deny" ||
		provider["require_parameters"] != true || provider["allow_fallbacks"] != true {
		t.Fatalf("provider routing = %v", provider)
	}
	if sent["max_tokens"] != float64(512) || sent["user"] != "user-1" {
		t.Fatalf("max_tokens/user = %v/%v", sent["max_tokens"], sent["user"])
	}
}

func TestCompleteJSONAcceptsOnlyTheSelectedModel(t *testing.T) {
	for name, tc := range map[string]struct {
		returned string
		accepted bool
	}{
		"request id":         {returned: testModel, accepted: true},
		"canonical slug":     {returned: "anthropic/claude-opus-4.8-20260801", accepted: true},
		"case-folded id":     {returned: "Anthropic/Claude-Opus-4.8", accepted: true},
		"substituted model":  {returned: "deepseek/deepseek-v4-flash", accepted: false},
		"missing model name": {returned: "", accepted: false},
	} {
		t.Run(name, func(t *testing.T) {
			client := testClient(t, func(w http.ResponseWriter, _ *http.Request) {
				_, _ = io.WriteString(w, completion(tc.returned, "stop", `{"name":"market"}`))
			})
			_, err := client.CompleteJSON(context.Background(), request())
			if tc.accepted && err != nil {
				t.Fatalf("CompleteJSON: %v", err)
			}
			if !tc.accepted && !isMalformed(err) {
				t.Fatalf("err = %v, want MalformedStructuredOutputError", err)
			}
		})
	}
}

func TestCompleteJSONRejectsAnythingButOneFinishedConformingChoice(t *testing.T) {
	for name, body := range map[string]string{
		"no choices":       `{"model":"` + testModel + `","choices":[]}`,
		"two choices":      `{"model":"` + testModel + `","choices":[{"finish_reason":"stop","message":{"content":"{\"name\":\"a\"}"}},{"finish_reason":"stop","message":{"content":"{\"name\":\"b\"}"}}]}`,
		"length":           completion(testModel, "length", `{"name":"market"}`),
		"content filter":   completion(testModel, "content_filter", `{"name":"market"}`),
		"tool calls":       completion(testModel, "tool_calls", `{"name":"market"}`),
		"error finish":     completion(testModel, "error", `{"name":"market"}`),
		"empty finish":     completion(testModel, "", `{"name":"market"}`),
		"empty content":    completion(testModel, "stop", "  "),
		"malformed JSON":   completion(testModel, "stop", `{"name":`),
		"not an object":    completion(testModel, "stop", `["market"]`),
		"schema violation": completion(testModel, "stop", `{"name":""}`),
		"extra property":   completion(testModel, "stop", `{"name":"market","mood":"JOY"}`),
		"body is not JSON": "<html>gateway</html>",
		"empty body":       "",
	} {
		t.Run(name, func(t *testing.T) {
			client := testClient(t, func(w http.ResponseWriter, _ *http.Request) {
				_, _ = io.WriteString(w, body)
			})
			if _, err := client.CompleteJSON(context.Background(), request()); !isMalformed(err) {
				t.Fatalf("err = %v, want MalformedStructuredOutputError", err)
			}
		})
	}
}

func TestCompleteJSONBoundsAnOversizedBody(t *testing.T) {
	client := testClient(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"model":"`+testModel+`","choices":[{"finish_reason":"stop","message":{"content":"`)
		_, _ = io.WriteString(w, strings.Repeat("x", maxResponseBytes))
		_, _ = io.WriteString(w, `"}}]}`)
	})
	if _, err := client.CompleteJSON(context.Background(), request()); !isMalformed(err) {
		t.Fatalf("err = %v, want MalformedStructuredOutputError for an oversized body", err)
	}
}

func TestCompleteJSONMapsFailuresOntoTheTypedSet(t *testing.T) {
	for name, tc := range map[string]struct {
		status     int
		retryAfter string
		wantRetry  bool
		wantDelay  time.Duration
	}{
		"401 bad key":              {status: http.StatusUnauthorized},
		"403 forbidden model":      {status: http.StatusForbidden},
		"402 credits exhausted":    {status: http.StatusPaymentRequired},
		"400 rejected request":     {status: http.StatusBadRequest},
		"429 throttled":            {status: http.StatusTooManyRequests, retryAfter: "7", wantRetry: true, wantDelay: 7 * time.Second},
		"408 request timeout":      {status: http.StatusRequestTimeout, wantRetry: true},
		"500 upstream":             {status: http.StatusInternalServerError, wantRetry: true},
		"502 upstream":             {status: http.StatusBadGateway, wantRetry: true},
		"503 overloaded":           {status: http.StatusServiceUnavailable, retryAfter: "3", wantRetry: true, wantDelay: 3 * time.Second},
		"429 with an HTTP date":    {status: http.StatusTooManyRequests, retryAfter: "Wed, 21 Oct 2026 07:28:00 GMT", wantRetry: true},
		"429 with a negative hint": {status: http.StatusTooManyRequests, retryAfter: "-4", wantRetry: true},
	} {
		t.Run(name, func(t *testing.T) {
			client := testClient(t, func(w http.ResponseWriter, _ *http.Request) {
				if tc.retryAfter != "" {
					w.Header().Set("Retry-After", tc.retryAfter)
				}
				w.WriteHeader(tc.status)
				_, _ = io.WriteString(w, `{"error":{"code":`+http.StatusText(tc.status)+`,"message":"`+vendorSecret+`"}}`)
			})
			_, err := client.CompleteJSON(context.Background(), request())
			if strings.Contains(err.Error(), vendorSecret) {
				t.Fatalf("cause carries the vendor message: %v", err)
			}
			var rateLimited *ai.RateLimitedError
			var authFailed *ai.AuthFailedError
			if tc.wantRetry {
				if !errors.As(err, &rateLimited) {
					t.Fatalf("err = %v, want RateLimitedError", err)
				}
				if rateLimited.RetryAfter != tc.wantDelay {
					t.Fatalf("RetryAfter = %v, want %v", rateLimited.RetryAfter, tc.wantDelay)
				}
				return
			}
			if !errors.As(err, &authFailed) {
				t.Fatalf("err = %v, want AuthFailedError", err)
			}
			if ai.IsCostLimitError(err) {
				t.Fatalf("credit exhaustion must never read as the local cost cap: %v", err)
			}
		})
	}
}

func TestCompleteJSONKeepsCallerCancellationAndRetriesTransportFaults(t *testing.T) {
	release := make(chan struct{})
	client := testClient(t, func(_ http.ResponseWriter, r *http.Request) {
		select {
		case <-release:
		case <-r.Context().Done():
		}
	})
	defer close(release)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := client.CompleteJSON(ctx, request()); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled unchanged", err)
	}

	deadline, stop := context.WithTimeout(context.Background(), time.Nanosecond)
	defer stop()
	time.Sleep(time.Millisecond)
	if _, err := client.CompleteJSON(deadline, request()); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("err = %v, want context.DeadlineExceeded unchanged", err)
	}

	broken, err := newClient(ai.ProviderConfig{APIKey: "sk-test"}, testModel, "")
	if err != nil {
		t.Fatalf("newClient: %v", err)
	}
	broken.endpoint = "http://127.0.0.1:1"
	var rateLimited *ai.RateLimitedError
	if _, err := broken.CompleteJSON(context.Background(), request()); !errors.As(err, &rateLimited) {
		t.Fatalf("transport fault = %v, want RateLimitedError", err)
	}
}

func TestNewRefusesAnEmptyOrUnreviewedModel(t *testing.T) {
	for _, model := range []string{"", "  ", testModel, "openrouter/auto"} {
		if _, err := New(ai.ProviderConfig{APIKey: "sk-test", Model: model}); err == nil {
			t.Fatalf("New(%q) built a client the allowlist has not admitted", model)
		}
	}
	if _, err := newClient(ai.ProviderConfig{}, testModel, ""); err == nil {
		t.Fatal("newClient built a client without a key")
	}
}

func isMalformed(err error) bool {
	var malformed *ai.MalformedStructuredOutputError
	return errors.As(err, &malformed)
}
