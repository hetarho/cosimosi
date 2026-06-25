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

	// User-list / stardust-grant surface (spec 46).
	// ErrInvalidGrantAmount covers BOTH a non-positive amount and one too large to
	// fit the wallet's integer range — both are bad client input (InvalidArgument).
	// ErrStardustOverflow is reserved for the server-state case: a valid amount the
	// target's current balance can't absorb without overflowing (FailedPrecondition).
	ErrInvalidGrantAmount = errors.New("admin: grant amount must be a positive integer within range")
	ErrUserNotFound       = errors.New("admin: target user not found")
	ErrStardustOverflow   = errors.New("admin: grant would overflow the wallet balance")
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

// AdminUser is one row of the operator user list (spec 46): the user id, the
// effective stardust balance (the wallet row value, or starting_stardust when no
// wallet row exists yet), and whether the wallet row has been seeded.
type AdminUser struct {
	UserID       string
	Stardust     int64
	WalletSeeded bool
}

// ListUsersInput is the user-list query (keyset pagination, user_id ASC). The
// service clamps PageSize against the admin values before it reaches the repo.
type ListUsersInput struct {
	Query     string // case-insensitive contains filter on user_id ("" = all)
	PageSize  int    // 0 = default; capped by the service
	PageToken string // last user_id from the previous page ("" = first page)
}

// ListUsersResult is one page of users plus the keyset cursor for the next page
// ("" when the page is the last).
type ListUsersResult struct {
	Users         []AdminUser
	NextPageToken string
}

// GrantStardustInput is one admin corrective stardust grant. AdminUserID is the
// acting admin's verified JWT sub (audit), recorded in admin_stardust_grants.
type GrantStardustInput struct {
	AdminUserID  string
	TargetUserID string
	Amount       int64
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

	// ListUsers returns one page of users — auth.users on a Supabase DB, the
	// app-domain table user_id union locally (acceptance A2/A3) — filtered by a
	// case-insensitive user_id contains match, keyset-paginated by user_id ASC.
	// startingStardust is the effective balance shown for unseeded wallets;
	// limit is page_size+1 so the service can detect a following page.
	ListUsers(ctx context.Context, query, pageToken string, limit, startingStardust int) ([]AdminUser, error)
	// GrantStardust seeds the target wallet to startingStardust if absent, adds
	// amount (overflow-guarded), and writes the admin_stardust_grants audit row —
	// all in one transaction (A7/A8/A9). Returns ErrUserNotFound when the target
	// is unknown and ErrStardustOverflow when the add would exceed the wallet's
	// integer range, leaving wallet + audit untouched (A10).
	GrantStardust(ctx context.Context, in GrantStardustInput, startingStardust int) (AdminUser, error)
}
