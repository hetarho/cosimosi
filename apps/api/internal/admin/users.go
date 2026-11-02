package admin

import (
	"context"

	"github.com/cosimosi/api/internal/platform/values"
)

// ListUsers returns one page of account metadata joined with balance, non-content counts, and
// admin status. Metadata only — no memory content is read ([I2]). pageSize <= 0 uses the
// configured default; larger requests are clamped to the same configured ceiling so provider and
// batch allocations stay bounded.
func (s *Service) ListUsers(ctx context.Context, page int, pageSize int, query string) (UserPage, error) {
	if pageSize <= 0 || pageSize > values.AdminUserListPageSize {
		pageSize = values.AdminUserListPageSize
	}
	if page < 0 {
		page = 0
	}
	accounts, hasMore, err := listDirectoryUsers(ctx, s.directory, page, pageSize, query)
	if err != nil {
		return UserPage{}, err
	}
	promoted, err := s.store.ListPromoted(ctx)
	if err != nil {
		return UserPage{}, err
	}
	userIDs := make([]string, 0, len(accounts))
	for _, account := range accounts {
		userIDs = append(userIDs, account.UserID)
	}
	balances := map[string]Balance{}
	stats := map[string]Stats{}
	if len(userIDs) > 0 {
		balances, err = s.stardust.Balances(ctx, userIDs)
		if err != nil {
			return UserPage{}, err
		}
		stats, err = s.memStats.Counts(ctx, userIDs)
		if err != nil {
			return UserPage{}, err
		}
	}
	promotedSet := make(map[string]struct{}, len(promoted))
	for _, p := range promoted {
		promotedSet[p.UserID] = struct{}{}
	}
	users := make([]UserSummary, 0, len(accounts))
	for _, acct := range accounts {
		isSeed := s.isSeedIdentity(acct.UserID, acct.Email)
		_, isPromoted := promotedSet[acct.UserID]
		stat := stats[acct.UserID] // absent memory rows explicitly mean zero counts
		users = append(users, UserSummary{
			UserID:              acct.UserID,
			Email:               acct.Email,
			SignupAt:            acct.SignupAt,
			IsAdmin:             isSeed || isPromoted,
			IsSeedAdmin:         isSeed,
			Balance:             balances[acct.UserID],
			DiaryCount:          stat.DiaryCount,
			EpisodicMemoryCount: stat.EpisodicMemoryCount,
		})
	}
	return UserPage{Users: users, Page: page, HasMore: hasMore}, nil
}
