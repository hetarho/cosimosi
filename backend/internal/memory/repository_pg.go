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
	"github.com/pgvector/pgvector-go"

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
			ID:               row.MemoryID,
			Mood:             moodFromDB(row.Mood),
			Intensity:        intensityFromDB(row.Intensity),
			Valence:          valenceFromDB(row.Valence),
			LastRecalledAt:   timeFromDB(row.LastRecalledAt),
			BrightnessOffset: float64(row.BrightnessOffset),
			HueShift:         float64(row.HueShift),
			FormSeedDelta:    float64(row.FormSeedDelta),
			Version:          int(row.Version),
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
			ID:               row.MemoryID,
			Mood:             moodFromDB(row.Mood),
			Intensity:        intensityFromDB(row.Intensity),
			Valence:          valenceFromDB(row.Valence),
			LastRecalledAt:   timeFromDB(row.LastRecalledAt),
			BrightnessOffset: float64(row.BrightnessOffset),
			HueShift:         float64(row.HueShift),
			FormSeedDelta:    float64(row.FormSeedDelta),
			Version:          int(row.Version),
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

// GetReshapeContext reads the PE/strength input for one recalled star (spec 23).
// ErrNotFound when the star+embedding pair is absent (a star with no embedding yet —
// extract/embed still pending — has no PE basis, so reshaping is simply skipped).
func (r *pgRepository) GetReshapeContext(ctx context.Context, userID, memoryID string) (ReshapeContext, error) {
	row, err := gen.New(r.pool).GetReshapeContext(ctx, gen.GetReshapeContextParams{
		ID: memoryID, UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ReshapeContext{}, ErrNotFound
	}
	if err != nil {
		return ReshapeContext{}, fmt.Errorf("get reshape context: %w", err)
	}
	// No consolidation snapshot exists yet (no column), so both embeddings are the
	// star's own — cos=1, pe=0 (acceptance 1.1). The seam lets a future snapshot feed
	// a real prediction error without changing the service gate.
	emb := embeddingToDomain(row.Embedding)
	return ReshapeContext{
		State: ReshapeState{
			BrightnessOffset: float64(row.BrightnessOffset),
			HueShift:         float64(row.HueShift),
			FormSeedDelta:    float64(row.FormSeedDelta),
			Version:          int(row.Version),
		},
		RecallEmbedding:       emb,
		ConsolidatedEmbedding: emb,
		CoRecall:              int(row.CoRecallTotal),
		CreatedAt:             row.CreatedAt.Time,
	}, nil
}

// ListDirectNeighbors returns the 1-hop neighbor ids over memory_links (spec 23).
func (r *pgRepository) ListDirectNeighbors(ctx context.Context, userID, memoryID string) ([]string, error) {
	ids, err := gen.New(r.pool).ListDirectNeighbors(ctx, gen.ListDirectNeighborsParams{
		ID: memoryID, UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("list direct neighbors: %w", err)
	}
	return ids, nil
}

// ReshapeStar applies the new reshaping state (version++) and appends the variant row
// IN ONE TRANSACTION — a crash between the two would otherwise bump version on memories
// with no matching evolution_history row (the append-only log would drift from version).
// Only the mutable star + the log change; the record is never touched (constitution §1).
func (r *pgRepository) ReshapeStar(ctx context.Context, userID, memoryID string, st ReshapeState, snap EvolutionSnapshot) error {
	evoID, err := newID()
	if err != nil {
		return err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reshape tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	q := gen.New(tx)
	if err := q.ApplyReshape(ctx, gen.ApplyReshapeParams{
		ID:               memoryID,
		UserID:           userID,
		BrightnessOffset: float32(st.BrightnessOffset),
		HueShift:         float32(st.HueShift),
		FormSeedDelta:    float32(st.FormSeedDelta),
	}); err != nil {
		return fmt.Errorf("apply reshape: %w", err)
	}
	if err := q.AppendEvolution(ctx, gen.AppendEvolutionParams{
		ID:            evoID,
		MemoryID:      memoryID,
		UserID:        userID,
		Version:       int32(snap.Version),
		Brightness:    float32(snap.Brightness),
		HueShift:      float32(snap.HueShift),
		FormSeedDelta: float32(snap.FormSeedDelta),
		Trigger:       snap.Trigger,
		Pe:            float32(snap.PE),
		Dir:           int32(snap.Dir),
	}); err != nil {
		return fmt.Errorf("append evolution: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit reshape: %w", err)
	}
	return nil
}

// GetEvolutionHistory reads a star's variant log, version ascending (spec 23).
func (r *pgRepository) GetEvolutionHistory(ctx context.Context, userID, memoryID string) ([]EvolutionSnapshot, error) {
	rows, err := gen.New(r.pool).GetEvolutionHistory(ctx, gen.GetEvolutionHistoryParams{
		MemoryID: memoryID, UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("get evolution history: %w", err)
	}
	out := make([]EvolutionSnapshot, 0, len(rows))
	for _, row := range rows {
		out = append(out, EvolutionSnapshot{
			Version:       int(row.Version),
			Brightness:    float64(row.Brightness),
			HueShift:      float64(row.HueShift),
			FormSeedDelta: float64(row.FormSeedDelta),
			Trigger:       row.Trigger,
			PE:            float64(row.Pe),
			Dir:           int(row.Dir),
			CreatedAt:     row.CreatedAt.Time,
		})
	}
	return out, nil
}

// embeddingToDomain flattens a pgvector column into the pure-domain []float64 the
// PE cosine uses; nil/absent vector → nil (cosineSim then yields pe 0).
func embeddingToDomain(v *pgvector.Vector) []float64 {
	if v == nil {
		return nil
	}
	src := v.Slice()
	out := make([]float64, len(src))
	for i, f := range src {
		out[i] = float64(f)
	}
	return out
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
