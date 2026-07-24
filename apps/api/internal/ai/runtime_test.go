package ai

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeSelection struct {
	provider string
	model    string
}

type fakeConfigReader struct {
	selections map[string]fakeSelection
	keys       map[string][]byte
}

func (f fakeConfigReader) ReadCapabilityConfig(_ context.Context, capability string) (string, string, bool, error) {
	sel, ok := f.selections[capability]
	if !ok {
		return "", "", false, nil
	}
	return sel.provider, sel.model, true, nil
}

func (f fakeConfigReader) ReadProviderKey(_ context.Context, provider string) ([]byte, bool, error) {
	key, ok := f.keys[provider]
	if !ok {
		return nil, false, nil
	}
	return key, true, nil
}

type plainDecrypter struct{}

func (plainDecrypter) Decrypt(ciphertext []byte) ([]byte, error) {
	return ciphertext, nil
}

type failingDecrypter struct{ err error }

func (d failingDecrypter) Decrypt([]byte) ([]byte, error) {
	return nil, d.err
}

// A capability that selects a provider whose key was cleared must not resolve to a
// keyless DB cfg (which NewAdapters rejects) — it falls through to the env selection.
func TestEffectiveClearedKeyFallsThroughToEnv(t *testing.T) {
	envCfg := CapabilityConfig{Provider: "openai", APIKey: "env-key", Model: "env-model"}
	source := &RuntimeConfigSource{
		reader: fakeConfigReader{
			selections: map[string]fakeSelection{"llm": {provider: "openai", model: "gpt-x"}},
		},
		decrypter: plainDecrypter{},
		llmEnv:    envCfg,
	}

	cfg, fp, err := source.effective(context.Background(), "llm", source.llmEnv)
	if err != nil {
		t.Fatalf("effective failed: %v", err)
	}
	if cfg != envCfg {
		t.Fatalf("cfg = %+v, want env fall-through %+v", cfg, envCfg)
	}
	if want := fingerprint("env", envCfg); fp != want {
		t.Fatalf("fingerprint = %q, want env fingerprint %q (so cached env-built adapters are reused)", fp, want)
	}
}

// With no env fallback either, the cleared-key selection degrades all the way to the
// keyless mock: current() builds adapters instead of hard-failing every AI port.
func TestCurrentWithClearedKeyBuildsKeylessMock(t *testing.T) {
	source := &RuntimeConfigSource{
		reader: fakeConfigReader{
			selections: map[string]fakeSelection{
				"llm":       {provider: "openai", model: "gpt-x"},
				"embedding": {provider: "voyage", model: "voyage-x"},
			},
		},
		decrypter: plainDecrypter{},
	}
	resolving := &ResolvingAdapters{source: source, meter: NewMeter()}

	adapters, err := resolving.current(context.Background())
	if err != nil {
		t.Fatalf("current failed: %v", err)
	}
	if adapters.Mode != "llm=mock embedding=mock" {
		t.Fatalf("mode = %q, want llm=mock embedding=mock", adapters.Mode)
	}
}

// A key row that exists but cannot be decrypted (encryption-key drift, corruption) must
// stay a hard error — it never silently falls through to env/mock.
func TestEffectiveDecryptFailureIsHardError(t *testing.T) {
	driftErr := errors.New("secretbox: decrypt failed")
	source := &RuntimeConfigSource{
		reader: fakeConfigReader{
			selections: map[string]fakeSelection{"llm": {provider: "openai", model: "gpt-x"}},
			keys:       map[string][]byte{"openai": []byte("ciphertext")},
		},
		decrypter: failingDecrypter{err: driftErr},
		llmEnv:    CapabilityConfig{Provider: "openai", APIKey: "env-key"},
	}

	if _, _, err := source.effective(context.Background(), "llm", source.llmEnv); !errors.Is(err, driftErr) {
		t.Fatalf("err = %v, want the decrypt error surfaced (no fall-through)", err)
	}
}

// A present-but-unusable key row (empty ciphertext here; nil decrypter and empty plaintext
// take the same branch) is corruption/miswire — also a hard error, not a mock fall-through.
func TestEffectiveUnusableKeyRowIsHardError(t *testing.T) {
	source := &RuntimeConfigSource{
		reader: fakeConfigReader{
			selections: map[string]fakeSelection{"llm": {provider: "openai", model: "gpt-x"}},
			keys:       map[string][]byte{"openai": {}},
		},
		decrypter: plainDecrypter{},
	}

	_, _, err := source.effective(context.Background(), "llm", source.llmEnv)
	if err == nil || !strings.Contains(err.Error(), "no usable ciphertext") {
		t.Fatalf("err = %v, want unusable-key-row hard error", err)
	}
}

// The happy path is unchanged: a keyed selection resolves to the DB config with the
// decrypted key and a DB fingerprint distinct from the env one.
func TestEffectiveKeyedSelectionResolvesDBConfig(t *testing.T) {
	envCfg := CapabilityConfig{Provider: "openai", APIKey: "env-key", Model: "env-model"}
	source := &RuntimeConfigSource{
		reader: fakeConfigReader{
			selections: map[string]fakeSelection{"llm": {provider: "anthropic", model: "claude-x"}},
			keys:       map[string][]byte{"anthropic": []byte("db-key")},
		},
		decrypter: plainDecrypter{},
		llmEnv:    envCfg,
	}

	cfg, fp, err := source.effective(context.Background(), "llm", source.llmEnv)
	if err != nil {
		t.Fatalf("effective failed: %v", err)
	}
	want := CapabilityConfig{Provider: "anthropic", APIKey: "db-key", Model: "claude-x"}
	if cfg != want {
		t.Fatalf("cfg = %+v, want DB config %+v", cfg, want)
	}
	if wantFP := fingerprint("db", want); fp != wantFP {
		t.Fatalf("fingerprint = %q, want db fingerprint %q", fp, wantFP)
	}
}
