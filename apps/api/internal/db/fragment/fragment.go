// Package fragment owns the fragment fan-out core (spec 21): persisting one
// diary entry's segments as fragment stars. It sits at the db layer (operates
// on gen.Queries) so BOTH writers — the async extract worker (internal/job)
// and the synchronous user-confirmed path (internal/memory RecordMemory) —
// share one implementation and can never drift in graph topology. Neither of
// those packages may import the other (the ai test suite imports memory, and
// job imports ai — a memory→job import would cycle in tests), which is why
// this core lives in a third package.
package fragment

import (
	"context"
	"fmt"

	dbutil "github.com/cosimosi/backend/internal/db"
	"github.com/cosimosi/backend/internal/db/gen"
	"github.com/cosimosi/backend/internal/platform/id"
	"github.com/cosimosi/backend/internal/values"
)

// Segment is one event-boundary fragment to persist as a star (spec 21):
// its text and AI-detected (or user-confirmed) emotion.
type Segment struct {
	Index     int
	Text      string
	Mood      string // 13-value lowercase mood, "" = unset
	Intensity float64
	Valence   float64
}

// FanOutTx persists one entry's segments as fragment stars on the caller's
// queries handle (the CALLER owns the transaction and any idempotency fences):
// N InsertMemory + N EnqueueEmbedJob + the all-pairs within-event binding
// links (w=0.8, a<b normalized in SQL).
func FanOutTx(ctx context.Context, q *gen.Queries, recordID, userID string, segs []Segment) ([]string, error) {
	ids := make([]string, 0, len(segs))
	for _, s := range segs {
		memoryID, err := id.New()
		if err != nil {
			return nil, err
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{
			ID:            memoryID,
			UserID:        userID,
			RecordID:      recordID,
			Mood:          dbutil.StringPtr(s.Mood),
			Intensity:     dbutil.Float32Ptr(s.Intensity),
			FragmentIndex: int32(s.Index),
			FragmentText:  dbutil.StringPtr(s.Text),
			Valence:       dbutil.Float32Ptr(s.Valence),
		}); err != nil {
			return nil, fmt.Errorf("insert fragment %d: %w", s.Index, err)
		}
		jobID, err := id.New()
		if err != nil {
			return nil, err
		}
		if err := q.EnqueueEmbedJob(ctx, gen.EnqueueEmbedJobParams{ID: jobID, MemoryID: &memoryID}); err != nil {
			return nil, fmt.Errorf("enqueue embed job for fragment %d: %w", s.Index, err)
		}
		ids = append(ids, memoryID)
	}

	// Within-event binding: every fragment pair, w=connection.intra_entry_weight
	// (a<b normalized in SQL). Weight sourced from spec/values.yaml (generated).
	if len(ids) >= 2 {
		var aIDs, bIDs, userIDs []string
		for i := 0; i < len(ids); i++ {
			for k := i + 1; k < len(ids); k++ {
				aIDs = append(aIDs, ids[i])
				bIDs = append(bIDs, ids[k])
				userIDs = append(userIDs, userID)
			}
		}
		if err := q.BatchUpsertIntraEntryLinks(ctx, gen.BatchUpsertIntraEntryLinksParams{
			Weight: values.ConnectionIntraEntryWeight, AIds: aIDs, BIds: bIDs, UserIds: userIDs,
		}); err != nil {
			return nil, fmt.Errorf("upsert intra-entry links: %w", err)
		}
	}
	return ids, nil
}
