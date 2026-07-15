package pg

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// InRecallTx implements memory.RecallRepo: it runs fn against a store bound to one pgx
// transaction, so a recall — sync + spend + anchors + reinforce + (reconsolidate) +
// provenance — commits wholly or not at all. Same transaction mechanics as InLaunchTx;
// a distinct fn type keeps the recall surface (RecallTx) narrow — no launch write leaks in.
func (s Store) InRecallTx(ctx context.Context, fn func(tx memory.RecallTx) error) error {
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

func (s Store) EpisodicMemoryForRecall(ctx context.Context, scope platform.UserScope, memoryID string) (memory.EpisodicMemory, error) {
	if err := s.ready(scope); err != nil {
		return memory.EpisodicMemory{}, err
	}
	row, err := s.queries.LoadEpisodicMemoryForRecall(ctx, dbgen.LoadEpisodicMemoryForRecallParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.EpisodicMemory{}, memory.ErrRecallMemoryNotFound
	}
	if err != nil {
		return memory.EpisodicMemory{}, err
	}
	return mapRecallMemory(row), nil
}

func (s Store) RecallMemberNeurons(ctx context.Context, scope platform.UserScope, memoryID string) ([]memory.ExistingNeuron, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.LoadRecallMemberNeurons(ctx, dbgen.LoadRecallMemberNeuronsParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if err != nil {
		return nil, err
	}
	neurons := make([]memory.ExistingNeuron, 0, len(rows))
	for _, row := range rows {
		neurons = append(neurons, existingNeuron(row.ID, row.Name.String, row.NeuronType))
	}
	return neurons, nil
}

func (s Store) RecallMemberSynapses(ctx context.Context, scope platform.UserScope, memoryID string) ([]memory.Synapse, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.LoadRecallMemberSynapses(ctx, dbgen.LoadRecallMemberSynapsesParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if err != nil {
		return nil, err
	}
	synapses := make([]memory.Synapse, 0, len(rows))
	for _, row := range rows {
		synapses = append(synapses, memory.Synapse{
			ID:                        row.ID,
			NeuronAID:                 row.NeuronAID,
			NeuronBID:                 row.NeuronBID,
			Strength:                  row.Strength,
			CoActivationCount:         row.CoActivationCount,
			LastActivatedUniverseTime: dateValue(row.LastActivatedUniverseTime),
			CreatedAt:                 timeValue(row.CreatedAt),
		})
	}
	return synapses, nil
}

func (s Store) LiveDiaryRecallAnchors(ctx context.Context, scope platform.UserScope, diaryID string) ([]memory.DiaryRecallAnchor, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListLiveDiaryRecallAnchors(ctx, dbgen.ListLiveDiaryRecallAnchorsParams{
		UserID:  scope.UserID(),
		DiaryID: diaryID,
	})
	if err != nil {
		return nil, err
	}
	anchors := make([]memory.DiaryRecallAnchor, 0, len(rows))
	for _, row := range rows {
		anchors = append(anchors, memory.DiaryRecallAnchor{
			EpisodicMemoryID:         row.ID,
			Arousal:                  float64(row.Arousal),
			BaseStrength:             float64(row.BaseStrength),
			RecallCount:              row.RecallCount,
			CreatedUniverseTime:      dateValue(row.CreatedUniverseTime),
			LastRecalledUniverseTime: datePtr(row.LastRecalledUniverseTime),
			ForgettingOffsetDays:     float64(row.ForgettingOffsetDays),
		})
	}
	return anchors, nil
}

func (s Store) NeighborSharedSemanticCounts(ctx context.Context, scope platform.UserScope, memoryID string) ([]memory.NeighborSharedSemanticCount, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.NeighborSharedSemanticCounts(ctx, dbgen.NeighborSharedSemanticCountsParams{
		UserID:   scope.UserID(),
		MemoryID: memoryID,
	})
	if err != nil {
		return nil, err
	}
	neighbors := make([]memory.NeighborSharedSemanticCount, 0, len(rows))
	for _, row := range rows {
		neighbors = append(neighbors, memory.NeighborSharedSemanticCount{
			NeighborID:          row.NeighborID,
			SharedSemanticCount: int(row.SharedSemanticCount),
		})
	}
	return neighbors, nil
}

func (s Store) ResetRecallAnchors(ctx context.Context, scope platform.UserScope, memoryID string, universeTime time.Time) (memory.RecallAnchors, error) {
	if err := s.ready(scope); err != nil {
		return memory.RecallAnchors{}, err
	}
	row, err := s.queries.ResetRecallAnchors(ctx, dbgen.ResetRecallAnchorsParams{
		UniverseTime: pgDate(universeTime),
		UserID:       scope.UserID(),
		MemoryID:     memoryID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.RecallAnchors{}, memory.ErrRecallMemoryNotFound
	}
	if err != nil {
		return memory.RecallAnchors{}, err
	}
	return memory.RecallAnchors{
		RecallCount:  row.RecallCount,
		BaseStrength: float64(row.BaseStrength),
	}, nil
}

func (s Store) ApplyReconsolidatedText(ctx context.Context, scope platform.UserScope, memoryID string, currentText string, seed int64) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.ApplyReconsolidatedText(ctx, dbgen.ApplyReconsolidatedTextParams{
		CurrentText: currentText,
		Seed:        pgtype.Int8{Int64: seed, Valid: true},
		UserID:      scope.UserID(),
		MemoryID:    memoryID,
	})
}

func mapRecallMemory(row dbgen.LoadEpisodicMemoryForRecallRow) memory.EpisodicMemory {
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
		ForgettingOffsetDays:     float64(row.ForgettingOffsetDays),
		DeletedAt:                timePtr(row.DeletedAt),
	}
}
