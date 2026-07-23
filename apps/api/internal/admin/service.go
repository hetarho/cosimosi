package admin

import (
	"context"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// Service is the admin console's use-case layer: the authorization rule plus admin-management,
// user-list, stardust-grant, AI-config, and dashboard behaviors. All policy lives here (§2.9#7);
// the handler is a thin proto↔domain map. Cross-context work goes strictly through the ports.
type Service struct {
	store      Store
	directory  AccountDirectory
	stardust   TwinkleGranter
	memStats   MemoryStats
	usage      AIUsageReader
	jobs       JobHealthReader
	cipher     Cipher
	validator  AIProviderValidator
	envConfig  AIEnvConfig
	seedIDs    map[string]struct{}
	seedEmails map[string]struct{}
	devMode    bool
	now        func() time.Time
	newID      func() string
}

// ServiceDeps carries the concrete adapters injected at the composition root. SeedAdmins is the
// raw ADMIN_USER_IDS env value (comma-separated Supabase ids and/or verified emails).
type ServiceDeps struct {
	Store      Store
	Directory  AccountDirectory
	Twinkle    TwinkleGranter
	MemStats   MemoryStats
	Usage      AIUsageReader
	Jobs       JobHealthReader
	Cipher     Cipher
	Validator  AIProviderValidator
	EnvConfig  AIEnvConfig
	SeedAdmins string
	// DevMode makes every authenticated caller an admin — set ONLY from the dev-auth bypass
	// (COSIMOSI_DEV_AUTH), never in production, so `pnpm dev` reaches /admin without seeding ids.
	DevMode bool
	// Now/NewID are test seams; nil selects the real UTC clock and the platform id.
	Now   func() time.Time
	NewID func() string
}

func NewService(deps ServiceDeps) (*Service, error) {
	switch {
	case deps.Store == nil:
		return nil, ErrStoreRequired
	case deps.Directory == nil:
		return nil, ErrDirectoryRequired
	case deps.Twinkle == nil:
		return nil, ErrStardustRequired
	case deps.MemStats == nil:
		return nil, ErrMemoryStats
	case deps.Usage == nil:
		return nil, ErrUsageRequired
	case deps.Jobs == nil:
		return nil, ErrJobsRequired
	case deps.Cipher == nil:
		return nil, ErrCipherRequired
	case deps.Validator == nil:
		return nil, ErrValidatorRequired
	}
	ids, emails := parseSeedAdmins(deps.SeedAdmins)
	svc := &Service{
		store:      deps.Store,
		directory:  deps.Directory,
		stardust:   deps.Twinkle,
		memStats:   deps.MemStats,
		usage:      deps.Usage,
		jobs:       deps.Jobs,
		cipher:     deps.Cipher,
		validator:  deps.Validator,
		envConfig:  deps.EnvConfig,
		seedIDs:    ids,
		seedEmails: emails,
		devMode:    deps.DevMode,
		now:        deps.Now,
		newID:      deps.NewID,
	}
	if svc.now == nil {
		svc.now = func() time.Time { return time.Now().UTC() }
	}
	if svc.newID == nil {
		svc.newID = platform.NewID
	}
	return svc, nil
}

// parseSeedAdmins splits ADMIN_USER_IDS into an id set and an email set (an entry with '@' is an
// email; emails compare case-insensitively). Both are the undemotable trust anchor.
func parseSeedAdmins(raw string) (ids map[string]struct{}, emails map[string]struct{}) {
	ids = map[string]struct{}{}
	emails = map[string]struct{}{}
	for _, part := range strings.Split(raw, ",") {
		entry := strings.TrimSpace(part)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "@") {
			emails[strings.ToLower(entry)] = struct{}{}
			continue
		}
		ids[entry] = struct{}{}
	}
	return ids, emails
}

// IsAdmin reports whether the caller is an admin: a seed id, a seed email (resolved through the
// directory only when email seeds exist, so the common id-only case makes no extra call), or a
// DB-promoted row. The admin-authorization interceptor calls this to gate every admin.v1 method.
func (s *Service) IsAdmin(ctx context.Context, userID string) (bool, error) {
	if userID == "" {
		return false, nil
	}
	// Dev-auth bypass: any authenticated caller is an admin so `pnpm dev` reaches /admin without
	// seeding ADMIN_USER_IDS. Gated behind COSIMOSI_DEV_AUTH — never set in production.
	if s.devMode {
		return true, nil
	}
	if _, ok := s.seedIDs[userID]; ok {
		return true, nil
	}
	if len(s.seedEmails) > 0 {
		email, err := s.directory.EmailFor(ctx, userID)
		if err == nil {
			if _, ok := s.seedEmails[strings.ToLower(strings.TrimSpace(email))]; ok {
				return true, nil
			}
		}
		// A directory lookup failure is not authorization — fall through to the DB role check.
	}
	return s.store.IsPromoted(ctx, userID)
}

// GetAdminSelf is the FE gate/affordance source: whether the caller is an admin.
func (s *Service) GetAdminSelf(ctx context.Context, userID string) (bool, error) {
	return s.IsAdmin(ctx, userID)
}

// ListAdmins returns the effective admin set: seed ids first (undemotable), then DB-promoted rows.
func (s *Service) ListAdmins(ctx context.Context) ([]AdminEntry, error) {
	promoted, err := s.store.ListPromoted(ctx)
	if err != nil {
		return nil, err
	}
	entries := make([]AdminEntry, 0, len(s.seedIDs)+len(promoted))
	for id := range s.seedIDs {
		entries = append(entries, AdminEntry{UserID: id, IsSeed: true})
	}
	for _, p := range promoted {
		if _, isSeed := s.seedIDs[p.UserID]; isSeed {
			continue // a seed id also promoted in DB is reported once, as seed
		}
		entries = append(entries, AdminEntry{
			UserID:    p.UserID,
			GrantedBy: p.GrantedBy,
			GrantedAt: p.GrantedAt,
		})
	}
	return entries, nil
}

// GrantAdmin promotes a user (idempotent) and audits it. Returns the new admin status (always
// true on success).
func (s *Service) GrantAdmin(ctx context.Context, actor string, userID string) (bool, error) {
	target := strings.TrimSpace(userID)
	if target == "" {
		return false, ErrUserIDRequired
	}
	audit := s.auditEntry(actor, ActionGrantAdmin, target, nil)
	if err := s.store.Promote(ctx, target, actor, audit); err != nil {
		return false, err
	}
	return true, nil
}

// RevokeAdmin demotes a DB-promoted admin and audits it. A seed admin is refused
// (ErrSeedAdminUndemotable) — the env set is the trust anchor. Returns the admin status after the
// call (false when demoted or already not promoted).
func (s *Service) RevokeAdmin(ctx context.Context, actor string, userID string) (bool, error) {
	target := strings.TrimSpace(userID)
	if target == "" {
		return false, ErrUserIDRequired
	}
	if _, isSeed := s.seedIDs[target]; isSeed {
		return true, ErrSeedAdminUndemotable
	}
	audit := s.auditEntry(actor, ActionRevokeAdmin, target, nil)
	if _, err := s.store.Revoke(ctx, target, audit); err != nil {
		return false, err
	}
	return false, nil
}

// ListUsers returns one page of account metadata joined with balance, non-content counts, and
// admin status. Metadata only — no memory content is read ([I2]). pageSize <= 0 uses the
// configured default.
func (s *Service) ListUsers(ctx context.Context, page int, pageSize int, query string) (UserPage, error) {
	if pageSize <= 0 {
		pageSize = values.AdminUserListPageSize
	}
	if page < 0 {
		page = 0
	}
	accounts, hasMore, err := s.directory.ListUsers(ctx, page, pageSize, strings.TrimSpace(query))
	if err != nil {
		return UserPage{}, err
	}
	promoted, err := s.store.ListPromoted(ctx)
	if err != nil {
		return UserPage{}, err
	}
	promotedSet := make(map[string]struct{}, len(promoted))
	for _, p := range promoted {
		promotedSet[p.UserID] = struct{}{}
	}
	users := make([]UserSummary, 0, len(accounts))
	for _, acct := range accounts {
		balance, err := s.stardust.Balance(ctx, acct.UserID)
		if err != nil {
			return UserPage{}, err
		}
		diaryCount, starCount, err := s.memStats.Counts(ctx, acct.UserID)
		if err != nil {
			return UserPage{}, err
		}
		isSeed := s.isSeedIdentity(acct.UserID, acct.Email)
		_, isPromoted := promotedSet[acct.UserID]
		users = append(users, UserSummary{
			UserID:              acct.UserID,
			Email:               acct.Email,
			SignupAt:            acct.SignupAt,
			IsAdmin:             isSeed || isPromoted,
			IsSeedAdmin:         isSeed,
			Balance:             balance,
			DiaryCount:          diaryCount,
			EpisodicMemoryCount: starCount,
		})
	}
	return UserPage{Users: users, Page: page, HasMore: hasMore}, nil
}

func (s *Service) isSeedIdentity(userID string, email string) bool {
	if _, ok := s.seedIDs[userID]; ok {
		return true
	}
	if _, ok := s.seedEmails[strings.ToLower(strings.TrimSpace(email))]; ok {
		return true
	}
	return false
}

// GrantStardust credits additional Twinkle to a user (별가루 증정): validate the cap, credit through
// the twinkle earn (idempotent by grantID), then record the grant + audit rows in one admin tx.
// Both sides key off grantID, so a replay never double-credits or double-records. Returns the
// target's balance total after the grant. ([G3] admin_grant, A7; nothing is deleted/priced/spent.)
func (s *Service) GrantStardust(ctx context.Context, actor string, userID string, amount int, note string, grantID string) (int, error) {
	target := strings.TrimSpace(userID)
	if target == "" {
		return 0, ErrUserIDRequired
	}
	if amount <= 0 || amount > values.TwinkleAdminGrantMax {
		return 0, ErrGrantAmountRange
	}
	// The client supplies grant_id so a retried grant is idempotent end to end (the twinkle earn
	// and the admin_stardust_grants row both key off it); an empty id mints one (no dedup).
	grantID = strings.TrimSpace(grantID)
	if grantID == "" {
		grantID = s.newID()
	}
	total, err := s.stardust.Grant(ctx, target, amount, grantID)
	if err != nil {
		return 0, err
	}
	grant := TwinkleGrant{
		ID:         grantID,
		GrantedBy:  actor,
		TargetUser: target,
		Amount:     amount,
		Note:       strings.TrimSpace(note),
		CreatedAt:  s.now(),
	}
	audit := s.auditEntry(actor, ActionGrantStardust, target, map[string]string{
		"amount":   itoa(amount),
		"grant_id": grantID,
	})
	if _, err := s.store.RecordGrant(ctx, grant, audit); err != nil {
		return 0, err
	}
	return total, nil
}

// ListTwinkleGrants returns one page of the grant history (newest first) for accountability.
func (s *Service) ListTwinkleGrants(ctx context.Context, page int, pageSize int) (GrantPage, error) {
	if pageSize <= 0 {
		pageSize = values.AdminUserListPageSize
	}
	if page < 0 {
		page = 0
	}
	grants, hasMore, err := s.store.ListGrants(ctx, page, pageSize)
	if err != nil {
		return GrantPage{}, err
	}
	return GrantPage{Grants: grants, Page: page, HasMore: hasMore}, nil
}

// GetAIConfig returns the effective provider config per capability, key masked. A stored DB row
// wins (source "db"); otherwise the env selection is reported (source "env" when a provider is
// configured, else "unset"). The plaintext key is never returned.
func (s *Service) GetAIConfig(ctx context.Context) ([]EffectiveAIConfig, error) {
	capabilities := []AICapability{CapabilityLLM, CapabilityEmbedding}
	out := make([]EffectiveAIConfig, 0, len(capabilities))
	for _, capability := range capabilities {
		stored, err := s.store.GetAIConfig(ctx, capability)
		if err != nil {
			return nil, err
		}
		if stored != nil {
			out = append(out, EffectiveAIConfig{
				Capability: capability,
				Provider:   stored.Provider,
				Model:      stored.Model,
				BaseURL:    stored.BaseURL,
				KeySet:     len(stored.APIKeyEncrypted) > 0,
				KeyHint:    stored.KeyHint,
				Source:     "db",
				UpdatedBy:  stored.UpdatedBy,
				UpdatedAt:  stored.UpdatedAt,
			})
			continue
		}
		provider, model, baseURL, keySet := s.envSnapshot(capability)
		source := "unset"
		if provider != "" || keySet {
			source = "env"
		}
		out = append(out, EffectiveAIConfig{
			Capability: capability,
			Provider:   provider,
			Model:      model,
			BaseURL:    baseURL,
			KeySet:     keySet,
			Source:     source,
		})
	}
	return out, nil
}

func (s *Service) envSnapshot(capability AICapability) (provider, model, baseURL string, keySet bool) {
	if s.envConfig == nil {
		return "", "", "", false
	}
	return s.envConfig.EnvConfig(capability)
}

// SetAIConfig validates the provider slot (and embedding dimension) then upserts the capability's
// config, encrypting a supplied key at rest. Omitting the key keeps the stored one. Applied
// without redeploy — the factory's config source rebuilds on the next call (T010).
func (s *Service) SetAIConfig(ctx context.Context, actor string, capability AICapability, provider string, model string, baseURL string, apiKey *string) (EffectiveAIConfig, error) {
	if !KnownCapability(capability) {
		return EffectiveAIConfig{}, ErrUnknownCapability
	}
	provider = strings.TrimSpace(provider)
	model = strings.TrimSpace(model)
	baseURL = strings.TrimSpace(baseURL)
	if provider == "" {
		return EffectiveAIConfig{}, ErrProviderRequired
	}
	switch capability {
	case CapabilityLLM:
		if err := s.validator.ValidateLLM(provider, model); err != nil {
			return EffectiveAIConfig{}, err
		}
	case CapabilityEmbedding:
		if err := s.validator.ValidateEmbedding(provider, model); err != nil {
			return EffectiveAIConfig{}, err
		}
	}

	cfg := StoredAIConfig{
		Capability: capability,
		Provider:   provider,
		Model:      model,
		BaseURL:    baseURL,
		UpdatedBy:  actor,
		UpdatedAt:  s.now(),
	}
	// A supplied key replaces the stored one; omitting it keeps the existing ciphertext + hint.
	if apiKey != nil {
		key := strings.TrimSpace(*apiKey)
		if key != "" {
			encrypted, err := s.cipher.Encrypt([]byte(key))
			if err != nil {
				return EffectiveAIConfig{}, err
			}
			cfg.APIKeyEncrypted = encrypted
			cfg.KeyHint = s.cipher.Hint(key)
		}
	} else if existing, err := s.store.GetAIConfig(ctx, capability); err == nil && existing != nil {
		cfg.APIKeyEncrypted = existing.APIKeyEncrypted
		cfg.KeyHint = existing.KeyHint
	} else if err != nil {
		return EffectiveAIConfig{}, err
	}

	audit := s.auditEntry(actor, ActionSetAIConfig, string(capability), map[string]string{
		"provider": provider,
		"model":    model,
		// Never the key — only whether one was set on this write.
		"key_updated": boolStr(apiKey != nil && strings.TrimSpace(deref(apiKey)) != ""),
	})
	if err := s.store.UpsertAIConfig(ctx, cfg, audit); err != nil {
		return EffectiveAIConfig{}, err
	}
	return EffectiveAIConfig{
		Capability: capability,
		Provider:   cfg.Provider,
		Model:      cfg.Model,
		BaseURL:    cfg.BaseURL,
		KeySet:     len(cfg.APIKeyEncrypted) > 0,
		KeyHint:    cfg.KeyHint,
		Source:     "db",
		UpdatedBy:  cfg.UpdatedBy,
		UpdatedAt:  cfg.UpdatedAt,
	}, nil
}

// GetAIUsage returns the metering snapshot for the usage dashboard.
func (s *Service) GetAIUsage(ctx context.Context) (AIUsage, error) {
	return s.usage.Usage(ctx)
}

// GetJobHealth returns the background-job queue aggregate.
func (s *Service) GetJobHealth(ctx context.Context) (JobHealth, error) {
	return s.jobs.Health(ctx)
}

func (s *Service) auditEntry(actor string, action string, target string, detail map[string]string) AuditEntry {
	return AuditEntry{
		ID:     s.newID(),
		Actor:  actor,
		Action: action,
		Target: target,
		Detail: detail,
	}
}
