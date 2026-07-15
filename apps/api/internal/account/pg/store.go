// Package pg is the account context's only sqlc/pgx seam (ARCHITECTURE §2.6): the concrete
// PreferenceStore over palette_preferences with the row↔domain mapping at this edge — no dbgen
// type escapes inward. It declares no repository interface; the port is consumer-owned by the
// account use-case.
package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

var (
	ErrUserScopeRequired = errors.New("account store requires authenticated user scope")
	ErrQueriesRequired   = errors.New("account store requires database queries")
)

type Store struct {
	queries *dbgen.Queries
}

func NewStore(db dbgen.DBTX) Store {
	return Store{queries: dbgen.New(db)}
}

// GetPalettePreference reads the user's stored palette id. A user who never chose one owns no row
// — that reads as found=false (not an error), which the use-case resolves to the default id.
func (s Store) GetPalettePreference(ctx context.Context, scope platform.UserScope) (string, bool, error) {
	if err := s.ready(scope); err != nil {
		return "", false, err
	}
	id, err := s.queries.GetPalettePreference(ctx, scope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

// UpsertPalettePreference stores the user's chosen palette id (one row per user) and returns the
// stored value. Per-user scoped: the row key is the authenticated user's id.
func (s Store) UpsertPalettePreference(ctx context.Context, scope platform.UserScope, paletteID string) (string, error) {
	if err := s.ready(scope); err != nil {
		return "", err
	}
	return s.queries.UpsertPalettePreference(ctx, dbgen.UpsertPalettePreferenceParams{
		UserID:    scope.UserID(),
		PaletteID: paletteID,
	})
}

func (s Store) ready(scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrUserScopeRequired
	}
	if s.queries == nil {
		return ErrQueriesRequired
	}
	return nil
}
