package job

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
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
	return Job{ID: row.ID, MemoryID: row.MemoryID, Attempts: int(row.Attempts)}, nil
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

// --- embedding/synapse (GraphStore) ---

func (r *pgRepository) GetMemoryForEmbed(ctx context.Context, memoryID string) (MemoryForEmbed, error) {
	row, err := gen.New(r.pool).GetMemoryForEmbed(ctx, memoryID)
	if err != nil {
		return MemoryForEmbed{}, fmt.Errorf("get memory for embed %s: %w", memoryID, err)
	}
	return MemoryForEmbed{
		UserID:    row.UserID,
		Body:      row.Body,
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
