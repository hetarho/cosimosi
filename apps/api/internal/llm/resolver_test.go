package llm

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/backend/internal/platform/config"
)

// fakeSource scripts ActiveLLM responses and counts reads (TTL verification).
type fakeSource struct {
	mu       sync.Mutex
	provider string
	model    string
	apiKey   string
	ok       bool
	err      error
	reads    int
}

func (s *fakeSource) ActiveLLM(context.Context) (string, string, string, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reads++
	return s.provider, s.model, s.apiKey, s.ok, s.err
}

func (s *fakeSource) set(provider, model, apiKey string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.provider, s.model, s.apiKey, s.ok, s.err = provider, model, apiKey, ok, nil
}

// fakeSink records usage calls and can be told to fail.
type fakeSink struct {
	mu       sync.Mutex
	calls    int
	provider string
	model    string
	usage    Usage
	fail     bool
}

func (s *fakeSink) RecordUsage(_ context.Context, _ time.Time, provider, model string, usage Usage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	s.provider, s.model, s.usage = provider, model, usage
	if s.fail {
		return errors.New("sink down")
	}
	return nil
}

// testResolver builds a resolver with direct field access for TTL manipulation.
func testResolver(src ConfigSource, cfg *config.Config, sink UsageSink) *resolver {
	return NewResolver(src, cfg, sink).(*resolver)
}

func TestResolverUsesActiveSelection(t *testing.T) {
	src := &fakeSource{}
	src.set("claude", "", "db-key", true)
	r := testResolver(src, &config.Config{}, nil)

	client, provider, model, err := r.resolve(context.Background())
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if client.Model() != "claude/"+defaultAnthropicModel {
		t.Fatalf("client = %q, want claude default", client.Model())
	}
	if provider != "claude" || model != defaultAnthropicModel {
		t.Fatalf("metering identity = %q/%q, want claude/%s", provider, model, defaultAnthropicModel)
	}
}

func TestResolverFallsBackToEnvWhenUnset(t *testing.T) {
	src := &fakeSource{} // ok=false: DB empty
	cfg := &config.Config{LLMProvider: "grok", XAIAPIKey: "env-key"}
	r := testResolver(src, cfg, nil)

	client, provider, model, err := r.resolve(context.Background())
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if client.Model() != "grok/"+defaultGrokModel {
		t.Fatalf("fallback client = %q, want env grok", client.Model())
	}
	if provider != "grok" || model != defaultGrokModel {
		t.Fatalf("fallback metering identity = %q/%q", provider, model)
	}
}

func TestResolverFallbackWithoutEnvKeyErrors(t *testing.T) {
	src := &fakeSource{}
	r := testResolver(src, &config.Config{LLMProvider: "openai"}, nil)
	if _, _, _, err := r.resolve(context.Background()); err == nil || !strings.Contains(err.Error(), "OPENAI_API_KEY") {
		t.Fatalf("want missing-env-key error, got %v", err)
	}
}

func TestResolverTTLCachesThenPicksUpChange(t *testing.T) {
	src := &fakeSource{}
	src.set("claude", "", "k1", true)
	r := testResolver(src, &config.Config{}, nil)
	ctx := context.Background()

	if _, _, _, err := r.resolve(ctx); err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if _, _, _, err := r.resolve(ctx); err != nil { // within TTL → cached, no re-read
		t.Fatalf("resolve: %v", err)
	}
	if src.reads != 1 {
		t.Fatalf("source reads = %d, want 1 (TTL cache)", src.reads)
	}

	// Selection changes; TTL expiry must surface it without any restart (2.1).
	src.set("gemini", "custom-model", "k2", true)
	r.mu.Lock()
	r.expiresAt = time.Now().Add(-time.Second)
	r.mu.Unlock()

	client, provider, model, err := r.resolve(ctx)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if client.Model() != "gemini/custom-model" {
		t.Fatalf("post-TTL client = %q, want gemini/custom-model", client.Model())
	}
	if provider != "gemini" || model != "custom-model" {
		t.Fatalf("post-TTL identity = %q/%q", provider, model)
	}
	if src.reads != 2 {
		t.Fatalf("source reads = %d, want 2", src.reads)
	}
}

func TestResolverSourceErrorFallsBack(t *testing.T) {
	src := &fakeSource{err: errors.New("db down")}
	cfg := &config.Config{LLMProvider: "deepseek", DeepSeekAPIKey: "env-key"}
	r := testResolver(src, cfg, nil)

	client, _, _, err := r.resolve(context.Background())
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if client.Model() != "deepseek/"+defaultDeepSeekModel {
		t.Fatalf("client = %q, want env fallback", client.Model())
	}
}

// stubClient lets Complete-path tests run without HTTP.
type stubClient struct {
	resp Response
	err  error
}

func (c *stubClient) Complete(context.Context, Request) (Response, error) { return c.resp, c.err }
func (c *stubClient) Model() string                                       { return "stub/model" }

func TestResolverCompleteMetersUsageBestEffort(t *testing.T) {
	src := &fakeSource{}
	src.set("claude", "m", "k", true)
	sink := &fakeSink{fail: true} // sink failure must NOT fail the call (4.2)
	r := testResolver(src, &config.Config{}, sink)

	// Pre-seed the cache with a stub adapter so Complete is HTTP-free.
	r.mu.Lock()
	r.current = &stubClient{resp: Response{Text: "ok", Usage: Usage{InputTokens: 7, OutputTokens: 3}}}
	r.provider, r.model, r.apiKey = "claude", "m", "k"
	r.expiresAt = time.Now().Add(time.Minute)
	r.mu.Unlock()

	resp, err := r.Complete(context.Background(), Request{User: "hi"})
	if err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if resp.Text != "ok" {
		t.Fatalf("resp.Text = %q", resp.Text)
	}
	if sink.calls != 1 || sink.provider != "claude" || sink.model != "m" {
		t.Fatalf("sink = %+v, want 1 call for claude/m", sink)
	}
	if sink.usage != (Usage{InputTokens: 7, OutputTokens: 3}) {
		t.Fatalf("sink usage = %+v", sink.usage)
	}
}

func TestResolverCompleteErrorSkipsSink(t *testing.T) {
	src := &fakeSource{}
	src.set("claude", "m", "k", true)
	sink := &fakeSink{}
	r := testResolver(src, &config.Config{}, sink)

	r.mu.Lock()
	r.current = &stubClient{err: errors.New("boom")}
	r.provider, r.model, r.apiKey = "claude", "m", "k"
	r.expiresAt = time.Now().Add(time.Minute)
	r.mu.Unlock()

	if _, err := r.Complete(context.Background(), Request{User: "hi"}); err == nil {
		t.Fatal("want transport error")
	}
	if sink.calls != 0 {
		t.Fatalf("sink.calls = %d, want 0 on failed Complete", sink.calls)
	}
}
