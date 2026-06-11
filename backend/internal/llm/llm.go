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

// Response is the model's text output. When Request.Schema was set, Text is
// the (claimed) JSON document.
type Response struct {
	Text string
}
