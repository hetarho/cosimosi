package admin

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/cosimosi/api/internal/platform/secretbox"
	"github.com/cosimosi/api/internal/platform/values"
)

// --- fakes for the consumer-owned ports ------------------------------------------------------

type fakeStore struct {
	promoted map[string]PromotedAdmin
	grants   []TwinkleGrant
	audits   []AuditEntry
	configs  map[AICapability]*StoredCapabilityConfig
	keys     map[string]*StoredProviderKey
}

func newFakeStore() *fakeStore {
	return &fakeStore{
		promoted: map[string]PromotedAdmin{},
		configs:  map[AICapability]*StoredCapabilityConfig{},
		keys:     map[string]*StoredProviderKey{},
	}
}

func (s *fakeStore) IsPromoted(_ context.Context, userID string) (bool, error) {
	_, ok := s.promoted[userID]
	return ok, nil
}
func (s *fakeStore) ListPromoted(context.Context) ([]PromotedAdmin, error) {
	out := make([]PromotedAdmin, 0, len(s.promoted))
	for _, p := range s.promoted {
		out = append(out, p)
	}
	return out, nil
}
func (s *fakeStore) Promote(_ context.Context, userID string, grantedBy string, audit AuditEntry) error {
	s.promoted[userID] = PromotedAdmin{UserID: userID, GrantedBy: grantedBy}
	s.audits = append(s.audits, audit)
	return nil
}
func (s *fakeStore) Revoke(_ context.Context, userID string, audit AuditEntry) (bool, error) {
	_, ok := s.promoted[userID]
	delete(s.promoted, userID)
	s.audits = append(s.audits, audit)
	return ok, nil
}
func (s *fakeStore) RecordGrant(_ context.Context, grant TwinkleGrant, audit AuditEntry) (bool, error) {
	for _, g := range s.grants {
		if g.ID == grant.ID {
			return false, nil // idempotent replay
		}
	}
	s.grants = append(s.grants, grant)
	s.audits = append(s.audits, audit)
	return true, nil
}
func (s *fakeStore) GetGrant(_ context.Context, grantID string) (*TwinkleGrant, error) {
	for _, g := range s.grants {
		if g.ID == grantID {
			grant := g
			return &grant, nil
		}
	}
	return nil, nil
}
func (s *fakeStore) ListGrants(context.Context, int, int) ([]TwinkleGrant, bool, error) {
	return s.grants, false, nil
}
func (s *fakeStore) GetCapabilityConfig(_ context.Context, capability AICapability) (*StoredCapabilityConfig, error) {
	return s.configs[capability], nil
}
func (s *fakeStore) UpsertCapabilityConfig(_ context.Context, cfg StoredCapabilityConfig, audit AuditEntry) error {
	stored := cfg
	s.configs[cfg.Capability] = &stored
	s.audits = append(s.audits, audit)
	return nil
}
func (s *fakeStore) GetProviderKey(_ context.Context, provider string) (*StoredProviderKey, error) {
	return s.keys[provider], nil
}
func (s *fakeStore) ListProviderKeys(context.Context) ([]StoredProviderKey, error) {
	out := make([]StoredProviderKey, 0, len(s.keys))
	for _, k := range s.keys {
		out = append(out, *k)
	}
	return out, nil
}
func (s *fakeStore) UpsertProviderKey(_ context.Context, key StoredProviderKey, audit AuditEntry) error {
	stored := key
	s.keys[key.Provider] = &stored
	s.audits = append(s.audits, audit)
	return nil
}
func (s *fakeStore) DeleteProviderKey(_ context.Context, provider string, audit AuditEntry) (bool, error) {
	_, ok := s.keys[provider]
	delete(s.keys, provider)
	s.audits = append(s.audits, audit)
	return ok, nil
}

type fakeDirectory struct {
	accounts map[string]DirectoryAccount
}

func (d fakeDirectory) ListUsers(context.Context, int, int, string) ([]DirectoryAccount, bool, error) {
	out := make([]DirectoryAccount, 0, len(d.accounts))
	for _, a := range d.accounts {
		out = append(out, a)
	}
	return out, false, nil
}
func (d fakeDirectory) EmailFor(_ context.Context, userID string) (string, error) {
	if a, ok := d.accounts[userID]; ok {
		return a.Email, nil
	}
	return "", nil
}

type fakeGranter struct {
	granted map[string]int
	deduped map[string]struct{}
	calls   int
}

func (g *fakeGranter) Balance(context.Context, string) (Balance, error) {
	return Balance{Basic: 100, Additional: 0, Total: 100}, nil
}

// Grant mirrors the real twinkle earn's per-(user, grant id) dedup, so the idempotency tests
// can fail if a replay reaches the credit twice.
func (g *fakeGranter) Grant(_ context.Context, targetUserID string, amount int, grantID string) (int, error) {
	g.calls++
	if g.granted == nil {
		g.granted = map[string]int{}
		g.deduped = map[string]struct{}{}
	}
	dedup := targetUserID + "\x00" + grantID
	if _, seen := g.deduped[dedup]; !seen {
		g.deduped[dedup] = struct{}{}
		g.granted[targetUserID] += amount
	}
	return g.granted[targetUserID], nil
}

type fakeStats struct{}

func (fakeStats) Counts(context.Context, string) (int, int, error) { return 2, 5, nil }

type fakeUsage struct{}

func (fakeUsage) Usage(context.Context) (AIUsage, error) { return AIUsage{}, nil }

type fakeJobs struct{}

func (fakeJobs) Health(context.Context) (JobHealth, error) { return JobHealth{}, nil }

type fakeCipher struct{}

func (fakeCipher) Encrypt(plaintext []byte) ([]byte, error) {
	return append([]byte("enc:"), plaintext...), nil
}
func (fakeCipher) Hint(string) string { return "…test" }

// fakeCatalog: openai + anthropic are the known slots; both implemented; openai supports both
// capabilities, anthropic LLM only (mirrors the real shape — no embedding for anthropic).
type fakeCatalog struct{}

func (fakeCatalog) Slots() []string { return []string{"openai", "anthropic"} }
func (fakeCatalog) SupportsLLM(p string) bool {
	return p == "openai" || p == "anthropic"
}
func (fakeCatalog) SupportsEmbedding(p string) bool    { return p == "openai" }
func (fakeCatalog) ImplementedLLM(p string) bool       { return p == "openai" || p == "anthropic" }
func (fakeCatalog) ImplementedEmbedding(p string) bool { return p == "openai" }

func newTestService(t *testing.T, store Store, deps func(*ServiceDeps)) *Service {
	t.Helper()
	d := ServiceDeps{
		Store:     store,
		Directory: fakeDirectory{accounts: map[string]DirectoryAccount{}},
		Twinkle:   &fakeGranter{},
		MemStats:  fakeStats{},
		Usage:     fakeUsage{},
		Jobs:      fakeJobs{},
		Cipher:    fakeCipher{},
		Catalog:   fakeCatalog{},
		NewID:     func() string { return "id-1" },
	}
	if deps != nil {
		deps(&d)
	}
	svc, err := NewService(d)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc
}

// --- tests -----------------------------------------------------------------------------------

func TestIsAdminUnionOfSeedAndPromoted(t *testing.T) {
	store := newFakeStore()
	store.promoted["promoted-user"] = PromotedAdmin{UserID: "promoted-user"}
	svc := newTestService(t, store, func(d *ServiceDeps) {
		d.SeedAdmins = "seed-user, admin@example.com"
		d.Directory = fakeDirectory{accounts: map[string]DirectoryAccount{
			"email-user": {UserID: "email-user", Email: "admin@example.com"},
		}}
	})
	ctx := context.Background()
	cases := map[string]bool{
		"seed-user":     true, // env-seed id
		"email-user":    true, // env-seed email resolved via directory
		"promoted-user": true, // DB-promoted
		"nobody":        false,
	}
	for userID, want := range cases {
		got, err := svc.IsAdmin(ctx, userID)
		if err != nil {
			t.Fatalf("IsAdmin(%s): %v", userID, err)
		}
		if got != want {
			t.Errorf("IsAdmin(%s) = %v, want %v", userID, got, want)
		}
	}
}

func TestDevModeMakesEveryoneAdmin(t *testing.T) {
	svc := newTestService(t, newFakeStore(), func(d *ServiceDeps) { d.DevMode = true })
	got, err := svc.IsAdmin(context.Background(), "any-user")
	if err != nil || !got {
		t.Fatalf("dev mode IsAdmin(any) = %v, %v; want true, nil", got, err)
	}
}

func TestRevokeSeedAdminIsRefused(t *testing.T) {
	store := newFakeStore()
	svc := newTestService(t, store, func(d *ServiceDeps) { d.SeedAdmins = "seed-user" })
	if _, err := svc.RevokeAdmin(context.Background(), "actor", "seed-user"); !errors.Is(err, ErrSeedAdminUndemotable) {
		t.Fatalf("RevokeAdmin(seed) err = %v, want ErrSeedAdminUndemotable", err)
	}
}

// A seed admin identified by EMAIL in ADMIN_USER_IDS is as undemotable as an id seed: a revoke
// targeting their resolved uuid is refused, and the response reports isAdmin=true, not a
// misleading false.
func TestRevokeSeedAdminByEmailIsRefused(t *testing.T) {
	store := newFakeStore()
	svc := newTestService(t, store, func(d *ServiceDeps) {
		d.SeedAdmins = "admin@example.com"
		d.Directory = fakeDirectory{accounts: map[string]DirectoryAccount{
			"email-user": {UserID: "email-user", Email: "Admin@Example.com"},
		}}
	})
	isAdmin, err := svc.RevokeAdmin(context.Background(), "actor", "email-user")
	if !errors.Is(err, ErrSeedAdminUndemotable) {
		t.Fatalf("RevokeAdmin(email seed) err = %v, want ErrSeedAdminUndemotable", err)
	}
	if !isAdmin {
		t.Error("RevokeAdmin(email seed) reported isAdmin=false for a still-admin seed")
	}
	// A non-seed user is still revocable when email seeds exist.
	if _, err := svc.RevokeAdmin(context.Background(), "actor", "plain-user"); err != nil {
		t.Fatalf("RevokeAdmin(non-seed) err = %v, want nil", err)
	}
}

// When email seeds exist and the directory lookup fails, the revoke fails CLOSED: nothing is
// deleted, no revoke_admin audit is written, and no misleading isAdmin=false is returned.
func TestRevokeAdminFailsClosedOnDirectoryError(t *testing.T) {
	store := newFakeStore()
	store.promoted["email-user"] = PromotedAdmin{UserID: "email-user"}
	svc := newTestService(t, store, func(d *ServiceDeps) {
		d.SeedAdmins = "admin@example.com"
		d.Directory = failingDirectory{}
	})
	if _, err := svc.RevokeAdmin(context.Background(), "actor", "email-user"); err == nil {
		t.Fatal("RevokeAdmin with a failing directory succeeded, want an error")
	}
	if _, stillPromoted := store.promoted["email-user"]; !stillPromoted {
		t.Error("revoke proceeded despite the directory failure")
	}
	if len(store.audits) != 0 {
		t.Errorf("audit rows = %d, want 0 (no revoke happened)", len(store.audits))
	}
}

type failingDirectory struct{}

func (failingDirectory) ListUsers(context.Context, int, int, string) ([]DirectoryAccount, bool, error) {
	return nil, false, errors.New("directory down")
}
func (failingDirectory) EmailFor(context.Context, string) (string, error) {
	return "", errors.New("directory down")
}

func TestGrantStardustCapAndIdempotency(t *testing.T) {
	store := newFakeStore()
	granter := &fakeGranter{}
	svc := newTestService(t, store, func(d *ServiceDeps) { d.Twinkle = granter })
	ctx := context.Background()

	if _, err := svc.GrantStardust(ctx, "actor", "u1", 0, "", ""); !errors.Is(err, ErrGrantAmountRange) {
		t.Fatalf("zero amount err = %v, want ErrGrantAmountRange", err)
	}
	if _, err := svc.GrantStardust(ctx, "actor", "u1", values.TwinkleAdminGrantMax+1, "", ""); !errors.Is(err, ErrGrantAmountRange) {
		t.Fatalf("over-cap amount err = %v, want ErrGrantAmountRange", err)
	}
	// An empty grant id is refused, never auto-minted: the money-path idempotency is
	// server-enforced, and no credit happens on the refused call.
	if _, err := svc.GrantStardust(ctx, "actor", "u1", 50, "", "  "); !errors.Is(err, ErrGrantIDRequired) {
		t.Fatalf("empty grant id err = %v, want ErrGrantIDRequired", err)
	}
	if granter.calls != 0 {
		t.Fatalf("granter called %d times before a valid grant id, want 0", granter.calls)
	}
	total, err := svc.GrantStardust(ctx, "actor", "u1", 50, "gift", "grant-1")
	if err != nil {
		t.Fatalf("GrantStardust: %v", err)
	}
	if total != 50 {
		t.Errorf("total = %d, want 50", total)
	}
	// A replay with the same grant id records no second grant row AND credits nothing twice.
	replayTotal, err := svc.GrantStardust(ctx, "actor", "u1", 50, "gift", "grant-1")
	if err != nil {
		t.Fatalf("replay: %v", err)
	}
	if replayTotal != 50 || granter.granted["u1"] != 50 {
		t.Errorf("replay credited again: total=%d granted=%d, want 50/50", replayTotal, granter.granted["u1"])
	}
	if len(store.grants) != 1 {
		t.Errorf("grants recorded = %d, want 1 (idempotent)", len(store.grants))
	}
	if len(store.audits) == 0 {
		t.Error("expected an audit row for the grant")
	}
	// The same grant id for a DIFFERENT grant (other user or amount) is refused before any
	// credit — the id is the idempotency key of one logical grant, never reusable.
	callsBefore := granter.calls
	if _, err := svc.GrantStardust(ctx, "actor", "u2", 50, "", "grant-1"); !errors.Is(err, ErrGrantIDConflict) {
		t.Fatalf("cross-user id reuse err = %v, want ErrGrantIDConflict", err)
	}
	if _, err := svc.GrantStardust(ctx, "actor", "u1", 60, "", "grant-1"); !errors.Is(err, ErrGrantIDConflict) {
		t.Fatalf("changed-amount id reuse err = %v, want ErrGrantIDConflict", err)
	}
	if granter.calls != callsBefore || granter.granted["u2"] != 0 {
		t.Errorf("a refused id reuse still reached the credit (calls %d→%d, u2=%d)", callsBefore, granter.calls, granter.granted["u2"])
	}
}

func TestSetProviderKeyEncryptsAndMasks(t *testing.T) {
	store := newFakeStore()
	svc := newTestService(t, store, nil)
	ctx := context.Background()
	key := "sk-secret"

	// Unknown provider slot is refused.
	if _, err := svc.SetProviderKey(ctx, "actor", "bogus", key); !errors.Is(err, ErrUnknownProvider) {
		t.Fatalf("unknown provider err = %v, want ErrUnknownProvider", err)
	}
	info, err := svc.SetProviderKey(ctx, "actor", "openai", key)
	if err != nil {
		t.Fatalf("SetProviderKey: %v", err)
	}
	if !info.KeySet || info.KeyHint == key {
		t.Errorf("key leaked: keySet=%v hint=%q", info.KeySet, info.KeyHint)
	}
	stored := store.keys["openai"]
	if stored == nil || string(stored.APIKeyEncrypted) == key {
		t.Error("stored key must be encrypted at rest, never plaintext")
	}
	// ListProviderKeys masks too and reports capability support.
	list, err := svc.ListProviderKeys(ctx)
	if err != nil {
		t.Fatalf("ListProviderKeys: %v", err)
	}
	for _, p := range list {
		if p.KeyHint == key {
			t.Error("ListProviderKeys returned the plaintext key")
		}
	}
}

// The hint SHAPE is asserted with the real secretbox cipher (the fakeCipher's constant hint
// can never equal the key, so the fake-based assertion cannot fail if masking breaks).
func TestSetProviderKeyHintShapeWithRealCipher(t *testing.T) {
	box, err := secretbox.New(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatalf("secretbox.New: %v", err)
	}
	store := newFakeStore()
	svc := newTestService(t, store, func(d *ServiceDeps) { d.Cipher = box })
	key := "sk-live-abcdefgh"

	info, err := svc.SetProviderKey(context.Background(), "actor", "openai", key)
	if err != nil {
		t.Fatalf("SetProviderKey: %v", err)
	}
	if info.KeyHint != secretbox.Hint(key) {
		t.Errorf("hint = %q, want the real masked hint %q", info.KeyHint, secretbox.Hint(key))
	}
	if !strings.HasPrefix(info.KeyHint, "…") || strings.Contains(info.KeyHint, key) || len(info.KeyHint) >= len(key) {
		t.Errorf("hint %q is not a short masked tail of the key", info.KeyHint)
	}
	if stored := store.keys["openai"]; stored == nil || bytes.Contains(stored.APIKeyEncrypted, []byte(key)) {
		t.Error("stored ciphertext must not embed the plaintext key")
	}
}

func TestSetAIConfigRequiresSupportKeyAndImplementation(t *testing.T) {
	store := newFakeStore()
	svc := newTestService(t, store, nil)
	ctx := context.Background()

	// No key yet → refused.
	if _, err := svc.SetAIConfig(ctx, "actor", CapabilityLLM, "openai", "gpt"); !errors.Is(err, ErrProviderKeyMissing) {
		t.Fatalf("no-key err = %v, want ErrProviderKeyMissing", err)
	}
	if _, err := svc.SetProviderKey(ctx, "actor", "openai", "sk"); err != nil {
		t.Fatalf("SetProviderKey: %v", err)
	}
	if _, err := svc.SetProviderKey(ctx, "actor", "anthropic", "sk"); err != nil {
		t.Fatalf("SetProviderKey: %v", err)
	}
	// anthropic has a key but does not support embedding → capability mismatch.
	if _, err := svc.SetAIConfig(ctx, "actor", CapabilityEmbedding, "anthropic", "m"); !errors.Is(err, ErrProviderCapabilityMismatch) {
		t.Fatalf("embedding-on-anthropic err = %v, want ErrProviderCapabilityMismatch", err)
	}
	// openai LLM with a key + support + implemented → ok.
	sel, err := svc.SetAIConfig(ctx, "actor", CapabilityLLM, "openai", "gpt")
	if err != nil {
		t.Fatalf("SetAIConfig: %v", err)
	}
	if sel.Provider != "openai" || sel.Source != "db" {
		t.Errorf("selection = %+v, want openai/db", sel)
	}
}
