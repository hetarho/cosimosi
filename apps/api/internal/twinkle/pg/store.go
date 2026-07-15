// Package pg is the twinkle context's only sqlc/pgx seam (ARCHITECTURE §2.6): the concrete
// store over twinkle_balances + twinkle_ledger_entries with the row↔domain mapping at this
// edge — no dbgen row escapes inward. It declares no repository interface: the port is
// consumer-owned by the earn/spend use-case, which composes these methods inside
// its single-writer transaction (construct a Store over the tx via NewStore).
package pg

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/cosimosi/api/internal/twinkle"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrUserScopeRequired = errors.New("twinkle store requires authenticated user scope")
	ErrQueriesRequired   = errors.New("twinkle store requires database queries")
	// ErrTxStarterRequired is returned when the store was built over a plain DBTX
	// (e.g. an existing transaction) and cannot begin a ledger transaction itself.
	ErrTxStarterRequired = errors.New("twinkle store requires a transaction-capable pool")
	// ErrBasicGrantExceeded is the guard rejection: the basic-tier draw would push the
	// window's spend past the daily grant (a raced/stale plan) — the spend is refused,
	// never partially applied. It wraps the canonical insufficient-twinkle denial: to
	// the caller a raced basic overdraw IS not-enough-twinkle at the true window state.
	ErrBasicGrantExceeded = fmt.Errorf("twinkle spend exceeds the daily basic grant: %w", twinkle.ErrInsufficientTwinkle)
	// ErrDeltaOutOfRange rejects deltas/amounts the INT columns cannot hold, and a negative
	// basic spend delta (PlanSpend never produces one; a refund is not a domain operation) —
	// values that would otherwise wrap through the int32 cast or mint basic silently.
	ErrDeltaOutOfRange = errors.New("twinkle delta or amount is out of range")
)

type Store struct {
	queries *dbgen.Queries
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	store := Store{queries: dbgen.New(db)}
	if txer, ok := db.(txStarter); ok {
		store.txer = txer
	}
	return store
}

// InLedgerTx implements twinkle.LedgerRepo: it runs fn against a store bound to one
// pgx transaction, so an earn/spend pair — the dedup-keyed log append plus the
// guarded balance delta — commits wholly or not at all. The RPC-driven earns
// (invite, charge) and the tx-less gist-view spend run here; a spend joining a
// memory transaction instead arrives through the composition root's economy seam
// (NewStore over that transaction's handle).
func (s Store) InLedgerTx(ctx context.Context, fn func(tx twinkle.LedgerStore) error) error {
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
	if err := fn(Store{queries: s.queries.WithTx(tx)}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// GetBalanceRecord reads the user's stored balance facts. A user who never earned or spent
// owns no row yet — that reads as nil (not an error): the lazy-birth default, which the
// caller derives as a full-basic balance with today's window (twinkle.DeriveBalance).
func (s Store) GetBalanceRecord(ctx context.Context, scope platform.UserScope) (*twinkle.BalanceRecord, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	row, err := s.queries.GetTwinkleBalance(ctx, scope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	record := mapBalanceRecord(row)
	return &record, nil
}

// ApplyBalanceDelta commits one earn/spend against the single balance row (the row lock
// serializes concurrent spends; the DB CHECKs reject a negative tier and the in-query grant
// guard rejects a basic draw past the daily grant, so a plan raced against a stale read can
// never oversell either tier). resetWindow is the caller's current UTC day; a stale stored
// anchor rolls forward here (the lazy reset's one write). additionalDelta is signed (earn +,
// spend −); basicSpentDelta is the basic-tier draw being added to the window's spend, never
// negative. This method is NOT dedup-guarded — idempotency of the earn/spend pair is the
// composing use-case's: append the dedup-keyed ledger entry in the same transaction first and
// skip the delta when the append reports an already-applied retry.
//
// Update-first, then birth-insert: a single INSERT … ON CONFLICT upsert cannot carry a
// negative delta (PG CHECKs the proposed insert tuple even when it conflicts into the UPDATE
// arm), so the row is born by a separate insert that carries the first delta directly — a
// first-write overdraw is rejected, never masked. A concurrent birth loses the PK conflict
// and retries the update against the winner's row; a final no-row result means the guard
// refused the draw (the row provably exists after the conflict), reported as
// ErrBasicGrantExceeded.
func (s Store) ApplyBalanceDelta(ctx context.Context, scope platform.UserScope, resetWindow time.Time, additionalDelta int, basicSpentDelta int) (twinkle.BalanceRecord, error) {
	if err := s.ready(scope); err != nil {
		return twinkle.BalanceRecord{}, err
	}
	if basicSpentDelta < 0 || !fitsInt32(additionalDelta) || !fitsInt32(basicSpentDelta) {
		return twinkle.BalanceRecord{}, ErrDeltaOutOfRange
	}
	updateParams := dbgen.UpdateTwinkleBalanceDeltaParams{
		UserID:          scope.UserID(),
		AdditionalDelta: int32(additionalDelta),
		BasicSpentDelta: int32(basicSpentDelta),
		ResetWindow:     pgDate(resetWindow),
		BasicGrant:      int32(values.TwinkleBasicDailyAmount),
	}
	row, err := s.queries.UpdateTwinkleBalanceDelta(ctx, updateParams)
	if err == nil {
		return mapBalanceRecord(row), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return twinkle.BalanceRecord{}, balanceCheckAsInsufficient(err)
	}
	born, err := s.queries.InsertTwinkleBalance(ctx, dbgen.InsertTwinkleBalanceParams{
		UserID:          scope.UserID(),
		AdditionalDelta: int32(additionalDelta),
		BasicSpentDelta: int32(basicSpentDelta),
		ResetWindow:     pgDate(resetWindow),
		BasicGrant:      int32(values.TwinkleBasicDailyAmount),
	})
	if err == nil {
		return mapBalanceRecord(born), nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return twinkle.BalanceRecord{}, balanceCheckAsInsufficient(err)
	}
	row, err = s.queries.UpdateTwinkleBalanceDelta(ctx, updateParams)
	if errors.Is(err, pgx.ErrNoRows) {
		return twinkle.BalanceRecord{}, ErrBasicGrantExceeded
	}
	if err != nil {
		return twinkle.BalanceRecord{}, balanceCheckAsInsufficient(err)
	}
	return mapBalanceRecord(row), nil
}

// balanceCheckAsInsufficient translates a twinkle_balances CHECK violation into the
// canonical insufficient-twinkle denial: two spends racing the same stale balance
// read serialize on the row lock, and the loser's delta drives a tier negative —
// which IS "not enough twinkle at the true balance", not a storage fault. Every
// other error passes through untouched.
func balanceCheckAsInsufficient(err error) error {
	var pgErr *pgconn.PgError
	// 23514 = PostgreSQL check_violation.
	if errors.As(err, &pgErr) && pgErr.Code == "23514" && pgErr.TableName == "twinkle_balances" {
		return fmt.Errorf("twinkle balance tier exhausted by a concurrent spend: %w (%w)", twinkle.ErrInsufficientTwinkle, err)
	}
	return err
}

// AppendLedgerEntry appends one row to the append-only earn/spend log ([I1] — the log is
// never updated or deleted by the system). Returns false when the entry's dedup key was
// already applied (the idempotent retry no-op), true when the row was written. In an
// earn/spend transaction this append goes first: a false here tells the use-case to skip
// ApplyBalanceDelta, which is what makes the retried pair idempotent end to end.
func (s Store) AppendLedgerEntry(ctx context.Context, scope platform.UserScope, entry twinkle.LedgerEntry) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	if !fitsInt32(entry.Amount) || !fitsInt32(entry.FromBasic) || !fitsInt32(entry.FromAdditional) {
		return false, ErrDeltaOutOfRange
	}
	affected, err := s.queries.AppendTwinkleLedgerEntry(ctx, dbgen.AppendTwinkleLedgerEntryParams{
		ID:             entry.ID,
		UserID:         scope.UserID(),
		Kind:           string(entry.Kind),
		Reason:         string(entry.Reason),
		Amount:         int32(entry.Amount),
		FromBasic:      int32(entry.FromBasic),
		FromAdditional: int32(entry.FromAdditional),
		DedupKey:       pgText(entry.DedupKey),
		CreatedAt:      pgTime(timeOrNow(entry.CreatedAt)),
	})
	if err != nil {
		return false, err
	}
	return affected > 0, nil
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

// fitsInt32 keeps a domain int from wrapping through the INT-column cast — an oversized
// value is refused (ErrDeltaOutOfRange), never silently truncated into a different number.
func fitsInt32(value int) bool {
	return value >= math.MinInt32 && value <= math.MaxInt32
}

func mapBalanceRecord(row dbgen.TwinkleBalance) twinkle.BalanceRecord {
	return twinkle.BalanceRecord{
		Additional:           int(row.Additional),
		BasicSpentThisWindow: int(row.BasicSpentThisWindow),
		BasicResetWindow:     dateValue(row.BasicResetWindow),
	}
}

func pgDate(value time.Time) pgtype.Date {
	return pgtype.Date{Time: dateOnly(value), Valid: true}
}

func pgTime(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func pgText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func dateValue(value pgtype.Date) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return dateOnly(value.Time)
}

func dateOnly(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func timeOrNow(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now().UTC()
	}
	return value.UTC()
}
