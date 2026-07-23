package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/cosimosi/api/internal/memory"
)

// The runtime provider-config seam (the admin console — the change to the AI-provider abstraction's env-only stance). Provider
// selection resolves DB override → env → keyless mock and is applied WITHOUT a redeploy: a
// SetAIConfig write lands in ai_provider_config, and the next AI call rebuilds the vendor client
// when the effective config's fingerprint changes. Metering, error taxonomy, port adapters, and
// the keyless mock are unchanged — the swap happens strictly below them, inside NewAdapters.

// ConfigRecord is one capability's stored provider config, decoupled from admin types so this
// supporting wrapper never imports the admin core context (CC8). Found=false means no DB row.
type ConfigRecord struct {
	Provider        string
	Model           string
	BaseURL         string
	APIKeyEncrypted []byte
	Found           bool
}

// ConfigReader reads the stored provider config for a capability ("llm" | "embedding"). The
// concrete is admin/pg (which owns the ai_provider_config table); this port is consumer-owned here.
type ConfigReader interface {
	ReadProviderConfig(ctx context.Context, capability string) (ConfigRecord, error)
}

// KeyDecrypter decrypts a stored API-key ciphertext (platform/secretbox). Only the config source
// decrypts — never the admin RPC, which returns a masked hint.
type KeyDecrypter interface {
	Decrypt(ciphertext []byte) ([]byte, error)
}

// RuntimeConfigSource resolves the effective per-capability config: DB row (decrypted key) wins,
// else the env selection, else empty (which NewAdapters turns into the keyless mock).
type RuntimeConfigSource struct {
	reader    ConfigReader
	decrypter KeyDecrypter
	llmEnv    CapabilityConfig
	embEnv    CapabilityConfig
}

// NewRuntimeConfigSource wires the DB reader + key decrypter with the env fallbacks (read once at
// construction — env does not change without a redeploy anyway).
func NewRuntimeConfigSource(reader ConfigReader, decrypter KeyDecrypter) *RuntimeConfigSource {
	llmEnv, embEnv := EnvCapabilityConfigs()
	return &RuntimeConfigSource{reader: reader, decrypter: decrypter, llmEnv: llmEnv, embEnv: embEnv}
}

func (s *RuntimeConfigSource) effective(ctx context.Context, capability string, envCfg CapabilityConfig) (CapabilityConfig, string, error) {
	if s.reader != nil {
		rec, err := s.reader.ReadProviderConfig(ctx, capability)
		if err != nil {
			return CapabilityConfig{}, "", err
		}
		if rec.Found && strings.TrimSpace(rec.Provider) != "" {
			cfg := CapabilityConfig{Provider: rec.Provider, Model: rec.Model, BaseURL: rec.BaseURL}
			if len(rec.APIKeyEncrypted) > 0 && s.decrypter != nil {
				key, err := s.decrypter.Decrypt(rec.APIKeyEncrypted)
				if err != nil {
					return CapabilityConfig{}, "", err
				}
				cfg.APIKey = string(key)
			}
			return cfg, fingerprint("db", cfg), nil
		}
	}
	return envCfg, fingerprint("env", envCfg), nil
}

// fingerprint changes whenever the effective config changes, including a key rotation (the key is
// hashed, never stored in the fingerprint in the clear). A stable fingerprint means the cached
// built adapters are reused; a changed one triggers a rebuild.
func fingerprint(source string, cfg CapabilityConfig) string {
	sum := sha256.Sum256([]byte(source + "\x00" + cfg.Provider + "\x00" + cfg.Model + "\x00" + cfg.BaseURL + "\x00" + cfg.APIKey))
	return hex.EncodeToString(sum[:8])
}

// ResolvingAdapters is the memory-port set whose underlying real/mock adapters are rebuilt when the
// effective config changes. The per-call config read is a single indexed-row lookup — negligible
// beside the network-bound AI call it precedes — and guarantees a SetAIConfig takes effect
// immediately, including in the separate worker process (both read the same table).
type ResolvingAdapters struct {
	source *RuntimeConfigSource
	meter  *Meter
	mu     sync.Mutex
	fp     string
	built  *Adapters
}

func (r *ResolvingAdapters) current(ctx context.Context) (Adapters, error) {
	llm, llmFP, err := r.source.effective(ctx, "llm", r.source.llmEnv)
	if err != nil {
		return Adapters{}, err
	}
	emb, embFP, err := r.source.effective(ctx, "embedding", r.source.embEnv)
	if err != nil {
		return Adapters{}, err
	}
	fp := llmFP + "|" + embFP

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.built != nil && fp == r.fp {
		return *r.built, nil
	}
	adapters, err := NewAdapters(FactoryOptions{LLM: llm, Embedding: emb, Meter: r.meter})
	if err != nil {
		return Adapters{}, err
	}
	r.fp = fp
	r.built = &adapters
	return adapters, nil
}

// NewResolvingAdapters returns an Adapters whose ports resolve the effective config on each call.
// The Mode label is static ("runtime db→env→mock"); the concrete provider a given call uses is
// whatever the current config resolves to.
func NewResolvingAdapters(source *RuntimeConfigSource, meter *Meter) Adapters {
	if meter == nil {
		meter = NewMeter()
	}
	r := &ResolvingAdapters{source: source, meter: meter}
	return Adapters{
		Extractor:       resolvingExtractor{r},
		Embedder:        resolvingEmbedder{r},
		Semanticizer:    resolvingSemanticizer{r},
		PredictionError: resolvingPredictionError{r},
		SealSuggester:   resolvingSealSuggester{r},
		Mode:            "runtime db→env→mock",
	}
}

type resolvingExtractor struct{ r *ResolvingAdapters }

func (e resolvingExtractor) Split(ctx context.Context, body string, diaryDate time.Time, existing []memory.ExistingNeuron) (memory.ExtractResult, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return memory.ExtractResult{}, err
	}
	return a.Extractor.Split(ctx, body, diaryDate, existing)
}

func (e resolvingExtractor) ReviseSplit(ctx context.Context, prior memory.ExtractResult, instruction string) (memory.ExtractResult, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return memory.ExtractResult{}, err
	}
	return a.Extractor.ReviseSplit(ctx, prior, instruction)
}

type resolvingEmbedder struct{ r *ResolvingAdapters }

func (e resolvingEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return nil, err
	}
	return a.Embedder.Embed(ctx, texts)
}

type resolvingSemanticizer struct{ r *ResolvingAdapters }

func (e resolvingSemanticizer) GenerateSemanticStages(ctx context.Context, mem memory.SemanticizeMemory) (memory.SemanticStages, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return memory.SemanticStages{}, err
	}
	return a.Semanticizer.GenerateSemanticStages(ctx, mem)
}

type resolvingPredictionError struct{ r *ResolvingAdapters }

func (e resolvingPredictionError) Differs(ctx context.Context, currentText string, rewrite string) (bool, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return false, err
	}
	return a.PredictionError.Differs(ctx, currentText, rewrite)
}

type resolvingSealSuggester struct{ r *ResolvingAdapters }

func (e resolvingSealSuggester) Suggest(ctx context.Context, mem memory.MemorySummary, words string, candidates []memory.SealCandidateRef) (memory.SealSuggestion, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return memory.SealSuggestion{}, err
	}
	return a.SealSuggester.Suggest(ctx, mem, words, candidates)
}

// EnvCapabilityConfigs reads the per-capability env selection (the same COSIMOSI_* vars
// NewAdaptersFromEnv uses) — the fallback beneath a DB override.
func EnvCapabilityConfigs() (llm CapabilityConfig, embedding CapabilityConfig) {
	llm = CapabilityConfig{
		Provider: strings.TrimSpace(os.Getenv(EnvLLMProvider)),
		APIKey:   strings.TrimSpace(os.Getenv(EnvLLMAPIKey)),
		Model:    strings.TrimSpace(os.Getenv(EnvLLMModel)),
		BaseURL:  strings.TrimSpace(os.Getenv(EnvLLMBaseURL)),
	}
	embedding = CapabilityConfig{
		Provider: strings.TrimSpace(os.Getenv(EnvEmbeddingProvider)),
		APIKey:   strings.TrimSpace(os.Getenv(EnvEmbeddingAPIKey)),
		Model:    strings.TrimSpace(os.Getenv(EnvEmbeddingModel)),
		BaseURL:  strings.TrimSpace(os.Getenv(EnvEmbeddingBaseURL)),
	}
	return llm, embedding
}
