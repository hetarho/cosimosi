package admin

import (
	"context"
	"fmt"
	"strings"

	"github.com/cosimosi/api/internal/platform/values"
)

// listDirectoryUsers turns the directory's raw provider pages into the user list's pages. An
// unfiltered full page also peeks at the next provider page, so an exactly-full final page never
// advertises a phantom continuation.
//
// The provider has no portable prefix filter, so a search starts at the first provider page, skips
// matches belonging to earlier search pages, and scans until it has this page plus one lookahead
// match or reaches the provider's terminal short page. A search's cost therefore tracks the
// DIRECTORY size, not the query: the rarer the prefix, the further it walks, and a prefix matching
// nothing walks every account. So the scan is capped at values.AdminSearchScanMaxAccounts, and a
// request that would pass the cap fails with ErrUserSearchTooBroad rather than returning a page that
// silently omits later matches — a user list quietly missing a user reads as "this account does not
// exist". Wall-clock is bounded from the other side: every page honours the caller's context.
func listDirectoryUsers(
	ctx context.Context,
	directory AccountDirectory,
	page int,
	pageSize int,
	query string,
) ([]DirectoryAccount, bool, error) {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" {
		accounts, err := directory.ListUserPage(ctx, page, pageSize)
		if err != nil {
			return nil, false, err
		}
		if len(accounts) < pageSize {
			return accounts, false, nil
		}
		lookahead, err := directory.ListUserPage(ctx, page+1, pageSize)
		if err != nil {
			return nil, false, err
		}
		return accounts, len(lookahead) > 0, nil
	}

	// Keep only this search page plus one match. Provider pages stay fixed at pageSize, so the raw
	// page offsets are stable while the search stream is reconstructed.
	matchOffset := page * pageSize
	matches := make([]DirectoryAccount, 0, pageSize+1)
	seenMatches := 0
	scanned := 0
	for providerPage := 0; ; providerPage++ {
		if err := ctx.Err(); err != nil {
			return nil, false, err
		}
		accounts, err := directory.ListUserPage(ctx, providerPage, pageSize)
		if err != nil {
			return nil, false, err
		}
		for _, account := range accounts {
			if !accountHasPrefix(account, q) {
				continue
			}
			if seenMatches >= matchOffset {
				matches = append(matches, account)
				if len(matches) == pageSize+1 {
					return matches[:pageSize], true, nil
				}
			}
			seenMatches++
		}
		if len(accounts) < pageSize {
			return matches, false, nil
		}
		// Checked after the short-page exit, and on `>` rather than `>=`, so a directory whose last
		// full page lands exactly on the bound still gets the one page that reveals its end. The
		// breaker is for a walk that would keep going, not for one that just finished.
		scanned += len(accounts)
		if scanned > values.AdminSearchScanMaxAccounts {
			return nil, false, fmt.Errorf(
				"%w: scanned %d accounts for prefix search without resolving page %d",
				ErrUserSearchTooBroad, scanned, page,
			)
		}
	}
}

// accountHasPrefix matches a search against the start of the email or the user id, case-insensitively.
func accountHasPrefix(account DirectoryAccount, normalizedQuery string) bool {
	return strings.HasPrefix(strings.ToLower(account.Email), normalizedQuery) ||
		strings.HasPrefix(strings.ToLower(account.UserID), normalizedQuery)
}
