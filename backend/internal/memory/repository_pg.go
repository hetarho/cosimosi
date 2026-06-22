package memory

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	dbutil "github.com/cosimosi/backend/internal/db"
	"github.com/cosimosi/backend/internal/db/fragment"
	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/platform/id"
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

	recordID, err := id.New()
	if err != nil {
		return "", nil, err
	}
	if err := q.InsertRecord(ctx, gen.InsertRecordParams{
		ID:             recordID,
		UserID:         in.UserID,
		Body:           in.Body,
		EntryDate:      pgtype.Date{Time: in.EntryDate, Valid: true},
		Mood:           moodToDB(in.Mood),
		Intensity:      dbutil.Float32Ptr(in.Intensity),
		Valence:        dbutil.NonZeroFloat32Ptr(in.Valence),
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

	jobID, err := id.New()
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
			Intensity:        dbutil.Float64Value(row.Intensity),
			Valence:          dbutil.Float64Value(row.Valence),
			LastRecalledAt:   dbutil.TimePtr(row.LastRecalledAt),
			BrightnessOffset: float64(row.BrightnessOffset),
			HueShift:         float64(row.HueShift),
			FormSeedDelta:    float64(row.FormSeedDelta),
			Version:          int(row.Version),
			RecordID:         row.RecordID,           // 28: 일기 단위 그룹 키
			FragmentIndex:    int(row.FragmentIndex), // 28: 일기 내 조각 순서
			Resonant:         row.Resonant,           // 36: 공명으로 다른 우주의 별과 이어졌는지
			RecallCount:      int(row.RecallCount),   // 07: 누적 회상 횟수(클라 S/R 파생)
		})
	}
	return out, nil
}

// ListRecords returns the user's original diaries (spec 28): one RecordSummary per
// record with its fragment-star count, entry-date descending. records is read-only
// (constitution §1 — the query is a GROUP BY SELECT, no UPDATE/DELETE).
func (r *pgRepository) ListRecords(ctx context.Context, userID string) ([]RecordSummary, error) {
	rows, err := gen.New(r.pool).ListRecords(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list records: %w", err)
	}
	out := make([]RecordSummary, 0, len(rows))
	for _, row := range rows {
		out = append(out, RecordSummary{
			RecordID:    row.RecordID,
			EntryDate:   row.EntryDate.Time,
			BodyExcerpt: row.BodyExcerpt,
			StarCount:   int(row.StarCount),
			Moods:       moodsFromDB(row.Moods), // change 09: 일기 감정 facet(중복 제거)
		})
	}
	return out, nil
}

// ListStarVectorsByUser returns every star's embedding + recency/intensity weights for
// the spec-26 relevance centroid. The LEFT JOIN yields a nil embedding for stars whose
// embed job hasn't run yet → empty []float64 (that star scores relevance 0). The query's
// WHERE guarantees a non-null last_recalled_at, so the timestamp maps directly.
func (r *pgRepository) ListStarVectorsByUser(ctx context.Context, userID string) ([]StarVector, error) {
	rows, err := gen.New(r.pool).ListStarVectorsByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list star vectors: %w", err)
	}
	out := make([]StarVector, 0, len(rows))
	for _, row := range rows {
		out = append(out, StarVector{
			ID:             row.MemoryID,
			Embedding:      embeddingToDomain(row.Embedding),
			Intensity:      dbutil.Float64Value(row.Intensity),
			LastRecalledAt: row.LastRecalledAt.Time,
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
			Intensity:        dbutil.Float64Value(row.Intensity),
			Valence:          dbutil.Float64Value(row.Valence),
			LastRecalledAt:   dbutil.TimePtr(row.LastRecalledAt),
			BrightnessOffset: float64(row.BrightnessOffset),
			HueShift:         float64(row.HueShift),
			FormSeedDelta:    float64(row.FormSeedDelta),
			Version:          int(row.Version),
			RecallCount:      int(row.RecallCount), // 07: 누적 회상 횟수
		})
	}
	return out, nil
}

// (spec 07) ListRecentForAmbient retired — server no longer aggregates "요즘" emotion.

// TouchRecall sets memories.last_recalled_at=now (+ recall_count += 1, spec 07) for the
// user's star (no-op if absent — the original record is never touched, constitution §1).
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
		Body:         row.Body,
		EntryDate:    row.EntryDate.Time,
		Mood:         moodFromDB(row.Mood),
		Intensity:    dbutil.Float64Value(row.Intensity),
		CreatedAt:    row.CreatedAt.Time,
		FragmentText: fragmentTextFromDB(row.FragmentText), // 28: 별 → 조각(NULL → "")
	}, nil
}

// GetRecordByID reads the immutable original by record_id directly (spec 28, change 09 —
// standalone diary page). Owner-guarded query → ErrNoRows (another user's / missing record)
// maps to ErrNotFound. Side-effect free: the star layer is never touched (no recall bump).
func (r *pgRepository) GetRecordByID(ctx context.Context, userID, recordID string) (Record, error) {
	row, err := gen.New(r.pool).GetRecordByRecord(ctx, gen.GetRecordByRecordParams{
		ID: recordID, UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Record{}, ErrNotFound
	}
	if err != nil {
		return Record{}, fmt.Errorf("get record by id: %w", err)
	}
	return Record{
		Body:      row.Body,
		EntryDate: row.EntryDate.Time,
		Mood:      moodFromDB(row.Mood),
		Intensity: dbutil.Float64Value(row.Intensity),
		CreatedAt: row.CreatedAt.Time,
		// FragmentText stays "" — the standalone page shows the whole original (헌법1).
	}, nil
}

// fragmentTextFromDB maps the nullable memories.fragment_text to "" (single-fragment /
// pre-21 stars store NULL → the client falls back to the whole-record body, spec 28).
func fragmentTextFromDB(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// moodsFromDB maps the ListRecords mood facet (text[], NULLs already removed in SQL) to
// the domain Mood slice (change 09). nil/empty → nil. Defensive: a stray empty string
// (shouldn't occur — array_remove drops NULL, and stored moods are non-empty) is skipped.
func moodsFromDB(ss []string) []Mood {
	if len(ss) == 0 {
		return nil
	}
	out := make([]Mood, 0, len(ss))
	for _, s := range ss {
		if s == "" {
			continue
		}
		out = append(out, Mood(s))
	}
	return out
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
	return ReshapeContext{
		State: ReshapeState{
			BrightnessOffset: float64(row.BrightnessOffset),
			HueShift:         float64(row.HueShift),
			FormSeedDelta:    float64(row.FormSeedDelta),
			Version:          int(row.Version),
		},
		RecallEmbedding:       embeddingToDomain(row.RecallEmbedding),
		ConsolidatedEmbedding: embeddingToDomain(row.ConsolidatedEmbedding),
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
	evoID, err := id.New()
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

// --- domain ↔ db (nullable) mappers ---

func moodToDB(m Mood) *string {
	if m == MoodUnspecified {
		return nil
	}
	return dbutil.StringPtr(string(m))
}

func moodFromDB(s *string) Mood {
	if s == nil {
		return MoodUnspecified
	}
	return Mood(*s)
}

func keyToDB(k string) *string {
	return dbutil.StringPtr(k)
}
