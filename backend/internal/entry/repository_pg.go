package entry

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PgRepository is the Postgres-backed implementation of Repository.
//
// It will become a thin mapping layer over the sqlc-generated code in
// internal/db/gen once `sqlc generate` has run. Until then methods
// return ErrNotImplemented so the program still builds.
type PgRepository struct {
	pool *pgxpool.Pool
}

func NewPgRepository(pool *pgxpool.Pool) *PgRepository {
	return &PgRepository{pool: pool}
}

var errNotImplemented = errors.New("entry: repository_pg not implemented yet — run `sqlc generate`")

func (r *PgRepository) Create(_ context.Context, _ Entry) (Entry, error) {
	return Entry{}, errNotImplemented
}

func (r *PgRepository) GetByDate(_ context.Context, _ time.Time) (Entry, error) {
	return Entry{}, errNotImplemented
}

func (r *PgRepository) List(_ context.Context, _, _ int) ([]Entry, error) {
	return nil, errNotImplemented
}

func (r *PgRepository) Update(_ context.Context, _ Entry) (Entry, error) {
	return Entry{}, errNotImplemented
}

func (r *PgRepository) Delete(_ context.Context, _ string) error {
	return errNotImplemented
}
