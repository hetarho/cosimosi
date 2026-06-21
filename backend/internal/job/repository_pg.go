package job

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"

	dbutil "github.com/cosimosi/backend/internal/db"
	"github.com/cosimosi/backend/internal/db/fragment"
	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/platform/id"
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
		MemoryID: dbutil.StringValue(row.MemoryID),
		RecordID: dbutil.StringValue(row.RecordID),
		UserID:   dbutil.StringValue(row.UserID),
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
		HintMood:      dbutil.StringValue(row.Mood),
		HintIntensity: dbutil.Float64Value(row.Intensity),
		HintValence:   dbutil.Float64Value(row.Valence),
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

	// Shared fan-out core (db/fragment) — single owner of the fan-out shape,
	// shared with the synchronous user-confirmed path (memory.RecordMemory) so
	// the two paths can never drift in graph topology.
	ids, err := fragment.FanOutTx(ctx, q, recordID, userID, segs)
	if err != nil {
		return nil, err
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

func (r *pgRepository) LoadExcitabilityInputs(ctx context.Context, userID string, ids []string) (ExcitabilityInputs, error) {
	if len(ids) == 0 {
		return ExcitabilityInputs{Recalled: map[string]time.Time{}}, nil
	}
	q := gen.New(r.pool)
	recalledRows, err := q.ListLastRecalled(ctx, gen.ListLastRecalledParams{UserID: userID, Ids: ids})
	if err != nil {
		return ExcitabilityInputs{}, fmt.Errorf("list last recalled: %w", err)
	}
	recalled := make(map[string]time.Time, len(recalledRows))
	for _, row := range recalledRows {
		recalled[row.ID] = row.LastRecalledAt.Time
	}
	linkRows, err := q.ListLinksForCluster(ctx, gen.ListLinksForClusterParams{UserID: userID, Ids: ids})
	if err != nil {
		return ExcitabilityInputs{}, fmt.Errorf("list links for cluster: %w", err)
	}
	links := make([]ClusterLink, 0, len(linkRows))
	for _, row := range linkRows {
		links = append(links, ClusterLink{AID: row.AID, BID: row.BID, LastActivatedAt: row.LastActivatedAt.Time})
	}
	return ExcitabilityInputs{Recalled: recalled, Links: links}, nil
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

// --- nightly consolidation (GraphStore, spec 27) ---

func (r *pgRepository) LoadConsolidateGraph(ctx context.Context, userID string) (ConsolidateGraph, error) {
	q := gen.New(r.pool)
	starRows, err := q.ListStarsForConsolidate(ctx, userID)
	if err != nil {
		return ConsolidateGraph{}, fmt.Errorf("list stars for consolidate: %w", err)
	}
	stars := make([]ConsolidateStar, 0, len(starRows))
	for _, row := range starRows {
		stars = append(stars, ConsolidateStar{
			ID:             row.MemoryID,
			LastRecalledAt: row.LastRecalledAt.Time,
			StableX:        dbutil.Float64Ptr(row.StableX),
			StableY:        dbutil.Float64Ptr(row.StableY),
			StableZ:        dbutil.Float64Ptr(row.StableZ),
		})
	}
	linkRows, err := q.ListLinksByUser(ctx, userID)
	if err != nil {
		return ConsolidateGraph{}, fmt.Errorf("list links for consolidate: %w", err)
	}
	links := make([]ConsolidateLink, 0, len(linkRows))
	for _, row := range linkRows {
		links = append(links, ConsolidateLink{
			AID:             row.AID,
			BID:             row.BID,
			Weight:          float64(row.Weight),
			LastActivatedAt: row.LastActivatedAt.Time,
		})
	}
	return ConsolidateGraph{Stars: stars, Links: links}, nil
}

// RunConsolidation applies passes ②–④ + job completion in ONE transaction (spec 27).
// Two layers make a re-run safe, since the gist UPDATE advances form_seed_delta by a fixed
// step (monotonic but NOT idempotent):
//   - within an attempt: bundling gist + its history append + prune + stable-coord cache +
//     CompleteJob in one tx means a mid-job failure rolls them ALL back together — never a
//     half-applied (and re-appliable) consolidation.
//   - across attempts: if the whole job exceeds the 120s claim lease (huge graph) or a worker
//     crashes after committing, the reclaimed re-run's gist WHERE (gist_dedupe_cutoff) sees
//     the prior committed nightly_gist history and skips those stars — so the same night never
//     double-advances. The gist RETURNING rows feed the history insert in-tx, so memories ↔
//     evolution_history can never drift. No DELETE (constitution §2); records untouched (§1).
func (r *pgRepository) RunConsolidation(ctx context.Context, jobID, userID string, w ConsolidationWrite) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin consolidation tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op once committed
	q := gen.New(tx)

	if len(w.Coords) > 0 {
		ids := make([]string, len(w.Coords))
		xs := make([]float32, len(w.Coords))
		ys := make([]float32, len(w.Coords))
		zs := make([]float32, len(w.Coords))
		for i, c := range w.Coords {
			ids[i], xs[i], ys[i], zs[i] = c.ID, float32(c.X), float32(c.Y), float32(c.Z)
		}
		if err := q.CacheStableCoords(ctx, gen.CacheStableCoordsParams{
			UserID: userID, Ids: ids, Xs: xs, Ys: ys, Zs: zs,
		}); err != nil {
			return 0, fmt.Errorf("cache stable coords: %w", err)
		}
	}

	gisted, err := q.GistSimplifyStars(ctx, gen.GistSimplifyStarsParams{
		Simplify:         float32(w.Simplify),
		UserID:           userID,
		AgeCutoff:        pgtype.Timestamptz{Time: w.AgeCutoff, Valid: true},
		RecallCutoff:     pgtype.Timestamptz{Time: w.RecallCutoff, Valid: true},
		GistDedupeCutoff: pgtype.Timestamptz{Time: w.GistDedupeCutoff, Valid: true},
	})
	if err != nil {
		return 0, fmt.Errorf("gist simplify: %w", err)
	}
	if len(gisted) > 0 {
		histIDs := make([]string, len(gisted))
		memoryIDs := make([]string, len(gisted))
		versions := make([]int32, len(gisted))
		brightnesses := make([]float32, len(gisted))
		hueShifts := make([]float32, len(gisted))
		formSeedDeltas := make([]float32, len(gisted))
		for i, row := range gisted {
			historyID, err := id.New()
			if err != nil {
				return 0, fmt.Errorf("gist history id: %w", err)
			}
			histIDs[i] = historyID
			memoryIDs[i] = row.MemoryID
			versions[i] = row.Version
			brightnesses[i] = row.BrightnessOffset // brightness_offset snapshot at this version (23)
			hueShifts[i] = row.HueShift
			formSeedDeltas[i] = row.FormSeedDelta
		}
		if err := q.AppendGistHistory(ctx, gen.AppendGistHistoryParams{
			UserID: userID, Ids: histIDs, MemoryIds: memoryIDs, Versions: versions,
			Brightnesses: brightnesses, HueShifts: hueShifts, FormSeedDeltas: formSeedDeltas,
		}); err != nil {
			return 0, fmt.Errorf("append gist history: %w", err)
		}
	}

	if err := q.PruneWeakLinks(ctx, gen.PruneWeakLinksParams{
		Floor:         float32(w.Floor),
		UserID:        userID,
		WeakThreshold: float32(w.WeakThreshold),
		IdleCutoff:    pgtype.Timestamptz{Time: w.IdleCutoff, Valid: true},
	}); err != nil {
		return 0, fmt.Errorf("prune weak links: %w", err)
	}

	if err := q.CompleteJob(ctx, jobID); err != nil {
		return 0, fmt.Errorf("complete consolidate: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit consolidation: %w", err)
	}
	return len(gisted), nil
}

// --- nightly scheduler (producer, spec 27) ---

// pgScheduler is the nightly ticker's enqueue side. Kept distinct from the consumer
// Repository so the "no Enqueue on the consumer" invariant (see Repository doc) stays
// crisp: consolidate jobs are enqueued by the ticker, outside any RecordMemory tx.
type pgScheduler struct {
	pool *pgxpool.Pool
}

// NewScheduler builds the nightly-consolidation Scheduler over a pgx pool.
func NewScheduler(pool *pgxpool.Pool) Scheduler { return &pgScheduler{pool: pool} }

func (s *pgScheduler) ActiveUserIDs(ctx context.Context) ([]string, error) {
	ids, err := gen.New(s.pool).ListActiveUserIDs(ctx)
	if err != nil {
		return nil, fmt.Errorf("list active user ids: %w", err)
	}
	return ids, nil
}

func (s *pgScheduler) EnqueueConsolidate(ctx context.Context, userID string) (bool, error) {
	jobID, err := id.New()
	if err != nil {
		return false, err
	}
	uid := userID
	n, err := gen.New(s.pool).EnqueueConsolidateJob(ctx, gen.EnqueueConsolidateJobParams{
		ID:     jobID,
		UserID: &uid,
	})
	if err != nil {
		return false, fmt.Errorf("enqueue consolidate job: %w", err)
	}
	return n > 0, nil
}

// isUniqueViolation reports a Postgres 23505 (unique_violation) — the fan-out
// fence on UNIQUE (record_id, fragment_index).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
