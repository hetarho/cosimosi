// Package llm is the provider abstraction for large-language-model calls
// (spec 20, constitution §7): domain code depends only on the Client port and
// the concrete provider adapter (OpenAI, Gemini, Claude, DeepSeek, Grok, …)
// is selected by config at the edge — swapping providers is an env change,
// never a code change. Types here are pure transport-agnostic values; all
// provider HTTP details (endpoints, auth, request shapes) stay inside this
// package and never leak upward.
package llm

import (
	"context"
	"encoding/json"
	"time"
)

// Client is the single LLM port: one unary completion, optionally constrained
// to a JSON schema. Adapters guarantee Response.Text carries the model's text
// output (the JSON document when Schema is set). Transport failures surface as
// errors; content-level garbage does NOT — schema conformance is best-effort
// per provider, so callers must validate/fall back themselves (concept §4.6).
type Client interface {
	Complete(ctx context.Context, req Request) (Response, error)
	// Model names the provider/model serving the calls — for logs and metrics.
	Model() string
}

// Schema is a JSON Schema the response must conform to. Name labels it for
// providers that require a schema name (OpenAI/Grok json_schema). Keep the
// document portable: every object needs additionalProperties:false with all
// properties required, and numeric/array constraints (minimum, minItems, …)
// are unevenly supported — enforce those in code instead.
type Schema struct {
	Name string
	Raw  json.RawMessage
}

// Request is one completion call: a system instruction, the user text, and an
// optional structured-output schema.
type Request struct {
	System    string
	User      string
	Schema    *Schema // nil = free text
	MaxTokens int     // response token cap; 0 = adapter default
}

// Usage is the token count one completion consumed, mapped from the provider's
// usage metadata (spec 34 — the unit-economics input). Best-effort: providers
// that omit usage yield zeros.
type Usage struct {
	InputTokens  int
	OutputTokens int
}

// Response is the model's text output. When Request.Schema was set, Text is
// the (claimed) JSON document.
type Response struct {
	Text  string
	Usage Usage
}

// ConfigSource is the port the Resolver reads the runtime-active LLM selection
// from (spec 34). Implemented by internal/admin (DB selection + key decryption)
// — llm itself knows neither the DB nor the admin context (dependency
// inversion, constitution §7). ok=false = nothing configured → env fallback.
// model "" = the provider's default.
type ConfigSource interface {
	ActiveLLM(ctx context.Context) (provider, model, apiKey string, ok bool, err error)
}

// UsageSink receives per-call token usage after a successful Complete (spec 34).
// Implementations must be cheap/best-effort — the Resolver logs and drops sink
// errors so metering can never fail an extraction.
type UsageSink interface {
	RecordUsage(ctx context.Context, day time.Time, provider, model string, usage Usage) error
}
