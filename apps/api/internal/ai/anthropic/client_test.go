package anthropic

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	sdk "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

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

func TestCompleteJSONPreservesCallerCancellation(t *testing.T) {
	started := make(chan struct{})
	client := newTransportTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		close(started)
		<-req.Context().Done()
		return nil, req.Context().Err()
	}))
	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() {
		_, err := client.CompleteJSON(ctx, ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
		errCh <- err
	}()
	<-started
	cancel()

	err := <-errCh
	if err != ctx.Err() {
		t.Fatalf("error = %v, want unchanged %v", err, ctx.Err())
	}
	if ai.IsRateLimited(err) {
		t.Fatalf("error = %v, caller cancellation must not be rate-limited", err)
	}
}

func TestCompleteJSONPreservesCallerDeadline(t *testing.T) {
	started := make(chan struct{})
	client := newTransportTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		close(started)
		<-req.Context().Done()
		return nil, req.Context().Err()
	}))
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	_, err := client.CompleteJSON(ctx, ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
	if err != ctx.Err() {
		t.Fatalf("error = %v, want unchanged %v", err, ctx.Err())
	}
	if ai.IsRateLimited(err) {
		t.Fatalf("error = %v, caller deadline must not be rate-limited", err)
	}
	select {
	case <-started:
	default:
		t.Fatal("request deadline expired before the transport started")
	}
}

func TestCompleteJSONPreservesGenuineTransportCause(t *testing.T) {
	cause := errors.New("connection reset")
	client := newTransportTestClient(roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, cause
	}))

	_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
	if !ai.IsRateLimited(err) {
		t.Fatalf("error = %v, want RateLimitedError", err)
	}
	if !errors.Is(err, cause) {
		t.Fatalf("error chain = %v, want transport cause", err)
	}
	var vendor *sdk.Error
	if errors.As(err, &vendor) {
		t.Fatalf("vendor *sdk.Error escaped internal/ai: %v", err)
	}
}

func TestCompleteJSONPreservesResponseBodyTransportCause(t *testing.T) {
	cause := errors.New("body connection reset")
	client := newTransportTestClient(roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       &errorBody{err: cause},
			Request:    req,
		}, nil
	}))

	_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
	if !ai.IsRateLimited(err) {
		t.Fatalf("error = %v, want RateLimitedError", err)
	}
	if !errors.Is(err, cause) {
		t.Fatalf("error chain = %v, want response-body transport cause", err)
	}
}

// newTestClient builds the adapter pointed at a fake server. Production New offers no
// endpoint override (the endpoint is adapter-owned, change 03), so the test constructs
// the Client directly with the SDK's base-URL option.
func newTestClient(t *testing.T, baseURL string) ai.LLMClient {
	t.Helper()
	return &Client{
		api:   sdk.NewClient(option.WithAPIKey("test-key"), option.WithBaseURL(baseURL)),
		model: defaultModel,
	}
}

func newTransportTestClient(transport http.RoundTripper) ai.LLMClient {
	return &Client{
		api: sdk.NewClient(
			option.WithAPIKey("test-key"),
			option.WithBaseURL("https://anthropic.invalid"),
			option.WithHTTPClient(&http.Client{Transport: transport}),
			option.WithMaxRetries(0),
		),
		model: defaultModel,
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type errorBody struct {
	err error
}

func (b *errorBody) Read([]byte) (int, error) {
	return 0, b.err
}

func (*errorBody) Close() error {
	return nil
}

func TestNewRequiresAPIKey(t *testing.T) {
	if _, err := New(ai.ProviderConfig{}); err == nil {
		t.Fatal("New with empty key succeeded, want error")
	}
}

// The success path of New is not covered by the CompleteJSON tests (they construct the
// Client directly to inject a fake endpoint), so cover its config handling here.
func TestNewSelectsModel(t *testing.T) {
	client, err := New(ai.ProviderConfig{APIKey: "k"})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	if got := client.(*Client).model; got != defaultModel {
		t.Fatalf("model = %q, want default %q", got, defaultModel)
	}
	client, err = New(ai.ProviderConfig{APIKey: "k", Model: "claude-custom"})
	if err != nil {
		t.Fatalf("New with model override failed: %v", err)
	}
	if got := client.(*Client).model; got != "claude-custom" {
		t.Fatalf("model = %q, want override", got)
	}
}

func TestListModelsFetchesVendorListAndNormalizesErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || !strings.Contains(r.URL.Path, "/models") {
			t.Errorf("request = %s %s, want GET …/models", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		// claude-old reports no structured-output support — CompleteJSON could never use it,
		// so the listing must drop it.
		_, _ = w.Write([]byte(`{"data":[{"type":"model","id":"claude-a","display_name":"Claude A","created_at":"2026-01-01T00:00:00Z","capabilities":{"structured_outputs":{"supported":true}}},{"type":"model","id":"claude-old","display_name":"Claude Old","created_at":"2024-01-01T00:00:00Z","capabilities":{"structured_outputs":{"supported":false}}},{"type":"model","id":"claude-b","display_name":"Claude B","created_at":"2026-01-01T00:00:00Z","capabilities":{"structured_outputs":{"supported":true}}}],"has_more":false,"first_id":"claude-a","last_id":"claude-b"}`))
	}))
	defer server.Close()

	models, err := listModels(context.Background(), ai.ProviderConfig{APIKey: "k"}, option.WithBaseURL(server.URL))
	if err != nil {
		t.Fatalf("listModels: %v", err)
	}
	want := []ai.ModelInfo{{ID: "claude-a", DisplayName: "Claude A"}, {ID: "claude-b", DisplayName: "Claude B"}}
	if len(models) != len(want) || models[0] != want[0] || models[1] != want[1] {
		t.Fatalf("models = %+v, want %+v (structured-output-unsupported model dropped)", models, want)
	}

	if _, err := listModels(context.Background(), ai.ProviderConfig{}); err == nil {
		t.Fatal("empty key was accepted")
	}

	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer failing.Close()
	var authErr *ai.AuthFailedError
	if _, err := listModels(context.Background(), ai.ProviderConfig{APIKey: "bad"}, option.WithBaseURL(failing.URL), option.WithMaxRetries(0)); !errors.As(err, &authErr) {
		t.Fatalf("401 err = %v, want AuthFailedError", err)
	}
}
