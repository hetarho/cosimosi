package memory

import (
	"context"
	"errors"
)

// ErrNotFound is returned by repository reads when a requested row is absent.
var ErrNotFound = errors.New("memory: not found")

// Repository is the persistence port the memory service depends on (consumer-side
// interface — the pgx implementation lives in repository_pg.go). RecordMemory is
// one transaction; there is intentionally no Update/Delete for records
// (constitution §1: the original diary is immutable).
type Repository interface {
	// RecordMemory persists, in a single transaction: (idempotency check →)
	// records insert (immutable) → memories insert → jobs enqueue, returning the
	// new memory id. If the (user_id, idempotency_key) pair already exists, it
	// returns the existing memory id without writing anything.
	RecordMemory(ctx context.Context, in RecordInput) (memoryID string, err error)

	// ListByUser returns every star for the user, dormant ones included (no
	// brightness filter — constitution §2), with mood/intensity JOINed from records.
	ListByUser(ctx context.Context, userID string) ([]Memory, error)

	// TouchRecall re-ignites a star (sets memories.last_recalled_at=now); a no-op if
	// the (user, memory) pair is absent (spec 11). Only the star is mutable; the
	// record is never touched (constitution §1).
	TouchRecall(ctx context.Context, userID, memoryID string) error

	// GetRecord reads the immutable original (records JOIN) for the recall panel;
	// returns ErrNotFound when the (user, memory) pair is absent.
	GetRecord(ctx context.Context, userID, memoryID string) (Record, error)
}
