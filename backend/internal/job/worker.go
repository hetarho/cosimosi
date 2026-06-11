package job

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"runtime/debug"
	"time"

	"github.com/cosimosi/backend/internal/ai"
)

// Connection-rule constants (Architecture §6, spec 05). τ is also enforced in the
// KnnNearest SQL; it is repeated here only for documentation.
const (
	knnK               = 8   // top-k nearest neighbors to consider
	weightAlpha        = 1.0 // α in w0 = clamp(α·cos_sim + temporal_bonus, 0, 1)
	temporalBonusMax   = 0.3 // +0.3 when the two entries share a day…
	temporalWindowDays = 7.0 // …decaying linearly to 0 at 7 days apart
)

// Worker-loop defaults.
const (
	defaultPollInterval = 2 * time.Second
	defaultMaxAttempts  = 5
	defaultBaseBackoff  = 2 * time.Second
	defaultMaxBackoff   = 5 * time.Minute
	// 큐 상태 요약 로그 주기(spec 18, 3.6) — 그라파나 없이 docker logs만으로
	// pending/failed 백로그와 최고령 잡 나이를 본다.
	defaultSummaryInterval = 5 * time.Minute
)

// Worker is the embedding pipeline loop: claim → embed → store → KNN → link →
// complete, with exponential backoff on failure. It depends only on ports
// (queue, graph store, embedder) — no transport, no db.
type Worker struct {
	jobs     Repository
	store    GraphStore
	embedder ai.Embedder
	logger   *slog.Logger

	pollInterval    time.Duration
	maxAttempts     int
	baseBackoff     time.Duration
	maxBackoff      time.Duration
	summaryInterval time.Duration
	k               int
}

// NewWorker wires the worker over its ports. A nil logger falls back to the default.
func NewWorker(jobs Repository, store GraphStore, embedder ai.Embedder, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	return &Worker{
		jobs:            jobs,
		store:           store,
		embedder:        embedder,
		logger:          logger,
		pollInterval:    defaultPollInterval,
		maxAttempts:     defaultMaxAttempts,
		baseBackoff:     defaultBaseBackoff,
		maxBackoff:      defaultMaxBackoff,
		summaryInterval: defaultSummaryInterval,
		k:               knnK,
	}
}

// Run drains the queue, then polls every pollInterval until ctx is cancelled.
// It claims one job at a time and keeps going while jobs are available so a
// backlog clears without waiting a full interval per job. Every summaryInterval
// it logs one queue-stats line (spec 18, 3.6) — including at startup, so the
// first log after a deploy already shows any backlog left from the previous run.
func (w *Worker) Run(ctx context.Context) {
	w.logger.Info("embedding worker started", "embedder", w.embedder.Model(), "poll", w.pollInterval)
	var lastSummary time.Time // zero → the first loop iteration logs immediately
	for {
		if ctx.Err() != nil {
			w.logger.Info("embedding worker stopped")
			return
		}
		if time.Since(lastSummary) >= w.summaryInterval {
			lastSummary = time.Now()
			w.logQueueSummary(ctx)
		}
		if w.processOne(ctx) {
			continue // claimed something — drain the queue without sleeping
		}
		select {
		case <-ctx.Done():
			w.logger.Info("embedding worker stopped")
			return
		case <-time.After(w.pollInterval):
		}
	}
}

// logQueueSummary emits the one-line queue snapshot. A stats failure is logged
// and skipped — observability must never wedge the pipeline.
func (w *Worker) logQueueSummary(ctx context.Context) {
	stats, err := w.jobs.Stats(ctx)
	if err != nil {
		if ctx.Err() == nil {
			w.logger.Warn("queue stats failed", "err", err)
		}
		return
	}
	w.logger.Info("queue summary",
		"pending", stats.Pending,
		"due_pending", stats.DuePending,
		"running", stats.Running,
		"failed", stats.Failed,
		"oldest_pending", stats.OldestPendingAge.Truncate(time.Second),
	)
}

// processOne claims and handles a single job. It returns true if a job was
// claimed (success or failure), false when the queue is empty.
//
// KindExtract stub (spec 20 → 21): the kind exists but is intentionally NOT
// claimed here — nothing enqueues extract jobs yet, so the embed loop stays
// unchanged and the stub never runs (no-op-safe). Spec 21 wires the fan-out:
//
//	case KindExtract:
//	  ext, err := w.extractor.Extract(ctx, m.Body) // 21: inject ai.Extractor into Worker
//	  // 21: ext.Segments → InsertMemory fan-out + one embed job per fragment
//	  return w.jobs.Complete(ctx, j.ID)            // 20: safe completion, no star creation
func (w *Worker) processOne(ctx context.Context) bool {
	j, err := w.jobs.Claim(ctx, KindEmbed)
	switch {
	case errors.Is(err, ErrNoJob):
		return false
	case err != nil:
		w.logger.Error("claim job failed", "err", err)
		return false
	}
	if err := w.safeHandle(ctx, j); err != nil {
		if ctx.Err() != nil {
			// Interrupted by shutdown, not a genuine failure: leave the job 'running'
			// and don't burn an attempt. ClaimJob's lease reclaims it on the next run.
			w.logger.Info("job interrupted by shutdown; will be reclaimed", "job", j.ID)
			return true
		}
		w.failWithBackoff(ctx, j, err)
	}
	return true
}

// safeHandle runs handle with a panic guard (17, acceptance 2.7): a panicking
// job (bad embedder response, nil deref on odd data) becomes a normal failure —
// backed off and retried/failed by failWithBackoff — instead of killing the
// whole single binary (API + worker share the process in MVP). The stack is
// logged HERE (the only place the panicking frames exist): the persisted job
// error keeps just the value, and failWithBackoff's shutdown-interruption branch
// can no longer swallow the evidence.
func (w *Worker) safeHandle(ctx context.Context, j Job) (err error) {
	defer func() {
		if p := recover(); p != nil {
			w.logger.Error("job panic recovered",
				"job", j.ID, "memory", j.MemoryID, "panic", p,
				"stack", string(debug.Stack()),
			)
			err = fmt.Errorf("job panic recovered: %v", p)
		}
	}()
	return w.handle(ctx, j)
}

// handle runs the pipeline for one claimed job. Every step is idempotent
// (embedding upsert, GREATEST link upsert) so a retry after a mid-pipeline
// failure is safe. The original record/memory is never mutated (constitution §1).
func (w *Worker) handle(ctx context.Context, j Job) error {
	m, err := w.store.GetMemoryForEmbed(ctx, j.MemoryID)
	if err != nil {
		return fmt.Errorf("load memory: %w", err)
	}

	vec, err := w.embedder.Embed(ctx, m.Body)
	if err != nil {
		return fmt.Errorf("embed: %w", err)
	}
	if len(vec) != w.embedder.Dim() {
		return fmt.Errorf("embed: got dim %d, want %d", len(vec), w.embedder.Dim())
	}

	if err := w.store.UpsertEmbedding(ctx, j.MemoryID, m.UserID, vec, w.embedder.Model()); err != nil {
		return fmt.Errorf("store embedding: %w", err)
	}

	neighbors, err := w.store.KnnNearest(ctx, m.UserID, vec, j.MemoryID, w.k)
	if err != nil {
		return fmt.Errorf("knn: %w", err)
	}

	// 0 neighbors above τ is normal — the star stays isolated in the universe
	// (constitution §2, acceptance 3.2); the job still completes.
	links := buildLinks(j.MemoryID, m.UserID, m.EntryDate, neighbors)
	if len(links) > 0 {
		if err := w.store.BatchUpsertLinks(ctx, links); err != nil {
			return fmt.Errorf("upsert links: %w", err)
		}
	}

	if err := w.jobs.Complete(ctx, j.ID); err != nil {
		return fmt.Errorf("complete: %w", err)
	}
	w.logger.Info("job done", "job", j.ID, "memory", j.MemoryID, "links", len(links))
	return nil
}

// failWithBackoff bumps attempts, reschedules with exponential backoff, and once
// attempts reach the cap preserves the job as failed (never deletes — §1/§2).
func (w *Worker) failWithBackoff(ctx context.Context, j Job, cause error) {
	attempts := j.Attempts + 1
	status := StatusPending
	if attempts >= w.maxAttempts {
		status = StatusFailed
	}
	next := time.Now().UTC().Add(backoffDelay(attempts, w.baseBackoff, w.maxBackoff))
	if err := w.jobs.Fail(ctx, j.ID, status, cause.Error(), next); err != nil {
		w.logger.Error("persisting job failure failed", "job", j.ID, "err", err)
		return
	}
	w.logger.Warn("job failed", "job", j.ID, "attempts", attempts, "status", string(status), "err", cause)
}

// --- pure helpers (unit-tested) ---

// buildLinks turns KNN candidates into semantic links. The threshold (cos_sim ≥
// τ) is already applied by the SQL, so every candidate becomes a link. The pair
// is emitted (self, neighbor); BatchUpsertLinks does the authoritative a<b
// normalization with LEAST/GREATEST under the DB collation (the byte-order swap
// here would disagree with en_US.utf8 and violate the a_id<b_id CHECK).
func buildLinks(selfID, userID string, selfDate time.Time, neighbors []Neighbor) []LinkUpsert {
	out := make([]LinkUpsert, 0, len(neighbors))
	for _, n := range neighbors {
		if n.MemoryID == selfID {
			continue // defensive: KnnNearest already excludes self
		}
		w := initialWeight(n.CosSim, temporalBonus(selfDate, n.EntryDate))
		out = append(out, LinkUpsert{AID: selfID, BID: n.MemoryID, Weight: w, UserID: userID})
	}
	return out
}

// temporalBonus is +0.3 when the two entries share a day, decaying linearly to 0
// at temporalWindowDays apart and staying 0 beyond it.
func temporalBonus(self, other time.Time) float64 {
	days := math.Abs(self.Sub(other).Hours()) / 24.0
	if days >= temporalWindowDays {
		return 0
	}
	return temporalBonusMax * (1 - days/temporalWindowDays)
}

// initialWeight is w0 = clamp(α·cos_sim + temporal_bonus, 0, 1).
func initialWeight(cosSim, tBonus float64) float64 {
	return clamp(weightAlpha*cosSim+tBonus, 0, 1)
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// backoffDelay is base·2^(attempts-1), capped at maxBackoff: the first retry
// waits ~base, doubling each attempt. The d<=0 guard catches a shift that
// overflowed time.Duration on an absurd attempt count (it then just caps).
func backoffDelay(attempts int, base, max time.Duration) time.Duration {
	if attempts < 1 {
		attempts = 1
	}
	d := base << uint(attempts-1)
	if d <= 0 || d > max {
		return max
	}
	return d
}
