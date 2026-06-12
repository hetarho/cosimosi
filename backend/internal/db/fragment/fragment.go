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
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"github.com/cosimosi/backend/internal/db/gen"
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
		memoryID, err := newID()
		if err != nil {
			return nil, err
		}
		if _, err := q.InsertMemory(ctx, gen.InsertMemoryParams{
			ID:            memoryID,
			UserID:        userID,
			RecordID:      recordID,
			Mood:          strToDB(s.Mood),
			Intensity:     f32ToDB(s.Intensity),
			FragmentIndex: int32(s.Index),
			FragmentText:  strToDB(s.Text),
			Valence:       f32ToDB(s.Valence),
		}); err != nil {
			return nil, fmt.Errorf("insert fragment %d: %w", s.Index, err)
		}
		jobID, err := newID()
		if err != nil {
			return nil, err
		}
		if err := q.EnqueueEmbedJob(ctx, gen.EnqueueEmbedJobParams{ID: jobID, MemoryID: &memoryID}); err != nil {
			return nil, fmt.Errorf("enqueue embed job for fragment %d: %w", s.Index, err)
		}
		ids = append(ids, memoryID)
	}

	// Within-event binding: every fragment pair, w=0.8 (a<b normalized in SQL).
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
			AIds: aIDs, BIds: bIDs, UserIds: userIDs,
		}); err != nil {
			return nil, fmt.Errorf("upsert intra-entry links: %w", err)
		}
	}
	return ids, nil
}

// newID is the server-authoritative id source (same recipe as the memory/job
// repositories): 16 bytes of crypto entropy, base64url without padding.
func newID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

// strToDB stores "" as NULL ("" = unset mood / no fragment text → r.body fallback).
func strToDB(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// f32ToDB stores the value as-is — a confirmed/extracted 0 is a real value here,
// not "unset" (unlike the record-level hint mappers).
func f32ToDB(v float64) *float32 {
	f := float32(v)
	return &f
}
