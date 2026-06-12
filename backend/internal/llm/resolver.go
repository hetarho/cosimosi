package llm

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/cosimosi/backend/internal/platform/config"
)

// resolverTTL is how long one ActiveLLM read is trusted before re-reading the
// DB selection — the upper bound on how stale a SetActiveLLM/key change can be
// (spec 34, acceptance 2.1: provider/model swaps apply without a restart ≤30s).
const resolverTTL = 30 * time.Second

// resolver is the dynamic Client (spec 34): each Complete resolves the active
// (provider, model, key) from the ConfigSource under a short TTL cache and
// delegates to the matching adapter. With nothing configured in the DB
// (ok=false) it falls back to the env-built factory.New client, preserving
// spec-20 behavior exactly — including the keyless mock path, which never
// reaches this type at all (ai.NewExtractor only builds an llm client when
// AI_EXTRACTOR=llm).
type resolver struct {
	src  ConfigSource
	sink UsageSink // nil-safe; failures are logged, never propagated (4.2)
	cfg  *config.Config
	http *http.Client

	mu        sync.Mutex
	current   Client // adapter for the cached selection (nil = fallback)
	provider  string // cached selection identity (rebuild only on change)
	model     string
	apiKey    string
	expiresAt time.Time
	// lazily-built env client (factory.New) + its metering identity.
	fallback            Client
	fbProvider, fbModel string
}

// NewResolver wires the dynamic client over an admin-owned ConfigSource and
// UsageSink (both may be nil-ish in tests). It never fails at construction —
// the env fallback is built lazily so a key-less environment still boots and
// only errors if an LLM call actually needs a client.
func NewResolver(src ConfigSource, cfg *config.Config, sink UsageSink) Client {
	return &resolver{src: src, sink: sink, cfg: cfg, http: &http.Client{Timeout: llmTimeout}}
}

func (r *resolver) Complete(ctx context.Context, req Request) (Response, error) {
	client, provider, model, err := r.resolve(ctx)
	if err != nil {
		return Response{}, err
	}
	resp, err := client.Complete(ctx, req)
	if err != nil {
		return Response{}, err
	}
	if r.sink != nil && provider != "" {
		// Metering is best-effort: a sink failure must never fail the extraction.
		day := time.Now().UTC().Truncate(24 * time.Hour)
		if sinkErr := r.sink.RecordUsage(ctx, day, provider, model, resp.Usage); sinkErr != nil {
			slog.Warn("llm usage sink failed", "provider", provider, "model", model, "err", sinkErr)
		}
	}
	return resp, nil
}

// Model names the currently-resolved provider/model (logs/metrics). It reports
// the cached resolution without forcing a DB read.
func (r *resolver) Model() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.current != nil {
		return r.current.Model()
	}
	if r.fallback != nil {
		return r.fallback.Model()
	}
	return "llm-resolver(unresolved)"
}

// resolve returns the adapter for the active selection (plus its metering
// identity), re-reading the ConfigSource at most once per TTL.
func (r *resolver) resolve(ctx context.Context) (client Client, provider, model string, err error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	if now.Before(r.expiresAt) {
		if r.current != nil {
			return r.current, r.provider, r.modelOrDefault(), nil
		}
		return r.fallbackClientLocked()
	}

	p, m, key, ok, srcErr := r.src.ActiveLLM(ctx)
	r.expiresAt = now.Add(resolverTTL)
	if srcErr != nil {
		// A broken source (DB down, undecryptable key) must not take extraction
		// down with it: log, keep whatever we had, else fall back to env.
		slog.Warn("llm resolver: config source failed; using fallback", "err", srcErr)
		if r.current != nil {
			return r.current, r.provider, r.modelOrDefault(), nil
		}
		return r.fallbackClientLocked()
	}
	if !ok {
		// Nothing configured in the DB → spec-20 env behavior, verbatim.
		r.current = nil
		return r.fallbackClientLocked()
	}

	// Rebuild the adapter only when the selection identity actually changed.
	if r.current == nil || p != r.provider || m != r.model || key != r.apiKey {
		c, buildErr := NewForProvider(p, m, key, r.http)
		if buildErr != nil {
			slog.Warn("llm resolver: active selection unusable; using fallback", "provider", p, "err", buildErr)
			r.current = nil
			return r.fallbackClientLocked()
		}
		r.current, r.provider, r.model, r.apiKey = c, p, m, key
	}
	return r.current, r.provider, r.modelOrDefault(), nil
}

// modelOrDefault resolves the cached model name for metering ("" = the
// provider's matrix default).
func (r *resolver) modelOrDefault() string {
	if r.model != "" {
		return r.model
	}
	if spec, ok := Provider(r.provider); ok {
		return spec.DefaultModel
	}
	return r.model
}

// fallbackClientLocked lazily builds (and caches) the env-config client, with
// its provider/model identity so the fallback path is metered too (4.2).
// Callers hold r.mu.
func (r *resolver) fallbackClientLocked() (Client, string, string, error) {
	if r.fallback == nil {
		c, err := New(r.cfg)
		if err != nil {
			// Don't latch the failure: a later fix (e.g. SetActiveLLM) re-resolves.
			return nil, "", "", err
		}
		provider := orDefault(r.cfg.LLMProvider, DefaultProvider)
		model := r.cfg.LLMModel
		if model == "" {
			if spec, ok := Provider(provider); ok {
				model = spec.DefaultModel
			}
		}
		r.fallback, r.fbProvider, r.fbModel = c, provider, model
	}
	return r.fallback, r.fbProvider, r.fbModel, nil
}
