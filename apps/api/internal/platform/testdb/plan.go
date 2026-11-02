package testdb

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
)

// TxBeginner is the slice of a pgx pool a plan read needs.
type TxBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Plan returns the EXPLAIN text of query with sequential scans disabled, so a test can prove an
// index serves its shape even on a table too small for the planner to prefer it.
func Plan(ctx context.Context, db TxBeginner, query string, args ...any) (string, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, "SET LOCAL enable_seqscan = off"); err != nil {
		return "", err
	}
	rows, err := tx.Query(ctx, "EXPLAIN "+query, args...)
	if err != nil {
		return "", err
	}
	lines, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return "", err
	}
	return strings.Join(lines, "\n"), nil
}
