// Package admin is the operator-console bounded context (spec 34): runtime LLM
// provider/key management (AES-256-GCM envelope — crypto.go) and the operations
// dashboard aggregates. A separate context from the star graph and settings,
// with its own AdminService; it also implements llm.ConfigSource/UsageSink so
// the llm Resolver stays ignorant of the DB and this package (constitution §7).
//
// Domain types here are pure values — no json/db/proto tags (constitution §5).
package admin

import (
	"context"
	"errors"
	"time"
)

// Validation sentinels — the handler maps these to Connect codes (spec-17 pattern).
var (
	ErrUnknownProvider = errors.New("admin: unknown provider")
	ErrInvalidModel    = errors.New("admin: model is not in the provider's model list")
	ErrEmptyKey        = errors.New("admin: api key must not be empty")
	// ErrKeyTooShort also protects the last4 display: a key no longer than its
	// own suffix would otherwise be echoed back in full as key_last4.
	ErrKeyTooShort = errors.New("admin: api key is implausibly short (min 8 chars)")
	ErrNoStoredKey = errors.New("admin: no key stored for this provider")
)

// ProviderConfig is one provider card: the code matrix's read-only default
// model merged with the stored overrides. KeyUpdatedAt is zero when no key
// was ever stored.
type ProviderConfig struct {
	Provider     string
	DefaultModel string
	Models       []string
	KeySet       bool
	KeyLast4     string
	KeyUpdatedAt time.Time
}

// Selection is the active extraction LLM. Model "" = the provider's default.
type Selection struct {
	Provider string
	Model    string
}

// LLMConfig is the full console view: every matrix provider (DB merged over
// it), the active selection, and whether the encryption master key is set.
type LLMConfig struct {
	Providers       []ProviderConfig
	Active          Selection
	EncryptionReady bool
}

// TestResult is one key-validation ping's outcome.
type TestResult struct {
	OK      bool
	Message string
	Latency time.Duration
}

// UsageRow is one llm_usage_daily row (UTC day × provider × model × kind).
type UsageRow struct {
	Day          time.Time
	Provider     string
	Model        string
	Kind         string
	Calls        int64
	InputTokens  int64
	OutputTokens int64
}

// DayCount is one point of the records-per-day series.
type DayCount struct {
	Day   time.Time
	Count int64
}

// Overview is the dashboard payload: service totals, job-queue health, the
// 30-day record series, and 30 days of LLM token usage.
type Overview struct {
	Users          int64
	Records        int64
	Memories       int64
	Synapses       int64
	JobsPending    int64
	JobsProcessing int64
	JobsFailed     int64
	JobsDone24h    int64
	RecordSeries   []DayCount
	Usage          []UsageRow
}

// ProviderRow is the stored override row for one provider (repository read
// model — what the DB knows, before merging with the code matrix).
type ProviderRow struct {
	Provider     string
	Models       []string
	KeySet       bool
	KeyLast4     string
	KeyUpdatedAt time.Time
}

// JobCounts is the queue-health read model.
type JobCounts struct {
	Pending    int64
	Processing int64
	Failed     int64
	Done24h    int64
}

// Totals is the service-totals read model. Users is COUNT(DISTINCT user_id)
// FROM records by default; repositories on a Supabase DB add auth.users when
// that table exists (to_regclass guard — acceptance 4.3).
type Totals struct {
	Users    int64
	Records  int64
	Memories int64
	Synapses int64
}

// Repository is the persistence port (pgx/sqlc impl in repository_pg.go).
type Repository interface {
	// ListProviderRows returns only the providers with stored overrides.
	ListProviderRows(ctx context.Context) ([]ProviderRow, error)
	// GetProviderKeyEnc returns the encrypted key blob, or nil when the
	// provider has no row / no key.
	GetProviderKeyEnc(ctx context.Context, provider string) ([]byte, error)
	UpsertProviderKey(ctx context.Context, provider string, enc []byte, last4 string) error
	ClearProviderKey(ctx context.Context, provider string) error
	UpsertProviderModels(ctx context.Context, provider string, models []string) error
	// GetSelection: ok=false when no selection row exists (env fallback).
	GetSelection(ctx context.Context) (Selection, bool, error)
	UpsertSelection(ctx context.Context, sel Selection) error
	// AddUsage upsert-accumulates one day×provider×model×kind row.
	AddUsage(ctx context.Context, day time.Time, provider, model, kind string, calls, inputTokens, outputTokens int64) error
	ListUsageSince(ctx context.Context, since time.Time) ([]UsageRow, error)
	Totals(ctx context.Context) (Totals, error)
	JobCounts(ctx context.Context) (JobCounts, error)
	RecordDaySeries(ctx context.Context) ([]DayCount, error)
}
