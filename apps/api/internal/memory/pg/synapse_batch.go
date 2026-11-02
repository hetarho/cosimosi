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

// InsertNeurons creates a launch's new neurons in batches of persistence.graph_write_batch_size.
func (s Store) InsertNeurons(ctx context.Context, scope platform.UserScope, neurons []memory.Neuron) ([]memory.Neuron, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	created := make([]memory.Neuron, 0, len(neurons))
	for start := 0; start < len(neurons); start += values.PersistenceGraphWriteBatchSize {
		end := min(start+values.PersistenceGraphWriteBatchSize, len(neurons))
		params := dbgen.InsertNeuronsParams{UserID: scope.UserID()}
		for _, neuron := range neurons[start:end] {
			if neuron.Name == nil {
				return nil, errors.New("a launched neuron requires a name")
			}
			params.Ids = append(params.Ids, neuron.ID)
			params.Names = append(params.Names, *neuron.Name)
			params.NeuronTypes = append(params.NeuronTypes, string(neuron.Type))
			params.CreatedAts = append(params.CreatedAts, pgTime(timeOrNow(neuron.CreatedAt)))
		}
		rows, err := s.queries.InsertNeurons(ctx, params)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			created = append(created, mapNeuron(dbgen.UpsertNeuronRow(row)))
		}
	}
	return created, nil
}

// InsertNeuronActivations writes a launch's activations in batches of
// persistence.graph_write_batch_size.
func (s Store) InsertNeuronActivations(ctx context.Context, scope platform.UserScope, activations []memory.NeuronActivation) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	for start := 0; start < len(activations); start += values.PersistenceGraphWriteBatchSize {
		end := min(start+values.PersistenceGraphWriteBatchSize, len(activations))
		params := dbgen.InsertNeuronActivationsParams{UserID: scope.UserID()}
		for _, activation := range activations[start:end] {
			params.EpisodicMemoryIds = append(params.EpisodicMemoryIds, activation.EpisodicMemoryID)
			params.NeuronIds = append(params.NeuronIds, activation.NeuronID)
			params.Weights = append(params.Weights, activation.Weight)
		}
		if err := s.queries.InsertNeuronActivations(ctx, params); err != nil {
			return err
		}
	}
	return nil
}
