package pg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

var (
	ErrUserScopeRequired = errors.New("memory store requires authenticated user scope")
	ErrQueriesRequired   = errors.New("memory store requires database queries")
)

type Store struct {
	queries *dbgen.Queries
	db      dbgen.DBTX
	txer    txStarter
}

type txStarter interface {
	BeginTx(context.Context, pgx.TxOptions) (pgx.Tx, error)
}

func NewStore(db dbgen.DBTX) Store {
	store := Store{queries: dbgen.New(db), db: db}
	if txer, ok := db.(txStarter); ok {
		store.txer = txer
	}
	return store
}

// DB exposes the query handle this store is bound to — the pool, or the open
// transaction inside In*Tx. It exists for the composition root's cross-context
// economy seam ([CC2]): the root binds the twinkle ledger store onto the very same
// transaction a recall/launch runs in, so a spend/earn and its memory work commit or
// roll back together. Context behavior never calls it (the handle stays opaque
// through memory.EconomyTx).
func (s Store) DB() dbgen.DBTX {
	return s.db
}

func (s Store) InsertDiary(ctx context.Context, scope platform.UserScope, diary memory.Diary) (memory.Diary, error) {
	if err := s.ready(scope); err != nil {
		return memory.Diary{}, err
	}
	row, err := s.queries.InsertDiary(ctx, dbgen.InsertDiaryParams{
		ID:        diary.ID,
		UserID:    scope.UserID(),
		Body:      diary.Body,
		DiaryDate: pgDate(diary.DiaryDate),
		CreatedAt: pgTime(timeOrNow(diary.CreatedAt)),
	})
	if err != nil {
		return memory.Diary{}, err
	}
	return mapDiary(row), nil
}

func (s Store) InsertEpisodicMemory(ctx context.Context, scope platform.UserScope, episodicMemory memory.EpisodicMemory) (memory.EpisodicMemory, error) {
	if err := s.ready(scope); err != nil {
		return memory.EpisodicMemory{}, err
	}
	row, err := s.queries.InsertEpisodicMemory(ctx, dbgen.InsertEpisodicMemoryParams{
		ID:                       episodicMemory.ID,
		UserID:                   scope.UserID(),
		DiaryID:                  episodicMemory.DiaryID,
		Name:                     episodicMemory.Name,
		CurrentText:              episodicMemory.CurrentText,
		Seed:                     pgInt8(episodicMemory.Seed),
		Mood:                     string(episodicMemory.Emotion.Mood),
		Valence:                  float32(episodicMemory.Emotion.Valence),
		Arousal:                  float32(episodicMemory.Emotion.Arousal),
		Intensity:                float32(episodicMemory.Emotion.Intensity),
		BaseStrength:             float32(episodicMemory.BaseStrength),
		RecallCount:              episodicMemory.RecallCount,
		CreatedUniverseTime:      pgDate(episodicMemory.CreatedUniverseTime),
		LastRecalledUniverseTime: pgDatePtr(episodicMemory.LastRecalledUniverseTime),
		SemanticStage:            episodicMemory.SemanticStage,
		SemanticizeTimerResetAt:  pgDatePtr(episodicMemory.SemanticizeTimerResetAt),
	})
	if err != nil {
		return memory.EpisodicMemory{}, err
	}
	return mapEpisodicMemory(row), nil
}

func (s Store) UpsertNeuron(ctx context.Context, scope platform.UserScope, neuron memory.Neuron) (memory.Neuron, error) {
	if err := s.ready(scope); err != nil {
		return memory.Neuron{}, err
	}
	row, err := s.queries.UpsertNeuron(ctx, dbgen.UpsertNeuronParams{
		ID:         neuron.ID,
		UserID:     scope.UserID(),
		Name:       pgText(neuron.Name),
		NeuronType: string(neuron.Type),
		CreatedAt:  pgTime(timeOrNow(neuron.CreatedAt)),
		SealedAt:   pgTimePtr(neuron.SealedAt),
	})
	if err != nil {
		return memory.Neuron{}, err
	}
	return mapNeuron(row), nil
}

func (s Store) InsertNeuronActivation(ctx context.Context, scope platform.UserScope, activation memory.NeuronActivation) (memory.NeuronActivation, error) {
	if err := s.ready(scope); err != nil {
		return memory.NeuronActivation{}, err
	}
	row, err := s.queries.InsertNeuronActivation(ctx, dbgen.InsertNeuronActivationParams{
		EpisodicMemoryID: activation.EpisodicMemoryID,
		NeuronID:         activation.NeuronID,
		UserID:           scope.UserID(),
		Weight:           activation.Weight,
	})
	if err != nil {
		return memory.NeuronActivation{}, err
	}
	return mapNeuronActivation(row), nil
}

func (s Store) UpsertSynapse(ctx context.Context, scope platform.UserScope, synapse memory.Synapse) (memory.Synapse, error) {
	params, err := synapseParams(scope, synapse)
	if err != nil {
		return memory.Synapse{}, err
	}
	if s.queries == nil {
		return memory.Synapse{}, ErrQueriesRequired
	}
	row, err := s.queries.UpsertSynapse(ctx, params)
	if err != nil {
		return memory.Synapse{}, err
	}
	return mapSynapse(row), nil
}

func (s Store) InsertEmbedding(ctx context.Context, scope platform.UserScope, embedding memory.Embedding) (memory.Embedding, error) {
	if err := s.ready(scope); err != nil {
		return memory.Embedding{}, err
	}
	vector, err := vectorLiteral(embedding.Vector)
	if err != nil {
		return memory.Embedding{}, err
	}
	row, err := s.queries.InsertEmbedding(ctx, dbgen.InsertEmbeddingParams{
		NeuronID: embedding.NeuronID,
		UserID:   scope.UserID(),
		Column3:  vector,
	})
	if err != nil {
		return memory.Embedding{}, err
	}
	return mapEmbedding(row)
}

func (s Store) EnqueueJob(ctx context.Context, scope platform.UserScope, job memory.Job) (memory.Job, error) {
	if err := s.ready(scope); err != nil {
		return memory.Job{}, err
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(job.Payload, &payload); err != nil || payload == nil || len(payload) != 0 {
		return memory.Job{}, errors.New("memory job payload must be an empty object")
	}
	if len(job.Targets) == 0 {
		return memory.Job{}, errors.New("memory job requires at least one target")
	}
	targetKinds := make([]string, 0, len(job.Targets))
	targetIDs := make([]string, 0, len(job.Targets))
	expectedRevisions := make([]int64, 0, len(job.Targets))
	for _, target := range job.Targets {
		if target.Kind == "" || target.ID == "" {
			return memory.Job{}, errors.New("memory job target requires kind and id")
		}
		targetKinds = append(targetKinds, string(target.Kind))
		targetIDs = append(targetIDs, target.ID)
		expectedRevisions = append(expectedRevisions, target.ExpectedRevision)
	}
	row, err := s.queries.EnqueueJob(ctx, dbgen.EnqueueJobParams{
		ID:                job.ID,
		UserID:            scope.UserID(),
		Kind:              string(job.Kind),
		Payload:           job.Payload,
		Status:            string(job.Status),
		Attempts:          job.Attempts,
		NextRunAt:         pgTime(timeOrNow(job.NextRunAt)),
		CreatedAt:         pgTime(timeOrNow(job.CreatedAt)),
		DedupKey:          pgText(job.DedupKey),
		TargetKinds:       targetKinds,
		TargetIds:         targetIDs,
		ExpectedRevisions: expectedRevisions,
	})
	if err != nil {
		return memory.Job{}, err
	}
	mapped := mapEnqueuedJob(row)
	mapped.Targets = append([]memory.JobTarget(nil), job.Targets...)
	return mapped, nil
}

func (s Store) ClaimDue(ctx context.Context, now time.Time) (memory.Job, error) {
	if s.queries == nil {
		return memory.Job{}, ErrQueriesRequired
	}
	claimAt := timeOrNow(now)
	row, err := s.queries.ClaimDueJob(ctx, dbgen.ClaimDueJobParams{
		LeaseUntil: pgTime(jobLeaseUntil(claimAt)),
		NowAt:      pgTime(claimAt),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.Job{}, jobqueue.ErrNoJob
	}
	if err != nil {
		return memory.Job{}, err
	}
	job := mapJob(row)
	targetRows, err := s.queries.ListJobTargets(ctx, dbgen.ListJobTargetsParams{
		UserID: job.UserID,
		JobID:  job.ID,
	})
	if err != nil {
		return memory.Job{}, err
	}
	job.Targets = mapJobTargets(targetRows)
	return job, nil
}

func (s Store) Complete(ctx context.Context, job memory.Job) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	_, err := s.queries.CompleteJob(ctx, dbgen.CompleteJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		LeaseGeneration: job.LeaseGeneration,
	})
	return ignoreLostLease(err)
}

func (s Store) Retry(ctx context.Context, job memory.Job, nextAttempts int32, nextRunAt time.Time) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	_, err := s.queries.RetryJob(ctx, dbgen.RetryJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		Attempts:        nextAttempts,
		NextRunAt:       pgTime(nextRunAt),
		LeaseGeneration: job.LeaseGeneration,
	})
	return ignoreLostLease(err)
}

func (s Store) Fail(ctx context.Context, job memory.Job, nextAttempts int32) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	_, err := s.queries.FailJob(ctx, dbgen.FailJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		Attempts:        nextAttempts,
		LeaseGeneration: job.LeaseGeneration,
	})
	return ignoreLostLease(err)
}

// ignoreLostLease swallows the no-rows result of a fenced terminal transition: the
// job's lease was superseded by another worker's re-claim, so this worker no longer
// owns it and must not treat the missed update as an error.
func ignoreLostLease(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

// EmbedJobSources resolves the authoritative current names only while the job's
// running lease and each live neuron revision still match its target row.
func (s Store) EmbedJobSources(ctx context.Context, job memory.Job) ([]memory.EmbedJobSource, error) {
	if err := s.readyJob(job); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListLiveNeuronJobSources(ctx, dbgen.ListLiveNeuronJobSourcesParams{
		UserID:          job.UserID,
		JobID:           job.ID,
		LeaseGeneration: job.LeaseGeneration,
	})
	if err != nil {
		return nil, err
	}
	sources := make([]memory.EmbedJobSource, 0, len(rows))
	for _, row := range rows {
		sources = append(sources, memory.EmbedJobSource{
			NeuronID:         row.ID,
			Text:             row.Name.String,
			ExpectedRevision: row.ExpectedRevision.Int64,
		})
	}
	return sources, nil
}

// SemanticizeJobSource resolves the current memory representation, live member
// neurons, and risen stages under the same running lease/revision predicate.
func (s Store) SemanticizeJobSource(ctx context.Context, job memory.Job) (memory.SemanticizeJobSource, bool, error) {
	if err := s.readyJob(job); err != nil {
		return memory.SemanticizeJobSource{}, false, err
	}
	params := dbgen.LoadLiveSemanticizeJobSourceParams{
		UserID:          job.UserID,
		JobID:           job.ID,
		LeaseGeneration: job.LeaseGeneration,
	}
	row, err := s.queries.LoadLiveSemanticizeJobSource(ctx, params)
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.SemanticizeJobSource{}, false, nil
	}
	if err != nil {
		return memory.SemanticizeJobSource{}, false, err
	}
	if len(row.NeuronNames) != len(row.NeuronTypes) {
		return memory.SemanticizeJobSource{}, false, errors.New("semanticize source neuron arrays do not match")
	}
	neurons := make([]memory.ExtractedNeuron, 0, len(row.NeuronNames))
	for i, name := range row.NeuronNames {
		neurons = append(neurons, memory.ExtractedNeuron{
			Name: name,
			Type: memory.NeuronType(row.NeuronTypes[i]),
		})
	}
	return memory.SemanticizeJobSource{
		Engram: memory.SemanticizeMemory{
			ID:          row.ID,
			Name:        row.Name,
			CurrentText: row.CurrentText,
			Mood:        memory.Mood(row.Mood),
			Neurons:     neurons,
		},
		ExpectedRevision: row.RepresentationRevision,
	}, true, nil
}

func (s Store) SaveJobEmbeddings(ctx context.Context, job memory.Job, embeddings []memory.RevisionedEmbedding) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	for _, embedding := range embeddings {
		vector, err := vectorLiteral(embedding.Vector)
		if err != nil {
			return err
		}
		if _, err := s.queries.UpsertJobEmbedding(ctx, dbgen.UpsertJobEmbeddingParams{
			UserID:           job.UserID,
			JobID:            job.ID,
			LeaseGeneration:  job.LeaseGeneration,
			NeuronID:         embedding.NeuronID,
			ExpectedRevision: embedding.ExpectedRevision,
			Vector:           vector,
		}); err != nil {
			return err
		}
	}
	return nil
}

// CompleteSemanticizeJob is the semanticize completion transaction in one atomic unit: under the
// per-user graph lock it re-validates the running lease + live representation revision,
// merges the generated ladder over the live kept stages, finalizes a pending gist rise
// (visible stage + one stage-identified provenance row per newly materialized stage, at the
// crossing's universe-time), and marks the job done — atomically. A lost fence applies no
// side effect and lets the worker's own terminal transition decide the job's fate; a
// replayed completion finds the job no longer running and is a no-op.
func (s Store) CompleteSemanticizeJob(ctx context.Context, job memory.Job, memoryID string, expectedRevision int64, generated memory.SemanticStages) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	if s.txer == nil {
		// Already transaction-scoped (InTx-bound store): run on the open transaction.
		return s.completeSemanticizeJob(ctx, s.queries, job, memoryID, expectedRevision, generated)
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	if err := s.completeSemanticizeJob(ctx, s.queries.WithTx(tx), job, memoryID, expectedRevision, generated); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s Store) completeSemanticizeJob(ctx context.Context, queries *dbgen.Queries, job memory.Job, memoryID string, expectedRevision int64, generated memory.SemanticStages) error {
	// The same advisory lock every graph writer takes first: the finalization below moves
	// semantic_stage and appends provenance, so it must serialize with a concurrent
	// consolidation instead of racing its stale ListMemoriesForConsolidation read.
	if err := queries.LockGraphMutation(ctx, job.UserID); err != nil {
		return err
	}
	live, err := queries.LockSemanticizeCompletion(ctx, dbgen.LockSemanticizeCompletionParams{
		UserID:           job.UserID,
		JobID:            job.ID,
		LeaseGeneration:  job.LeaseGeneration,
		MemoryID:         memoryID,
		ExpectedRevision: expectedRevision,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// Fence lost: lease reclaimed, revision superseded, or target released. No side
		// effect; the stale job completes as a successful no-op upstream.
		return nil
	}
	if err != nil {
		return err
	}

	// Merge live kept stages: the texts of already-visible stages are history-backed (their
	// provenance rows carry them) and are never replaced by a later generation.
	merged := generated
	if kept := semanticStagesPtr(live.SemanticStages); kept != nil {
		for i := 0; i < int(live.SemanticStage) && i < len(merged); i++ {
			if strings.TrimSpace(kept[i]) != "" {
				merged[i] = kept[i]
			}
		}
	}

	targetStage := live.SemanticStage
	pendingStage := int16Ptr(live.PendingSemanticStage)
	riseAt := datePtr(live.PendingSemanticRiseAt)
	if pendingStage != nil && *pendingStage > targetStage {
		targetStage = *pendingStage
	}
	for stage := live.SemanticStage + 1; stage <= targetStage; stage++ {
		text := merged[stage-1]
		if strings.TrimSpace(text) == "" || riseAt == nil {
			return fmt.Errorf("pending gist rise to stage %d cannot materialize: blank text or missing rise time", stage)
		}
		stageID := stage
		if err := queries.AppendMemoryProvenance(ctx, dbgen.AppendMemoryProvenanceParams{
			ID:               platform.NewID(),
			UserID:           job.UserID,
			EpisodicMemoryID: memoryID,
			Kind:             string(memory.ProvenanceKindSemanticized),
			Source:           string(memory.ProvenanceSourceSystem),
			Text:             text,
			UniverseTime:     pgDate(*riseAt),
			SemanticStage:    pgInt2Ptr(&stageID),
		}); err != nil {
			return err
		}
	}

	raw, err := json.Marshal(merged)
	if err != nil {
		return err
	}
	if err := queries.FinalizeSemanticizeCompletion(ctx, dbgen.FinalizeSemanticizeCompletionParams{
		SemanticStages: raw,
		Stage:          targetStage,
		UserID:         job.UserID,
		MemoryID:       memoryID,
	}); err != nil {
		return err
	}
	// Completing the job in this same transaction is what makes a replay a no-op: once the
	// ladder/stage/provenance land, no later claim can run this work again.
	_, err = queries.CompleteJob(ctx, dbgen.CompleteJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		LeaseGeneration: job.LeaseGeneration,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

func (s Store) PurgeTerminalJobs(ctx context.Context, cutoff time.Time, batchSize int32) (int, error) {
	if s.queries == nil {
		return 0, ErrQueriesRequired
	}
	if batchSize <= 0 {
		return 0, errors.New("terminal job purge requires a positive batch size")
	}
	ids, err := s.queries.PurgeTerminalJobs(ctx, dbgen.PurgeTerminalJobsParams{
		Cutoff:    pgTime(cutoff),
		BatchSize: batchSize,
	})
	return len(ids), err
}

func (s Store) GetUniverse(ctx context.Context, scope platform.UserScope) (memory.UniverseFacts, error) {
	if err := s.ready(scope); err != nil {
		return memory.UniverseFacts{}, err
	}

	if s.txer != nil {
		tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{
			IsoLevel:   pgx.RepeatableRead,
			AccessMode: pgx.ReadOnly,
		})
		if err != nil {
			return memory.UniverseFacts{}, err
		}
		defer func() {
			_ = tx.Rollback(ctx)
		}()

		facts, err := getUniverse(ctx, scope, s.queries.WithTx(tx))
		if err != nil {
			return memory.UniverseFacts{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return memory.UniverseFacts{}, err
		}
		return facts, nil
	}

	return getUniverse(ctx, scope, s.queries)
}

func getUniverse(ctx context.Context, scope platform.UserScope, queries *dbgen.Queries) (memory.UniverseFacts, error) {
	userID := scope.UserID()
	memories, err := queries.ListUniverseEpisodicMemories(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	neurons, err := queries.ListUniverseNeurons(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	activations, err := queries.ListUniverseNeuronActivations(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	synapses, err := queries.ListUniverseSynapses(ctx, userID)
	if err != nil {
		return memory.UniverseFacts{}, err
	}
	clock, err := nilableClock(queries.GetUniverseClock(ctx, userID))
	if err != nil {
		return memory.UniverseFacts{}, err
	}

	return memory.UniverseFacts{
		EpisodicMemories: mapEpisodicMemories(memories),
		Neurons:          mapNeuronsWithConnectivity(neurons),
		Activations:      mapNeuronActivations(activations),
		Synapses:         mapSynapses(synapses),
		UniverseClock:    clock,
	}, nil
}

func (s Store) ready(scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrUserScopeRequired
	}
	if s.queries == nil {
		return ErrQueriesRequired
	}
	return nil
}

func (s Store) readyUserID(userID string) error {
	if userID == "" {
		return ErrUserScopeRequired
	}
	if s.queries == nil {
		return ErrQueriesRequired
	}
	return nil
}

func (s Store) readyJob(job memory.Job) error {
	if job.ID == "" {
		return errors.New("memory job requires an id")
	}
	return s.readyUserID(job.UserID)
}

func jobLeaseUntil(now time.Time) time.Time {
	return now.Add(jobLeaseDuration())
}

// The lease only has to outlast one handler run — long enough that a healthy worker
// finishes before another can re-claim, short enough that a dead worker's job frees up
// promptly. It is its own knob, not coupled to the (exponential) retry backoff.
func jobLeaseDuration() time.Duration {
	return time.Duration(values.AiJobLeaseMs) * time.Millisecond
}

func synapseParams(scope platform.UserScope, synapse memory.Synapse) (dbgen.UpsertSynapseParams, error) {
	if scope.UserID() == "" {
		return dbgen.UpsertSynapseParams{}, ErrUserScopeRequired
	}
	ordered, err := canonicalSynapse(synapse)
	if err != nil {
		return dbgen.UpsertSynapseParams{}, err
	}
	return dbgen.UpsertSynapseParams{
		ID:                        ordered.ID,
		UserID:                    scope.UserID(),
		NeuronAID:                 ordered.NeuronAID,
		NeuronBID:                 ordered.NeuronBID,
		Strength:                  ordered.Strength,
		CoActivationCount:         ordered.CoActivationCount,
		LastActivatedUniverseTime: pgDate(ordered.LastActivatedUniverseTime),
		CreatedAt:                 pgTime(timeOrNow(ordered.CreatedAt)),
	}, nil
}

func canonicalSynapse(synapse memory.Synapse) (memory.Synapse, error) {
	if synapse.NeuronAID == "" || synapse.NeuronBID == "" {
		return memory.Synapse{}, errors.New("synapse requires both neuron ids")
	}
	if synapse.NeuronAID == synapse.NeuronBID {
		return memory.Synapse{}, errors.New("synapse requires two distinct neurons")
	}
	if synapse.NeuronAID < synapse.NeuronBID {
		return synapse, nil
	}
	synapse.NeuronAID, synapse.NeuronBID = synapse.NeuronBID, synapse.NeuronAID
	return synapse, nil
}

func mapDiary(row dbgen.InsertDiaryRow) memory.Diary {
	return memory.Diary{
		ID:        row.ID,
		Body:      row.Body,
		DiaryDate: dateValue(row.DiaryDate),
		CreatedAt: timeValue(row.CreatedAt),
	}
}

func mapEpisodicMemory(row dbgen.InsertEpisodicMemoryRow) memory.EpisodicMemory {
	return memory.EpisodicMemory{
		ID:          row.ID,
		DiaryID:     row.DiaryID,
		Name:        row.Name,
		CurrentText: row.CurrentText,
		Seed:        int64Ptr(row.Seed),
		Emotion: memory.Emotion{
			Mood:      memory.Mood(row.Mood),
			Valence:   float64(row.Valence),
			Arousal:   float64(row.Arousal),
			Intensity: float64(row.Intensity),
		},
		BaseStrength:             float64(row.BaseStrength),
		RecallCount:              row.RecallCount,
		CreatedUniverseTime:      dateValue(row.CreatedUniverseTime),
		LastRecalledUniverseTime: datePtr(row.LastRecalledUniverseTime),
		SemanticStage:            row.SemanticStage,
		SemanticizeTimerResetAt:  datePtr(row.SemanticizeTimerResetAt),
		DeletedAt:                timePtr(row.DeletedAt),
		RepresentationRevision:   row.RepresentationRevision,
	}
}

func mapEpisodicMemoryRead(row dbgen.ListUniverseEpisodicMemoriesRow) memory.EpisodicMemory {
	return memory.EpisodicMemory{
		ID:          row.ID,
		DiaryID:     row.DiaryID,
		Name:        row.Name,
		CurrentText: row.CurrentText,
		Seed:        int64Ptr(row.Seed),
		Emotion: memory.Emotion{
			Mood:      memory.Mood(row.Mood),
			Valence:   float64(row.Valence),
			Arousal:   float64(row.Arousal),
			Intensity: float64(row.Intensity),
		},
		BaseStrength:             float64(row.BaseStrength),
		RecallCount:              row.RecallCount,
		CreatedUniverseTime:      dateValue(row.CreatedUniverseTime),
		LastRecalledUniverseTime: datePtr(row.LastRecalledUniverseTime),
		SemanticStage:            row.SemanticStage,
		SemanticizeTimerResetAt:  datePtr(row.SemanticizeTimerResetAt),
		SemanticStages:           semanticStagesPtr(row.SemanticStages),
		PendingSemanticStage:     int16Ptr(row.PendingSemanticStage),
		PendingSemanticRiseAt:    datePtr(row.PendingSemanticRiseAt),
		DecayStages:              decayStagesSlice(row.DecayStages),
		ForgettingOffsetDays:     float64(row.ForgettingOffsetDays),
		DeletedAt:                timePtr(row.DeletedAt),
		RepresentationRevision:   row.RepresentationRevision,
	}
}

func mapNeuron(row dbgen.UpsertNeuronRow) memory.Neuron {
	return memory.Neuron{
		ID:                     row.ID,
		Name:                   textPtr(row.Name),
		Type:                   memory.NeuronType(row.NeuronType),
		CreatedAt:              timeValue(row.CreatedAt),
		SealedAt:               timePtr(row.SealedAt),
		RepresentationRevision: row.RepresentationRevision,
	}
}

func mapNeuronRead(row dbgen.ListUniverseNeuronsRow) memory.NeuronWithConnectivity {
	return memory.NeuronWithConnectivity{
		Neuron: memory.Neuron{
			ID:                     row.ID,
			Name:                   textPtr(row.Name),
			Type:                   memory.NeuronType(row.NeuronType),
			CreatedAt:              timeValue(row.CreatedAt),
			SealedAt:               timePtr(row.SealedAt),
			RepresentationRevision: row.RepresentationRevision,
		},
		Connectivity: row.Connectivity,
	}
}

func mapNeuronActivation(row dbgen.InsertNeuronActivationRow) memory.NeuronActivation {
	return memory.NeuronActivation{
		EpisodicMemoryID: row.EpisodicMemoryID,
		NeuronID:         row.NeuronID,
		Weight:           row.Weight,
	}
}

func mapNeuronActivationRead(row dbgen.ListUniverseNeuronActivationsRow) memory.NeuronActivation {
	return memory.NeuronActivation{
		EpisodicMemoryID: row.EpisodicMemoryID,
		NeuronID:         row.NeuronID,
		Weight:           row.Weight,
	}
}

func mapSynapse(row dbgen.UpsertSynapseRow) memory.Synapse {
	return memory.Synapse{
		ID:                        row.ID,
		NeuronAID:                 row.NeuronAID,
		NeuronBID:                 row.NeuronBID,
		Strength:                  row.Strength,
		CoActivationCount:         row.CoActivationCount,
		LastActivatedUniverseTime: dateValue(row.LastActivatedUniverseTime),
		CreatedAt:                 timeValue(row.CreatedAt),
	}
}

func mapSynapseRead(row dbgen.ListUniverseSynapsesRow) memory.Synapse {
	return memory.Synapse{
		ID:                        row.ID,
		NeuronAID:                 row.NeuronAID,
		NeuronBID:                 row.NeuronBID,
		Strength:                  row.Strength,
		CoActivationCount:         row.CoActivationCount,
		LastActivatedUniverseTime: dateValue(row.LastActivatedUniverseTime),
		CreatedAt:                 timeValue(row.CreatedAt),
	}
}

func mapEmbedding(row dbgen.InsertEmbeddingRow) (memory.Embedding, error) {
	vector, err := parseVectorLiteral(row.Vector)
	if err != nil {
		return memory.Embedding{}, err
	}
	return memory.Embedding{
		NeuronID: row.NeuronID,
		Vector:   vector,
	}, nil
}

func mapJob(row dbgen.Job) memory.Job {
	return memory.Job{
		ID:                  row.ID,
		UserID:              row.UserID,
		Kind:                memory.JobKind(row.Kind),
		Payload:             row.Payload,
		Status:              memory.JobStatus(row.Status),
		Attempts:            row.Attempts,
		NextRunAt:           timeValue(row.NextRunAt),
		CreatedAt:           timeValue(row.CreatedAt),
		DedupKey:            textPtr(row.DedupKey),
		TerminalAt:          timePtr(row.TerminalAt),
		CanceledByReleaseID: textPtr(row.CancelledByReleaseID),
		LeaseGeneration:     row.LeaseGeneration,
	}
}

func mapEnqueuedJob(row dbgen.EnqueueJobRow) memory.Job {
	return memory.Job{
		ID:                  row.ID,
		UserID:              row.UserID,
		Kind:                memory.JobKind(row.Kind),
		Payload:             row.Payload,
		Status:              memory.JobStatus(row.Status),
		Attempts:            row.Attempts,
		NextRunAt:           timeValue(row.NextRunAt),
		CreatedAt:           timeValue(row.CreatedAt),
		DedupKey:            textPtr(row.DedupKey),
		TerminalAt:          timePtr(row.TerminalAt),
		CanceledByReleaseID: textPtr(row.CancelledByReleaseID),
		LeaseGeneration:     row.LeaseGeneration,
	}
}

func mapJobTargets(rows []dbgen.ListJobTargetsRow) []memory.JobTarget {
	targets := make([]memory.JobTarget, 0, len(rows))
	for _, row := range rows {
		targets = append(targets, memory.JobTarget{
			Kind:             memory.JobTargetKind(row.TargetKind),
			ID:               row.TargetID,
			ExpectedRevision: row.ExpectedRevision.Int64,
		})
	}
	return targets
}

func mapEpisodicMemories(rows []dbgen.ListUniverseEpisodicMemoriesRow) []memory.EpisodicMemory {
	items := make([]memory.EpisodicMemory, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapEpisodicMemoryRead(row))
	}
	return items
}

func mapNeuronsWithConnectivity(rows []dbgen.ListUniverseNeuronsRow) []memory.NeuronWithConnectivity {
	items := make([]memory.NeuronWithConnectivity, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapNeuronRead(row))
	}
	return items
}

func mapNeuronActivations(rows []dbgen.ListUniverseNeuronActivationsRow) []memory.NeuronActivation {
	items := make([]memory.NeuronActivation, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapNeuronActivationRead(row))
	}
	return items
}

func mapSynapses(rows []dbgen.ListUniverseSynapsesRow) []memory.Synapse {
	items := make([]memory.Synapse, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapSynapseRead(row))
	}
	return items
}

func vectorLiteral(vector []float32) (string, error) {
	if len(vector) != values.AiEmbeddingDim {
		return "", fmt.Errorf("embedding vector dimension = %d, want %d", len(vector), values.AiEmbeddingDim)
	}
	var out strings.Builder
	out.WriteByte('[')
	for i, value := range vector {
		if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
			return "", errors.New("embedding vector values must be finite")
		}
		if i > 0 {
			out.WriteByte(',')
		}
		out.WriteString(strconv.FormatFloat(float64(value), 'g', -1, 32))
	}
	out.WriteByte(']')
	return out.String(), nil
}

func parseVectorLiteral(raw string) ([]float32, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "[]" {
		return []float32{}, nil
	}
	if !strings.HasPrefix(trimmed, "[") || !strings.HasSuffix(trimmed, "]") {
		return nil, fmt.Errorf("invalid pgvector literal %q", raw)
	}
	body := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(trimmed, "["), "]"))
	if body == "" {
		return []float32{}, nil
	}
	parts := strings.Split(body, ",")
	vector := make([]float32, 0, len(parts))
	for _, part := range parts {
		value, err := strconv.ParseFloat(strings.TrimSpace(part), 32)
		if err != nil {
			return nil, err
		}
		vector = append(vector, float32(value))
	}
	return vector, nil
}

func semanticStagesPtr(raw []byte) *memory.SemanticStages {
	if len(raw) == 0 {
		return nil
	}
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil || len(values) != len(memory.SemanticStages{}) {
		return nil
	}
	var stages memory.SemanticStages
	copy(stages[:], values)
	return &stages
}

// decayStagesSlice decodes the stored decay_stages JSONB into the variable-length stage-text slice
// ([R8a]); NULL/empty and malformed JSON both read as nil (no stage text filled yet), never an error
// — the read stays derivation-only, and the client falls back to current_text.
func decayStagesSlice(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	var stages []string
	if err := json.Unmarshal(raw, &stages); err != nil {
		return nil
	}
	return stages
}

func pgDate(value time.Time) pgtype.Date {
	return pgtype.Date{Time: dateOnly(value), Valid: true}
}

func pgDatePtr(value *time.Time) pgtype.Date {
	if value == nil {
		return pgtype.Date{}
	}
	return pgDate(*value)
}

func pgTime(value time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func pgTimePtr(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgTime(*value)
}

func pgInt8(value *int64) pgtype.Int8 {
	if value == nil {
		return pgtype.Int8{}
	}
	return pgtype.Int8{Int64: *value, Valid: true}
}

func pgInt2Ptr(value *int16) pgtype.Int2 {
	if value == nil {
		return pgtype.Int2{}
	}
	return pgtype.Int2{Int16: *value, Valid: true}
}

func int16Ptr(value pgtype.Int2) *int16 {
	if !value.Valid {
		return nil
	}
	return &value.Int16
}

func pgText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func dateValue(value pgtype.Date) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return dateOnly(value.Time)
}

func datePtr(value pgtype.Date) *time.Time {
	if !value.Valid {
		return nil
	}
	date := dateOnly(value.Time)
	return &date
}

func timeValue(value pgtype.Timestamptz) time.Time {
	if !value.Valid {
		return time.Time{}
	}
	return value.Time.UTC()
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	t := value.Time.UTC()
	return &t
}

func int64Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	return &value.String
}

func dateOnly(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func timeOrNow(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now().UTC()
	}
	return value.UTC()
}
