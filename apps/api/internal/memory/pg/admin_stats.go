package pg

import (
	"context"

	"github.com/cosimosi/api/internal/memory"
)

// The non-content aggregate reads the admin console consumes (the admin console). Per-user counts are the
// user's diary/episodic memory totals — COUNTS only, never content ([I2]); the job-queue counts are a global
// operator health read. These are memory-owned reads (memory owns diaries/episodic_memories/jobs);
// the admin context reaches them through composition-root ports, never by querying these tables.

// UserContentCountsByUserIDs returns diary and live episodic-memory totals for all requested users
// in one grouped query. Users with no content are omitted; the composition adapter supplies their
// explicit zero default while translating to admin's consumer-owned type.
func (s Store) UserContentCountsByUserIDs(ctx context.Context, userIDs []string) (map[string]memory.ContentCounts, error) {
	if s.queries == nil {
		return nil, ErrQueriesRequired
	}
	rows, err := s.queries.CountUserContentByUserIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}
	counts := make(map[string]memory.ContentCounts, len(rows))
	for _, row := range rows {
		counts[row.UserID] = memory.ContentCounts{
			Diaries:          row.DiaryCount,
			EpisodicMemories: row.EpisodicMemoryCount,
		}
	}
	return counts, nil
}

// JobStatusCounts returns the queue's row count per status (pending/running/done/failed).
func (s Store) JobStatusCounts(ctx context.Context) (map[string]int64, error) {
	if s.queries == nil {
		return nil, ErrQueriesRequired
	}
	rows, err := s.queries.CountJobsByStatus(ctx)
	if err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	return counts, nil
}

// DeadLetteredJobs counts terminally-failed jobs that exhausted their retry budget.
func (s Store) DeadLetteredJobs(ctx context.Context, maxAttempts int32) (int64, error) {
	if s.queries == nil {
		return 0, ErrQueriesRequired
	}
	return s.queries.CountDeadLetteredJobs(ctx, maxAttempts)
}
