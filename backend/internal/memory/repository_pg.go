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

	"github.com/cosimosi/backend/internal/db/fragment"
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

// RecordMemory runs the record write in one transaction so a failure leaves no
// partial rows. With user-confirmed Segments (review step) the same transaction
// also fans them out as fragment stars (N memories + N embed jobs + intra-entry
// links) and returns their ids; without Segments the legacy path enqueues an
// extract job and the fragments are born asynchronously (spec 21). With an
// idempotency key, an existing (user_id, key) short-circuits to the stored
// record id plus whatever fragment ids its fan-out has produced so far,
// without writing.
func (r *pgRepository) RecordMemory(ctx context.Context, in RecordInput) (string, []string, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return "", nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	q := gen.New(tx)

	if in.IdempotencyKey != "" {
		key := in.IdempotencyKey
		existing, err := q.FindRecordByIdempotencyKey(ctx, gen.FindRecordByIdempotencyKeyParams{
			UserID:         in.UserID,
			IdempotencyKey: &key,
		})
		switch {
		case err == nil:
			memoryIDs, err := q.ListMemoryIDsByRecord(ctx, existing)
			if err != nil {
				return "", nil, fmt.Errorf("list fragments (idempotent hit): %w", err)
			}
			if err := tx.Commit(ctx); err != nil {
				return "", nil, fmt.Errorf("commit (idempotent hit): %w", err)
			}
			return existing, memoryIDs, nil
		case errors.Is(err, pgx.ErrNoRows):
			// Not seen before — fall through to insert.
		default:
			return "", nil, fmt.Errorf("idempotency check: %w", err)
		}
	}

	recordID, err := newID()
	if err != nil {
		return "", nil, err
	}
	if err := q.InsertRecord(ctx, gen.InsertRecordParams{
		ID:             recordID,
		UserID:         in.UserID,
		Body:           in.Body,
		EntryDate:      pgtype.Date{Time: in.EntryDate, Valid: true},
		Mood:           moodToDB(in.Mood),
		Intensity:      intensityToDB(in.Intensity),
		Valence:        valenceToDB(in.Valence),
		IdempotencyKey: keyToDB(in.IdempotencyKey),
	}); err != nil {
		return "", nil, fmt.Errorf("insert record: %w", err)
	}

	if len(in.Segments) > 0 {
		// User-confirmed fragments: same-transaction fan-out via the SHARED core
		// (db/fragment — single owner of the fan-out shape, so this path and the
		// async extract worker can never drift).
		segs := make([]fragment.Segment, 0, len(in.Segments))
		for i, s := range in.Segments {
			segs = append(segs, fragment.Segment{
				Index:     i,
				Text:      s.Text,
				Mood:      string(s.Mood),
				Intensity: s.Intensity,
				Valence:   s.Valence,
			})
		}
		memoryIDs, err := fragment.FanOutTx(ctx, q, recordID, in.UserID, segs)
		if err != nil {
			return "", nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return "", nil, fmt.Errorf("commit: %w", err)
		}
		return recordID, memoryIDs, nil
	}

	jobID, err := newID()
	if err != nil {
		return "", nil, err
	}
	if err := q.EnqueueExtractJob(ctx, gen.EnqueueExtractJobParams{
		ID:       jobID,
		RecordID: &recordID,
		UserID:   &in.UserID,
	}); err != nil {
		return "", nil, fmt.Errorf("enqueue extract job: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", nil, fmt.Errorf("commit: %w", err)
	}
	return recordID, nil, nil
}

// ListByUser returns every star for the user (dormant included);
// mood/intensity/valence are the fragment's own (memories, spec 21).
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
			Valence:        valenceFromDB(row.Valence),
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
			Valence:        valenceFromDB(row.Valence),
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

// valenceToDB stores the optional hint; 0 means "unset" (proto double default —
// documented on RecordMemoryRequest.valence) and maps to NULL.
func valenceToDB(v float64) *float32 {
	if v == 0 {
		return nil
	}
	f := float32(v)
	return &f
}

func intensityFromDB(f *float32) float64 {
	if f == nil {
		return 0
	}
	return float64(*f)
}

// valenceFromDB is intensityFromDB's valence twin — separate name because the
// ranges differ (valence -1..1 vs intensity 0..1) and may diverge later.
func valenceFromDB(f *float32) float64 {
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
