package memory

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

var (
	ErrJobUserRequired = errors.New("memory job requires a user id")
	ErrJobPayload      = errors.New("memory job payload invalid")
)

// Queue payloads are deliberately empty. Effect identities and their expected
// representation revisions live in Job.Targets / job_targets, so one source of
// truth drives cancellation, execution-time reads, and post-provider fencing.
// Keeping named payload types makes the allowed JSON contract explicit and lets
// strict decoding reject any accidental source snapshot.
type EmbedJobPayload struct{}

type SemanticizeJobPayload struct{}

type ConsolidateJobPayload struct{}

type RetentionSweepJobPayload struct{}

// EmbedJobSource and SemanticizeJobSource are current, live source snapshots read
// immediately before an external call. The pg adapter returns no source when the
// job lease, liveness, target, or expected revision no longer matches.
type EmbedJobSource struct {
	NeuronID         string
	Text             string
	ExpectedRevision int64
}

type SemanticizeJobSource struct {
	Engram           SemanticizeMemory
	ExpectedRevision int64
	RisenStage       int16
	CurrentStages    *SemanticStages
}

type JobSourceReader interface {
	EmbedJobSources(ctx context.Context, job Job) ([]EmbedJobSource, error)
	SemanticizeJobSource(ctx context.Context, job Job) (SemanticizeJobSource, bool, error)
}

type RevisionedEmbedding struct {
	NeuronID         string
	ExpectedRevision int64
	Vector           []float32
}

type JobEmbeddingWriter interface {
	SaveJobEmbeddings(ctx context.Context, job Job, embeddings []RevisionedEmbedding) error
}

type JobSemanticStagesWriter interface {
	SaveJobSemanticStages(ctx context.Context, job Job, memoryID string, expectedRevision int64, stages SemanticStages) error
}

type DueReleaseSweeper interface {
	SweepRelease(ctx context.Context, scope platform.UserScope, releaseID string, now time.Time) (bool, error)
}

type jobEnqueuer interface {
	EnqueueJob(ctx context.Context, scope platform.UserScope, job Job) (Job, error)
}

func NewEmbedJobHandler(embedder Embedder, sources JobSourceReader, writer JobEmbeddingWriter) func(context.Context, Job) error {
	return func(ctx context.Context, job Job) error {
		if err := validateJob(job, JobTargetNeuron, false); err != nil {
			return err
		}
		var payload EmbedJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		current, err := sources.EmbedJobSources(ctx, job)
		if err != nil {
			return err
		}
		return embedCurrentSources(ctx, embedder, writer, job, current)
	}
}

func NewSemanticizeJobHandler(semanticizer Semanticizer, sources JobSourceReader, writer JobSemanticStagesWriter) func(context.Context, Job) error {
	return func(ctx context.Context, job Job) error {
		if err := validateJob(job, JobTargetMemory, true); err != nil {
			return err
		}
		var payload SemanticizeJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		source, ok, err := sources.SemanticizeJobSource(ctx, job)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
		stages, err := semanticizer.GenerateSemanticStages(ctx, source.Engram)
		if err != nil {
			return err
		}
		// Reconsolidation keeps the already-risen gist texts and takes freshly
		// generated values only for the remaining stages. Reading both fields here
		// prevents a delayed job from publishing an enqueue-time snapshot.
		if source.CurrentStages != nil {
			keep := int(source.RisenStage)
			if keep < 0 {
				keep = 0
			}
			if keep > len(stages) {
				keep = len(stages)
			}
			for i := 0; i < keep && source.CurrentStages[i] != ""; i++ {
				stages[i] = source.CurrentStages[i]
			}
		}
		return writer.SaveJobSemanticStages(ctx, job, source.Engram.ID, source.ExpectedRevision, stages)
	}
}

// NewConsolidateJobHandler drains consolidation's asynchronous re-embed. It has
// the same target contract as embed; only the enqueueing use-case differs.
func NewConsolidateJobHandler(embedder Embedder, sources JobSourceReader, writer JobEmbeddingWriter) func(context.Context, Job) error {
	return func(ctx context.Context, job Job) error {
		if err := validateJob(job, JobTargetNeuron, false); err != nil {
			return err
		}
		var payload ConsolidateJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		current, err := sources.EmbedJobSources(ctx, job)
		if err != nil {
			return err
		}
		return embedCurrentSources(ctx, embedder, writer, job, current)
	}
}

func NewRetentionSweepJobHandler(sweeper DueReleaseSweeper, now func() time.Time) func(context.Context, Job) error {
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return func(ctx context.Context, job Job) error {
		if err := validateJob(job, JobTargetRelease, true); err != nil {
			return err
		}
		var payload RetentionSweepJobPayload
		if err := decodePayload(job.Payload, &payload); err != nil {
			return err
		}
		scope, err := platform.NewUserScope(job.UserID)
		if err != nil {
			return ErrJobUserRequired
		}
		_, err = sweeper.SweepRelease(ctx, scope, job.Targets[0].ID, now())
		return err
	}
}

// embedCurrentSources is the shared current-read -> external call -> fenced-write
// tail. Missing, sealed, deleted, or superseded targets never appear in sources;
// a race after the call is stopped by the conditional writer.
func embedCurrentSources(ctx context.Context, embedder Embedder, writer JobEmbeddingWriter, job Job, sources []EmbedJobSource) error {
	if len(sources) == 0 {
		return nil
	}
	texts := make([]string, 0, len(sources))
	for _, source := range sources {
		if source.NeuronID == "" || source.Text == "" || source.ExpectedRevision <= 0 {
			return fmt.Errorf("%w: current embed source is incomplete", ErrJobPayload)
		}
		texts = append(texts, source.Text)
	}
	vectors, err := embedder.Embed(ctx, texts)
	if err != nil {
		return err
	}
	if len(vectors) != len(sources) {
		return fmt.Errorf("%w: embedder returned %d vectors for %d neurons", ErrJobPayload, len(vectors), len(sources))
	}
	embeddings := make([]RevisionedEmbedding, 0, len(vectors))
	for i, vector := range vectors {
		embeddings = append(embeddings, RevisionedEmbedding{
			NeuronID:         sources[i].NeuronID,
			ExpectedRevision: sources[i].ExpectedRevision,
			Vector:           vector,
		})
	}
	return writer.SaveJobEmbeddings(ctx, job, embeddings)
}

func validateJob(job Job, targetKind JobTargetKind, exactlyOne bool) error {
	if job.UserID == "" {
		return ErrJobUserRequired
	}
	if len(job.Targets) == 0 || (exactlyOne && len(job.Targets) != 1) {
		return fmt.Errorf("%w: invalid %s target count", ErrJobPayload, targetKind)
	}
	seen := make(map[string]struct{}, len(job.Targets))
	for _, target := range job.Targets {
		if target.Kind != targetKind || target.ID == "" {
			return fmt.Errorf("%w: invalid %s target", ErrJobPayload, targetKind)
		}
		if targetKind == JobTargetRelease {
			if target.ExpectedRevision != 0 {
				return fmt.Errorf("%w: release target has a revision", ErrJobPayload)
			}
		} else if target.ExpectedRevision <= 0 {
			return fmt.Errorf("%w: %s target requires expected revision", ErrJobPayload, targetKind)
		}
		if _, exists := seen[target.ID]; exists {
			return fmt.Errorf("%w: duplicate %s target", ErrJobPayload, targetKind)
		}
		seen[target.ID] = struct{}{}
	}
	return nil
}

// enqueueJob marshals an allowlisted control payload and stores it with the
// authoritative target identities/revisions. A zero timestamp keeps the store's
// run-now default.
func enqueueJob(ctx context.Context, tx jobEnqueuer, scope platform.UserScope, id string, at time.Time, kind JobKind, payload any, targets ...JobTarget) error {
	return enqueueJobRecord(ctx, tx, scope, id, at, at, kind, nil, payload, targets)
}

func enqueueScheduledJob(ctx context.Context, tx jobEnqueuer, scope platform.UserScope, id string, nextRunAt time.Time, createdAt time.Time, kind JobKind, dedupKey string, payload any, targets ...JobTarget) error {
	return enqueueJobRecord(ctx, tx, scope, id, nextRunAt, createdAt, kind, &dedupKey, payload, targets)
}

func enqueueJobRecord(ctx context.Context, tx jobEnqueuer, scope platform.UserScope, id string, nextRunAt time.Time, createdAt time.Time, kind JobKind, dedupKey *string, payload any, targets []JobTarget) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = tx.EnqueueJob(ctx, scope, Job{
		ID:        id,
		UserID:    scope.UserID(),
		Kind:      kind,
		Payload:   raw,
		Status:    JobStatusPending,
		NextRunAt: nextRunAt,
		CreatedAt: createdAt,
		DedupKey:  dedupKey,
		Targets:   targets,
	})
	return err
}

func decodePayload(raw []byte, out any) error {
	if len(raw) == 0 {
		return fmt.Errorf("%w: empty payload", ErrJobPayload)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return fmt.Errorf("%w: %v", ErrJobPayload, err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return fmt.Errorf("%w: payload has trailing data", ErrJobPayload)
	}
	return nil
}
