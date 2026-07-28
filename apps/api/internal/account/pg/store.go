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
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserScopeRequired       = errors.New("account store requires authenticated user scope")
	ErrQueriesRequired         = errors.New("account store requires database queries")
	ErrTransactionPoolRequired = errors.New("account store requires a transaction-capable pool")
)

type Store struct {
	queries *dbgen.Queries
	pool    *pgxpool.Pool
}

func NewStore(db dbgen.DBTX) Store {
	store := Store{queries: dbgen.New(db)}
	store.pool, _ = db.(*pgxpool.Pool)
	return store
}

func (s Store) InSignupTx(ctx context.Context, fn func(account.Store) error) error {
	if s.pool == nil {
		return ErrTransactionPoolRequired
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	txStore := Store{queries: dbgen.New(tx)}
	if err := fn(txStore); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) InWithdrawalTx(ctx context.Context, fn func(account.WithdrawalStore) error) error {
	if s.pool == nil {
		return ErrTransactionPoolRequired
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	txStore := Store{queries: dbgen.New(tx)}
	if err := fn(txStore); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) WithInviteSettlementLock(
	ctx context.Context,
	inviterScope platform.UserScope,
	fn func() error,
) (err error) {
	if err := s.ready(inviterScope); err != nil {
		return err
	}
	if s.pool == nil {
		return ErrTransactionPoolRequired
	}
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	queries := dbgen.New(conn)
	if _, err := queries.AcquireInviteSettlementLock(ctx, inviterScope.UserID()); err != nil {
		return err
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		_, unlockErr := queries.ReleaseInviteSettlementLock(unlockCtx, inviterScope.UserID())
		err = errors.Join(err, unlockErr)
	}()
	return fn()
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

func (s Store) ListMoodColors(
	ctx context.Context,
	scope platform.UserScope,
) ([]account.MoodColor, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListMoodColors(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	colors := make([]account.MoodColor, 0, len(rows))
	for _, row := range rows {
		colors = append(colors, account.MoodColor{
			Mood:  account.Mood(row.Mood),
			Color: account.Color(row.Color),
		})
	}
	return colors, nil
}

func (s Store) SetMoodColor(
	ctx context.Context,
	scope platform.UserScope,
	color account.MoodColor,
	bucket int32,
) (account.MoodColor, error) {
	if err := s.ready(scope); err != nil {
		return account.MoodColor{}, err
	}
	if s.pool == nil {
		return account.MoodColor{}, ErrTransactionPoolRequired
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return account.MoodColor{}, err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	queries := dbgen.New(tx)
	if err := queries.LockMoodColorWrite(ctx, dbgen.LockMoodColorWriteParams{
		UserID: scope.UserID(),
		Mood:   string(color.Mood),
	}); err != nil {
		return account.MoodColor{}, err
	}
	old, err := queries.GetMoodColorForUpdate(ctx, dbgen.GetMoodColorForUpdateParams{
		UserID: scope.UserID(),
		Mood:   string(color.Mood),
	})
	oldFound := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return account.MoodColor{}, err
	}
	if oldFound && old.Color == string(color.Color) {
		return account.MoodColor{Mood: account.Mood(old.Mood), Color: account.Color(old.Color)}, tx.Commit(ctx)
	}
	if oldFound {
		if err := queries.DecrementMoodColorCount(ctx, dbgen.DecrementMoodColorCountParams{
			Mood:      old.Mood,
			HueBucket: int16(account.HueBucket(account.Color(old.Color))),
			Color:     old.Color,
		}); err != nil {
			return account.MoodColor{}, err
		}
	}
	row, err := queries.UpsertMoodColor(ctx, dbgen.UpsertMoodColorParams{
		UserID: scope.UserID(),
		Mood:   string(color.Mood),
		Color:  string(color.Color),
	})
	if err != nil {
		return account.MoodColor{}, err
	}
	if err := queries.IncrementMoodColorCount(ctx, dbgen.IncrementMoodColorCountParams{
		Mood:      row.Mood,
		HueBucket: int16(bucket),
		Color:     row.Color,
	}); err != nil {
		return account.MoodColor{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return account.MoodColor{}, err
	}
	return account.MoodColor{Mood: account.Mood(row.Mood), Color: account.Color(row.Color)}, nil
}

func (s Store) ListMoodColorStats(
	ctx context.Context,
	mood account.Mood,
	recommendationCount int32,
) ([]account.MoodColorStatCount, error) {
	if s.queries == nil {
		return nil, ErrQueriesRequired
	}
	rows, err := s.queries.ListMoodColorStats(ctx, dbgen.ListMoodColorStatsParams{
		RecommendationCount: recommendationCount,
		Mood:                string(mood),
	})
	if err != nil {
		return nil, err
	}
	stats := make([]account.MoodColorStatCount, 0, len(rows))
	for _, row := range rows {
		stats = append(stats, account.MoodColorStatCount{
			Bucket:      int32(row.HueBucket),
			BucketCount: row.BucketCount,
			TotalCount:  row.TotalCount,
			SwatchColor: account.Color(row.SwatchColor),
		})
	}
	return stats, nil
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

func (s Store) CreateUserIfAbsent(
	ctx context.Context,
	scope platform.UserScope,
	input account.SignUpInput,
	provider *account.AuthProvider,
) (account.Profile, bool, error) {
	if err := s.ready(scope); err != nil {
		return account.Profile{}, false, err
	}
	params := dbgen.CreateUserIfAbsentParams{
		UserID:   scope.UserID(),
		Nickname: input.Nickname,
		Timezone: input.Timezone,
		Locale:   input.Locale,
	}
	if provider != nil {
		params.Provider = string(provider.Kind)
		params.ProviderUserID = provider.ProviderUserID
	}
	row, err := s.queries.CreateUserIfAbsent(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		profile, found, readErr := s.GetUserProfile(ctx, scope)
		if readErr != nil {
			return account.Profile{}, false, readErr
		}
		if !found {
			return account.Profile{}, false, pgx.ErrNoRows
		}
		return profile, false, nil
	}
	if err != nil {
		return account.Profile{}, false, err
	}
	return account.Profile{
		UserID:    row.UserID,
		Nickname:  row.Nickname,
		Timezone:  row.Timezone,
		Locale:    row.Locale,
		CreatedAt: timeValue(row.CreatedAt),
		DeletedAt: timePtr(row.DeletedAt),
	}, true, nil
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

func (s Store) WithdrawalStatus(
	ctx context.Context,
	scope platform.UserScope,
) (time.Time, bool, error) {
	if err := s.ready(scope); err != nil {
		return time.Time{}, false, err
	}
	deletedAt, err := s.queries.AccountWithdrawalStatus(ctx, scope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, err
	}
	return timeValue(deletedAt), true, nil
}

func (s Store) WithdrawalStatusForUpdate(
	ctx context.Context,
	scope platform.UserScope,
) (time.Time, bool, error) {
	if err := s.ready(scope); err != nil {
		return time.Time{}, false, err
	}
	deletedAt, err := s.queries.AccountWithdrawalStatusForUpdate(ctx, scope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, err
	}
	return timeValue(deletedAt), true, nil
}

func (s Store) MarkWithdrawn(
	ctx context.Context,
	scope platform.UserScope,
	withdrawnAt time.Time,
) (time.Time, bool, error) {
	if err := s.ready(scope); err != nil {
		return time.Time{}, false, err
	}
	stamped, err := s.queries.MarkAccountWithdrawn(ctx, dbgen.MarkAccountWithdrawnParams{
		DeletedAt: pgtype.Timestamptz{Time: withdrawnAt.UTC(), Valid: true},
		UserID:    scope.UserID(),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, false, nil
	}
	if err != nil {
		return time.Time{}, false, err
	}
	return timeValue(stamped), true, nil
}

func (s Store) ClearWithdrawal(
	ctx context.Context,
	scope platform.UserScope,
	withdrawnAt time.Time,
) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	rows, err := s.queries.ClearAccountWithdrawal(ctx, dbgen.ClearAccountWithdrawalParams{
		UserID:    scope.UserID(),
		DeletedAt: pgtype.Timestamptz{Time: withdrawnAt.UTC(), Valid: true},
	})
	return rows == 1, err
}

func (s Store) PurgeAccountDependents(ctx context.Context, scope platform.UserScope) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	for _, purge := range []func(context.Context, string) error{
		s.queries.PurgeAccountAuthProviders,
		s.queries.PurgeAccountInvites,
		s.queries.PurgeAccountPalettePreference,
		s.queries.PurgeAccountMoodColors,
	} {
		if err := purge(ctx, scope.UserID()); err != nil {
			return err
		}
	}
	return nil
}

func (s Store) PurgeAccountUser(ctx context.Context, scope platform.UserScope) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	rows, err := s.queries.PurgeAccountUser(ctx, scope.UserID())
	return rows == 1, err
}

func (s Store) BindInviteToInvitee(
	ctx context.Context,
	inviteeScope platform.UserScope,
	invite account.Invite,
) (bool, error) {
	if err := s.ready(inviteeScope); err != nil {
		return false, err
	}
	_, err := s.queries.BindInviteToInvitee(ctx, dbgen.BindInviteToInviteeParams{
		ID:            invite.ID,
		UserID:        invite.InviterUserID,
		InviteeUserID: inviteeScope.UserID(),
		Token:         invite.Token,
		CreatedAt:     pgtype.Timestamptz{Time: invite.CreatedAt.UTC(), Valid: true},
		BoundAt:       pgtype.Timestamptz{Time: invite.BoundAt.UTC(), Valid: true},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "invites_invitee_unique" {
		return false, nil
	}
	return err == nil, err
}

func (s Store) FindSettleableInviteForInvitee(
	ctx context.Context,
	inviteeScope platform.UserScope,
) (*account.SettleableInvite, error) {
	if err := s.ready(inviteeScope); err != nil {
		return nil, err
	}
	row, err := s.queries.FindSettleableInviteForInvitee(ctx, inviteeScope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &account.SettleableInvite{
		InviteID:      row.ID,
		InviterUserID: row.InviterUserID,
		InviteeUserID: inviteeScope.UserID(),
		Token:         row.Token,
	}, nil
}

func (s Store) CountRewardedInvitesByInviter(ctx context.Context, scope platform.UserScope) (int64, error) {
	if err := s.ready(scope); err != nil {
		return 0, err
	}
	return s.queries.CountRewardedInvitesByInviter(ctx, scope.UserID())
}

func (s Store) MarkInviteRewarded(
	ctx context.Context,
	inviterScope platform.UserScope,
	inviteID string,
	rewardedAt time.Time,
) error {
	if err := s.ready(inviterScope); err != nil {
		return err
	}
	return s.queries.MarkInviteRewarded(ctx, dbgen.MarkInviteRewardedParams{
		RewardedAt: pgtype.Timestamptz{Time: rewardedAt.UTC(), Valid: true},
		UserID:     inviterScope.UserID(),
		ID:         inviteID,
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
