package admin

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/cosimosi/backend/internal/db/gen"
)

// rowQuerier is the subset of pgx shared by *pgxpool.Pool and pgx.Tx — lets the
// auth.users-aware listing/existence helpers run on the pool or inside a grant tx.
type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// fallbackUserExistsSQL checks the app-domain table user_id union for a target.
// Raw SQL (not sqlc): sqlc's analyzer can't infer the param type across a
// multi-table UNION/EXISTS, but Postgres runs it fine at runtime.
const fallbackUserExistsSQL = `SELECT (
    EXISTS(SELECT 1 FROM records WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM memories WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM user_settings WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM user_wallet WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM user_owned_items WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM user_emotion_colors WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM universe_shares WHERE user_id = $1)
 OR EXISTS(SELECT 1 FROM invite_redemptions WHERE user_id = $1)
)::bool`

// pgRepository is the pgx/sqlc-backed Repository. The domain never sees
// pgtype/db tags (constitution §5).
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

func (r *pgRepository) ListProviderRows(ctx context.Context) ([]ProviderRow, error) {
	rows, err := gen.New(r.pool).ListLLMProviderConfigs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list provider configs: %w", err)
	}
	out := make([]ProviderRow, 0, len(rows))
	for _, row := range rows {
		pr := ProviderRow{Provider: row.Provider, Models: row.Models, KeySet: row.KeySet}
		if row.ApiKeyLast4 != nil {
			pr.KeyLast4 = *row.ApiKeyLast4
		}
		if row.UpdatedAt.Valid {
			pr.KeyUpdatedAt = row.UpdatedAt.Time
		}
		out = append(out, pr)
	}
	return out, nil
}

func (r *pgRepository) GetProviderKeyEnc(ctx context.Context, provider string) ([]byte, error) {
	enc, err := gen.New(r.pool).GetLLMProviderKeyEnc(ctx, provider)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return nil, nil // no row = no key — a normal state, not an error
	case err != nil:
		return nil, fmt.Errorf("get provider key: %w", err)
	}
	return enc, nil
}

func (r *pgRepository) UpsertProviderKey(ctx context.Context, provider string, enc []byte, last4 string) error {
	if err := gen.New(r.pool).UpsertLLMProviderKey(ctx, gen.UpsertLLMProviderKeyParams{
		Provider:    provider,
		ApiKeyEnc:   enc,
		ApiKeyLast4: &last4,
	}); err != nil {
		return fmt.Errorf("upsert provider key: %w", err)
	}
	return nil
}

func (r *pgRepository) ClearProviderKey(ctx context.Context, provider string) error {
	if err := gen.New(r.pool).ClearLLMProviderKey(ctx, provider); err != nil {
		return fmt.Errorf("clear provider key: %w", err)
	}
	return nil
}

func (r *pgRepository) UpsertProviderModels(ctx context.Context, provider string, models []string) error {
	if err := gen.New(r.pool).UpsertLLMProviderModels(ctx, gen.UpsertLLMProviderModelsParams{
		Provider: provider,
		Models:   models,
	}); err != nil {
		return fmt.Errorf("upsert provider models: %w", err)
	}
	return nil
}

func (r *pgRepository) GetSelection(ctx context.Context) (Selection, bool, error) {
	row, err := gen.New(r.pool).GetLLMSelection(ctx)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return Selection{}, false, nil // unset → resolver falls back to env
	case err != nil:
		return Selection{}, false, fmt.Errorf("get llm selection: %w", err)
	}
	return Selection{Provider: row.Provider, Model: row.Model}, true, nil
}

func (r *pgRepository) UpsertSelection(ctx context.Context, sel Selection) error {
	if err := gen.New(r.pool).UpsertLLMSelection(ctx, gen.UpsertLLMSelectionParams{
		Provider: sel.Provider,
		Model:    sel.Model,
	}); err != nil {
		return fmt.Errorf("upsert llm selection: %w", err)
	}
	return nil
}

func (r *pgRepository) AddUsage(ctx context.Context, day time.Time, provider, model, kind string, calls, inputTokens, outputTokens int64) error {
	if err := gen.New(r.pool).AddLLMUsage(ctx, gen.AddLLMUsageParams{
		Day:          pgtype.Date{Time: day, Valid: true},
		Provider:     provider,
		Model:        model,
		Kind:         kind,
		Calls:        calls,
		InputTokens:  inputTokens,
		OutputTokens: outputTokens,
	}); err != nil {
		return fmt.Errorf("add llm usage: %w", err)
	}
	return nil
}

func (r *pgRepository) ListUsageSince(ctx context.Context, since time.Time) ([]UsageRow, error) {
	rows, err := gen.New(r.pool).ListLLMUsageSince(ctx, pgtype.Date{Time: since, Valid: true})
	if err != nil {
		return nil, fmt.Errorf("list llm usage: %w", err)
	}
	out := make([]UsageRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, UsageRow{
			Day:          row.Day.Time,
			Provider:     row.Provider,
			Model:        row.Model,
			Kind:         row.Kind,
			Calls:        row.Calls,
			InputTokens:  row.InputTokens,
			OutputTokens: row.OutputTokens,
		})
	}
	return out, nil
}

func (r *pgRepository) Totals(ctx context.Context) (Totals, error) {
	row, err := gen.New(r.pool).AdminTotals(ctx)
	if err != nil {
		return Totals{}, fmt.Errorf("admin totals: %w", err)
	}
	t := Totals{Users: row.Users, Records: row.Records, Memories: row.Memories, Synapses: row.Synapses}

	// On a Supabase DB the real signup count lives in auth.users; local docker
	// pg has no auth schema, so guard with to_regclass and skip silently
	// (acceptance 4.3). Raw SQL on purpose: sqlc's schema snapshot does not
	// (and should not) model the auth schema.
	var hasAuthUsers bool
	if err := r.pool.QueryRow(ctx, `SELECT to_regclass('auth.users') IS NOT NULL`).Scan(&hasAuthUsers); err != nil {
		return Totals{}, fmt.Errorf("probe auth.users: %w", err)
	}
	if hasAuthUsers {
		var authUsers int64
		if err := r.pool.QueryRow(ctx, `SELECT count(*) FROM auth.users`).Scan(&authUsers); err != nil {
			return Totals{}, fmt.Errorf("count auth.users: %w", err)
		}
		t.Users = authUsers
	}
	return t, nil
}

func (r *pgRepository) JobCounts(ctx context.Context) (JobCounts, error) {
	row, err := gen.New(r.pool).AdminJobCounts(ctx)
	if err != nil {
		return JobCounts{}, fmt.Errorf("admin job counts: %w", err)
	}
	return JobCounts{Pending: row.Pending, Processing: row.Processing, Failed: row.Failed, Done24h: row.Done24h}, nil
}

func (r *pgRepository) RecordDaySeries(ctx context.Context) ([]DayCount, error) {
	rows, err := gen.New(r.pool).AdminRecordDaySeries(ctx)
	if err != nil {
		return nil, fmt.Errorf("admin record series: %w", err)
	}
	out := make([]DayCount, 0, len(rows))
	for _, row := range rows {
		out = append(out, DayCount{Day: row.Day.Time, Count: row.Count})
	}
	return out, nil
}

// hasAuthUsers probes for the Supabase auth.users table (raw SQL — sqlc doesn't,
// and shouldn't, model the auth schema; same guard as Totals). Works on the pool
// or inside a tx so listing and the grant existence-check share one rule.
func (r *pgRepository) hasAuthUsers(ctx context.Context, q rowQuerier) (bool, error) {
	var ok bool
	if err := q.QueryRow(ctx, `SELECT to_regclass('auth.users') IS NOT NULL`).Scan(&ok); err != nil {
		return false, fmt.Errorf("probe auth.users: %w", err)
	}
	return ok, nil
}

// ListUsers returns one page of users (A2/A3). On a Supabase DB auth.users is the
// authoritative source (so accounts with no diary/wallet/settings row still show);
// locally it falls back to the app-domain table union. Both paths LEFT JOIN
// user_wallet for the effective balance + seed flag WITHOUT seeding (A4), apply a
// case-insensitive user_id contains filter (A5), and keyset-paginate by user_id
// ASC (A6). The auth.users path is raw SQL (auth schema is unmodeled by sqlc); the
// fallback is the sqlc query.
func (r *pgRepository) ListUsers(ctx context.Context, query, pageToken string, limit, startingStardust int) ([]AdminUser, error) {
	hasAuth, err := r.hasAuthUsers(ctx, r.pool)
	if err != nil {
		return nil, err
	}
	if !hasAuth {
		rows, err := gen.New(r.pool).AdminListUsersFallback(ctx, gen.AdminListUsersFallbackParams{
			StartingStardust: int32(startingStardust),
			Query:            query,
			PageToken:        pageToken,
			PageLimit:        int32(limit),
		})
		if err != nil {
			return nil, fmt.Errorf("list users (fallback): %w", err)
		}
		out := make([]AdminUser, 0, len(rows))
		for _, row := range rows {
			out = append(out, AdminUser{UserID: row.UserID, Stardust: int64(row.Stardust), WalletSeeded: row.WalletSeeded})
		}
		return out, nil
	}

	// Supabase path — auth.users as the base relation (mirrors the fallback shape).
	rows, err := r.pool.Query(ctx, `
		SELECT au.uid,
		       COALESCE(w.stardust, $1)::int AS stardust,
		       (w.user_id IS NOT NULL)::bool AS wallet_seeded
		FROM (SELECT id::text AS uid FROM auth.users) au
		LEFT JOIN user_wallet w ON w.user_id = au.uid
		WHERE ($2 = '' OR position(lower($2) IN lower(au.uid)) > 0)
		  AND ($3 = '' OR au.uid > $3)
		ORDER BY au.uid ASC
		LIMIT $4`, startingStardust, query, pageToken, limit)
	if err != nil {
		return nil, fmt.Errorf("list users (auth.users): %w", err)
	}
	defer rows.Close()
	out := make([]AdminUser, 0, limit)
	for rows.Next() {
		var u AdminUser
		var stardust int32
		if err := rows.Scan(&u.UserID, &stardust, &u.WalletSeeded); err != nil {
			return nil, fmt.Errorf("scan user row: %w", err)
		}
		u.Stardust = int64(stardust)
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user rows: %w", err)
	}
	return out, nil
}

// UserExists reports whether target is a real user — auth.users on Supabase, the
// app-domain union locally (A10 production NotFound guard). Both raw SQL.
func (r *pgRepository) UserExists(ctx context.Context, target string) (bool, error) {
	return r.userExists(ctx, r.pool, target)
}

// userExists runs the auth-aware existence probe on the pool or inside a tx.
func (r *pgRepository) userExists(ctx context.Context, q rowQuerier, target string) (bool, error) {
	hasAuth, err := r.hasAuthUsers(ctx, q)
	if err != nil {
		return false, err
	}
	var exists bool
	if hasAuth {
		if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM auth.users WHERE id::text = $1)`, target).Scan(&exists); err != nil {
			return false, fmt.Errorf("exists auth.users: %w", err)
		}
		return exists, nil
	}
	if err := q.QueryRow(ctx, fallbackUserExistsSQL, target).Scan(&exists); err != nil {
		return false, fmt.Errorf("exists (fallback): %w", err)
	}
	return exists, nil
}

// GrantStardust runs the corrective grant in one transaction (A7/A8/A9): verify
// the target exists → idempotent SeedWallet (the balance_before) → overflow-guarded
// add (the balance_after) → audit-row insert → commit. Any failed step rolls the
// whole transaction back so neither the wallet nor the audit row changes (A10).
func (r *pgRepository) GrantStardust(ctx context.Context, in GrantStardustInput, startingStardust int) (AdminUser, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return AdminUser{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	q := gen.New(tx)

	exists, err := r.userExists(ctx, tx, in.TargetUserID)
	if err != nil {
		return AdminUser{}, err
	}
	if !exists {
		return AdminUser{}, ErrUserNotFound
	}

	// Seed to starting_stardust if absent (idempotent — an existing balance is
	// untouched), so the grant lands on a known base. The returned value is the
	// pre-grant effective balance.
	before, err := q.SeedWallet(ctx, gen.SeedWalletParams{UserID: in.TargetUserID, Stardust: int32(startingStardust)})
	if err != nil {
		return AdminUser{}, fmt.Errorf("seed wallet: %w", err)
	}
	after, err := q.AdminAddStardust(ctx, gen.AdminAddStardustParams{Amount: int32(in.Amount), UserID: in.TargetUserID})
	if errors.Is(err, pgx.ErrNoRows) {
		return AdminUser{}, ErrStardustOverflow // guard WHERE matched no row → would overflow int4
	}
	if err != nil {
		return AdminUser{}, fmt.Errorf("add stardust: %w", err)
	}
	id, err := newID()
	if err != nil {
		return AdminUser{}, err
	}
	if err := q.InsertStardustGrant(ctx, gen.InsertStardustGrantParams{
		ID:            id,
		AdminUserID:   in.AdminUserID,
		TargetUserID:  in.TargetUserID,
		Amount:        int32(in.Amount),
		BalanceBefore: before,
		BalanceAfter:  after,
	}); err != nil {
		return AdminUser{}, fmt.Errorf("insert grant audit: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return AdminUser{}, fmt.Errorf("commit: %w", err)
	}
	return AdminUser{UserID: in.TargetUserID, Stardust: int64(after), WalletSeeded: true}, nil
}

// newID is the server-authoritative id source (same recipe as the gift/fragment
// repositories): 16 bytes of crypto entropy, base64url without padding.
func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}
