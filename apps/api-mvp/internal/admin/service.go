package admin

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/cosimosi/backend/internal/llm"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/values"
)

// usageKindExtract is the only metered kind for now (embedding usage is an
// explicit non-goal of spec 34 — the column exists for the future wiring).
const usageKindExtract = "extract"

// overviewWindowDays bounds the dashboard series/usage range.
const overviewWindowDays = 30

// testKeyTimeout bounds one TestProviderKey ping — much tighter than the
// extraction timeout: a validation click should fail fast, not hang 2 minutes.
const testKeyTimeout = 30 * time.Second

// testKeyMaxTokens keeps the validation completion tiny (cost ~zero).
const testKeyMaxTokens = 16

// minKeyLength rejects implausibly short keys — also a guard for the last4
// display (a ≤4-char "key" would round-trip in full as key_last4).
const minKeyLength = 8

// Service owns the admin policies: matrix∪DB merge (always the full provider
// set), provider/model domain validation, key encrypt/decrypt orchestration,
// and the dashboard aggregation. It also implements llm.ConfigSource and
// llm.UsageSink for the Resolver (dependency inversion — llm never sees admin).
type Service struct {
	repo   Repository
	cipher *Cipher // nil = encryption not configured (reads fine, key writes rejected)
	cfg    *config.Config
	// newClient builds a provider adapter for TestProviderKey — defaults to
	// llm.NewForProvider; tests inject a stub.
	newClient func(provider, model, apiKey string, hc *http.Client) (llm.Client, error)
}

// NewService wires the admin service. cipher may be nil (master key unset).
func NewService(repo Repository, cipher *Cipher, cfg *config.Config) *Service {
	return &Service{repo: repo, cipher: cipher, cfg: cfg, newClient: llm.NewForProvider}
}

// Resolver-port conformance (spec 34 — the admin context feeds the llm Resolver).
var (
	_ llm.ConfigSource = (*Service)(nil)
	_ llm.UsageSink    = (*Service)(nil)
)

// GetConfig merges the code matrix (SSOT for the provider set + defaults) with
// the stored overrides — the console always shows every matrix provider, rows
// or not (overrides-only, the spec-30 philosophy).
func (s *Service) GetConfig(ctx context.Context) (LLMConfig, error) {
	rows, err := s.repo.ListProviderRows(ctx)
	if err != nil {
		return LLMConfig{}, err
	}
	byProvider := make(map[string]ProviderRow, len(rows))
	for _, row := range rows {
		byProvider[row.Provider] = row
	}

	names := llm.ProviderNames()
	providers := make([]ProviderConfig, 0, len(names))
	for _, name := range names {
		spec, _ := llm.Provider(name)
		card := ProviderConfig{Provider: name, DefaultModel: spec.DefaultModel}
		if row, ok := byProvider[name]; ok {
			card.Models = row.Models
			card.KeySet = row.KeySet
			if row.KeySet {
				card.KeyLast4 = row.KeyLast4
			}
			card.KeyUpdatedAt = row.KeyUpdatedAt
		}
		providers = append(providers, card)
	}

	active, ok, err := s.repo.GetSelection(ctx)
	if err != nil {
		return LLMConfig{}, err
	}
	if !ok {
		// Nothing chosen in the console yet — surface what the Resolver would
		// actually use (the env fallback) so the UI never shows a void.
		active = Selection{Provider: s.envProvider(), Model: s.cfg.LLMModel}
	}
	return LLMConfig{Providers: providers, Active: active, EncryptionReady: s.cipher != nil}, nil
}

// SetKey encrypts and stores one provider key (write-only: the plaintext's
// life ends here — only key_set/last4 ever travel back out).
func (s *Service) SetKey(ctx context.Context, provider, apiKey string) (ProviderConfig, error) {
	if _, ok := llm.Provider(provider); !ok {
		return ProviderConfig{}, ErrUnknownProvider
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return ProviderConfig{}, ErrEmptyKey
	}
	if len(apiKey) < minKeyLength {
		return ProviderConfig{}, ErrKeyTooShort
	}
	enc, err := s.cipher.Seal(provider, []byte(apiKey))
	if err != nil {
		return ProviderConfig{}, err // ErrEncryptionKeyMissing → FailedPrecondition
	}
	if err := s.repo.UpsertProviderKey(ctx, provider, enc, last4(apiKey)); err != nil {
		return ProviderConfig{}, err
	}
	return s.providerCard(ctx, provider)
}

// DeleteKey clears the stored key (NULLs — the row's model list survives).
func (s *Service) DeleteKey(ctx context.Context, provider string) (ProviderConfig, error) {
	if _, ok := llm.Provider(provider); !ok {
		return ProviderConfig{}, ErrUnknownProvider
	}
	if err := s.repo.ClearProviderKey(ctx, provider); err != nil {
		return ProviderConfig{}, err
	}
	return s.providerCard(ctx, provider)
}

// UpdateModels replaces the provider's admin-added model list (trimmed,
// de-duplicated, empties dropped — order preserved).
func (s *Service) UpdateModels(ctx context.Context, provider string, models []string) (ProviderConfig, error) {
	if _, ok := llm.Provider(provider); !ok {
		return ProviderConfig{}, ErrUnknownProvider
	}
	cleaned := make([]string, 0, len(models))
	seen := make(map[string]bool, len(models))
	for _, m := range models {
		m = strings.TrimSpace(m)
		if m == "" || seen[m] {
			continue
		}
		seen[m] = true
		cleaned = append(cleaned, m)
	}
	if err := s.repo.UpsertProviderModels(ctx, provider, cleaned); err != nil {
		return ProviderConfig{}, err
	}
	return s.providerCard(ctx, provider)
}

// SetActive validates and stores the active extraction LLM. The model must be
// in the provider's models ∪ {default_model, ""} (acceptance 2.3).
func (s *Service) SetActive(ctx context.Context, provider, model string) (Selection, error) {
	spec, ok := llm.Provider(provider)
	if !ok {
		return Selection{}, ErrUnknownProvider
	}
	if model != "" && model != spec.DefaultModel {
		card, err := s.providerCard(ctx, provider)
		if err != nil {
			return Selection{}, err
		}
		if !slices.Contains(card.Models, model) {
			return Selection{}, ErrInvalidModel
		}
	}
	sel := Selection{Provider: provider, Model: model}
	if err := s.repo.UpsertSelection(ctx, sel); err != nil {
		return Selection{}, err
	}
	return sel, nil
}

// TestKey validates a key with one tiny completion (MaxTokens 16). apiKey ""
// = test the stored key. Provider errors come back as a failed TestResult —
// not an RPC error — so the console can show the reason inline; the key
// itself is scrubbed from the message defensively (1.2/2.4).
func (s *Service) TestKey(ctx context.Context, provider, model, apiKey string) (TestResult, error) {
	if _, ok := llm.Provider(provider); !ok {
		return TestResult{}, ErrUnknownProvider
	}
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		stored, err := s.storedKey(ctx, provider)
		if err != nil {
			return TestResult{}, err
		}
		apiKey = stored
	}

	client, err := s.newClient(provider, model, apiKey, &http.Client{Timeout: testKeyTimeout})
	if err != nil {
		return TestResult{OK: false, Message: scrub(err.Error(), apiKey)}, nil
	}
	start := time.Now()
	_, err = client.Complete(ctx, llm.Request{
		System:    "You are a connectivity check. Reply with the single word: ok",
		User:      "ping",
		MaxTokens: testKeyMaxTokens,
	})
	latency := time.Since(start)
	if err != nil {
		return TestResult{OK: false, Message: scrub(err.Error(), apiKey), Latency: latency}, nil
	}
	return TestResult{OK: true, Message: "completion succeeded", Latency: latency}, nil
}

// Overview aggregates the dashboard on demand (admin click — no polling).
func (s *Service) Overview(ctx context.Context) (Overview, error) {
	totals, err := s.repo.Totals(ctx)
	if err != nil {
		return Overview{}, err
	}
	jobs, err := s.repo.JobCounts(ctx)
	if err != nil {
		return Overview{}, err
	}
	series, err := s.repo.RecordDaySeries(ctx)
	if err != nil {
		return Overview{}, err
	}
	since := time.Now().UTC().AddDate(0, 0, -(overviewWindowDays - 1)).Truncate(24 * time.Hour)
	usage, err := s.repo.ListUsageSince(ctx, since)
	if err != nil {
		return Overview{}, err
	}
	return Overview{
		Users: totals.Users, Records: totals.Records, Memories: totals.Memories, Synapses: totals.Synapses,
		JobsPending: jobs.Pending, JobsProcessing: jobs.Processing, JobsFailed: jobs.Failed, JobsDone24h: jobs.Done24h,
		RecordSeries: series, Usage: usage,
	}, nil
}

// ListUsers returns one page of users (spec 46). The service owns the page-size
// policy (default/cap from admin values) and the search/token normalization; the
// repo owns the auth.users-vs-fallback data. It over-fetches one row (page_size+1)
// so a full page yields a next_page_token (the last in-page user_id) and trims it.
func (s *Service) ListUsers(ctx context.Context, in ListUsersInput) (ListUsersResult, error) {
	size := in.PageSize
	if size <= 0 {
		size = values.AdminUserListDefaultPageSize
	}
	if size > values.AdminUserListMaxPageSize {
		size = values.AdminUserListMaxPageSize
	}
	users, err := s.repo.ListUsers(ctx, strings.TrimSpace(in.Query), in.PageToken, size+1, values.CustomizationStartingStardust)
	if err != nil {
		return ListUsersResult{}, err
	}
	next := ""
	if len(users) > size {
		next = users[size-1].UserID // keyset cursor = last user_id of this page
		users = users[:size]
	}
	return ListUsersResult{Users: users, NextPageToken: next}, nil
}

// GrantStardust validates the amount and delegates the seed→add→audit transaction
// to the repo (spec 46). amount must be a positive integer (A10); an amount that
// can't fit the wallet's int range is rejected as overflow up front so the int32
// cast in the repo is always safe.
func (s *Service) GrantStardust(ctx context.Context, in GrantStardustInput) (AdminUser, error) {
	// Both a non-positive amount and one that can't fit the wallet's int range are
	// bad input (InvalidArgument). A valid amount the current balance can't absorb
	// is the repo's ErrStardustOverflow (FailedPrecondition). The range check here
	// also keeps the int32 cast in the repo always safe.
	if in.Amount <= 0 || in.Amount > math.MaxInt32 {
		return AdminUser{}, ErrInvalidGrantAmount
	}
	return s.repo.GrantStardust(ctx, in, values.CustomizationStartingStardust)
}

// ActiveLLM implements llm.ConfigSource: the Resolver's DB read (selection +
// decrypted key). ok=false = console untouched → env fallback. A selection
// pointing at a missing/undecryptable key is an error — the Resolver logs it
// and falls back rather than failing extraction.
func (s *Service) ActiveLLM(ctx context.Context) (provider, model, apiKey string, ok bool, err error) {
	sel, ok, err := s.repo.GetSelection(ctx)
	if err != nil || !ok {
		return "", "", "", false, err
	}
	key, err := s.storedKey(ctx, sel.Provider)
	if err != nil {
		return "", "", "", false, fmt.Errorf("active llm %s: %w", sel.Provider, err)
	}
	return sel.Provider, sel.Model, key, true, nil
}

// RecordUsage implements llm.UsageSink: one successful Complete → one
// upsert-accumulated llm_usage_daily row (UTC day, kind='extract').
func (s *Service) RecordUsage(ctx context.Context, day time.Time, provider, model string, usage llm.Usage) error {
	return s.repo.AddUsage(ctx, day.UTC().Truncate(24*time.Hour), provider, model, usageKindExtract,
		1, int64(usage.InputTokens), int64(usage.OutputTokens))
}

// storedKey loads and decrypts the provider's stored key.
func (s *Service) storedKey(ctx context.Context, provider string) (string, error) {
	enc, err := s.repo.GetProviderKeyEnc(ctx, provider)
	if err != nil {
		return "", err
	}
	if len(enc) == 0 {
		return "", ErrNoStoredKey
	}
	plaintext, err := s.cipher.Open(provider, enc)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// providerCard re-reads one provider's merged card (mutation responses).
func (s *Service) providerCard(ctx context.Context, provider string) (ProviderConfig, error) {
	cfg, err := s.GetConfig(ctx)
	if err != nil {
		return ProviderConfig{}, err
	}
	for _, card := range cfg.Providers {
		if card.Provider == provider {
			return card, nil
		}
	}
	return ProviderConfig{}, ErrUnknownProvider
}

// envProvider mirrors factory.New's default-provider rule for display.
func (s *Service) envProvider() string {
	if s.cfg.LLMProvider != "" {
		return s.cfg.LLMProvider
	}
	return llm.DefaultProvider
}

// last4 returns the key's trailing 4 characters — the only fragment of a key
// that ever leaves the server. Callers validated len ≥ minKeyLength, so the
// suffix can never be the whole key.
func last4(key string) string {
	return key[len(key)-4:]
}

// scrub removes the plaintext key from provider error text before it travels
// to the console (defense in depth — providers shouldn't echo keys, but their
// error bodies are out of our control).
func scrub(message, apiKey string) string {
	if apiKey == "" {
		return message
	}
	return strings.ReplaceAll(message, apiKey, "***")
}
