package admin

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"math"
	"net/http"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/backend/internal/llm"
	"github.com/cosimosi/backend/internal/platform/config"
	"github.com/cosimosi/backend/internal/values"
)

// fakeRepo is an in-memory Repository for service policy tests.
type fakeRepo struct {
	rows      map[string]*ProviderRow
	keys      map[string][]byte
	selection *Selection
	usage     []UsageRow

	totals Totals
	jobs   JobCounts
	series []DayCount

	// User-list / stardust-grant surface (spec 46).
	users   []string         // known user ids (existence + listing source)
	wallets map[string]int64 // seeded balances (absent key = no wallet row)
	grants  []GrantStardustInput
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{rows: map[string]*ProviderRow{}, keys: map[string][]byte{}, wallets: map[string]int64{}}
}

func (r *fakeRepo) row(provider string) *ProviderRow {
	if r.rows[provider] == nil {
		r.rows[provider] = &ProviderRow{Provider: provider}
	}
	return r.rows[provider]
}

func (r *fakeRepo) ListProviderRows(context.Context) ([]ProviderRow, error) {
	out := make([]ProviderRow, 0, len(r.rows))
	for _, row := range r.rows {
		out = append(out, *row)
	}
	return out, nil
}

func (r *fakeRepo) GetProviderKeyEnc(_ context.Context, provider string) ([]byte, error) {
	return r.keys[provider], nil
}

func (r *fakeRepo) UpsertProviderKey(_ context.Context, provider string, enc []byte, lastFour string) error {
	r.keys[provider] = enc
	row := r.row(provider)
	row.KeySet, row.KeyLast4, row.KeyUpdatedAt = true, lastFour, time.Now()
	return nil
}

func (r *fakeRepo) ClearProviderKey(_ context.Context, provider string) error {
	delete(r.keys, provider)
	row := r.row(provider)
	row.KeySet, row.KeyLast4 = false, ""
	return nil
}

func (r *fakeRepo) UpsertProviderModels(_ context.Context, provider string, models []string) error {
	r.row(provider).Models = models
	return nil
}

func (r *fakeRepo) GetSelection(context.Context) (Selection, bool, error) {
	if r.selection == nil {
		return Selection{}, false, nil
	}
	return *r.selection, true, nil
}

func (r *fakeRepo) UpsertSelection(_ context.Context, sel Selection) error {
	r.selection = &sel
	return nil
}

func (r *fakeRepo) AddUsage(_ context.Context, day time.Time, provider, model, kind string, calls, in, out int64) error {
	r.usage = append(r.usage, UsageRow{Day: day, Provider: provider, Model: model, Kind: kind, Calls: calls, InputTokens: in, OutputTokens: out})
	return nil
}

func (r *fakeRepo) ListUsageSince(context.Context, time.Time) ([]UsageRow, error) {
	return r.usage, nil
}
func (r *fakeRepo) Totals(context.Context) (Totals, error)              { return r.totals, nil }
func (r *fakeRepo) JobCounts(context.Context) (JobCounts, error)        { return r.jobs, nil }
func (r *fakeRepo) RecordDaySeries(context.Context) ([]DayCount, error) { return r.series, nil }

// ListUsers mirrors the pg keyset semantics: contains filter, user_id ASC, keyset
// after pageToken, limited to the requested limit (= page_size+1 from the service).
func (r *fakeRepo) ListUsers(_ context.Context, query, pageToken string, limit, startingStardust int) ([]AdminUser, error) {
	ids := append([]string(nil), r.users...)
	sort.Strings(ids)
	out := make([]AdminUser, 0, limit)
	for _, id := range ids {
		if query != "" && !strings.Contains(strings.ToLower(id), strings.ToLower(query)) {
			continue
		}
		if pageToken != "" && id <= pageToken {
			continue
		}
		bal := int64(startingStardust)
		seeded := false
		if w, ok := r.wallets[id]; ok {
			bal, seeded = w, true
		}
		out = append(out, AdminUser{UserID: id, Stardust: bal, WalletSeeded: seeded})
		if len(out) == limit {
			break
		}
	}
	return out, nil
}

func (r *fakeRepo) UserExists(_ context.Context, target string) (bool, error) {
	if _, ok := r.wallets[target]; ok {
		return true, nil
	}
	return slices.Contains(r.users, target), nil
}

func (r *fakeRepo) GrantStardust(_ context.Context, in GrantStardustInput, startingStardust int) (AdminUser, error) {
	exists, _ := r.UserExists(context.Background(), in.TargetUserID)
	if !exists {
		return AdminUser{}, ErrUserNotFound
	}
	before, ok := r.wallets[in.TargetUserID]
	if !ok {
		before = int64(startingStardust) // idempotent seed
	}
	if before+in.Amount > math.MaxInt32 {
		return AdminUser{}, ErrStardustOverflow
	}
	after := before + in.Amount
	r.wallets[in.TargetUserID] = after
	r.grants = append(r.grants, in)
	return AdminUser{UserID: in.TargetUserID, Stardust: after, WalletSeeded: true}, nil
}

func newTestService(t *testing.T, repo Repository) *Service {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	cipher, err := NewCipher(base64.StdEncoding.EncodeToString(key))
	if err != nil {
		t.Fatal(err)
	}
	return NewService(repo, cipher, &config.Config{})
}

func TestGetConfigAlwaysReturnsFullMatrix(t *testing.T) {
	repo := newFakeRepo()
	repo.row("claude").Models = []string{"claude-haiku-4-5"}
	svc := newTestService(t, repo)

	cfg, err := svc.GetConfig(context.Background())
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if len(cfg.Providers) != len(llm.ProviderNames()) {
		t.Fatalf("providers = %d, want full matrix %d", len(cfg.Providers), len(llm.ProviderNames()))
	}
	byName := map[string]ProviderConfig{}
	for _, p := range cfg.Providers {
		if p.DefaultModel == "" {
			t.Fatalf("provider %s lost its matrix default model", p.Provider)
		}
		byName[p.Provider] = p
	}
	if got := byName["claude"].Models; len(got) != 1 || got[0] != "claude-haiku-4-5" {
		t.Fatalf("claude DB override not merged: %v", got)
	}
	if !cfg.EncryptionReady {
		t.Fatal("encryption should be ready with a cipher")
	}
	// No selection row → env fallback display (default provider).
	if cfg.Active.Provider != "openai" {
		t.Fatalf("active fallback = %q, want openai", cfg.Active.Provider)
	}
}

func TestSetKeyEncryptsAndExposesOnlyLast4(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)

	card, err := svc.SetKey(context.Background(), "openai", "sk-test-abcd1234")
	if err != nil {
		t.Fatalf("SetKey: %v", err)
	}
	if !card.KeySet || card.KeyLast4 != "1234" {
		t.Fatalf("card = %+v, want key_set+last4 1234", card)
	}
	enc := repo.keys["openai"]
	if len(enc) == 0 || strings.Contains(string(enc), "sk-test") {
		t.Fatal("stored blob must be ciphertext, not plaintext")
	}
	// Round-trips through the service's own decryption path.
	plain, err := svc.storedKey(context.Background(), "openai")
	if err != nil || plain != "sk-test-abcd1234" {
		t.Fatalf("storedKey = %q, %v", plain, err)
	}
}

func TestSetKeyValidation(t *testing.T) {
	svc := newTestService(t, newFakeRepo())
	if _, err := svc.SetKey(context.Background(), "skynet", "k"); !errors.Is(err, ErrUnknownProvider) {
		t.Fatalf("unknown provider: %v", err)
	}
	if _, err := svc.SetKey(context.Background(), "openai", "  "); !errors.Is(err, ErrEmptyKey) {
		t.Fatalf("empty key: %v", err)
	}
	// ≤4-char keys would round-trip in full as key_last4 — rejected up front.
	if _, err := svc.SetKey(context.Background(), "openai", "abc"); !errors.Is(err, ErrKeyTooShort) {
		t.Fatalf("short key: %v", err)
	}
	noCipher := NewService(newFakeRepo(), nil, &config.Config{})
	if _, err := noCipher.SetKey(context.Background(), "openai", "k-12345678"); !errors.Is(err, ErrEncryptionKeyMissing) {
		t.Fatalf("missing master key: %v", err)
	}
}

func TestDeleteKeyClears(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	if _, err := svc.SetKey(context.Background(), "grok", "xai-key-9999"); err != nil {
		t.Fatal(err)
	}
	card, err := svc.DeleteKey(context.Background(), "grok")
	if err != nil {
		t.Fatalf("DeleteKey: %v", err)
	}
	if card.KeySet || card.KeyLast4 != "" {
		t.Fatalf("card after delete = %+v", card)
	}
	if repo.keys["grok"] != nil {
		t.Fatal("encrypted key must be cleared")
	}
}

func TestUpdateModelsSanitizes(t *testing.T) {
	svc := newTestService(t, newFakeRepo())
	card, err := svc.UpdateModels(context.Background(), "gemini", []string{" a ", "", "b", "a"})
	if err != nil {
		t.Fatalf("UpdateModels: %v", err)
	}
	if len(card.Models) != 2 || card.Models[0] != "a" || card.Models[1] != "b" {
		t.Fatalf("models = %v, want [a b]", card.Models)
	}
}

func TestSetActiveValidatesModelDomain(t *testing.T) {
	repo := newFakeRepo()
	repo.row("claude").Models = []string{"claude-haiku-4-5"}
	svc := newTestService(t, repo)
	ctx := context.Background()

	// "" (provider default), the matrix default, and a listed model all pass.
	for _, model := range []string{"", "claude-opus-4-8", "claude-haiku-4-5"} {
		if _, err := svc.SetActive(ctx, "claude", model); err != nil {
			t.Fatalf("SetActive(claude, %q): %v", model, err)
		}
	}
	if _, err := svc.SetActive(ctx, "claude", "gpt-5.4-mini"); !errors.Is(err, ErrInvalidModel) {
		t.Fatalf("out-of-domain model: %v", err)
	}
	if _, err := svc.SetActive(ctx, "skynet", ""); !errors.Is(err, ErrUnknownProvider) {
		t.Fatalf("unknown provider: %v", err)
	}
}

// stubLLMClient fakes the test-ping adapter.
type stubLLMClient struct {
	err error
}

func (c stubLLMClient) Complete(context.Context, llm.Request) (llm.Response, error) {
	return llm.Response{Text: "ok"}, c.err
}
func (c stubLLMClient) Model() string { return "stub/model" }

func TestTestKeyUsesProvidedOrStoredKeyAndScrubs(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	ctx := context.Background()

	var gotKey string
	var gotMax int
	svc.newClient = func(_, _, apiKey string, _ *http.Client) (llm.Client, error) {
		gotKey = apiKey
		return clientFunc(func(_ context.Context, req llm.Request) (llm.Response, error) {
			gotMax = req.MaxTokens
			return llm.Response{Text: "ok"}, nil
		}), nil
	}

	res, err := svc.TestKey(ctx, "openai", "", "sk-inline-key")
	if err != nil || !res.OK {
		t.Fatalf("TestKey inline = %+v, %v", res, err)
	}
	if gotKey != "sk-inline-key" || gotMax != testKeyMaxTokens {
		t.Fatalf("client got key=%q max=%d", gotKey, gotMax)
	}

	// Stored-key path: empty api_key decrypts the saved one.
	if _, err := svc.SetKey(ctx, "openai", "sk-stored-key"); err != nil {
		t.Fatal(err)
	}
	if res, err := svc.TestKey(ctx, "openai", "", ""); err != nil || !res.OK {
		t.Fatalf("TestKey stored = %+v, %v", res, err)
	}
	if gotKey != "sk-stored-key" {
		t.Fatalf("stored key not used: %q", gotKey)
	}

	// Failure path: provider error becomes ok=false and the key is scrubbed.
	svc.newClient = func(_, _, _ string, _ *http.Client) (llm.Client, error) {
		return stubLLMClient{err: errors.New("status 401: bad key sk-inline-key")}, nil
	}
	res, err = svc.TestKey(ctx, "openai", "", "sk-inline-key")
	if err != nil || res.OK {
		t.Fatalf("failed ping must be ok=false without RPC error: %+v, %v", res, err)
	}
	if strings.Contains(res.Message, "sk-inline-key") {
		t.Fatalf("key leaked into message: %q", res.Message)
	}

	// No stored key and none provided → explicit sentinel.
	if _, err := svc.TestKey(ctx, "gemini", "", ""); !errors.Is(err, ErrNoStoredKey) {
		t.Fatalf("missing stored key: %v", err)
	}
}

// clientFunc adapts a function to llm.Client for test stubs.
type clientFunc func(ctx context.Context, req llm.Request) (llm.Response, error)

func (f clientFunc) Complete(ctx context.Context, req llm.Request) (llm.Response, error) {
	return f(ctx, req)
}
func (f clientFunc) Model() string { return "stub/fn" }

func TestActiveLLMDecryptsSelectionKey(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	ctx := context.Background()

	// Unset → ok=false (env fallback), no error.
	if _, _, _, ok, err := svc.ActiveLLM(ctx); ok || err != nil {
		t.Fatalf("unset selection: ok=%v err=%v", ok, err)
	}

	if _, err := svc.SetKey(ctx, "claude", "sk-active-key"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetActive(ctx, "claude", ""); err != nil {
		t.Fatal(err)
	}
	provider, model, key, ok, err := svc.ActiveLLM(ctx)
	if err != nil || !ok {
		t.Fatalf("ActiveLLM: ok=%v err=%v", ok, err)
	}
	if provider != "claude" || model != "" || key != "sk-active-key" {
		t.Fatalf("ActiveLLM = %q/%q key=%q", provider, model, key)
	}

	// Selection set but key deleted → error (resolver logs + falls back).
	if _, err := svc.DeleteKey(ctx, "claude"); err != nil {
		t.Fatal(err)
	}
	if _, _, _, _, err := svc.ActiveLLM(ctx); err == nil {
		t.Fatal("selection without key must error")
	}
}

func TestRecordUsageAccumulatesExtractKind(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	day := time.Date(2026, 6, 12, 15, 4, 5, 0, time.UTC)

	if err := svc.RecordUsage(context.Background(), day, "claude", "m", llm.Usage{InputTokens: 100, OutputTokens: 20}); err != nil {
		t.Fatalf("RecordUsage: %v", err)
	}
	if len(repo.usage) != 1 {
		t.Fatalf("usage rows = %d", len(repo.usage))
	}
	row := repo.usage[0]
	if row.Kind != usageKindExtract || row.Calls != 1 || row.InputTokens != 100 || row.OutputTokens != 20 {
		t.Fatalf("usage row = %+v", row)
	}
	if row.Day.Hour() != 0 || row.Day.Location() != time.UTC {
		t.Fatalf("day not truncated to UTC midnight: %v", row.Day)
	}
}

func TestListUsersPageSizeDefaultAndCap(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	ctx := context.Background()

	// Default applies when page_size <= 0; the service over-fetches size+1.
	var gotLimit int
	probe := &limitProbeRepo{fakeRepo: repo, gotLimit: &gotLimit}
	probeSvc := NewService(probe, svc.cipher, svc.cfg)

	if _, err := probeSvc.ListUsers(ctx, ListUsersInput{PageSize: 0}); err != nil {
		t.Fatalf("ListUsers default: %v", err)
	}
	if want := values.AdminUserListDefaultPageSize + 1; gotLimit != want {
		t.Fatalf("default over-fetch limit = %d, want %d", gotLimit, want)
	}

	if _, err := probeSvc.ListUsers(ctx, ListUsersInput{PageSize: 10_000}); err != nil {
		t.Fatalf("ListUsers cap: %v", err)
	}
	if want := values.AdminUserListMaxPageSize + 1; gotLimit != want {
		t.Fatalf("capped over-fetch limit = %d, want %d", gotLimit, want)
	}
}

func TestListUsersKeysetTokenAndTrim(t *testing.T) {
	repo := newFakeRepo()
	repo.users = []string{"u1", "u2", "u3", "u4", "u5"}
	repo.wallets["u2"] = 250 // seeded wallet shows its real balance
	svc := newTestService(t, repo)
	ctx := context.Background()

	page, err := svc.ListUsers(ctx, ListUsersInput{PageSize: 2})
	if err != nil {
		t.Fatalf("ListUsers: %v", err)
	}
	if len(page.Users) != 2 || page.Users[0].UserID != "u1" || page.Users[1].UserID != "u2" {
		t.Fatalf("page 1 = %+v", page.Users)
	}
	if page.NextPageToken != "u2" {
		t.Fatalf("next token = %q, want u2", page.NextPageToken)
	}
	// Unseeded user shows starting_stardust without a wallet row; seeded shows real.
	if page.Users[0].WalletSeeded || page.Users[0].Stardust != int64(values.CustomizationStartingStardust) {
		t.Fatalf("u1 effective balance = %+v", page.Users[0])
	}
	if !page.Users[1].WalletSeeded || page.Users[1].Stardust != 250 {
		t.Fatalf("u2 seeded balance = %+v", page.Users[1])
	}

	// Continue from the token; the last page yields no further token.
	last, err := svc.ListUsers(ctx, ListUsersInput{PageSize: 50, PageToken: page.NextPageToken})
	if err != nil {
		t.Fatalf("ListUsers page 2: %v", err)
	}
	if len(last.Users) != 3 || last.NextPageToken != "" {
		t.Fatalf("page 2 = %+v token=%q", last.Users, last.NextPageToken)
	}
}

func TestGrantStardustValidatesAmount(t *testing.T) {
	repo := newFakeRepo()
	repo.users = []string{"target"}
	svc := newTestService(t, repo)
	ctx := context.Background()

	for _, amt := range []int64{0, -5} {
		if _, err := svc.GrantStardust(ctx, GrantStardustInput{TargetUserID: "target", Amount: amt}); !errors.Is(err, ErrInvalidGrantAmount) {
			t.Fatalf("amount %d: err = %v, want ErrInvalidGrantAmount", amt, err)
		}
	}
	// An amount that can't fit the wallet's int range is bad input (InvalidArgument).
	if _, err := svc.GrantStardust(ctx, GrantStardustInput{TargetUserID: "target", Amount: math.MaxInt32 + 1}); !errors.Is(err, ErrInvalidGrantAmount) {
		t.Fatalf("oversized amount: err = %v, want ErrInvalidGrantAmount", err)
	}
	// No grant should have been recorded for any rejected request.
	if len(repo.grants) != 0 {
		t.Fatalf("rejected grants recorded: %+v", repo.grants)
	}
}

func TestGrantStardustSeedsAndAdds(t *testing.T) {
	repo := newFakeRepo()
	repo.users = []string{"fresh", "rich"}
	repo.wallets["rich"] = 1000
	svc := newTestService(t, repo)
	ctx := context.Background()

	// Unseeded target: starting_stardust + amount.
	u, err := svc.GrantStardust(ctx, GrantStardustInput{AdminUserID: "admin-1", TargetUserID: "fresh", Amount: 50})
	if err != nil {
		t.Fatalf("grant fresh: %v", err)
	}
	if want := int64(values.CustomizationStartingStardust) + 50; u.Stardust != want || !u.WalletSeeded {
		t.Fatalf("fresh post-grant = %+v, want %d", u, want)
	}

	// Seeded target: existing balance + amount.
	u, err = svc.GrantStardust(ctx, GrantStardustInput{AdminUserID: "admin-1", TargetUserID: "rich", Amount: 50})
	if err != nil {
		t.Fatalf("grant rich: %v", err)
	}
	if u.Stardust != 1050 {
		t.Fatalf("rich post-grant = %+v, want 1050", u)
	}
}

func TestGrantStardustUnknownTarget(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(t, repo)
	if _, err := svc.GrantStardust(context.Background(), GrantStardustInput{TargetUserID: "ghost", Amount: 10}); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("unknown target: err = %v, want ErrUserNotFound", err)
	}
}

// limitProbeRepo wraps fakeRepo to capture the limit the service passes to ListUsers.
type limitProbeRepo struct {
	*fakeRepo
	gotLimit *int
}

func (r *limitProbeRepo) ListUsers(ctx context.Context, query, pageToken string, limit, startingStardust int) ([]AdminUser, error) {
	*r.gotLimit = limit
	return r.fakeRepo.ListUsers(ctx, query, pageToken, limit, startingStardust)
}

func TestOverviewAssembles(t *testing.T) {
	repo := newFakeRepo()
	repo.totals = Totals{Users: 3, Records: 10, Memories: 12, Synapses: 30}
	repo.jobs = JobCounts{Pending: 1, Processing: 2, Failed: 3, Done24h: 4}
	repo.series = []DayCount{{Day: time.Now(), Count: 2}}
	svc := newTestService(t, repo)

	ov, err := svc.Overview(context.Background())
	if err != nil {
		t.Fatalf("Overview: %v", err)
	}
	if ov.Users != 3 || ov.JobsFailed != 3 || len(ov.RecordSeries) != 1 {
		t.Fatalf("overview = %+v", ov)
	}
}
