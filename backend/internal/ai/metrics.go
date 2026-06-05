package ai

import "sync/atomic"

// Metrics counts embedding-provider cost signals. It is deliberately separate
// from any (future) LLM-extraction metrics so cheap embedding calls and
// expensive LLM calls are measured independently (Architecture §4.7, spec 05
// 비용 가드). The OpenAI embedder surfaces them as a structured log line per call.
type Metrics struct {
	EmbedCalls   atomic.Int64 // network calls actually made (cache misses)
	ApproxTokens atomic.Int64 // rough input token count (~runes/4)
	CacheHits    atomic.Int64 // calls served from the in-memory cache
	TokenCapHits atomic.Int64 // inputs truncated for exceeding the token cap
}
