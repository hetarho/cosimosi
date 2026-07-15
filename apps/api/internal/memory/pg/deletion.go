package pg

import (
	"context"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// RemovalNeuronIDs returns the distinct unsealed neurons the given memories activate, optionally
// narrowed to one neuron type (letting-go passes NeuronTypeSemantic; full delete passes nil for all
// types) — the neuron set the domain classifier partitions ([X1][X4]). Per-user scoped.
func (s Store) RemovalNeuronIDs(ctx context.Context, scope platform.UserScope, memoryIDs []string, neuronType *memory.NeuronType) ([]string, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	var typeArg *string
	if neuronType != nil {
		value := string(*neuronType)
		typeArg = &value
	}
	return s.queries.ListRemovalNeuronIDs(ctx, dbgen.ListRemovalNeuronIDsParams{
		UserID:     scope.UserID(),
		MemoryIds:  memoryIDs,
		NeuronType: pgText(typeArg),
	})
}

// NeuronActivationFacts returns, for the given neurons, every activation tagged with the activating
// memory's soft-delete state — the classification input the domain reduces to orphan/shared ([X1]).
// Per-user scoped.
func (s Store) NeuronActivationFacts(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]memory.NeuronActivationFact, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListRemovalNeuronActivations(ctx, dbgen.ListRemovalNeuronActivationsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
	if err != nil {
		return nil, err
	}
	facts := make([]memory.NeuronActivationFact, 0, len(rows))
	for _, row := range rows {
		facts = append(facts, memory.NeuronActivationFact{
			NeuronID:         row.NeuronID,
			EpisodicMemoryID: row.EpisodicMemoryID,
			MemoryDeleted:    row.MemoryDeleted,
		})
	}
	return facts, nil
}

// SoftDeleteDiaryMemories soft-deletes every still-live memory born from the diary at the caller's
// timestamp, returning the affected ids (the removal set). The Diary row is untouched ([I2]). Per-user
// scoped.
func (s Store) SoftDeleteDiaryMemories(ctx context.Context, scope platform.UserScope, diaryID string, deletedAt time.Time) ([]string, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	return s.queries.SoftDeleteDiaryMemories(ctx, dbgen.SoftDeleteDiaryMemoriesParams{
		UserID:    scope.UserID(),
		DiaryID:   diaryID,
		DeletedAt: pgTime(deletedAt),
	})
}

// SealNeurons seals the given orphan neurons at the caller's timestamp (only those not already sealed —
// idempotent). No unseal here (restore is the release use-case's). Per-user scoped.
func (s Store) SealNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string, sealedAt time.Time) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.SealNeurons(ctx, dbgen.SealNeuronsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
		SealedAt:  pgTime(sealedAt),
	})
}

// WeakenSharedContributions Depresses the removed memories' contribution to the shared neurons'
// synapses ([X1][I6], A3): read the affected edges (both endpoints in the removal set, ≥1 shared), lower
// each strength by one LTD step via the pure Depress, and write them back. The edge is never deleted;
// its base strength is lowered so the edge weakens. Per-user scoped; a no-op when nothing is affected.
func (s Store) WeakenSharedContributions(ctx context.Context, scope platform.UserScope, removalNeuronIDs, sharedNeuronIDs []string, amount float64) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(removalNeuronIDs) == 0 || len(sharedNeuronIDs) == 0 {
		return nil
	}
	rows, err := s.queries.ListContributionSynapses(ctx, dbgen.ListContributionSynapsesParams{
		UserID:           scope.UserID(),
		RemovalNeuronIds: removalNeuronIDs,
		SharedNeuronIds:  sharedNeuronIDs,
	})
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	ids := make([]string, 0, len(rows))
	strengths := make([]float32, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
		strengths = append(strengths, float32(memory.Depress(float64(row.Strength), amount)))
	}
	return s.queries.ApplyContributionWeaken(ctx, dbgen.ApplyContributionWeakenParams{
		UserID:     scope.UserID(),
		SynapseIds: ids,
		Strengths:  strengths,
	})
}
