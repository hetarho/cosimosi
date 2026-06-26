package gift

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	dbutil "github.com/cosimosi/backend/internal/db"
	"github.com/cosimosi/backend/internal/db/fragment"
	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/platform/id"
)

// pgRepository is the pgx/sqlc-backed Repository. It maps sqlc row types ↔ the pure domain
// (the domain never sees pgtype/db tags — constitution §5).
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

func (r *pgRepository) CreateGift(ctx context.Context, in CreateGiftInput) error {
	giftID, err := id.New()
	if err != nil {
		return err
	}
	_, err = gen.New(r.pool).CreateGift(ctx, gen.CreateGiftParams{
		ID:             giftID,
		Token:          in.Token,
		SenderUserID:   in.SenderUserID,
		SenderMemoryID: in.SenderMemoryID,
		Message:        in.Message,
		ExpiresAt:      pgtype.Timestamptz{Time: in.ExpiresAt, Valid: true},
	})
	// 0 rows (ownership guard failed: the star isn't the sender's, or doesn't exist) → ErrNoRows.
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrStarNotFound
	}
	if err != nil {
		return fmt.Errorf("create gift: %w", err)
	}
	return nil
}

func (r *pgRepository) GetByToken(ctx context.Context, token string) (Gift, error) {
	row, err := gen.New(r.pool).GetGiftViewByToken(ctx, token)
	if errors.Is(err, pgx.ErrNoRows) {
		return Gift{}, ErrNotFound
	}
	if err != nil {
		return Gift{}, fmt.Errorf("get gift by token: %w", err)
	}
	return Gift{
		ID:              row.ID,
		Token:           row.Token,
		SenderUserID:    row.SenderUserID,
		SenderMemoryID:  row.SenderMemoryID,
		Message:         row.Message,
		Status:          GiftStatus(row.Status),
		RecipientUserID: dbutil.StringValue(row.RecipientUserID),
		// COALESCE(…, CASE…)이라 sqlc가 nullable로 추론 — 실제론 항상 non-null('' 폴백). 빈 문자열로.
		FragmentText: dbutil.StringValue(row.FragmentText),
		Mood:         dbutil.StringValue(row.Mood),
		CreatedAt:    row.CreatedAt.Time,
		ExpiresAt:    row.ExpiresAt.Time,
		RespondedAt:  dbutil.TimePtr(row.RespondedAt),
	}, nil
}

// AcceptGift is the atomic accept (acceptance 2.1): lock the gift, re-check pending & not
// expired (authoritative — guards against a concurrent accept/cancel), then create the
// recipient's immutable record + a SINGLE fragment star via the shared spec-21 fan-out core
// (extract skipped: one event, one memory; the same core emits the embed job + no intra links
// for a 1-segment entry) + the resonance, and mark the gift accepted. All-or-nothing.
func (r *pgRepository) AcceptGift(ctx context.Context, token, recipientUserID string, rw Rewrite, now time.Time) (AcceptResult, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return AcceptResult{}, fmt.Errorf("begin accept tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	q := gen.New(tx)

	locked, err := q.GetGiftForUpdate(ctx, token)
	if errors.Is(err, pgx.ErrNoRows) {
		return AcceptResult{}, ErrNotFound
	}
	if err != nil {
		return AcceptResult{}, fmt.Errorf("lock gift: %w", err)
	}
	// Authoritative state guard (TOCTOU-safe under FOR UPDATE).
	if locked.SenderUserID == recipientUserID {
		return AcceptResult{}, ErrSelfRespond
	}
	if err := actionable(Gift{Status: GiftStatus(locked.Status), ExpiresAt: locked.ExpiresAt.Time}, now); err != nil {
		return AcceptResult{}, err
	}

	recordID, err := id.New()
	if err != nil {
		return AcceptResult{}, err
	}
	if err := q.InsertRecord(ctx, gen.InsertRecordParams{
		ID:        recordID,
		UserID:    recipientUserID,
		Body:      rw.Text,
		EntryDate: pgtype.Date{Time: now, Valid: true},
		Mood:      dbutil.StringPtr(rw.Mood),
		Intensity: dbutil.Float32Ptr(rw.Intensity),
		Valence:   dbutil.NonZeroFloat32Ptr(rw.Valence),
		// no idempotency key — the gift's pending-status guard is the idempotency fence.
	}); err != nil {
		return AcceptResult{}, fmt.Errorf("insert rewrite record: %w", err)
	}

	// Single fragment (extract skipped — 설계 요점). The shared fan-out core inserts the memory
	// + the embed job (and no intra-entry links for a lone segment), so this path can never drift
	// from the normal record fan-out.
	memoryIDs, err := fragment.FanOutTx(ctx, q, recordID, recipientUserID, []fragment.Segment{{
		Index:     0,
		Text:      rw.Text,
		Mood:      rw.Mood,
		Intensity: rw.Intensity,
		Valence:   rw.Valence,
	}})
	if err != nil {
		return AcceptResult{}, err
	}
	if len(memoryIDs) != 1 {
		return AcceptResult{}, fmt.Errorf("expected 1 fragment, got %d", len(memoryIDs))
	}
	recipientMemoryID := memoryIDs[0]

	resID, err := id.New()
	if err != nil {
		return AcceptResult{}, err
	}
	if err := q.InsertResonance(ctx, gen.InsertResonanceParams{
		ID:                resID,
		GiftID:            locked.ID,
		SenderMemoryID:    locked.SenderMemoryID,
		RecipientMemoryID: recipientMemoryID,
	}); err != nil {
		return AcceptResult{}, fmt.Errorf("insert resonance: %w", err)
	}

	rid := recipientUserID
	affected, err := q.MarkGiftAccepted(ctx, gen.MarkGiftAcceptedParams{ID: locked.ID, RecipientUserID: &rid})
	if err != nil {
		return AcceptResult{}, fmt.Errorf("mark gift accepted: %w", err)
	}
	if affected != 1 {
		// The FOR UPDATE lock makes this unreachable in practice, but a 0 here means the row
		// left 'pending' under us — refuse rather than commit an orphan record/memory.
		return AcceptResult{}, ErrNotPending
	}

	if err := tx.Commit(ctx); err != nil {
		return AcceptResult{}, fmt.Errorf("commit accept: %w", err)
	}
	return AcceptResult{RecordID: recordID, MemoryID: recipientMemoryID}, nil
}

func (r *pgRepository) DeclineGift(ctx context.Context, token, recipientUserID string) (bool, error) {
	rid := recipientUserID
	affected, err := gen.New(r.pool).DeclineGift(ctx, gen.DeclineGiftParams{Token: token, RecipientUserID: &rid})
	if err != nil {
		return false, fmt.Errorf("decline gift: %w", err)
	}
	return affected == 1, nil
}

func (r *pgRepository) CancelGift(ctx context.Context, giftID, senderUserID string) (bool, error) {
	affected, err := gen.New(r.pool).CancelGift(ctx, gen.CancelGiftParams{GiftID: giftID, SenderUserID: senderUserID})
	if err != nil {
		return false, fmt.Errorf("cancel gift: %w", err)
	}
	return affected == 1, nil
}

func (r *pgRepository) ListSent(ctx context.Context, userID string) ([]GiftRecord, error) {
	rows, err := gen.New(r.pool).ListSentGifts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list sent gifts: %w", err)
	}
	out := make([]GiftRecord, 0, len(rows))
	for _, row := range rows {
		out = append(out, GiftRecord{
			GiftID:            row.ID,
			Token:             row.Token,
			Status:            GiftStatus(row.Status),
			CounterpartUserID: dbutil.StringValue(row.RecipientUserID), // recipient ("" while pending)
			Message:           row.Message,
			CreatedAt:         row.CreatedAt.Time,
			RespondedAt:       dbutil.TimePtr(row.RespondedAt),
			ExpiresAt:         row.ExpiresAt.Time,
		})
	}
	return out, nil
}

func (r *pgRepository) ListReceived(ctx context.Context, userID string) ([]GiftRecord, error) {
	rows, err := gen.New(r.pool).ListReceivedGifts(ctx, &userID)
	if err != nil {
		return nil, fmt.Errorf("list received gifts: %w", err)
	}
	out := make([]GiftRecord, 0, len(rows))
	for _, row := range rows {
		out = append(out, GiftRecord{
			GiftID:            row.ID,
			Token:             row.Token,
			Status:            GiftStatus(row.Status),
			CounterpartUserID: row.SenderUserID, // sender
			Message:           row.Message,
			CreatedAt:         row.CreatedAt.Time,
			RespondedAt:       dbutil.TimePtr(row.RespondedAt),
			ExpiresAt:         row.ExpiresAt.Time,
		})
	}
	return out, nil
}

func (r *pgRepository) ResonancesBetween(ctx context.Context, callerUserID, ownerUserID string) ([]ResonancePair, error) {
	rows, err := gen.New(r.pool).ListResonanceBridges(ctx, gen.ListResonanceBridgesParams{
		CallerUserID: callerUserID,
		OwnerUserID:  ownerUserID,
	})
	if err != nil {
		return nil, fmt.Errorf("list resonance bridges: %w", err)
	}
	out := make([]ResonancePair, 0, len(rows))
	for _, row := range rows {
		out = append(out, ResonancePair{MyMemoryID: row.MyMemoryID, TheirMemoryID: row.TheirMemoryID})
	}
	return out, nil
}

func (r *pgRepository) ResonancePartnerUserID(ctx context.Context, memoryID, userID string) (string, bool, error) {
	partnerID, err := gen.New(r.pool).GetResonancePartner(ctx, gen.GetResonancePartnerParams{MemoryID: memoryID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil // not resonant (or not the caller's star)
	}
	if err != nil {
		return "", false, fmt.Errorf("get resonance partner: %w", err)
	}
	return partnerID, true, nil
}

// --- domain ↔ db (nullable) mappers ---
