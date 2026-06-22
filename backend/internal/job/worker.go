package job

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"runtime/debug"
	"time"

	"github.com/cosimosi/backend/internal/ai"
	"github.com/cosimosi/backend/internal/values"
)

// Connection-rule constants (Architecture §6, specs 05/21). τ is also enforced
// in the KnnNearest SQL; it is repeated here only for documentation.
const (
	knnK               = values.ConnectionKnnK               // top-k nearest neighbors to consider
	weightAlpha        = values.ConnectionWeightAlpha        // α in w0 = clamp(α·cos_sim + temporal_bonus, 0, 1)
	temporalBonusMax   = values.ConnectionTemporalBonusMax   // +0.3 when the two entries share a day…
	temporalWindowDays = values.ConnectionTemporalWindowDays // …decaying linearly to 0 at 7 days apart
	// semanticWeightCap keeps every cross-entry semantic link strictly below the
	// intra-entry binding weight 0.8 (spec 21, acceptance 1.3): same-event
	// fragments must always read as the strongest bond.
	semanticWeightCap = values.ConnectionSemanticWeightCap
)

// Competitive-allocation / excitability constants (spec 22). A new fragment's KNN
// candidates are re-ranked by how recently their CLUSTER was active ("excitability"),
// so a star is more readily absorbed by a recently-recalled/written constellation —
// modelling engram allocation by excitability competition (concept §결정2).
const (
	// tauExc is the excitability time constant: e(c,t)=Σ exp(-Δt/tauExc). With τ=6h the
	// half-life is ≈4h, so a cluster active 3h ago biases strongly while one active 24h
	// ago contributes ≈0 — the ~6h allocation window (acceptance 1.2).
	tauExc = values.ExcitabilityTauHours * time.Hour
	// wExc weights the excitability bias in score = cos_sim + (wExc·g)·norm_e.
	// g = memory.ExcitabilityGain(arousal), where arousal is derived from the user's
	// current Bjork R envelope. Bias only — the link WEIGHT still comes from
	// initialWeight(cos, temporal) (spec 22, 1.1).
	wExc = values.ExcitabilityWExc
	// biasedK is the final number of links kept after the excitability re-rank (≤ candidateK).
	biasedK = values.ExcitabilityBiasedK
	// candidateK is the KNN candidate ceiling: a wider pool gives the re-rank room to prefer
	// a hotter cluster over a marginally-closer-but-cold one. Derived as knnK*2 so tuning
	// knnK keeps the pool proportional.
	candidateK = knnK * 2
	// inhibitDecay is the soft-inhibition factor: each time a cluster absorbs a fragment its
	// e is multiplied by this, so one hot cluster can't monopolize every candidate
	// (Delamare/Clopath synaptic competition term — acceptance 1.3).
	inhibitDecay = values.ExcitabilityInhibitDecay
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

// Worker is the async pipeline loop: extract (segment → fragment fan-out) and
// embed (embed → store → KNN → link) jobs, with exponential backoff on failure.
// It depends only on ports (queue, graph store, embedder, extractor) — no
// transport, no db.
type Worker struct {
	jobs      Repository
	store     GraphStore
	embedder  ai.Embedder
	extractor ai.Extractor
	logger    *slog.Logger

	pollInterval    time.Duration
	maxAttempts     int
	baseBackoff     time.Duration
	maxBackoff      time.Duration
	summaryInterval time.Duration
	k               int
}

// NewWorker wires the worker over its ports. A nil logger falls back to the
// default; a nil extractor falls back to NoopExtractor (whole diary = one
// neutral segment), keeping keyless environments functional.
func NewWorker(jobs Repository, store GraphStore, embedder ai.Embedder, extractor ai.Extractor, logger *slog.Logger) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	if extractor == nil {
		extractor = ai.NoopExtractor{}
	}
	return &Worker{
		jobs:            jobs,
		store:           store,
		embedder:        embedder,
		extractor:       extractor,
		logger:          logger,
		pollInterval:    defaultPollInterval,
		maxAttempts:     defaultMaxAttempts,
		baseBackoff:     defaultBaseBackoff,
		maxBackoff:      defaultMaxBackoff,
		summaryInterval: defaultSummaryInterval,
		// Fetch the wider candidate pool (=knnK*2): the excitability re-rank trims it
		// back to biasedK final links (spec 22). knnK stays the conceptual neighbor count.
		k: candidateK,
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
// claimed (success or failure), false when the queue is empty. Extract jobs are
// claimed first (spec 21): a diary's fragments must exist before their embed
// jobs do, so draining extraction first keeps the universe's stars arriving in
// write order under backlog. (Under an extract-heavy backlog embed work queues
// up behind it — acceptable for the single in-process worker; per-kind workers
// are spec 27's scaling concern.)
func (w *Worker) processOne(ctx context.Context) bool {
	// Priority: extract → embed → consolidate. Interactive work (a diary becoming
	// stars + their links) drains first; the nightly whole-graph pass (spec 27) is a
	// heavy batch and claims last so it never starves the arrival pipeline.
	j, err := w.jobs.Claim(ctx, KindExtract)
	if errors.Is(err, ErrNoJob) {
		j, err = w.jobs.Claim(ctx, KindEmbed)
	}
	if errors.Is(err, ErrNoJob) {
		j, err = w.jobs.Claim(ctx, KindConsolidate)
	}
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
				"job", j.ID, "kind", string(j.Kind), "memory", j.MemoryID, "record", j.RecordID, "panic", p,
				"stack", string(debug.Stack()),
			)
			err = fmt.Errorf("job panic recovered: %v", p)
		}
	}()
	switch j.Kind {
	case KindExtract:
		return w.handleExtract(ctx, j)
	case KindConsolidate:
		return w.handleConsolidate(ctx, j)
	default:
		return w.handle(ctx, j)
	}
}

// handleExtract runs the fragmentation pipeline for one claimed extract job
// (spec 21): load the immutable diary → segment via the Extractor port → fan
// the segments out as fragment stars (one tx: N memories + N embed jobs +
// intra-entry links). FanOutFragments is idempotent (already-fanned-out records
// short-circuit), so a retry after a mid-pipeline failure is safe; the original
// record is never mutated (constitution §1).
func (w *Worker) handleExtract(ctx context.Context, j Job) error {
	// A job reclaimed after a crash-before-Complete already has its fragments —
	// check FIRST so the (paid) LLM extraction isn't re-run just to no-op.
	if existing, err := w.store.FragmentIDs(ctx, j.RecordID); err == nil && len(existing) > 0 {
		if err := w.jobs.Complete(ctx, j.ID); err != nil {
			return fmt.Errorf("complete (already fanned out): %w", err)
		}
		w.logger.Info("extract already fanned out", "job", j.ID, "record", j.RecordID, "fragments", len(existing))
		return nil
	}

	rec, err := w.store.GetRecordForExtract(ctx, j.RecordID)
	if err != nil {
		return fmt.Errorf("load record: %w", err)
	}

	ext, err := w.extractor.Extract(ctx, rec.Body)
	if err != nil {
		return fmt.Errorf("extract: %w", err)
	}

	segs := applyManualHint(toSegments(ext.Segments), rec)
	ids, err := w.store.FanOutFragments(ctx, j.RecordID, rec.UserID, segs)
	if err != nil {
		return fmt.Errorf("fan out fragments: %w", err)
	}

	if err := w.jobs.Complete(ctx, j.ID); err != nil {
		return fmt.Errorf("complete: %w", err)
	}
	w.logger.Info("extract done", "job", j.ID, "record", j.RecordID, "fragments", len(ids))
	return nil
}

// handle runs the embed pipeline for one claimed job. Every step is idempotent
// (embedding upsert, GREATEST link upsert) so a retry after a mid-pipeline
// failure is safe. The original record/memory is never mutated (constitution §1).
// Since spec 21 the input is the FRAGMENT's own text (whole-diary fallback) —
// each fragment star embeds separately.
func (w *Worker) handle(ctx context.Context, j Job) error {
	m, err := w.store.GetMemoryForEmbed(ctx, j.MemoryID)
	if err != nil {
		return fmt.Errorf("load memory: %w", err)
	}

	vec, err := w.embedder.Embed(ctx, m.Text)
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
	// (constitution §2, acceptance 3.2); the job still completes with no links.
	var links []LinkUpsert
	if len(neighbors) > 0 {
		// Competitive allocation (spec 22): bias the candidate selection toward recently
		// active clusters. Excitability is DERIVED from existing timestamps — no extra
		// column (acceptance 1.5) — and biasedLinks falls back to cos_sim order when it
		// is all zero or there's a single cluster, so this never regresses the base path.
		ids := make([]string, len(neighbors))
		for i, n := range neighbors {
			ids[i] = n.MemoryID
		}
		exc, err := w.store.LoadExcitabilityInputs(ctx, m.UserID, ids)
		if err != nil {
			return fmt.Errorf("excitability inputs: %w", err)
		}
		now := time.Now().UTC()
		clusterOf := deriveClusters(neighbors, exc.Links)
		clusterE := clusterExcitability(now, clusterOf, exc.Recalled, exc.Links)
		links = biasedLinks(j.MemoryID, m.UserID, m.EntryDate, now, neighbors, clusterOf, clusterE, exc.Arousal)
	}
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

// toSegments maps the extractor's segments onto the GraphStore port's own
// Segment shape (the port stays decoupled from the ai adapter layer, §5).
func toSegments(in []ai.Segment) []Segment {
	out := make([]Segment, 0, len(in))
	for _, s := range in {
		out = append(out, Segment{
			Index:     s.Index,
			Text:      s.Text,
			Mood:      string(s.Mood),
			Intensity: s.Intensity,
			Valence:   s.Valence,
		})
	}
	return out
}

// applyManualHint applies the user's optional whole-diary emotion hints as the
// FALLBACK (spec 21, acceptance 1.6): only when extraction degraded to the
// single-neutral-segment shape (NoopExtractor / LLM parse fallback — one
// segment, neutral mood, zero valence). A genuinely multi-fragment or
// affect-carrying extraction is never overridden by the hint.
func applyManualHint(segs []Segment, rec RecordForExtract) []Segment {
	if len(segs) != 1 || segs[0].Valence != 0 {
		return segs
	}
	s := &segs[0]
	if s.Mood != "" && s.Mood != string(ai.MoodNeutral) {
		return segs
	}
	if rec.HintMood != "" {
		s.Mood = rec.HintMood
	}
	if s.Intensity == 0 && rec.HintIntensity > 0 {
		s.Intensity = rec.HintIntensity
	}
	if rec.HintValence != 0 {
		s.Valence = rec.HintValence
	}
	return segs
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
