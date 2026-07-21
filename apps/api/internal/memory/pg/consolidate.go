package pg

import (
	"context"
	"encoding/json"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5/pgtype"
)

// The memory.ConsolidateTx surface (§2.6): the consolidation batch reads/writes on the same
// transaction-scoped store the advance runs on. The interval read reuses the universe read's
// query so consolidation and the read path see one non-deleted, per-user memory shape.

// Compile-time proof the transaction-scoped store satisfies the consolidation surface the
// advance hook upgrades its ProgressionTx to — the upgrade is a wiring fact, not a gamble.
var _ memory.ConsolidateTx = Store{}

func (s Store) ConsolidationWatermarkForUpdate(ctx context.Context, scope platform.UserScope) (*time.Time, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	through, err := s.queries.ConsolidationWatermarkForUpdate(ctx, scope.UserID())
	if err != nil {
		// No universe_state row would mean the hook fired before the clock advance
		// upserted it — a wiring bug, surfaced loudly rather than read as "never
		// consolidated" (which would silently re-run processed intervals).
		return nil, err
	}
	return datePtr(through), nil
}

func (s Store) SetConsolidationWatermark(ctx context.Context, scope platform.UserScope, through time.Time) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.SetConsolidationWatermark(ctx, dbgen.SetConsolidationWatermarkParams{
		Through: pgDate(through),
		UserID:  scope.UserID(),
	})
}

func (s Store) RecordPendingGistRises(ctx context.Context, scope platform.UserScope, rises []memory.PendingGistRise) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(rises) == 0 {
		return nil
	}
	params := dbgen.RecordPendingGistRisesParams{
		UserID:    scope.UserID(),
		MemoryIds: make([]string, 0, len(rises)),
		Stages:    make([]int16, 0, len(rises)),
		RiseAts:   make([]pgtype.Date, 0, len(rises)),
	}
	for _, rise := range rises {
		params.MemoryIds = append(params.MemoryIds, rise.MemoryID)
		params.Stages = append(params.Stages, rise.Stage)
		params.RiseAts = append(params.RiseAts, pgDate(rise.RiseAt))
	}
	return s.queries.RecordPendingGistRises(ctx, params)
}

func (s Store) ListMemoriesForConsolidation(ctx context.Context, scope platform.UserScope) ([]memory.EpisodicMemory, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListUniverseEpisodicMemories(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	return mapEpisodicMemories(rows), nil
}

func (s Store) ApplyStageAdvances(ctx context.Context, scope platform.UserScope, advances []memory.StageAdvance) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(advances) == 0 {
		return nil
	}
	params := dbgen.ApplyConsolidationStageAdvancesParams{
		UserID:        scope.UserID(),
		MemoryIds:     make([]string, 0, len(advances)),
		Stages:        make([]int16, 0, len(advances)),
		TimerResetAts: make([]pgtype.Date, 0, len(advances)),
	}
	for _, advance := range advances {
		params.MemoryIds = append(params.MemoryIds, advance.MemoryID)
		params.Stages = append(params.Stages, advance.Stage)
		params.TimerResetAts = append(params.TimerResetAts, pgDate(advance.TimerResetAt))
	}
	return s.queries.ApplyConsolidationStageAdvances(ctx, params)
}

func (s Store) FillDecayStages(ctx context.Context, scope platform.UserScope, memoryID string, stages []string) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	raw, err := json.Marshal(stages)
	if err != nil {
		return err
	}
	return s.queries.FillConsolidationDecayStages(ctx, dbgen.FillConsolidationDecayStagesParams{
		DecayStages: raw,
		UserID:      scope.UserID(),
		MemoryID:    memoryID,
	})
}

func (s Store) ReplaySetNeurons(ctx context.Context, scope platform.UserScope, memoryIDs []string) ([]memory.ExistingNeuron, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(memoryIDs) == 0 {
		return nil, nil
	}
	rows, err := s.queries.ListReplaySetNeurons(ctx, dbgen.ListReplaySetNeuronsParams{
		UserID:    scope.UserID(),
		MemoryIds: memoryIDs,
	})
	if err != nil {
		return nil, err
	}
	neurons := make([]memory.ExistingNeuron, 0, len(rows))
	for _, row := range rows {
		neurons = append(neurons, existingNeuron(row.ID, row.Name.String, row.NeuronType, row.RepresentationRevision))
	}
	return neurons, nil
}

func (s Store) MemoriesActivatingNeurons(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]string, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(neuronIDs) == 0 {
		return nil, nil
	}
	return s.queries.ListMemoriesActivatingNeurons(ctx, dbgen.ListMemoriesActivatingNeuronsParams{
		UserID:    scope.UserID(),
		NeuronIds: neuronIDs,
	})
}

func (s Store) TouchReplaySetSynapses(ctx context.Context, scope platform.UserScope, neuronIDs []string, universeTime time.Time) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(neuronIDs) == 0 {
		return nil
	}
	return s.queries.TouchReplaySetSynapses(ctx, dbgen.TouchReplaySetSynapsesParams{
		UserID:       scope.UserID(),
		UniverseTime: pgDate(universeTime),
		NeuronIds:    neuronIDs,
	})
}

func (s Store) ListSynapseStrengths(ctx context.Context, scope platform.UserScope, activatedBefore time.Time) ([]memory.SynapseStrength, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListSynapseStrengthsForDownscale(ctx, dbgen.ListSynapseStrengthsForDownscaleParams{
		UserID:          scope.UserID(),
		ActivatedBefore: pgDate(activatedBefore),
	})
	if err != nil {
		return nil, err
	}
	strengths := make([]memory.SynapseStrength, 0, len(rows))
	for _, row := range rows {
		strengths = append(strengths, memory.SynapseStrength{
			SynapseID: row.ID,
			Strength:  float64(row.Strength),
		})
	}
	return strengths, nil
}

func (s Store) ApplySynapseDownscale(ctx context.Context, scope platform.UserScope, updates []memory.SynapseStrength) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if len(updates) == 0 {
		return nil
	}
	params := dbgen.ApplySynapseDownscaleParams{
		UserID:     scope.UserID(),
		SynapseIds: make([]string, 0, len(updates)),
		Strengths:  make([]float32, 0, len(updates)),
	}
	for _, update := range updates {
		params.SynapseIds = append(params.SynapseIds, update.SynapseID)
		params.Strengths = append(params.Strengths, float32(update.Strength))
	}
	return s.queries.ApplySynapseDownscale(ctx, params)
}
