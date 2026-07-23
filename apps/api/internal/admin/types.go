package admin

import "time"

// AICapability is the AI slot a provider config / usage row applies to. LLM and embedding are
// selected independently (the AI-provider abstraction). A closed TEXT set, not a PG enum.
type AICapability string

const (
	CapabilityLLM       AICapability = "llm"
	CapabilityEmbedding AICapability = "embedding"
)

// KnownCapability reports whether c is a real capability slot.
func KnownCapability(c AICapability) bool {
	return c == CapabilityLLM || c == CapabilityEmbedding
}

// PromotedAdmin is one DB-promoted admin row (admin_users). Seed admins are not stored here.
type PromotedAdmin struct {
	UserID    string
	GrantedBy string
	GrantedAt time.Time
}

// AdminEntry is one member of the effective admin set for the console list: a seed admin (IsSeed,
// no granted_by/at) or a promoted one.
type AdminEntry struct {
	UserID    string
	IsSeed    bool
	GrantedBy string
	GrantedAt time.Time
}

// Balance is the target user's two-tier Twinkle balance, read through the stardust port.
type Balance struct {
	Basic      int
	Additional int
	Total      int
}

// UserSummary is one account row for the admin user list — metadata only ([I2]): identity,
// signup, admin status, balance, and non-content counts. There is deliberately no field for diary
// text, emotion, position, or any memory content.
type UserSummary struct {
	UserID              string
	Email               string
	SignupAt            time.Time
	IsAdmin             bool
	IsSeedAdmin         bool
	Balance             Balance
	DiaryCount          int
	EpisodicMemoryCount int
}

// UserPage is one page of the user list.
type UserPage struct {
	Users   []UserSummary
	Page    int
	HasMore bool
}

// TwinkleGrant is one admin gift record (admin_stardust_grants) — the accountability row behind a
// 별가루 증정. Its ID is the client idempotency key.
type TwinkleGrant struct {
	ID         string
	GrantedBy  string
	TargetUser string
	Amount     int
	Note       string
	CreatedAt  time.Time
}

// GrantPage is one page of the grant history.
type GrantPage struct {
	Grants  []TwinkleGrant
	Page    int
	HasMore bool
}

// StoredProviderKey is a persisted ai_provider_keys row: one provider's encrypted API key.
// APIKeyEncrypted is the ciphertext (never the plaintext); KeyHint is a masked tail for display.
// ListProviderKeys reads leave APIKeyEncrypted nil (the key column is not selected).
type StoredProviderKey struct {
	Provider        string
	APIKeyEncrypted []byte
	KeyHint         string
	UpdatedBy       string
	UpdatedAt       time.Time
}

// StoredCapabilityConfig is a persisted ai_provider_config row: which keyed provider + model a
// capability uses. The key is NOT here — it comes from ai_provider_keys by provider.
type StoredCapabilityConfig struct {
	Capability AICapability
	Provider   string
	Model      string
	UpdatedBy  string
	UpdatedAt  time.Time
}

// ProviderKeyInfo is one provider slot's key status + capability support, for the console's
// per-provider key management. The plaintext key is NEVER present — only KeySet + KeyHint.
type ProviderKeyInfo struct {
	Provider             string
	KeySet               bool
	KeyHint              string
	SupportsLLM          bool
	SupportsEmbedding    bool
	ImplementedLLM       bool
	ImplementedEmbedding bool
	UpdatedBy            string
	UpdatedAt            time.Time
}

// CapabilitySelection is what GetAIConfig returns per capability — the selected provider + model.
// Source is where it comes from: "db", "env", or "unset".
type CapabilitySelection struct {
	Capability AICapability
	Provider   string
	Model      string
	Source     string
	UpdatedBy  string
	UpdatedAt  time.Time
}

// AIUsage is the metering snapshot for the usage dashboard. ProcessLocal flags the the admin console
// limitation that the underlying meter is in-process/in-memory.
type AIUsage struct {
	Capabilities    []CapabilityUsage
	PerCallTokenCap int
	WindowUTCDay    string
	ProcessLocal    bool
}

// CapabilityUsage is one capability's call count against its daily cap.
type CapabilityUsage struct {
	Capability AICapability
	CallsToday int
	DailyCap   int
}

// JobHealth is the aggregate background-job queue snapshot for the health dashboard.
type JobHealth struct {
	Pending      int64
	Running      int64
	Done         int64
	Failed       int64
	DeadLettered int64
}

// AuditEntry is one append-only admin_audit_log row for a sensitive mutation. Detail is a small
// JSON object and NEVER carries a plaintext API key.
type AuditEntry struct {
	ID     string
	Actor  string
	Action string
	Target string
	Detail map[string]string
}

// The admin_audit_log action names (a closed set).
const (
	ActionGrantAdmin       = "grant_admin"
	ActionRevokeAdmin      = "revoke_admin"
	ActionSetAIConfig      = "set_ai_config"
	ActionSetProviderKey   = "set_provider_key"
	ActionClearProviderKey = "clear_provider_key"
	ActionGrantStardust    = "grant_stardust"
)
