package pg

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// InReleaseTx implements memory.ReleaseRepo: it runs fn against a store bound to one pgx
// transaction, so a release / restore / letting-go / sweep — soft-delete + seal + weaken +
// ledger, or their reversal, or the FK-ordered hard delete — commits wholly or not at all.
// Same transaction mechanics as InRecallTx; a distinct fn type (ReleaseTx) keeps the surface
// scoped to the release writes.
func (s Store) InReleaseTx(ctx context.Context, fn func(tx memory.ReleaseTx) error) error {
	if s.queries == nil {
		return ErrQueriesRequired
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()
	if err := fn(Store{queries: s.queries.WithTx(tx), db: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// EpisodicMemoryForRelease loads a memory for the letting-go read/re-check, reusing the recall
// load; a missing/foreign row is ErrReleaseMemoryNotFound. Per-user scoped.
func (s Store) EpisodicMemoryForRelease(ctx context.Context, scope platform.UserScope, memoryID string) (memory.EpisodicMemory, error) {
	if err := s.ready(scope); err != nil {
		return memory.EpisodicMemory{}, err
	}
	row, err := s.queries.LoadEpisodicMemoryForRecall(ctx, dbgen.LoadEpisodicMemoryForRecallParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.EpisodicMemory{}, memory.ErrReleaseMemoryNotFound
	}
	if err != nil {
		return memory.EpisodicMemory{}, err
	}
	return mapRecallMemory(row), nil
}

// ThisMemoryOnlySemanticNeurons returns the unsealed semantic neurons this memory activates that
// no other retained memory activates — the letting-go candidate set ([X4]). Per-user scoped.
func (s Store) ThisMemoryOnlySemanticNeurons(ctx context.Context, scope platform.UserScope, memoryID string) ([]memory.SealCandidateRef, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListThisMemoryOnlySemanticNeurons(ctx, dbgen.ListThisMemoryOnlySemanticNeuronsParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if err != nil {
		return nil, err
	}
	candidates := make([]memory.SealCandidateRef, 0, len(rows))
	for _, row := range rows {
		candidates = append(candidates, memory.SealCandidateRef{NeuronID: row.ID, Name: row.Name.String})
	}
	return candidates, nil
}

// ThisMemoryOnlySemanticNeuronIDs is LetGo's sealed-inclusive re-validation set — the this-memory-only
// semantic neuron ids (a shared/foreign/non-semantic id is absent and rejected). Per-user scoped.
func (s Store) ThisMemoryOnlySemanticNeuronIDs(ctx context.Context, scope platform.UserScope, memoryID string) ([]string, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return s.queries.ListThisMemoryOnlySemanticNeuronIDs(ctx, dbgen.ListThisMemoryOnlySemanticNeuronIDsParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
}

// ReleaseGroupForDiary returns the live release group for a diary and whether one exists — the
// already-released guard (Release) and the restore/expiry target (Restore). Per-user scoped.
func (s Store) ReleaseGroupForDiary(ctx context.Context, scope platform.UserScope, diaryID string) (memory.ReleaseGroup, bool, error) {
	if err := s.ready(scope); err != nil {
		return memory.ReleaseGroup{}, false, err
	}
	row, err := s.queries.GetReleaseGroupForDiary(ctx, dbgen.GetReleaseGroupForDiaryParams{
		UserID:  scope.UserID(),
		DiaryID: diaryID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.ReleaseGroup{}, false, nil
	}
	if err != nil {
		return memory.ReleaseGroup{}, false, err
	}
	return memory.ReleaseGroup{ID: row.ID, DiaryID: row.DiaryID, DeletedAt: timeValue(row.DeletedAt)}, true, nil
}

func (s Store) ReleaseGroupForSweep(ctx context.Context, scope platform.UserScope, releaseID string) (memory.ReleaseGroup, bool, error) {
	if err := s.ready(scope); err != nil {
		return memory.ReleaseGroup{}, false, err
	}
	row, err := s.queries.GetReleaseGroupForSweep(ctx, dbgen.GetReleaseGroupForSweepParams{
		UserID:    scope.UserID(),
		ReleaseID: releaseID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.ReleaseGroup{}, false, nil
	}
	if err != nil {
		return memory.ReleaseGroup{}, false, err
	}
	return memory.ReleaseGroup{ID: row.ID, DiaryID: row.DiaryID, DeletedAt: timeValue(row.DeletedAt)}, true, nil
}

func (s Store) InsertReleaseGroup(ctx context.Context, scope platform.UserScope, group memory.ReleaseGroup) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.InsertReleaseGroup(ctx, dbgen.InsertReleaseGroupParams{
		ID:        group.ID,
		UserID:    scope.UserID(),
		DiaryID:   group.DiaryID,
		DeletedAt: pgTime(group.DeletedAt),
	})
}

func (s Store) RecordReleaseMemories(ctx context.Context, scope platform.UserScope, releaseID string, memoryIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(memoryIDs) == 0 {
		return nil
	}
	return s.queries.InsertReleaseMemories(ctx, dbgen.InsertReleaseMemoriesParams{
		ReleaseID:         releaseID,
		UserID:            scope.UserID(),
		EpisodicMemoryIds: memoryIDs,
	})
}

func (s Store) RecordReleaseSealedNeurons(ctx context.Context, scope platform.UserScope, releaseID string, neuronIDs []string, sealedAt time.Time) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.InsertReleaseSealedNeurons(ctx, dbgen.InsertReleaseSealedNeuronsParams{
		ReleaseID: releaseID,
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
		SealedAt:  pgTime(sealedAt),
	})
}

func (s Store) RecordReleaseSynapseDeltas(ctx context.Context, scope platform.UserScope, releaseID string, deltas []memory.SynapseDelta) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(deltas) == 0 {
		return nil
	}
	ids := make([]string, 0, len(deltas))
	amounts := make([]float32, 0, len(deltas))
	for _, delta := range deltas {
		ids = append(ids, delta.SynapseID)
		amounts = append(amounts, float32(delta.AppliedDelta))
	}
	return s.queries.InsertReleaseSynapseDeltas(ctx, dbgen.InsertReleaseSynapseDeltasParams{
		ReleaseID:     releaseID,
		UserID:        scope.UserID(),
		SynapseIds:    ids,
		AppliedDeltas: amounts,
	})
}

func (s Store) ReleaseMemories(ctx context.Context, scope platform.UserScope, releaseID string) ([]string, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return s.queries.ListReleaseMemories(ctx, dbgen.ListReleaseMemoriesParams{
		UserID:    scope.UserID(),
		ReleaseID: releaseID,
	})
}

func (s Store) ReleaseMemoryNeuronSealFacts(ctx context.Context, scope platform.UserScope, releaseID string) ([]memory.NeuronSealFact, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListReleaseMemoryNeuronSealFacts(ctx, dbgen.ListReleaseMemoryNeuronSealFactsParams{
		UserID:    scope.UserID(),
		ReleaseID: releaseID,
	})
	if err != nil {
		return nil, err
	}
	facts := make([]memory.NeuronSealFact, 0, len(rows))
	for _, row := range rows {
		facts = append(facts, memory.NeuronSealFact{
			NeuronID:               row.ID,
			RepresentationRevision: row.RepresentationRevision,
			Sealed:                 row.Sealed,
			HasReleaseEffect:       row.HasReleaseEffect,
			ReleaseOwnsCurrentSeal: row.ReleaseOwnsCurrentSeal,
		})
	}
	return facts, nil
}

func (s Store) DeleteReleaseNeuronSealEffects(ctx context.Context, scope platform.UserScope, neuronIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.DeleteReleaseNeuronSealEffects(ctx, dbgen.DeleteReleaseNeuronSealEffectsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
}

func (s Store) UnsealReleaseOwnedNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.UnsealReleaseOwnedNeurons(ctx, dbgen.UnsealReleaseOwnedNeuronsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
}

// ReverseReleaseSynapseDeltas adds each recorded LTD amount back to the edge's current strength,
// clamped, atomically in SQL — the lost-update-safe reversal of Release's Depress (a concurrent
// LTP/downscale between a read and write can't be clobbered). Per-user scoped.
func (s Store) ReverseReleaseSynapseDeltas(ctx context.Context, scope platform.UserScope, releaseID string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.ReverseReleaseSynapseDeltas(ctx, dbgen.ReverseReleaseSynapseDeltasParams{
		UserID:      scope.UserID(),
		ReleaseID:   releaseID,
		StrengthCap: float32(values.SynapseStrengthCap),
	})
}

func (s Store) CancelReleaseMemoryJobs(ctx context.Context, scope platform.UserScope, releaseID string, memoryIDs []string, cancelledAt time.Time) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(memoryIDs) == 0 {
		return nil
	}
	_, err := s.queries.CancelReleaseMemoryJobs(ctx, dbgen.CancelReleaseMemoryJobsParams{
		CancelledAt:       pgTime(cancelledAt),
		ReleaseID:         pgtype.Text{String: releaseID, Valid: releaseID != ""},
		UserID:            scope.UserID(),
		EpisodicMemoryIds: memoryIDs,
	})
	return err
}

func (s Store) RequeueReleaseMemoryJobs(ctx context.Context, scope platform.UserScope, releaseID string, nextRunAt time.Time) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	_, err := s.queries.RequeueReleaseMemoryJobs(ctx, dbgen.RequeueReleaseMemoryJobsParams{
		NextRunAt: pgTime(nextRunAt),
		UserID:    scope.UserID(),
		ReleaseID: pgtype.Text{String: releaseID, Valid: releaseID != ""},
	})
	return err
}

func (s Store) DeleteReleaseRetentionJobs(ctx context.Context, scope platform.UserScope, releaseID string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	_, err := s.queries.DeleteReleaseRetentionJobs(ctx, dbgen.DeleteReleaseRetentionJobsParams{
		UserID:    scope.UserID(),
		ReleaseID: releaseID,
	})
	return err
}

func (s Store) ClearReleaseMemoriesDeletedAt(ctx context.Context, scope platform.UserScope, memoryIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(memoryIDs) == 0 {
		return nil
	}
	return s.queries.ClearReleaseMemoriesDeletedAt(ctx, dbgen.ClearReleaseMemoriesDeletedAtParams{
		UserID:            scope.UserID(),
		EpisodicMemoryIds: memoryIDs,
	})
}

func (s Store) DeleteReleaseGroup(ctx context.Context, scope platform.UserScope, releaseID string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.DeleteReleaseGroup(ctx, dbgen.DeleteReleaseGroupParams{
		UserID: scope.UserID(),
		ID:     releaseID,
	})
}

func (s Store) ExpiredReleaseGroups(ctx context.Context, scope platform.UserScope, cutoff time.Time) ([]memory.ReleaseGroup, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListExpiredReleaseGroups(ctx, dbgen.ListExpiredReleaseGroupsParams{
		UserID: scope.UserID(),
		Cutoff: pgTime(cutoff),
	})
	if err != nil {
		return nil, err
	}
	groups := make([]memory.ReleaseGroup, 0, len(rows))
	for _, row := range rows {
		groups = append(groups, memory.ReleaseGroup{ID: row.ID, DiaryID: row.DiaryID, DeletedAt: timeValue(row.DeletedAt)})
	}
	return groups, nil
}

func (s Store) ExclusiveReleaseNeurons(ctx context.Context, scope platform.UserScope, releaseID string, releaseMemoryIDs []string) ([]string, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return s.queries.ListExclusiveReleaseNeurons(ctx, dbgen.ListExclusiveReleaseNeuronsParams{
		UserID:           scope.UserID(),
		ReleaseID:        releaseID,
		ReleaseMemoryIds: releaseMemoryIDs,
	})
}

func (s Store) PurgeReleaseJobs(ctx context.Context, scope platform.UserScope, releaseID string, memoryIDs, neuronIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	_, err := s.queries.PurgeReleaseJobs(ctx, dbgen.PurgeReleaseJobsParams{
		UserID:            scope.UserID(),
		EpisodicMemoryIds: memoryIDs,
		NeuronIds:         neuronIDs,
		ReleaseID:         releaseID,
	})
	return err
}

func (s Store) DeleteReleaseActivations(ctx context.Context, scope platform.UserScope, memoryIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(memoryIDs) == 0 {
		return nil
	}
	return s.queries.DeleteReleaseActivations(ctx, dbgen.DeleteReleaseActivationsParams{
		UserID:            scope.UserID(),
		EpisodicMemoryIds: memoryIDs,
	})
}

func (s Store) DeleteReleaseSynapses(ctx context.Context, scope platform.UserScope, neuronIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.DeleteReleaseSynapses(ctx, dbgen.DeleteReleaseSynapsesParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
}

func (s Store) DeleteReleaseEmbeddings(ctx context.Context, scope platform.UserScope, neuronIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.DeleteReleaseEmbeddings(ctx, dbgen.DeleteReleaseEmbeddingsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
}

func (s Store) DeleteReleaseNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.DeleteReleaseNeurons(ctx, dbgen.DeleteReleaseNeuronsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
}

func (s Store) DeleteReleaseMemories(ctx context.Context, scope platform.UserScope, memoryIDs []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(memoryIDs) == 0 {
		return nil
	}
	return s.queries.DeleteReleaseMemories(ctx, dbgen.DeleteReleaseMemoriesParams{
		UserID:            scope.UserID(),
		EpisodicMemoryIds: memoryIDs,
	})
}

func (s Store) DeleteReleaseDiary(ctx context.Context, scope platform.UserScope, diaryID string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.DeleteReleaseDiary(ctx, dbgen.DeleteReleaseDiaryParams{
		UserID:  scope.UserID(),
		DiaryID: diaryID,
	})
}

// WeakenSharedContributionsReturningDeltas mirrors WeakenSharedContributions but returns
// the amount Depressed off each shared-contribution edge, so Release records it in the ledger for an
// exact Restore. It reads the affected edges, lowers each strength one LTD step via the pure Depress,
// and writes them back — the edge is never deleted. Per-user scoped; empty when nothing is affected.
func (s Store) WeakenSharedContributionsReturningDeltas(ctx context.Context, scope platform.UserScope, removalNeuronIDs, sharedNeuronIDs []string, amount float64) ([]memory.SynapseDelta, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(removalNeuronIDs) == 0 || len(sharedNeuronIDs) == 0 {
		return nil, nil
	}
	rows, err := s.queries.ListContributionSynapses(ctx, dbgen.ListContributionSynapsesParams{
		UserID:           scope.UserID(),
		RemovalNeuronIds: removalNeuronIDs,
		SharedNeuronIds:  sharedNeuronIDs,
	})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	ids := make([]string, 0, len(rows))
	strengths := make([]float32, 0, len(rows))
	deltas := make([]memory.SynapseDelta, 0, len(rows))
	for _, row := range rows {
		preStored := row.Strength
		postStored := float32(memory.Depress(float64(preStored), amount))
		ids = append(ids, row.ID)
		strengths = append(strengths, postStored)
		deltas = append(deltas, memory.SynapseDelta{
			SynapseID:    row.ID,
			AppliedDelta: float64(preStored - postStored),
		})
	}
	if err := s.queries.ApplyContributionWeaken(ctx, dbgen.ApplyContributionWeakenParams{
		UserID:     scope.UserID(),
		SynapseIds: ids,
		Strengths:  strengths,
	}); err != nil {
		return nil, err
	}
	return deltas, nil
}

// Static assertions: the store satisfies the release use-case's consumer-owned ports.
var (
	_ memory.ReleaseRepo = Store{}
	_ memory.ReleaseTx   = Store{}
)
