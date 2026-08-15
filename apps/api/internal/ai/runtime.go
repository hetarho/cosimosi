package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
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

// ConfigReader reads the stored runtime provider selection: which provider+model a capability uses,
// and the encrypted key for a provider. Decoupled from admin types so this supporting wrapper never
// imports the admin core context (CC8). The concrete is admin/pg (which owns the ai_provider_* tables).
type ConfigReader interface {
	// ReadCapabilityConfig returns the selected provider+model for "llm"|"embedding"; found=false
	// when unset (the source falls back to env → keyless mock).
	ReadCapabilityConfig(ctx context.Context, capability string) (provider string, model string, found bool, err error)
	// ReadProviderKey returns a provider's encrypted key; found=false when unset.
	ReadProviderKey(ctx context.Context, provider string) (encryptedKey []byte, found bool, err error)
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
		provider, model, found, err := s.reader.ReadCapabilityConfig(ctx, capability)
		if err != nil {
			return CapabilityConfig{}, "", err
		}
		if found && strings.TrimSpace(provider) != "" {
			cfg := CapabilityConfig{Provider: provider, Model: model}
			// The key lives per provider (not per capability): resolve it by the selected provider.
			encryptedKey, keyFound, err := s.reader.ReadProviderKey(ctx, provider)
			if err != nil {
				return CapabilityConfig{}, "", err
			}
			if keyFound {
				// A key row that exists but cannot be used (empty ciphertext, no decrypter, a
				// decrypt failure from encryption-key drift, or an empty plaintext) is a loud ops
				// error, never a silent fall-through to mock — corruption/miswire must surface.
				if len(encryptedKey) == 0 || s.decrypter == nil {
					return CapabilityConfig{}, "", fmt.Errorf("ai: provider %q has a key row but no usable ciphertext/decrypter", provider)
				}
				key, err := s.decrypter.Decrypt(encryptedKey)
				if err != nil {
					return CapabilityConfig{}, "", err
				}
				if len(key) == 0 {
					return CapabilityConfig{}, "", fmt.Errorf("ai: provider %q key decrypted to empty", provider)
				}
				cfg.APIKey = string(key)
				return cfg, fingerprint("db", cfg), nil
			}
			// A selection whose provider key row is absent (cleared, or never set) falls through
			// to env → keyless mock instead of yielding a keyless DB cfg that NewAdapters rejects:
			// the factory's provider-without-key fail-fast guards deploy-time env misconfig, but a
			// runtime operator action (ClearProviderKey before reselecting) must degrade the
			// pipeline, never hard-fail every AI port in api and worker.
		}
	}
	return envCfg, fingerprint("env", envCfg), nil
}

// fingerprint changes whenever the effective config changes, including a key rotation (the key is
// hashed, never stored in the fingerprint in the clear). A stable fingerprint means the cached
// built adapters are reused; a changed one triggers a rebuild.
func fingerprint(source string, cfg CapabilityConfig) string {
	sum := sha256.Sum256([]byte(source + "\x00" + cfg.Provider + "\x00" + cfg.Model + "\x00" + cfg.APIKey))
	return hex.EncodeToString(sum[:8])
}

// ResolvingAdapters is the memory-port set whose underlying real/mock adapters are rebuilt when the
// effective config changes. The per-call config read is a single indexed-row lookup — negligible
// beside the network-bound AI call it precedes — and guarantees a SetAIConfig takes effect
// immediately, including in the separate worker process (both read the same table).
type ResolvingAdapters struct {
	source      *RuntimeConfigSource
	meter       *Meter
	logger      *log.Logger
	httpClients HTTPClients
	mu          sync.Mutex
	fp          string
	built       *Adapters
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
	adapters, err := NewAdapters(FactoryOptions{
		LLM: llm, Embedding: emb, Meter: r.meter, HTTPClients: r.httpClients,
	})
	if err != nil {
		return Adapters{}, err
	}
	// The prior built Adapters is dropped without disposal — deliberate: LLMClient/EmbeddingClient
	// expose no Close, config changes are rare operator actions, and the replaced vendor client's
	// idle keep-alive connections drain on the transport's idle timeout. In-flight calls holding
	// the old Adapters value finish safely on it.
	if r.logger != nil {
		// The one operator-visible signal that a config change (including a cleared key
		// degrading a capability to env/mock) actually took effect in this process.
		r.logger.Printf("ai: adapters rebuilt (%s)", adapters.Mode)
	}
	r.fp = fp
	r.built = &adapters
	return adapters, nil
}

// NewResolvingAdapters returns an Adapters whose ports resolve the effective config on each call.
// The Mode label is static ("runtime db→env→mock"); the concrete provider a given call uses is
// whatever the current config resolves to. logger (nil-safe) reports each rebuild's resolved mode,
// so a runtime degradation to env/mock is visible in the process log.
func NewResolvingAdapters(source *RuntimeConfigSource, meter *Meter, logger *log.Logger, clients ...HTTPClients) Adapters {
	if meter == nil {
		meter = NewMeter()
	}
	var httpClients HTTPClients
	if len(clients) > 0 {
		httpClients = clients[0]
	}
	r := &ResolvingAdapters{source: source, meter: meter, logger: logger, httpClients: httpClients}
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

func (e resolvingExtractor) ReviseSplit(ctx context.Context, body string, prior memory.ExtractResult, instruction string) (memory.ExtractResult, error) {
	a, err := e.r.current(ctx)
	if err != nil {
		return memory.ExtractResult{}, err
	}
	return a.Extractor.ReviseSplit(ctx, body, prior, instruction)
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
	}
	embedding = CapabilityConfig{
		Provider: strings.TrimSpace(os.Getenv(EnvEmbeddingProvider)),
		APIKey:   strings.TrimSpace(os.Getenv(EnvEmbeddingAPIKey)),
		Model:    strings.TrimSpace(os.Getenv(EnvEmbeddingModel)),
	}
	return llm, embedding
}
