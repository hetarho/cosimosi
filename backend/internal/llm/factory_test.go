package llm

import (
	"strings"
	"testing"

	"github.com/cosimosi/backend/internal/platform/config"
)

func TestNewSelectsProviderWithDefaultModel(t *testing.T) {
	cases := []struct {
		cfg       config.Config
		wantModel string
	}{
		{config.Config{LLMProvider: "openai", OpenAIAPIKey: "k"}, "openai/" + defaultOpenAIModel},
		{config.Config{LLMProvider: "", OpenAIAPIKey: "k"}, "openai/" + defaultOpenAIModel}, // default provider
		{config.Config{LLMProvider: "deepseek", DeepSeekAPIKey: "k"}, "deepseek/" + defaultDeepSeekModel},
		{config.Config{LLMProvider: "grok", XAIAPIKey: "k"}, "grok/" + defaultGrokModel},
		{config.Config{LLMProvider: "claude", AnthropicAPIKey: "k"}, "claude/" + defaultAnthropicModel},
		{config.Config{LLMProvider: "gemini", GeminiAPIKey: "k"}, "gemini/" + defaultGeminiModel},
	}
	for _, c := range cases {
		client, err := New(&c.cfg)
		if err != nil {
			t.Fatalf("provider %q: %v", c.cfg.LLMProvider, err)
		}
		if client.Model() != c.wantModel {
			t.Fatalf("provider %q: Model() = %q, want %q", c.cfg.LLMProvider, client.Model(), c.wantModel)
		}
	}
}

func TestNewModelOverride(t *testing.T) {
	client, err := New(&config.Config{LLMProvider: "claude", AnthropicAPIKey: "k", LLMModel: "claude-haiku-4-5"})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if client.Model() != "claude/claude-haiku-4-5" {
		t.Fatalf("LLM_MODEL override ignored: %q", client.Model())
	}
}

func TestNewMissingKeyFailsFastNamingEnv(t *testing.T) {
	cases := map[string]string{
		"openai":   "OPENAI_API_KEY",
		"deepseek": "DEEPSEEK_API_KEY",
		"grok":     "XAI_API_KEY",
		"claude":   "ANTHROPIC_API_KEY",
		"gemini":   "GEMINI_API_KEY",
	}
	for provider, env := range cases {
		_, err := New(&config.Config{LLMProvider: provider})
		if err == nil || !strings.Contains(err.Error(), env) {
			t.Fatalf("provider %q without key: err = %v, want mention of %s", provider, err, env)
		}
	}
}

func TestNewUnknownProvider(t *testing.T) {
	_, err := New(&config.Config{LLMProvider: "skynet"})
	if err == nil || !strings.Contains(err.Error(), "unknown LLM_PROVIDER") {
		t.Fatalf("unknown provider: err = %v", err)
	}
}
