package memory

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/cosimosi/backend/internal/db/gen"
)

// pgRepository is the pgx/sqlc-backed Repository. It maps sqlc row types ↔ the
// pure domain (the domain never sees pgtype/db tags — constitution §5).
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the production Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository {
	return &pgRepository{pool: pool}
}

// RecordMemory runs record → memory → job in one transaction so a failure leaves
// no partial rows (acceptance 1.1/1.3). With an idempotency key, an existing
// (user_id, key) short-circuits to the stored memory id without writing (1.5).
func (r *pgRepository) RecordMemory(ctx context.Context, in RecordInput) (string, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	q := gen.New(tx)

	if in.IdempotencyKey != "" {
		key := in.IdempotencyKey
		existing, err := q.FindMemoryByIdempotencyKey(ctx, gen.FindMemoryByIdempotencyKeyParams{
			UserID:         in.UserID,
			IdempotencyKey: &key,
		})
		switch {
		case err == nil:
			if err := tx.Commit(ctx); err != nil {
				return "", fmt.Errorf("commit (idempotent hit): %w", err)
			}
			return existing, nil
		case errors.Is(err, pgx.ErrNoRows):
			// Not seen before — fall through to insert.
		default:
			return "", fmt.Errorf("idempotency check: %w", err)
		}
	}

	recordID, err := newID()
	if err != nil {
		return "", err
	}
	if err := q.InsertRecord(ctx, gen.InsertRecordParams{
		ID:             recordID,
		UserID:         in.UserID,
		Body:           in.Body,
		EntryDate:      pgtype.Date{Time: in.EntryDate, Valid: true},
		Mood:           moodToDB(in.Mood),
		Intensity:      intensityToDB(in.Intensity),
		IdempotencyKey: keyToDB(in.IdempotencyKey),
	}); err != nil {
		return "", fmt.Errorf("insert record: %w", err)
	}

	memoryID, err := newID()
	if err != nil {
		return "", err
	}
	if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{
		ID:       memoryID,
		UserID:   in.UserID,
		RecordID: recordID,
	}); err != nil {
		return "", fmt.Errorf("insert memory: %w", err)
	}

	jobID, err := newID()
	if err != nil {
		return "", err
	}
	if err := q.EnqueueJob(ctx, gen.EnqueueJobParams{ID: jobID, MemoryID: memoryID}); err != nil {
		return "", fmt.Errorf("enqueue job: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("commit: %w", err)
	}
	return memoryID, nil
}

// ListByUser returns every star for the user (dormant included), mood/intensity
// JOINed from records.
func (r *pgRepository) ListByUser(ctx context.Context, userID string) ([]Memory, error) {
	rows, err := gen.New(r.pool).ListMemoriesByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list memories: %w", err)
	}
	out := make([]Memory, 0, len(rows))
	for _, row := range rows {
		out = append(out, Memory{
			ID:             row.MemoryID,
			Mood:           moodFromDB(row.Mood),
			Intensity:      intensityFromDB(row.Intensity),
			LastRecalledAt: timeFromDB(row.LastRecalledAt),
		})
	}
	return out, nil
}

// ListDormant returns the user's long-unrecalled stars (last_recalled_at < cutoff),
// ascending — same column shape as ListByUser, so it maps to the same domain Memory.
func (r *pgRepository) ListDormant(ctx context.Context, userID string, cutoff time.Time) ([]Memory, error) {
	rows, err := gen.New(r.pool).ListDormant(ctx, gen.ListDormantParams{
		UserID: userID,
		Cutoff: pgtype.Timestamptz{Time: cutoff, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("list dormant: %w", err)
	}
	out := make([]Memory, 0, len(rows))
	for _, row := range rows {
		out = append(out, Memory{
			ID:             row.MemoryID,
			Mood:           moodFromDB(row.Mood),
			Intensity:      intensityFromDB(row.Intensity),
			LastRecalledAt: timeFromDB(row.LastRecalledAt),
		})
	}
	return out, nil
}

// TouchRecall sets memories.last_recalled_at=now for the user's star (no-op if
// absent — the original record is never touched, constitution §1).
func (r *pgRepository) TouchRecall(ctx context.Context, userID, memoryID string) error {
	if err := gen.New(r.pool).RecallMemoryTouch(ctx, gen.RecallMemoryTouchParams{
		ID: memoryID, UserID: userID,
	}); err != nil {
		return fmt.Errorf("touch recall: %w", err)
	}
	return nil
}

// GetRecord reads the immutable original (records JOIN) for the recall panel.
func (r *pgRepository) GetRecord(ctx context.Context, userID, memoryID string) (Record, error) {
	row, err := gen.New(r.pool).GetRecordByMemory(ctx, gen.GetRecordByMemoryParams{
		ID: memoryID, UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrNotFound
	}
	if err != nil {
		return Record{}, fmt.Errorf("get record: %w", err)
	}
	return Record{
		Body:      row.Body,
		EntryDate: row.EntryDate.Time,
		Mood:      moodFromDB(row.Mood),
		Intensity: intensityFromDB(row.Intensity),
		CreatedAt: row.CreatedAt.Time,
	}, nil
}

// newID is the server-authoritative id source: clients never supply ids
// (constitution §3/§8). 16 bytes of crypto entropy, base64url without padding.
func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// --- domain ↔ db (nullable) mappers ---

func moodToDB(m Mood) *string {
	if m == MoodUnspecified {
		return nil
	}
	s := string(m)
	return &s
}

func moodFromDB(s *string) Mood {
	if s == nil {
		return MoodUnspecified
	}
	return Mood(*s)
}

func intensityToDB(v float64) *float32 {
	f := float32(v)
	return &f
}

func intensityFromDB(f *float32) float64 {
	if f == nil {
		return 0
	}
	return float64(*f)
}

func keyToDB(k string) *string {
	if k == "" {
		return nil
	}
	return &k
}

func timeFromDB(ts pgtype.Timestamptz) *time.Time {
	if !ts.Valid {
		return nil
	}
	t := ts.Time
	return &t
}
