package admin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/cosimosi/backend/internal/db/gen"
)

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
