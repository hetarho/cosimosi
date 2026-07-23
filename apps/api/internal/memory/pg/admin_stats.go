package pg

import "context"

// The non-content aggregate reads the admin console consumes (the admin console). Per-user counts are the
// user's diary/episodic memory totals — COUNTS only, never content ([I2]); the job-queue counts are a global
// operator health read. These are memory-owned reads (memory owns diaries/episodic_memories/jobs);
// the admin context reaches them through composition-root ports, never by querying these tables.

// UserContentCounts returns a user's diary count and live (non-deleted) episodic memory count.
func (s Store) UserContentCounts(ctx context.Context, userID string) (diaries int64, stars int64, err error) {
	if s.queries == nil {
		return 0, 0, ErrQueriesRequired
	}
	diaries, err = s.queries.CountUserDiaries(ctx, userID)
	if err != nil {
		return 0, 0, err
	}
	stars, err = s.queries.CountUserStars(ctx, userID)
	if err != nil {
		return 0, 0, err
	}
	return diaries, stars, nil
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
