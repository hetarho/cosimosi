package link

import (
	"context"

	"github.com/cosimosi/backend/internal/memory"
)

// Service is the read-only synapse service. It satisfies memory.LinkReader, so
// the memory service can compose a Universe without importing this package.
type Service struct {
	repo Repository
}

// NewService builds the synapse read service over a Repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListByUser returns every synapse for the user (dormant included).
func (s *Service) ListByUser(ctx context.Context, userID string) ([]memory.Synapse, error) {
	return s.repo.ListByUser(ctx, userID)
}

// ReinforceLinks normalizes each delta to an a<b pair, sums duplicates within the
// batch, drops self-pairs, then persists idempotently by batchID (spec 11). The
// a<b here is byte-order (just to dedup the map key); the SQL re-normalizes under
// the DB collation.
func (s *Service) ReinforceLinks(ctx context.Context, userID, batchID string, deltas []memory.LinkDelta) error {
	if len(deltas) == 0 {
		return nil
	}
	sums := make(map[[2]string]float64, len(deltas))
	for _, d := range deltas {
		a, b := d.AID, d.BID
		if a == "" || b == "" || a == b {
			continue // skip empty/self pairs
		}
		if a > b {
			a, b = b, a
		}
		sums[[2]string{a, b}] += d.DeltaWeight
	}
	if len(sums) == 0 {
		return nil
	}
	aIDs := make([]string, 0, len(sums))
	bIDs := make([]string, 0, len(sums))
	ds := make([]float64, 0, len(sums))
	for pair, w := range sums {
		aIDs = append(aIDs, pair[0])
		bIDs = append(bIDs, pair[1])
		ds = append(ds, w)
	}
	return s.repo.ReinforceLinks(ctx, userID, batchID, aIDs, bIDs, ds)
}
