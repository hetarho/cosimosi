package deepseek

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

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

func TestNewUsesInjectedHTTPClient(t *testing.T) {
	httpClient := &http.Client{}
	client, err := New(ai.ProviderConfig{APIKey: "key", HTTPClient: httpClient})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	if client.(*Client).http != httpClient {
		t.Fatal("New did not preserve the composition-root HTTP client")
	}
}

// The requested schema is enforced locally on the response (stable JSON Output guarantees only
// JSON syntax, not conformance), so a schema-violating object never crosses the LLMClient seam.
// The schema exercises the keywords the port adapters actually emit.
func TestCompleteJSONEnforcesRequestedSchema(t *testing.T) {
	schema := ai.JSONSchema{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"mood", "tags"},
		"properties": map[string]any{
			"mood": map[string]any{"type": "string", "enum": []string{"CALM", "TENSE"}},
			"tags": map[string]any{
				"type":     "array",
				"items":    map[string]any{"type": "string"},
				"minItems": 1,
				"maxItems": 2,
			},
		},
	}
	cases := []struct {
		name    string
		content string
		wantErr bool
	}{
		{"conforming", `{"mood":"CALM","tags":["a"]}`, false},
		{"conforming max items", `{"mood":"TENSE","tags":["a","b"]}`, false},
		{"missing required", `{"tags":["a"]}`, true},
		{"enum violation", `{"mood":"ECSTATIC","tags":["a"]}`, true},
		{"additional property", `{"mood":"CALM","tags":["a"],"extra":1}`, true},
		{"below minItems", `{"mood":"CALM","tags":[]}`, true},
		{"above maxItems", `{"mood":"CALM","tags":["a","b","c"]}`, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := stopContentServer(tc.content)
			defer server.Close()
			client := newTestClient(t, server.URL)
			resp, err := client.CompleteJSON(context.Background(), ai.LLMRequest{
				Prompt:          "prompt",
				MaxOutputTokens: 1200,
				OutputSchema:    schema,
			})
			if tc.wantErr {
				if !ai.IsMalformedStructuredOutput(err) {
					t.Fatalf("error = %v, want MalformedStructuredOutputError", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("CompleteJSON failed: %v", err)
			}
			if string(resp.JSON) != tc.content {
				t.Fatalf("JSON = %q, want %q", string(resp.JSON), tc.content)
			}
		})
	}
}

// An invalid requested schema is a malformed contract, rejected before the billable request.
func TestCompleteJSONRejectsInvalidRequestedSchema(t *testing.T) {
	called := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"stop","message":{"content":"{}"}}]}`))
	}))
	defer server.Close()

	client := newTestClient(t, server.URL)
	_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{
		Prompt:          "prompt",
		MaxOutputTokens: 1200,
		// "type" must be a string/array; a number is not a valid schema.
		OutputSchema: ai.JSONSchema{"type": 5},
	})
	if !ai.IsMalformedStructuredOutput(err) {
		t.Fatalf("error = %v, want MalformedStructuredOutputError", err)
	}
	if called {
		t.Error("an invalid requested schema must be rejected before the billable HTTP request")
	}
}

// Only finish_reason == "stop" yields content. A capacity failure is retryable; every other
// non-stop reason is malformed output even when the body is syntactically valid JSON.
func TestCompleteJSONGatesOnFinishReason(t *testing.T) {
	if _, err := runFinishReason(t, "insufficient_system_resource", `{}`); !ai.IsRateLimited(err) {
		t.Fatalf("insufficient_system_resource error = %v, want RateLimitedError", err)
	}
	for _, reason := range []string{"length", "content_filter", "tool_calls", "", "wat"} {
		t.Run("reason="+reason, func(t *testing.T) {
			// Syntactically valid object content — only the finish reason makes it unusable.
			if _, err := runFinishReason(t, reason, `{}`); !ai.IsMalformedStructuredOutput(err) {
				t.Fatalf("finish reason %q error = %v, want MalformedStructuredOutputError", reason, err)
			}
		})
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

func TestCompleteJSONPreservesCallerCancellation(t *testing.T) {
	started := make(chan struct{})
	client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
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
	client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
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
	client := newTransportTestClient(t, roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, cause
	}))

	_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
	if !ai.IsRateLimited(err) {
		t.Fatalf("error = %v, want RateLimitedError", err)
	}
	if !errors.Is(err, cause) {
		t.Fatalf("error chain = %v, want transport cause", err)
	}
}

func TestCompleteJSONPreservesResponseBodyTransportCause(t *testing.T) {
	cause := errors.New("body connection reset")
	client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
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

func TestCompleteJSONPreservesCancellationDuringResponseBodyRead(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusTooManyRequests} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			started := make(chan struct{})
			client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: status,
					Header:     make(http.Header),
					Body:       &contextBody{ctx: req.Context(), started: started},
					Request:    req,
				}, nil
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
				t.Fatalf("status %d error = %v, want unchanged %v", status, err, ctx.Err())
			}
			if ai.IsRateLimited(err) || ai.IsAuthFailed(err) || ai.IsMalformedStructuredOutput(err) {
				t.Fatalf("status %d error = %v, body-read cancellation must stay untyped", status, err)
			}
		})
	}
}

func TestCompleteJSONDrainsErrorBodyBeforeClose(t *testing.T) {
	cases := []struct {
		name       string
		body       string
		wantRead   int
		wantSawEOF bool
	}{
		{"small body reaches EOF", "provider details", len("provider details"), true},
		{
			"exact threshold reaches EOF",
			strings.Repeat("x", maxErrorBodyDrainBytes),
			maxErrorBodyDrainBytes,
			true,
		},
		{
			"oversized body stays bounded",
			strings.Repeat("x", maxErrorBodyDrainBytes+2),
			maxErrorBodyDrainBytes + 1,
			false,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body := &observedBody{reader: strings.NewReader(tc.body)}
			client := newTransportTestClient(t, roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode: http.StatusTooManyRequests,
					Header:     make(http.Header),
					Body:       body,
					Request:    req,
				}, nil
			}))

			_, err := client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
			if !ai.IsRateLimited(err) {
				t.Fatalf("error = %v, want RateLimitedError", err)
			}
			if body.bytesRead != tc.wantRead {
				t.Fatalf("bytes read = %d, want %d", body.bytesRead, tc.wantRead)
			}
			if body.sawEOF != tc.wantSawEOF {
				t.Fatalf("saw EOF = %v, want %v", body.sawEOF, tc.wantSawEOF)
			}
			if !body.closed {
				t.Fatal("error response body was not closed")
			}
			if body.bytesAtClose != tc.wantRead {
				t.Fatalf("bytes read before close = %d, want %d", body.bytesAtClose, tc.wantRead)
			}
		})
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

func TestListModelsFetchesVendorList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("method = %q, want GET", r.Method)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer key" {
			t.Errorf("Authorization = %q, want Bearer key", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"id":"deepseek-chat","object":"model","owned_by":"deepseek"},{"id":" ","object":"model","owned_by":"deepseek"},{"id":"deepseek-reasoner","object":"model","owned_by":"deepseek"}]}`))
	}))
	defer server.Close()

	models, err := listModels(context.Background(), server.URL, ai.ProviderConfig{APIKey: "key"}, server.Client())
	if err != nil {
		t.Fatalf("listModels: %v", err)
	}
	want := []ai.ModelInfo{{ID: "deepseek-chat"}, {ID: "deepseek-reasoner"}}
	if len(models) != len(want) || models[0] != want[0] || models[1] != want[1] {
		t.Fatalf("models = %+v, want %+v (blank ids dropped)", models, want)
	}
}

func TestListModelsRequiresAPIKeyAndMapsStatusErrors(t *testing.T) {
	if _, err := listModels(context.Background(), "http://unused.invalid", ai.ProviderConfig{}, http.DefaultClient); err == nil {
		t.Fatal("empty key was accepted")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()
	var authErr *ai.AuthFailedError
	if _, err := listModels(context.Background(), server.URL, ai.ProviderConfig{APIKey: "bad"}, server.Client()); !errors.As(err, &authErr) {
		t.Fatalf("401 err = %v, want AuthFailedError", err)
	}
}

func TestListerRegistersWithModelRegistry(t *testing.T) {
	if _, err := ai.ListLLMModels(context.Background(), ai.CapabilityConfig{Provider: providerName}); err == nil ||
		!strings.Contains(err.Error(), "api key is required") {
		t.Fatalf("keyless registry dispatch err = %v, want the adapter's key-required error", err)
	}
}

// stopContentServer returns a fake DeepSeek that replies with finish_reason "stop" and the given
// raw content string as the assistant message.
func stopContentServer(content string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		body := chatResponseBody{}
		body.Choices = append(body.Choices, struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content string `json:"content"`
			} `json:"message"`
		}{FinishReason: "stop"})
		body.Choices[0].Message.Content = content
		_ = json.NewEncoder(w).Encode(body)
	}))
}

// runFinishReason drives one request through a fake server that replies with the given finish
// reason and content, returning the client error (if any).
func runFinishReason(t *testing.T, reason, content string) (ai.LLMResponse, error) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		body := chatResponseBody{}
		body.Choices = append(body.Choices, struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content string `json:"content"`
			} `json:"message"`
		}{FinishReason: reason})
		body.Choices[0].Message.Content = content
		_ = json.NewEncoder(w).Encode(body)
	}))
	defer server.Close()
	client := newTestClient(t, server.URL)
	return client.CompleteJSON(context.Background(), ai.LLMRequest{Prompt: "x", MaxOutputTokens: 1200})
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

func newTransportTestClient(t *testing.T, transport http.RoundTripper) *Client {
	t.Helper()
	client := newTestClient(t, "https://deepseek.invalid")
	client.http = &http.Client{Transport: transport}
	return client
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type observedBody struct {
	reader       *strings.Reader
	bytesRead    int
	bytesAtClose int
	sawEOF       bool
	closed       bool
}

func (b *observedBody) Read(p []byte) (int, error) {
	n, err := b.reader.Read(p)
	b.bytesRead += n
	if errors.Is(err, io.EOF) {
		b.sawEOF = true
	}
	return n, err
}

func (b *observedBody) Close() error {
	b.bytesAtClose = b.bytesRead
	b.closed = true
	return nil
}

type contextBody struct {
	ctx     context.Context
	started chan struct{}
	once    sync.Once
}

func (b *contextBody) Read([]byte) (int, error) {
	b.once.Do(func() { close(b.started) })
	<-b.ctx.Done()
	return 0, b.ctx.Err()
}

func (*contextBody) Close() error {
	return nil
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
