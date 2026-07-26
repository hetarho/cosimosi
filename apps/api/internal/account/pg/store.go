// Package pg is the account context's only sqlc/pgx seam (ARCHITECTURE §2.6): the concrete
// PreferenceStore over palette_preferences with the row↔domain mapping at this edge — no dbgen
// type escapes inward. It declares no repository interface; the port is consumer-owned by the
// account use-case.
package pg

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/account"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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

func (s Store) GetUserProfile(ctx context.Context, scope platform.UserScope) (account.Profile, bool, error) {
	if err := s.ready(scope); err != nil {
		return account.Profile{}, false, err
	}
	row, err := s.queries.GetUserProfile(ctx, scope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return account.Profile{}, false, nil
	}
	if err != nil {
		return account.Profile{}, false, err
	}
	return profileFromRow(row), true, nil
}

func (s Store) UpdateUserProfile(ctx context.Context, scope platform.UserScope, input account.UpdateProfileInput) (account.Profile, bool, error) {
	if err := s.ready(scope); err != nil {
		return account.Profile{}, false, err
	}
	row, err := s.queries.UpdateUserProfile(ctx, dbgen.UpdateUserProfileParams{
		Nickname: input.Nickname,
		Timezone: input.Timezone,
		Locale:   input.Locale,
		UserID:   scope.UserID(),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return account.Profile{}, false, nil
	}
	if err != nil {
		return account.Profile{}, false, err
	}
	return profileFromRow(row), true, nil
}

func (s Store) ListAuthProviders(ctx context.Context, scope platform.UserScope) ([]account.AuthProvider, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListAuthProviders(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	providers := make([]account.AuthProvider, 0, len(rows))
	for _, row := range rows {
		providers = append(providers, account.AuthProvider{
			Kind:           account.AuthProviderKind(row.Provider),
			ProviderUserID: row.ProviderUserID,
			LinkedAt:       timeValue(row.LinkedAt),
		})
	}
	return providers, nil
}

func (s Store) RecordAuthProvider(ctx context.Context, scope platform.UserScope, kind account.AuthProviderKind, providerUserID string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.RecordAuthProvider(ctx, dbgen.RecordAuthProviderParams{
		UserID:         scope.UserID(),
		Provider:       string(kind),
		ProviderUserID: providerUserID,
	})
}

func (s Store) CountRewardedInvitesByInviter(ctx context.Context, scope platform.UserScope) (int64, error) {
	if err := s.ready(scope); err != nil {
		return 0, err
	}
	return s.queries.CountRewardedInvitesByInviter(ctx, scope.UserID())
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

func profileFromRow(row dbgen.User) account.Profile {
	return account.Profile{
		UserID:    row.UserID,
		Nickname:  row.Nickname,
		Timezone:  row.Timezone,
		Locale:    row.Locale,
		CreatedAt: timeValue(row.CreatedAt),
		DeletedAt: timePtr(row.DeletedAt),
	}
}

func timeValue(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time.UTC()
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	normalized := value.Time.UTC()
	return &normalized
}
