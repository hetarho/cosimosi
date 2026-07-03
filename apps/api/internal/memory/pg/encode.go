package pg

import (
	"context"
	"errors"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

// ErrTxStarterRequired is returned when the store was built over a plain DBTX
// (e.g. an existing transaction) and cannot begin the launch transaction itself.
var ErrTxStarterRequired = errors.New("memory store requires a transaction-capable pool")

// InLaunchTx implements memory.LaunchRepo: it runs fn against a store bound to
// one pgx transaction, so a launch commits wholly or not at all.
func (s Store) InLaunchTx(ctx context.Context, fn func(tx memory.LaunchTx) error) error {
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
	if err := fn(Store{queries: s.queries.WithTx(tx)}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// LatestLaunchedUniverseTime returns the newest launched memory's
// created_universe_time, or nil when the user has launched nothing yet.
func (s Store) LatestLaunchedUniverseTime(ctx context.Context, scope platform.UserScope) (*time.Time, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	row, err := s.queries.LatestLaunchedUniverseTime(ctx, scope.UserID())
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return datePtr(row), nil
}

func (s Store) ListNeuronCandidatesInBody(ctx context.Context, scope platform.UserScope, body string, limit int32) ([]memory.ExistingNeuron, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListNeuronCandidatesInBody(ctx, dbgen.ListNeuronCandidatesInBodyParams{
		UserID:  scope.UserID(),
		Column2: body,
		Limit:   limit,
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

func (s Store) ListNearestNeuronCandidates(ctx context.Context, scope platform.UserScope, vector []float32, minSimilarity float64, limit int32) ([]memory.ExistingNeuron, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	literal, err := vectorLiteral(vector)
	if err != nil {
		return nil, err
	}
	rows, err := s.queries.ListNearestNeuronCandidates(ctx, dbgen.ListNearestNeuronCandidatesParams{
		UserID:  scope.UserID(),
		Column2: literal,
		Column3: minSimilarity,
		Limit:   limit,
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

// FindNeuronsByNames resolves persist-time dedup: names are matched
// case-insensitively, so callers pass lowercased names.
func (s Store) FindNeuronsByNames(ctx context.Context, scope platform.UserScope, names []string) ([]memory.ExistingNeuron, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	if len(names) == 0 {
		return nil, nil
	}
	rows, err := s.queries.ListNeuronsByNames(ctx, dbgen.ListNeuronsByNamesParams{
		UserID:  scope.UserID(),
		Column2: names,
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

func existingNeuron(id string, name string, neuronType string) memory.ExistingNeuron {
	return memory.ExistingNeuron{
		ID:   id,
		Name: name,
		Type: memory.NeuronType(neuronType),
	}
}
