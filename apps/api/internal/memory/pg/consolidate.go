package pg

import (
	"context"
	"encoding/json"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
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

func (s Store) ListMemoriesForConsolidation(ctx context.Context, scope platform.UserScope) ([]memory.ConsolidationMemory, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListConsolidationMemories(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	memories := make([]memory.ConsolidationMemory, 0, len(rows))
	for _, row := range rows {
		memories = append(memories, memory.ConsolidationMemory{
			ID:                       row.ID,
			Arousal:                  float64(row.Arousal),
			BaseStrength:             float64(row.BaseStrength),
			RecallCount:              row.RecallCount,
			CreatedUniverseTime:      dateValue(row.CreatedUniverseTime),
			LastRecalledUniverseTime: datePtr(row.LastRecalledUniverseTime),
			ForgettingOffsetDays:     float64(row.ForgettingOffsetDays),
			SemanticStage:            row.SemanticStage,
			SemanticizeTimerResetAt:  datePtr(row.SemanticizeTimerResetAt),
			PendingSemanticStage:     int16Ptr(row.PendingSemanticStage),
			RepresentationRevision:   row.RepresentationRevision,
			SemanticStagesPresent:    uint32(row.SemanticStagesPresent),
			DecayStageCount:          int(row.DecayStageCount),
			DecayStagesFilled:        int(row.DecayStagesFilled),
		})
	}
	return memories, nil
}

func (s Store) ConsolidationTexts(ctx context.Context, scope platform.UserScope, memoryIDs []string) ([]memory.ConsolidationTexts, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(memoryIDs) == 0 {
		return nil, nil
	}
	rows, err := s.queries.ListConsolidationTexts(ctx, dbgen.ListConsolidationTextsParams{
		UserID:    scope.UserID(),
		MemoryIds: memoryIDs,
	})
	if err != nil {
		return nil, err
	}
	texts := make([]memory.ConsolidationTexts, 0, len(rows))
	for _, row := range rows {
		texts = append(texts, memory.ConsolidationTexts{
			MemoryID:       row.ID,
			CurrentText:    row.CurrentText,
			Seed:           int64Ptr(row.Seed),
			SemanticStages: semanticStagesPtr(row.SemanticStages),
			DecayStages:    decayStagesSlice(row.DecayStages),
		})
	}
	return texts, nil
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

func (s Store) FillDecayStages(ctx context.Context, scope platform.UserScope, fills []memory.DecayStageFill) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	for start := 0; start < len(fills); start += values.PersistenceGraphWriteBatchSize {
		end := min(start+values.PersistenceGraphWriteBatchSize, len(fills))
		params := dbgen.FillConsolidationDecayStagesParams{
			UserID:      scope.UserID(),
			MemoryIds:   make([]string, 0, end-start),
			DecayStages: make([]string, 0, end-start),
		}
		for _, fill := range fills[start:end] {
			raw, err := json.Marshal(fill.Stages)
			if err != nil {
				return err
			}
			params.MemoryIds = append(params.MemoryIds, fill.MemoryID)
			params.DecayStages = append(params.DecayStages, string(raw))
		}
		if err := s.queries.FillConsolidationDecayStages(ctx, params); err != nil {
			return err
		}
	}
	return nil
}

// AppendMemoryProvenances appends 변천사 rows in batches of persistence.graph_write_batch_size, with
// the same kind and source guards as the single append.
func (s Store) AppendMemoryProvenances(ctx context.Context, scope platform.UserScope, entries []memory.MemoryProvenance) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	for _, entry := range entries {
		if err := validProvenance(entry); err != nil {
			return err
		}
	}
	for start := 0; start < len(entries); start += values.PersistenceGraphWriteBatchSize {
		end := min(start+values.PersistenceGraphWriteBatchSize, len(entries))
		params := dbgen.AppendMemoryProvenancesParams{UserID: scope.UserID()}
		for _, entry := range entries[start:end] {
			stage := int16(0)
			if entry.SemanticStage != nil {
				stage = *entry.SemanticStage
			}
			params.Ids = append(params.Ids, entry.ID)
			params.EpisodicMemoryIds = append(params.EpisodicMemoryIds, entry.EpisodicMemoryID)
			params.Kinds = append(params.Kinds, string(entry.Kind))
			params.Sources = append(params.Sources, string(entry.Source))
			params.Texts = append(params.Texts, entry.Text)
			params.UniverseTimes = append(params.UniverseTimes, pgDate(entry.UniverseTime))
			params.SemanticStages = append(params.SemanticStages, stage)
		}
		if err := s.queries.AppendMemoryProvenances(ctx, params); err != nil {
			return err
		}
	}
	return nil
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
