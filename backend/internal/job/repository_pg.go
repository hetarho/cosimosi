package job

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	"github.com/cosimosi/backend/internal/db/gen"
)

// claimLeaseSeconds is the visibility timeout: a job left 'running' longer than
// this (a worker killed/crashed before Complete/Fail) is considered abandoned and
// reclaimable by the next ClaimJob. Generous enough that no healthy in-progress
// job (mock is instant, OpenAI is seconds) is ever reclaimed mid-flight.
const claimLeaseSeconds = 120

// pgRepository is the pgx/sqlc-backed implementation of both the queue Repository
// and the embedding/synapse GraphStore. It maps sqlc row/param types ↔ the pure
// job domain (the domain never sees pgtype/pgvector — constitution §5).
type pgRepository struct {
	pool *pgxpool.Pool
}

// NewRepository builds the queue Repository over a pgx pool.
func NewRepository(pool *pgxpool.Pool) Repository { return &pgRepository{pool: pool} }

// NewGraphStore builds the embedding/synapse GraphStore over a pgx pool.
func NewGraphStore(pool *pgxpool.Pool) GraphStore { return &pgRepository{pool: pool} }

// --- queue (Repository) ---
//
// Note: there is deliberately no Enqueue here. Enqueue must run inside the
// RecordMemory transaction (memory/repository_pg.go, gen.EnqueueJob on the tx) so
// record→memory→job is atomic (spec 04); a separate pool-scoped enqueue would
// break that guarantee. The worker only consumes (Claim/Complete/Fail).

func (r *pgRepository) Claim(ctx context.Context, kind Kind) (Job, error) {
	row, err := gen.New(r.pool).ClaimJob(ctx, gen.ClaimJobParams{
		Kind:         string(kind),
		LeaseSeconds: claimLeaseSeconds,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, ErrNoJob
	}
	if err != nil {
		return Job{}, fmt.Errorf("claim job: %w", err)
	}
	return Job{
		ID:       row.ID,
		Kind:     kind,
		MemoryID: strFromDB(row.MemoryID),
		RecordID: strFromDB(row.RecordID),
		Attempts: int(row.Attempts),
	}, nil
}

func (r *pgRepository) Complete(ctx context.Context, id string) error {
	if err := gen.New(r.pool).CompleteJob(ctx, id); err != nil {
		return fmt.Errorf("complete job: %w", err)
	}
	return nil
}

func (r *pgRepository) Fail(ctx context.Context, id string, status Status, errMsg string, nextRunAt time.Time) error {
	if err := gen.New(r.pool).FailJob(ctx, gen.FailJobParams{
		ID:        id,
		Status:    string(status),
		Error:     errMsg,
		NextRunAt: pgtype.Timestamptz{Time: nextRunAt, Valid: true},
	}); err != nil {
		return fmt.Errorf("fail job: %w", err)
	}
	return nil
}

func (r *pgRepository) Stats(ctx context.Context) (QueueStats, error) {
	row, err := gen.New(r.pool).JobQueueStats(ctx)
	if err != nil {
		return QueueStats{}, fmt.Errorf("job queue stats: %w", err)
	}
	return QueueStats{
		Pending:          int(row.Pending),
		DuePending:       int(row.DuePending),
		Running:          int(row.Running),
		Failed:           int(row.Failed),
		OldestPendingAge: time.Duration(row.OldestPendingSeconds * float64(time.Second)),
	}, nil
}

// --- fragment fan-out (GraphStore, spec 21) ---

func (r *pgRepository) GetRecordForExtract(ctx context.Context, recordID string) (RecordForExtract, error) {
	row, err := gen.New(r.pool).GetRecordForExtract(ctx, recordID)
	if err != nil {
		return RecordForExtract{}, fmt.Errorf("get record for extract %s: %w", recordID, err)
	}
	return RecordForExtract{
		UserID:        row.UserID,
		Body:          row.Body,
		EntryDate:     row.EntryDate.Time,
		HintMood:      strFromDB(row.Mood),
		HintIntensity: f32FromDB(row.Intensity),
		HintValence:   f32FromDB(row.Valence),
	}, nil
}

func (r *pgRepository) FragmentIDs(ctx context.Context, recordID string) ([]string, error) {
	ids, err := gen.New(r.pool).ListMemoryIDsByRecord(ctx, recordID)
	if err != nil {
		return nil, fmt.Errorf("list fragments for %s: %w", recordID, err)
	}
	return ids, nil
}

// FanOutFragments runs the whole fan-out in ONE transaction: N InsertMemory +
// N EnqueueEmbedJob + the intra-entry links — a partial failure rolls back all
// (acceptance 1.1–1.3). The already-fanned-out short-circuit makes a retried or
// lease-reclaimed extract job a no-op. A CONCURRENT double-run (two workers on
// the same record after a lease expiry) can pass the check on both sides; the
// UNIQUE (record_id, fragment_index) index then rejects the loser, which is
// converted back into the idempotent path (existing ids) instead of a retry storm.
func (r *pgRepository) FanOutFragments(ctx context.Context, recordID, userID string, segs []Segment) ([]string, error) {
	ids, err := r.fanOutTx(ctx, recordID, userID, segs)
	if isUniqueViolation(err) {
		existing, listErr := gen.New(r.pool).ListMemoryIDsByRecord(ctx, recordID)
		if listErr == nil && len(existing) > 0 {
			return existing, nil
		}
	}
	return ids, err
}

func (r *pgRepository) fanOutTx(ctx context.Context, recordID, userID string, segs []Segment) ([]string, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin fan-out tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed

	q := gen.New(tx)

	existing, err := q.ListMemoryIDsByRecord(ctx, recordID)
	if err != nil {
		return nil, fmt.Errorf("check existing fragments: %w", err)
	}
	if len(existing) > 0 {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit (already fanned out): %w", err)
		}
		return existing, nil
	}

	ids := make([]string, 0, len(segs))
	for _, s := range segs {
		memoryID, err := newID()
		if err != nil {
			return nil, err
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{
			ID:            memoryID,
			UserID:        userID,
			RecordID:      recordID,
			Mood:          strToDB(s.Mood),
			Intensity:     f32ToDB(s.Intensity),
			FragmentIndex: int32(s.Index),
			FragmentText:  strToDB(s.Text),
			Valence:       f32ToDB(s.Valence),
		}); err != nil {
			return nil, fmt.Errorf("insert fragment %d: %w", s.Index, err)
		}
		jobID, err := newID()
		if err != nil {
			return nil, err
		}
		if err := q.EnqueueEmbedJob(ctx, gen.EnqueueEmbedJobParams{ID: jobID, MemoryID: &memoryID}); err != nil {
			return nil, fmt.Errorf("enqueue embed job for fragment %d: %w", s.Index, err)
		}
		ids = append(ids, memoryID)
	}

	// Within-event binding: every fragment pair, w=0.8 (a<b normalized in SQL).
	if len(ids) >= 2 {
		var aIDs, bIDs, userIDs []string
		for i := 0; i < len(ids); i++ {
			for k := i + 1; k < len(ids); k++ {
				aIDs = append(aIDs, ids[i])
				bIDs = append(bIDs, ids[k])
				userIDs = append(userIDs, userID)
			}
		}
		if err := q.BatchUpsertIntraEntryLinks(ctx, gen.BatchUpsertIntraEntryLinksParams{
			AIds: aIDs, BIds: bIDs, UserIds: userIDs,
		}); err != nil {
			return nil, fmt.Errorf("upsert intra-entry links: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit fan-out: %w", err)
	}
	return ids, nil
}

// --- embedding/synapse (GraphStore) ---

func (r *pgRepository) GetMemoryForEmbed(ctx context.Context, memoryID string) (MemoryForEmbed, error) {
	row, err := gen.New(r.pool).GetMemoryForEmbed(ctx, memoryID)
	if err != nil {
		return MemoryForEmbed{}, fmt.Errorf("get memory for embed %s: %w", memoryID, err)
	}
	return MemoryForEmbed{
		UserID:    row.UserID,
		Text:      row.Text,
		EntryDate: row.EntryDate.Time,
	}, nil
}

func (r *pgRepository) UpsertEmbedding(ctx context.Context, memoryID, userID string, vec []float32, model string) error {
	v := pgvector.NewVector(vec)
	if err := gen.New(r.pool).UpsertEmbedding(ctx, gen.UpsertEmbeddingParams{
		MemoryID:  memoryID,
		UserID:    userID,
		Embedding: &v,
		Model:     model,
	}); err != nil {
		return fmt.Errorf("upsert embedding: %w", err)
	}
	return nil
}

func (r *pgRepository) KnnNearest(ctx context.Context, userID string, vec []float32, selfID string, k int) ([]Neighbor, error) {
	v := pgvector.NewVector(vec)
	rows, err := gen.New(r.pool).KnnNearest(ctx, gen.KnnNearestParams{
		Query:  &v,
		UserID: userID,
		SelfID: selfID,
		K:      int32(k),
	})
	if err != nil {
		return nil, fmt.Errorf("knn nearest: %w", err)
	}
	out := make([]Neighbor, 0, len(rows))
	for _, row := range rows {
		out = append(out, Neighbor{
			MemoryID:  row.MemoryID,
			CosSim:    row.CosSim,
			EntryDate: row.EntryDate.Time,
		})
	}
	return out, nil
}

func (r *pgRepository) BatchUpsertLinks(ctx context.Context, links []LinkUpsert) error {
	if len(links) == 0 {
		return nil
	}
	aIDs := make([]string, len(links))
	bIDs := make([]string, len(links))
	weights := make([]float64, len(links))
	userIDs := make([]string, len(links))
	for i, l := range links {
		aIDs[i] = l.AID
		bIDs[i] = l.BID
		weights[i] = l.Weight
		userIDs[i] = l.UserID
	}
	if err := gen.New(r.pool).BatchUpsertLinks(ctx, gen.BatchUpsertLinksParams{
		AIds:    aIDs,
		BIds:    bIDs,
		Weights: weights,
		UserIds: userIDs,
	}); err != nil {
		return fmt.Errorf("batch upsert links: %w", err)
	}
	return nil
}

// isUniqueViolation reports a Postgres 23505 (unique_violation) — the fan-out
// fence on UNIQUE (record_id, fragment_index).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// newID is the server-authoritative id source (same recipe as the memory
// repository): 16 bytes of crypto entropy, base64url without padding.
func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// --- domain ↔ db (nullable) mappers ---

func strFromDB(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// strToDB stores "" as NULL ("" = unset mood / no fragment text → r.body fallback).
func strToDB(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func f32FromDB(f *float32) float64 {
	if f == nil {
		return 0
	}
	return float64(*f)
}

func f32ToDB(v float64) *float32 {
	f := float32(v)
	return &f
}
