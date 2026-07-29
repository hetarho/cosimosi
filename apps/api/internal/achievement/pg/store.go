// Package pg is the achievement context's only sqlc/pgx seam (ARCHITECTURE §2.6): the concrete
// store over achievement_counters + achievement_progress, with the row↔domain mapping at this
// edge — no dbgen row escapes inward. It declares no repository interface: the ports are
// consumer-owned by the achievement behavior (construct a Store over a transaction handle with
// NewStore to compose a write into a producer's transaction — the shared-tx recorder seam).
package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/achievement"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrUserScopeRequired = errors.New("achievement repository requires authenticated user scope")
	ErrQueriesRequired   = errors.New("achievement repository requires database queries")
	// ErrTxStarterRequired is returned when the store was built over a plain DBTX (an existing
	// transaction) and so cannot begin its own transaction.
	ErrTxStarterRequired = errors.New("achievement repository requires a transaction-capable pool")
)

type Store struct {
	queries *dbgen.Queries
	db      dbgen.DBTX
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	built := Store{queries: dbgen.New(db), db: db}
	if txer, ok := db.(txStarter); ok {
		built.txer = txer
	}
	return built
}

// DB exposes the query handle this store is bound to — the pool, or the open transaction inside
// InAchievementTx. It exists for the composition root's recorder seam: the root binds an
// achievement store onto the very same transaction a launch/recall/decorate runs in, so the counter
// write commits or rolls back with the fact that caused it. Context behavior never calls it.
func (s Store) DB() dbgen.DBTX {
	return s.db
}

// InAchievementTx runs fn inside one transaction, over a store bound to it.
func (s Store) InAchievementTx(ctx context.Context, fn func(tx achievement.Store) error) error {
	if s.queries == nil {
		return ErrQueriesRequired
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	if err := fn(Store{queries: s.queries.WithTx(tx), db: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) ready(scope platform.UserScope) error {
	if s.queries == nil {
		return ErrQueriesRequired
	}
	if scope.UserID() == "" {
		return ErrUserScopeRequired
	}
	return nil
}

// requireKey is the runtime half of the closed-vocabulary guard: an unknown key is a wiring fault
// that fails its transaction ([A2]) — safe because the composition-root membership test makes a
// typo'd producer constant a test failure first.
func requireKey(key achievement.CounterKey) error {
	if !achievement.KnownCounterKey(key) {
		return achievement.ErrUnknownCounterKey
	}
	return nil
}

func (s Store) ListCounters(
	ctx context.Context,
	scope platform.UserScope,
) (map[achievement.CounterKey]int64, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListAchievementCounters(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	counters := make(map[achievement.CounterKey]int64, len(rows))
	for _, row := range rows {
		counters[achievement.CounterKey(row.CounterKey)] = row.Value
	}
	return counters, nil
}

func (s Store) ListProgress(
	ctx context.Context,
	scope platform.UserScope,
) ([]achievement.ProgressRecord, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListAchievementProgress(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	records := make([]achievement.ProgressRecord, 0, len(rows))
	for _, row := range rows {
		records = append(records, progressRecord(row.AchievementID, row.AchievedAt, row.ClaimedAt, row.ClaimID))
	}
	return records, nil
}

func (s Store) GetProgress(
	ctx context.Context,
	scope platform.UserScope,
	achievementID string,
) (*achievement.ProgressRecord, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	row, err := s.queries.GetAchievementProgress(ctx, dbgen.GetAchievementProgressParams{
		UserID:        scope.UserID(),
		AchievementID: achievementID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	record := progressRecord(row.AchievementID, row.AchievedAt, row.ClaimedAt, row.ClaimID)
	return &record, nil
}

// TouchCounter reports whether THIS statement created the row: ON CONFLICT DO NOTHING skips an
// existing counter, so 1 is the first touch — the signal the derived variety counters bump on.
func (s Store) TouchCounter(
	ctx context.Context,
	scope platform.UserScope,
	key achievement.CounterKey,
) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	if err := requireKey(key); err != nil {
		return false, err
	}
	created, err := s.queries.CreateAchievementCounter(ctx, dbgen.CreateAchievementCounterParams{
		UserID:     scope.UserID(),
		CounterKey: string(key),
	})
	if err != nil {
		return false, err
	}
	return created > 0, nil
}

func (s Store) AddCounter(
	ctx context.Context,
	scope platform.UserScope,
	key achievement.CounterKey,
	delta int64,
) (int64, error) {
	if err := s.ready(scope); err != nil {
		return 0, err
	}
	if err := achievement.RequireCounterMode(key, achievement.CounterModeAccumulate); err != nil {
		return 0, err
	}
	if err := achievement.RequireForwardDelta(delta); err != nil {
		return 0, err
	}
	return s.writeCounter(ctx, scope, key, func() (int64, error) {
		return s.queries.AddAchievementCounter(ctx, dbgen.AddAchievementCounterParams{
			Delta:      delta,
			UserID:     scope.UserID(),
			CounterKey: string(key),
		})
	})
}

func (s Store) RaiseCounter(
	ctx context.Context,
	scope platform.UserScope,
	key achievement.CounterKey,
	level int64,
) (int64, error) {
	if err := s.ready(scope); err != nil {
		return 0, err
	}
	if err := achievement.RequireCounterMode(key, achievement.CounterModeReach); err != nil {
		return 0, err
	}
	if err := achievement.RequireReachLevel(level); err != nil {
		return 0, err
	}
	return s.writeCounter(ctx, scope, key, func() (int64, error) {
		return s.queries.RaiseAchievementCounter(ctx, dbgen.RaiseAchievementCounterParams{
			Level:      level,
			UserID:     scope.UserID(),
			CounterKey: string(key),
		})
	})
}

// writeCounter runs an UPDATE that must land on an existing row, creating the row and retrying once
// if it does not. Both counter writes are `:one` UPDATEs, so a first-ever write for a key would
// otherwise surface pgx.ErrNoRows and roll back the launch/recall/save that reported it — the
// twinkle balance store's shape, for the same reason. The retry does not weaken TouchCounter's
// first-touch signal: the recorder still touches first, and this only catches a caller that did not.
func (s Store) writeCounter(
	ctx context.Context,
	scope platform.UserScope,
	key achievement.CounterKey,
	write func() (int64, error),
) (int64, error) {
	value, err := write()
	if !errors.Is(err, pgx.ErrNoRows) {
		return value, err
	}
	if _, err := s.queries.CreateAchievementCounter(ctx, dbgen.CreateAchievementCounterParams{
		UserID:     scope.UserID(),
		CounterKey: string(key),
	}); err != nil {
		return 0, err
	}
	return write()
}

// MarkAchieved reports whether THIS statement marked the row; a replay reads as false. achieved_at
// comes from the DDL default now(), so no Go clock is involved ([A1a]).
func (s Store) MarkAchieved(
	ctx context.Context,
	scope platform.UserScope,
	achievementID string,
) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	if err := achievement.RequireCatalogID(achievementID); err != nil {
		return false, err
	}
	marked, err := s.queries.MarkAchievementAchieved(ctx, dbgen.MarkAchievementAchievedParams{
		UserID:        scope.UserID(),
		AchievementID: achievementID,
	})
	if err != nil {
		return false, err
	}
	return marked > 0, nil
}

// MarkClaimed reports whether THIS statement claimed the row: the claimed_at IS NULL arm makes a
// second claim affect zero rows before any credit moves ([A4]).
func (s Store) MarkClaimed(
	ctx context.Context,
	scope platform.UserScope,
	achievementID string,
	claimID string,
) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	if err := achievement.RequireCatalogID(achievementID); err != nil {
		return false, err
	}
	if claimID == "" {
		return false, achievement.ErrClaimIDRequired
	}
	claimed, err := s.queries.ClaimAchievementReward(ctx, dbgen.ClaimAchievementRewardParams{
		ClaimID:       pgtype.Text{String: claimID, Valid: true},
		UserID:        scope.UserID(),
		AchievementID: achievementID,
	})
	if err != nil {
		return false, err
	}
	return claimed > 0, nil
}

// PurgeUser hard-deletes the withdrawing user's own rows, both tables in one transaction so a
// retried sweep never finds progress surviving its counters ([I1][U1]).
func (s Store) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	// Counters BEFORE progress, matching the order a counter report takes them: one global lock order
	// across every path that touches both tables is what keeps a sweep and an in-flight launch for the
	// same user from deadlocking AB/BA. There is no FK between them, so the order is free to choose.
	queries := s.queries.WithTx(tx)
	if err := queries.PurgeUserAchievementCounters(ctx, scope.UserID()); err != nil {
		return err
	}
	if err := queries.PurgeUserAchievementProgress(ctx, scope.UserID()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func progressRecord(
	achievementID string,
	achievedAt pgtype.Timestamptz,
	claimedAt pgtype.Timestamptz,
	claimID pgtype.Text,
) achievement.ProgressRecord {
	record := achievement.ProgressRecord{
		AchievementID: achievementID,
		AchievedAt:    achievedAt.Time,
	}
	if claimedAt.Valid {
		claimed := claimedAt.Time
		record.ClaimedAt = &claimed
		record.ClaimID = claimID.String
	}
	return record
}
