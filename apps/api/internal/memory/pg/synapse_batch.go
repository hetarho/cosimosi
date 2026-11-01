package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// UpsertSynapses joins the graph writer's transaction. Validate before the first batch is written.
func (s Store) UpsertSynapses(ctx context.Context, scope platform.UserScope, synapses []memory.Synapse) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	rows := make([]dbgen.UpsertSynapseParams, len(synapses))
	seen := make(map[[2]string]bool, len(synapses))
	for i, synapse := range synapses {
		row, err := synapseParams(scope, synapse)
		if err != nil {
			return err
		}
		key := [2]string{row.NeuronAID, row.NeuronBID}
		if seen[key] {
			return errors.New("synapse batch repeats a neuron pair")
		}
		seen[key], rows[i] = true, row
	}
	for start := 0; start < len(rows); start += values.PersistenceGraphWriteBatchSize {
		end := min(start+values.PersistenceGraphWriteBatchSize, len(rows))
		params := dbgen.UpsertSynapsesParams{UserID: scope.UserID()}
		for _, row := range rows[start:end] {
			params.Ids = append(params.Ids, row.ID)
			params.NeuronAIds = append(params.NeuronAIds, row.NeuronAID)
			params.NeuronBIds = append(params.NeuronBIds, row.NeuronBID)
			params.Strengths = append(params.Strengths, row.Strength)
			params.Counts = append(params.Counts, row.CoActivationCount)
			params.ActivatedAts = append(params.ActivatedAts, row.LastActivatedUniverseTime)
			params.CreatedAts = append(params.CreatedAts, row.CreatedAt)
		}
		if err := s.queries.UpsertSynapses(ctx, params); err != nil {
			return err
		}
	}
	return nil
}
