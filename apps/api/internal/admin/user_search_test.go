package admin

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"

	"github.com/cosimosi/api/internal/platform/values"
)

// pagedDirectory serves raw provider pages and records which ones the search asked for.
type pagedDirectory struct {
	pages     func(page int, pageSize int) []DirectoryAccount
	requested []int
}

func (d *pagedDirectory) ListUserPage(_ context.Context, page int, pageSize int) ([]DirectoryAccount, error) {
	d.requested = append(d.requested, page)
	return d.pages(page, pageSize), nil
}

func (*pagedDirectory) EmailFor(context.Context, string) (string, error) { return "", nil }

func fixedPages(pages ...[]DirectoryAccount) *pagedDirectory {
	return &pagedDirectory{pages: func(page int, _ int) []DirectoryAccount {
		if page < len(pages) {
			return pages[page]
		}
		return nil
	}}
}

func ids(ids ...string) []DirectoryAccount {
	accounts := make([]DirectoryAccount, 0, len(ids))
	for _, id := range ids {
		accounts = append(accounts, DirectoryAccount{UserID: id})
	}
	return accounts
}

func TestUserSearchTraversesProviderPagesWithPrefixPagination(t *testing.T) {
	t.Parallel()
	directory := fixedPages(
		[]DirectoryAccount{{UserID: "u1", Email: "first@example.com"}, {UserID: "u2", Email: "second@example.com"}},
		[]DirectoryAccount{{UserID: "u3", Email: "third@example.com"}, {UserID: "u4", Email: "fourth@example.com"}},
		[]DirectoryAccount{{UserID: "target-1", Email: "match@example.com"}},
	)
	accounts, hasMore, err := listDirectoryUsers(context.Background(), directory, 0, 2, " MATCH@ ")
	if err != nil {
		t.Fatalf("listDirectoryUsers: %v", err)
	}
	if hasMore || len(accounts) != 1 || accounts[0].UserID != "target-1" {
		t.Fatalf("search = %#v, hasMore %v; want later-page target and terminal", accounts, hasMore)
	}
	if want := []int{0, 1, 2}; !reflect.DeepEqual(directory.requested, want) {
		t.Fatalf("provider pages = %v, want %v", directory.requested, want)
	}
}

func TestUserSearchRequiresEmailOrIDPrefix(t *testing.T) {
	t.Parallel()
	directory := fixedPages([]DirectoryAccount{{UserID: "u1", Email: "no-match@example.com"}})
	accounts, hasMore, err := listDirectoryUsers(context.Background(), directory, 0, 2, "match")
	if err != nil || hasMore || len(accounts) != 0 {
		t.Fatalf("substring-only search = %#v, hasMore %v, err %v; want no match", accounts, hasMore, err)
	}
}

func TestUserSearchHasMoreBelongsToTheMatchStream(t *testing.T) {
	t.Parallel()
	pages := [][]DirectoryAccount{ids("match-1", "other-1"), ids("other-2", "match-2"), ids("match-3")}
	first, firstHasMore, err := listDirectoryUsers(context.Background(), fixedPages(pages...), 0, 2, "match")
	if err != nil || !firstHasMore || len(first) != 2 || first[0].UserID != "match-1" || first[1].UserID != "match-2" {
		t.Fatalf("first search page = %#v, hasMore %v, err %v", first, firstHasMore, err)
	}
	second, secondHasMore, err := listDirectoryUsers(context.Background(), fixedPages(pages...), 1, 2, "match")
	if err != nil || secondHasMore || len(second) != 1 || second[0].UserID != "match-3" {
		t.Fatalf("second search page = %#v, hasMore %v, err %v", second, secondHasMore, err)
	}
}

func TestUnfilteredExactlyFullLastPageIsTerminal(t *testing.T) {
	t.Parallel()
	directory := fixedPages(ids("u1", "u2"))
	accounts, hasMore, err := listDirectoryUsers(context.Background(), directory, 0, 2, "")
	if err != nil || hasMore || len(accounts) != 2 {
		t.Fatalf("list = %#v, hasMore %v, err %v; want two terminal users", accounts, hasMore, err)
	}
	if want := []int{0, 1}; !reflect.DeepEqual(directory.requested, want) {
		t.Fatalf("provider pages = %v, want lookahead %v", directory.requested, want)
	}
}

func TestUnfilteredPageUsesProviderLookahead(t *testing.T) {
	t.Parallel()
	accounts, hasMore, err := listDirectoryUsers(context.Background(), fixedPages(ids("u1", "u2"), ids("u3")), 0, 2, "   ")
	if err != nil || !hasMore || len(accounts) != 2 {
		t.Fatalf("empty-query list = %#v, hasMore %v, err %v; want first raw page + continuation", accounts, hasMore, err)
	}
}

// One full provider page of misses, or with the single prefix match at matchAt.
func providerPage(page int, pageSize int, matchAt int) []DirectoryAccount {
	accounts := make([]DirectoryAccount, 0, pageSize)
	for index := range pageSize {
		id := fmt.Sprintf("other-%d-%d", page, index)
		if index == matchAt {
			id = "match-last"
		}
		accounts = append(accounts, DirectoryAccount{UserID: id})
	}
	return accounts
}

// A prefix search's cost tracks the directory, not the query: nothing matching means nothing stops
// the walk. The breaker refuses the request rather than answering with a page that omits later
// matches, and it refuses after a bounded number of provider calls.
func TestUserSearchRefusesToWalkPastItsScanBound(t *testing.T) {
	t.Parallel()
	const pageSize = values.AdminUserListPageSize
	directory := &pagedDirectory{pages: func(page int, size int) []DirectoryAccount {
		return providerPage(page, size, -1)
	}}
	accounts, hasMore, err := listDirectoryUsers(context.Background(), directory, 0, pageSize, "match")
	if !errors.Is(err, ErrUserSearchTooBroad) {
		t.Fatalf("endless-walk search err = %v, want ErrUserSearchTooBroad", err)
	}
	if accounts != nil || hasMore {
		t.Fatalf("refused search returned %#v, hasMore %v; want no partial page", accounts, hasMore)
	}
	// One page past the bound is the lookahead that would have revealed a terminal directory.
	if want := values.AdminSearchScanMaxAccounts/pageSize + 1; len(directory.requested) != want {
		t.Fatalf("provider requests = %d, want the bound's %d", len(directory.requested), want)
	}
}

// The bound must not cut off a legitimate needle sitting at the far edge of a directory that ends
// exactly on it — the same exactly-full-last-page case the unfiltered path peeks past.
func TestUserSearchFindsTheLastAccountOfADirectoryEndingOnTheScanBound(t *testing.T) {
	t.Parallel()
	const pageSize = values.AdminUserListPageSize
	lastPage := values.AdminSearchScanMaxAccounts/pageSize - 1
	directory := &pagedDirectory{pages: func(page int, size int) []DirectoryAccount {
		switch {
		case page > lastPage:
			// Past the end: the empty page is what tells the walk this directory is terminal.
			return nil
		case page == lastPage:
			return providerPage(page, size, size-1)
		default:
			return providerPage(page, size, -1)
		}
	}}
	accounts, hasMore, err := listDirectoryUsers(context.Background(), directory, 0, pageSize, "match")
	if err != nil {
		t.Fatalf("terminal-directory search: %v", err)
	}
	if hasMore || len(accounts) != 1 || accounts[0].UserID != "match-last" {
		t.Fatalf("search = %#v, hasMore %v; want the final account and terminal", accounts, hasMore)
	}
}
