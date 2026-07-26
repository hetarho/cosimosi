package pg

import (
	"context"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

func (s Store) PurgeUser(
	ctx context.Context,
	scope platform.UserScope,
	keepJobID string,
) error {
	if err := s.ready(scope); err != nil {
		return err
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
	queries := s.queries.WithTx(tx)
	userID := scope.UserID()
	for _, purge := range []func(context.Context, string) error{
		queries.PurgeUserPaidActionReceipts,
		queries.PurgeUserReleaseSynapseDeltas,
		queries.PurgeUserReleaseSealedNeurons,
		queries.PurgeUserReleaseMemories,
		queries.PurgeUserReleaseGroups,
		queries.PurgeUserMemoryProvenance,
		queries.PurgeUserNeuronActivations,
		queries.PurgeUserSynapses,
		queries.PurgeUserEmbeddings,
		queries.PurgeUserEpisodicMemories,
		queries.PurgeUserNeurons,
		queries.PurgeUserDiaries,
		queries.PurgeUserUniverseState,
	} {
		if err := purge(ctx, userID); err != nil {
			return err
		}
	}
	if err := queries.PurgeUserJobTargets(ctx, dbgen.PurgeUserJobTargetsParams{
		UserID:    userID,
		KeepJobID: keepJobID,
	}); err != nil {
		return err
	}
	if err := queries.PurgeUserJobs(ctx, dbgen.PurgeUserJobsParams{
		UserID:    userID,
		KeepJobID: keepJobID,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
