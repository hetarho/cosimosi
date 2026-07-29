package achievement

import (
	"context"
	"fmt"

	"github.com/cosimosi/api/internal/platform"
)

// The achievement read: the whole catalog answered for one caller, progress derived at read time
// (§2.9 #3), plus the withdrawal purge leg. RecordProgress and ClaimAchievement belong to the
// tracking use-case — nothing here can record progress.

// AchievementServiceDeps carries a store and the two reward legs — **no clock, no Now func, no
// time-typed field, no id minter**. Compare twinkle.ServiceDeps, which DOES carry a zone reader
// because a daily reset window needs one; achievement has no legitimate use for a clock, so it is
// not given one and a real-time condition stays unexpressible ([A1a]).
type AchievementServiceDeps struct {
	Repo Repo
	// Twinkle and Ornaments are the claim's two payout legs. Both are required unconditionally, in
	// every environment: a service that records claims it cannot pay would strand rewards.
	Twinkle   TwinkleGranter
	Ornaments OrnamentGranter
}

type Service struct {
	repo      Repo
	twinkle   TwinkleGranter
	ornaments OrnamentGranter
}

func NewService(deps AchievementServiceDeps) (*Service, error) {
	if deps.Repo == nil {
		return nil, ErrRepoRequired
	}
	if deps.Twinkle == nil || deps.Ornaments == nil {
		return nil, ErrGrantersRequired
	}
	return &Service{repo: deps.Repo, twinkle: deps.Twinkle, ornaments: deps.Ornaments}, nil
}

// ListAchievements answers EVERY catalog row for the caller, in the catalog's own server-fixed
// order. A user with no rows in either table gets the full catalog at zero progress — absence of
// rows is a state, not an error ([A4][U9]).
func (s *Service) ListAchievements(ctx context.Context, scope platform.UserScope) ([]Entry, error) {
	if scope.UserID() == "" {
		return nil, ErrScopeRequired
	}
	// Progress is read FIRST, and the order is load-bearing. These are two statements, so a
	// recorder committing between them is visible to one and not the other. Reading the progress
	// rows first means the counter read that follows can only be a LATER snapshot — and counters
	// are monotonic, so any achievement whose row already exists must also satisfy
	// counter >= target in that later read. The contradiction "achieved, 0/5" is therefore
	// unrepresentable rather than merely unlikely; the worst a race can produce is a just-achieved
	// row whose achieved_at arrives on the next read.
	progress, err := s.repo.ListProgress(ctx, scope)
	if err != nil {
		return nil, fmt.Errorf("list achievement progress: %w", err)
	}
	counters, err := s.repo.ListCounters(ctx, scope)
	if err != nil {
		return nil, fmt.Errorf("list achievement counters: %w", err)
	}
	recorded := make(map[string]ProgressRecord, len(progress))
	for _, record := range progress {
		recorded[record.AchievementID] = record
	}

	entries := make([]Entry, 0, len(catalog))
	for _, row := range catalog {
		counter := counters[row.Condition.Counter]
		entry := Entry{
			Achievement: row,
			Progress:    Progress(counter, row.Condition.Target),
			Achieved:    Achieved(counter, row.Condition.Target),
		}
		if record, ok := recorded[row.ID]; ok {
			// The stored fact wins over the derived one: an achieved_at row is never un-achieved,
			// whatever the counter reads ([I1]). Progress is filled to the target with it, so the
			// pair cannot contradict itself after a target is raised in a later release — the row
			// says this was earned, and 200/500 beside "achieved" would read as a bug.
			entry.Achieved = true
			entry.Progress = row.Condition.Target
			entry.AchievedAt = record.AchievedAt
			entry.Claimed = record.ClaimedAt != nil
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// PurgeUser deletes the withdrawing user's own counters and progress, and is the only delete path
// this context has ([I1][U1]).
func (s *Service) PurgeUser(ctx context.Context, scope platform.UserScope) error {
	if err := purgeUser(ctx, s.repo, scope); err != nil {
		return fmt.Errorf("purge user achievements: %w", err)
	}
	return nil
}
