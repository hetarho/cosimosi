package invite

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

// pgRepository is the pgx/sqlc-backed Repository. The domain never sees pgtype/db tags
// (constitution §5) — toDomain/*FromPtr translate at this boundary.
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

func (r *pgRepository) Issue(ctx context.Context, c InviteCode) (InviteCode, error) {
	row, err := gen.New(r.pool).CreateInviteCode(ctx, gen.CreateInviteCodeParams{
		ID:        c.ID,
		Code:      c.Code,
		Label:     c.Label,
		CreatedBy: c.CreatedBy,
		ExpiresAt: tsFromPtr(c.ExpiresAt),
		MaxUses:   i32FromPtr(c.MaxUses),
	})
	if err != nil {
		return InviteCode{}, fmt.Errorf("create invite code: %w", err)
	}
	return toDomain(row), nil
}

func (r *pgRepository) GetByCode(ctx context.Context, code string) (InviteCode, bool, error) {
	row, err := gen.New(r.pool).GetInviteCodeByCode(ctx, code)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return InviteCode{}, false, nil
	case err != nil:
		return InviteCode{}, false, fmt.Errorf("get invite code: %w", err)
	}
	return toDomain(row), true, nil
}

func (r *pgRepository) IsMember(ctx context.Context, userID string) (bool, error) {
	ok, err := gen.New(r.pool).UserIsMember(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("user is member: %w", err)
	}
	return ok, nil
}

func (r *pgRepository) List(ctx context.Context) ([]InviteCode, error) {
	rows, err := gen.New(r.pool).ListInviteCodes(ctx)
	if err != nil {
		return nil, fmt.Errorf("list invite codes: %w", err)
	}
	out := make([]InviteCode, 0, len(rows))
	for _, row := range rows {
		out = append(out, toDomain(row))
	}
	return out, nil
}

func (r *pgRepository) Revoke(ctx context.Context, id string) (InviteCode, bool, error) {
	row, err := gen.New(r.pool).RevokeInviteCode(ctx, id)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return InviteCode{}, false, nil // no such code → service maps to ErrNotFound
	case err != nil:
		return InviteCode{}, false, fmt.Errorf("revoke invite code: %w", err)
	}
	return toDomain(row), true, nil
}

// Redeem is the atomic consume + membership grant. The code row is locked FOR UPDATE so two
// concurrent redeems of the same one-time code serialize (acceptance A5); the validity re-check
// inside the lock is authoritative (TOCTOU-safe). Idempotent: an already-member caller returns
// without consuming a use (acceptance A8). Read-only / invalid paths leave the deferred Rollback
// to close the tx (nothing was written).
func (r *pgRepository) Redeem(ctx context.Context, code, userID string, now time.Time) (RedeemOutcome, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return RedeemOutcome{}, fmt.Errorf("begin redeem tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	q := gen.New(tx)

	member, err := q.UserIsMember(ctx, userID)
	if err != nil {
		return RedeemOutcome{}, fmt.Errorf("redeem membership check: %w", err)
	}
	if member {
		return RedeemOutcome{Reason: ReasonOK, AlreadyMember: true}, nil // idempotent, nothing consumed
	}

	row, err := q.GetInviteCodeByCodeForUpdate(ctx, code)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return RedeemOutcome{Reason: ReasonNotFound}, nil
	case err != nil:
		return RedeemOutcome{}, fmt.Errorf("lock invite code: %w", err)
	}

	c := toDomain(row)
	if reason := evaluate(c, now); reason != ReasonOK {
		return RedeemOutcome{Reason: reason}, nil // revoked / expired / exhausted — not consumed
	}

	// ON CONFLICT DO NOTHING → rows affected. 0이면 같은 사용자가 (다른 코드로) 이미 멤버가 된
	// 경쟁 상황 — PK 위반 대신 멱등 OK로 처리하고 이 코드의 used_count는 올리지 않는다(코드 행 잠금이
	// 서로 다른 코드 사이를 직렬화하지 않으므로 빠른 멤버십 체크만으로는 못 막는 TOCTOU를 여기서 닫는다).
	inserted, err := q.InsertRedemption(ctx, gen.InsertRedemptionParams{UserID: userID, InviteCodeID: c.ID})
	if err != nil {
		return RedeemOutcome{}, fmt.Errorf("insert redemption: %w", err)
	}
	if inserted == 0 {
		if err := tx.Commit(ctx); err != nil {
			return RedeemOutcome{}, fmt.Errorf("commit redeem: %w", err)
		}
		return RedeemOutcome{Reason: ReasonOK, AlreadyMember: true}, nil
	}
	if err := q.IncrementInviteCodeUse(ctx, c.ID); err != nil {
		return RedeemOutcome{}, fmt.Errorf("increment invite use: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return RedeemOutcome{}, fmt.Errorf("commit redeem: %w", err)
	}
	return RedeemOutcome{Reason: ReasonOK}, nil
}

// --- pgtype/pointer translation (db boundary, constitution §5) ---

func toDomain(row gen.InviteCode) InviteCode {
	return InviteCode{
		ID:        row.ID,
		Code:      row.Code,
		Label:     row.Label,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt.Time,
		ExpiresAt: timeFromTS(row.ExpiresAt),
		MaxUses:   intFromPtr(row.MaxUses),
		UsedCount: int(row.UsedCount),
		RevokedAt: timeFromTS(row.RevokedAt),
	}
}

func tsFromPtr(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

func timeFromTS(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}

func i32FromPtr(i *int) *int32 {
	if i == nil {
		return nil
	}
	v := int32(*i)
	return &v
}

func intFromPtr(i *int32) *int {
	if i == nil {
		return nil
	}
	v := int(*i)
	return &v
}
