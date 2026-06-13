package memory

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned by repository reads when a requested row is absent.
var ErrNotFound = errors.New("memory: not found")

// Repository is the persistence port the memory service depends on (consumer-side
// interface — the pgx implementation lives in repository_pg.go). RecordMemory is
// one transaction; there is intentionally no Update/Delete for records
// (constitution §1: the original diary is immutable).
type Repository interface {
	// RecordMemory persists, in a single transaction: (idempotency check →)
	// records insert (immutable) → extract job enqueue (spec 21). The fragment
	// stars are created asynchronously by the extract worker, so memoryIDs is
	// normally EMPTY — it is non-empty only on an idempotent replay of a record
	// whose fan-out already ran. If the (user_id, idempotency_key) pair already
	// exists, nothing is written.
	RecordMemory(ctx context.Context, in RecordInput) (recordID string, memoryIDs []string, err error)

	// ListByUser returns every star for the user, dormant ones included (no
	// brightness filter — constitution §2), with mood/intensity JOINed from records.
	ListByUser(ctx context.Context, userID string) ([]Memory, error)

	// ListDormant returns the user's stars whose last_recalled_at is before cutoff
	// (long unrecalled), ascending. The cutoff is derived in the service from the
	// dormancy threshold; the query compares time only (no decay math — constitution
	// §2). This is a search aid, not a delete/filter (GetUniverse stays whole).
	ListDormant(ctx context.Context, userID string, cutoff time.Time) ([]Memory, error)

	// TouchRecall re-ignites a star (sets memories.last_recalled_at=now); a no-op if
	// the (user, memory) pair is absent. Only the star is mutable; the
	// record is never touched (constitution §1).
	TouchRecall(ctx context.Context, userID, memoryID string) error

	// GetRecord reads the immutable original (records JOIN) for the recall panel;
	// returns ErrNotFound when the (user, memory) pair is absent.
	GetRecord(ctx context.Context, userID, memoryID string) (Record, error)

	// GetReshapeContext reads the PE/strength input for a reconsolidation step
	// (spec 23): the star's current reshaping state, embedding, co-recall total and
	// age. Returns ErrNotFound when the (user, memory) pair has no star+embedding.
	GetReshapeContext(ctx context.Context, userID, memoryID string) (ReshapeContext, error)

	// ListDirectNeighbors returns the 1-hop neighbor ids over memory_links (spec 23,
	// content-limited reshaping scope). Empty when the star is isolated.
	ListDirectNeighbors(ctx context.Context, userID, memoryID string) ([]string, error)

	// ReshapeStar applies the new cumulative reshaping state (version++) AND appends one
	// variant row to the append-only log IN ONE TRANSACTION, so version and the log can
	// never diverge. Only the mutable star + the append-only log change; the original
	// record is never touched (constitution §1·§2). The evolution id is server-generated.
	ReshapeStar(ctx context.Context, userID, memoryID string, st ReshapeState, snap EvolutionSnapshot) error

	// GetEvolutionHistory reads a star's variant log, version ascending (spec 23; UI
	// is spec 24).
	GetEvolutionHistory(ctx context.Context, userID, memoryID string) ([]EvolutionSnapshot, error)
}
