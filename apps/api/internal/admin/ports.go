package admin

import (
	"context"
	"time"
)

// The admin use-cases' consumer-owned ports (§2.4/§2.9#6). Declared HERE because the admin
// service is the consumer. Domain-shaped in and out — no proto, sqlc, pgx, or SDK type crosses
// any of them, and no other context's internal types either (CC8): cross-context facts arrive as
// scalars/DTOs owned by this package.

// Store is admin/pg's persistence surface: the DB-promoted admin roles, the grant + audit
// records, and the AI provider config rows. Each mutating method writes its admin_audit_log row
// in the SAME transaction as the mutation, so a mutation is never recorded without its audit
// trail ([I1], A9). The concrete is a struct in admin/pg; this interface is consumer-owned.
type Store interface {
	// IsPromoted reports whether a DB-promoted admin_users row exists for userID.
	IsPromoted(ctx context.Context, userID string) (bool, error)
	// ListPromoted returns every DB-promoted admin (seed admins are not stored).
	ListPromoted(ctx context.Context) ([]PromotedAdmin, error)
	// Promote adds an admin_users row (idempotent) and appends the audit entry, in one tx.
	Promote(ctx context.Context, userID string, grantedBy string, audit AuditEntry) error
	// Revoke removes the admin_users row and appends the audit entry, in one tx. removed=false
	// when there was no promoted row (a no-op demotion is not an error).
	Revoke(ctx context.Context, userID string, audit AuditEntry) (removed bool, err error)

	// RecordGrant writes the admin_stardust_grants row and its audit entry in one tx. applied is
	// false when a row with the same grant id already exists (an idempotent replay) — the caller
	// then skips nothing on the twinkle side because that earn is idempotent by the same id.
	RecordGrant(ctx context.Context, grant TwinkleGrant, audit AuditEntry) (applied bool, err error)
	// ListGrants returns one page of the grant history, newest first.
	ListGrants(ctx context.Context, page int, pageSize int) ([]TwinkleGrant, bool, error)

	// GetCapabilityConfig reads one capability's selected provider+model, or nil when unset.
	GetCapabilityConfig(ctx context.Context, capability AICapability) (*StoredCapabilityConfig, error)
	// UpsertCapabilityConfig writes the selection row and its audit entry in one tx.
	UpsertCapabilityConfig(ctx context.Context, cfg StoredCapabilityConfig, audit AuditEntry) error

	// GetProviderKey reads one provider's stored key row (with ciphertext), or nil when unset.
	GetProviderKey(ctx context.Context, provider string) (*StoredProviderKey, error)
	// ListProviderKeys reads every stored key row WITHOUT the ciphertext (hint + metadata only).
	ListProviderKeys(ctx context.Context) ([]StoredProviderKey, error)
	// UpsertProviderKey writes the encrypted key row and its audit entry in one tx.
	UpsertProviderKey(ctx context.Context, key StoredProviderKey, audit AuditEntry) error
	// DeleteProviderKey removes a provider's key row and appends the audit entry, in one tx.
	// removed=false when there was no key (a no-op clear is not an error).
	DeleteProviderKey(ctx context.Context, provider string, audit AuditEntry) (removed bool, err error)
}

// AccountDirectory is the identity source for the user list — a composition-root adapter over the
// Supabase Auth Admin API (a keyless fake in tests/dev). It exposes only account metadata; it
// never reaches memory content ([I2]).
type AccountDirectory interface {
	// ListUsers enumerates accounts (id, email, signup) with prefix search + pagination.
	ListUsers(ctx context.Context, page int, pageSize int, query string) ([]DirectoryAccount, bool, error)
	// EmailFor resolves one account's email — used only to match email-based ADMIN_USER_IDS
	// seed entries against the authenticated caller (whose context carries the id, not the email).
	EmailFor(ctx context.Context, userID string) (string, error)
}

// DirectoryAccount is one account's identity metadata from the directory.
type DirectoryAccount struct {
	UserID   string
	Email    string
	SignupAt time.Time
}

// TwinkleGranter is the twinkle-economy seam the grant use-case drives (bound over twinkle's
// GetBalance + EarnAdminGrant at the composition root; admin never imports twinkle).
type TwinkleGranter interface {
	// Balance reads a user's two-tier balance.
	Balance(ctx context.Context, userID string) (Balance, error)
	// Grant credits `amount` additional Twinkle to targetUserID as an admin gift, idempotent by
	// grantID, and returns the balance total after the grant.
	Grant(ctx context.Context, targetUserID string, amount int, grantID string) (total int, err error)
}

// MemoryStats is memory's published non-content aggregate read (bound at the composition root).
// Its return values are COUNTS only — there is no content field, so [I2] holds at the type level.
type MemoryStats interface {
	Counts(ctx context.Context, userID string) (diaryCount int, starCount int, err error)
}

// AIUsageReader is the the AI-provider abstraction meter snapshot (bound over ai.Meter at the composition root).
type AIUsageReader interface {
	Usage(ctx context.Context) (AIUsage, error)
}

// JobHealthReader is the background-job queue aggregate (bound over memory's published job counts;
// jobs are memory-owned, read through this port — admin never queries the jobs table directly).
type JobHealthReader interface {
	Health(ctx context.Context) (JobHealth, error)
}

// Cipher encrypts an API key for storage and derives its masked display hint. The concrete is
// platform/secretbox (AES-GCM, key from LLM_KEY_ENCRYPTION_KEY). Admin never decrypts — that is the
// AI config source's job when it builds a provider client (T010).
type Cipher interface {
	Encrypt(plaintext []byte) ([]byte, error)
	Hint(plaintext string) string
}

// AIEnvConfig exposes the env-configured provider selection per capability, so GetAIConfig can
// report the effective config when no DB override row exists (the factory's DB → env → mock
// fallback, surfaced to the operator). Never returns a plaintext key — only whether one is set.
type AIEnvConfig interface {
	EnvConfig(capability AICapability) (provider string, model string, baseURL string, keySet bool)
}

// ProviderCatalog is the set of provider slots + their per-capability support and adapter-
// implementation status (bound over the AI registry at the composition root). The console offers
// key management for every slot, filters each capability's selectable providers by support, and
// refuses selecting an unimplemented provider — all read from here, so admin imports no registry.
type ProviderCatalog interface {
	Slots() []string
	SupportsLLM(provider string) bool
	SupportsEmbedding(provider string) bool
	ImplementedLLM(provider string) bool
	ImplementedEmbedding(provider string) bool
}
