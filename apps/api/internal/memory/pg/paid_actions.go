package pg

import (
	"context"
	"errors"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5"
)

// InViewSemanticTx implements memory.ViewSemanticRepo: it runs fn against a store bound to one pgx
// transaction, so a paid gist view — the graph lock, the receipt lookup, the gist read, the
// Twinkle spend (joined via the store's DB() handle), and the receipt insert — commits wholly or
// not at all (A3). Same transaction mechanics as InRecallTx; the narrow ViewSemanticTx surface
// keeps a view structurally read-only (no anchor/clock/provenance write leaks in, [R8][I2]).
func (s Store) InViewSemanticTx(ctx context.Context, fn func(tx memory.ViewSemanticTx) error) error {
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

// GetPaidActionReceipt reads the receipt for a client operation id, per-user scoped (A2). Absent →
// found=false (no prior commit; the use-case does the work). The target ids are not read back —
// the use-case matches only on kind + fingerprint and replays the stored response.
func (s Store) GetPaidActionReceipt(ctx context.Context, scope platform.UserScope, operationID string) (memory.PaidActionReceipt, bool, error) {
	if err := s.ready(scope); err != nil {
		return memory.PaidActionReceipt{}, false, err
	}
	row, err := s.queries.GetPaidActionReceipt(ctx, dbgen.GetPaidActionReceiptParams{
		UserID:      scope.UserID(),
		OperationID: operationID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return memory.PaidActionReceipt{}, false, nil
	}
	if err != nil {
		return memory.PaidActionReceipt{}, false, err
	}
	return memory.PaidActionReceipt{
		OperationID:        operationID,
		Kind:               memory.PaidActionKind(row.ActionKind),
		RequestFingerprint: row.RequestFingerprint,
		Response:           row.Response,
	}, true, nil
}

// InsertPaidActionReceipt writes the commit-time receipt in the caller's transaction (A3). The
// table CHECK enforces exactly one target id; the FK cascade ties the receipt's lifetime to that
// retained target.
func (s Store) InsertPaidActionReceipt(ctx context.Context, scope platform.UserScope, receipt memory.PaidActionReceipt) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	return s.queries.InsertPaidActionReceipt(ctx, dbgen.InsertPaidActionReceiptParams{
		UserID:             scope.UserID(),
		OperationID:        receipt.OperationID,
		ActionKind:         string(receipt.Kind),
		RequestFingerprint: receipt.RequestFingerprint,
		EpisodicMemoryID:   pgText(receipt.EpisodicMemoryID),
		DiaryID:            pgText(receipt.DiaryID),
		Response:           receipt.Response,
	})
}
