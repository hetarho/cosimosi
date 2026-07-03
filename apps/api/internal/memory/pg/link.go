package pg

import (
	"context"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// CoActivations implements memory.SynapseStore: it returns every (neuron, memory,
// memory date) membership for the given neurons, user-scoped. Link times the
// temporal bonus on the memory's created_universe_time [L4][E6]; no sqlc row
// escapes memory/pg (§2.9#4).
func (s Store) CoActivations(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]memory.NeuronMemoryActivation, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(neuronIDs) == 0 {
		return nil, nil
	}
	rows, err := s.queries.ListNeuronCoActivationDates(ctx, dbgen.ListNeuronCoActivationDatesParams{
		UserID:  scope.UserID(),
		Column2: neuronIDs,
	})
	if err != nil {
		return nil, err
	}
	activations := make([]memory.NeuronMemoryActivation, 0, len(rows))
	for _, row := range rows {
		activations = append(activations, memory.NeuronMemoryActivation{
			NeuronID:   row.NeuronID,
			MemoryID:   row.EpisodicMemoryID,
			MemoryDate: dateValue(row.CreatedUniverseTime),
		})
	}
	return activations, nil
}

// SynapseStrengths implements memory.SynapseStore: it reads, in one query, the base
// strength of every synapse whose both endpoints are among neuronIDs — the
// repeat-path bases Link folds via Potentiate [L8]. A pair absent from the result is
// a first-time pair the caller seeds via InitialStrength.
func (s Store) SynapseStrengths(ctx context.Context, scope platform.UserScope, neuronIDs []string) ([]memory.NeuronPairStrength, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(neuronIDs) == 0 {
		return nil, nil
	}
	rows, err := s.queries.ListSynapseStrengths(ctx, dbgen.ListSynapseStrengthsParams{
		UserID:  scope.UserID(),
		Column2: neuronIDs,
	})
	if err != nil {
		return nil, err
	}
	strengths := make([]memory.NeuronPairStrength, 0, len(rows))
	for _, row := range rows {
		strengths = append(strengths, memory.NeuronPairStrength{
			NeuronAID: row.NeuronAID,
			NeuronBID: row.NeuronBID,
			Strength:  float64(row.Strength),
		})
	}
	return strengths, nil
}
