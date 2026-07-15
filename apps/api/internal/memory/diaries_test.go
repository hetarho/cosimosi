package memory

import (
	"context"
	"errors"
	"testing"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// fakeDiaryReader holds the full reverse-chronological diary set and honors the cursor + limit exactly
// as the keyset SQL would, so the use-case's pagination/hasMore/next-token logic is exercised end to end.
type fakeDiaryReader struct {
	pages      []DiaryPageRow
	splits     map[string][]DiarySplitRow
	pageCalls  int
	splitCalls int
	lastLimit  int
}

func (f *fakeDiaryReader) DiaryPage(_ context.Context, scope platform.UserScope, cursor *DiaryCursor, limit int) ([]DiaryPageRow, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	f.pageCalls++
	f.lastLimit = limit
	start := 0
	if cursor != nil {
		for i, row := range f.pages {
			if row.DiaryDate.Equal(cursor.DiaryDate) && row.ID == cursor.ID {
				start = i + 1
				break
			}
		}
	}
	end := start + limit
	if end > len(f.pages) {
		end = len(f.pages)
	}
	return append([]DiaryPageRow(nil), f.pages[start:end]...), nil
}

func (f *fakeDiaryReader) DiarySplitRefs(_ context.Context, scope platform.UserScope, diaryIDs []string) ([]DiarySplitRow, error) {
	if scope.UserID() == "" {
		return nil, errors.New("scope missing")
	}
	f.splitCalls++
	var out []DiarySplitRow
	for _, id := range diaryIDs {
		out = append(out, f.splits[id]...)
	}
	return out, nil
}

func TestGetDiariesReturnsReverseChronPageWithSplitRefs(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.diaries.pages = []DiaryPageRow{
		{ID: "d2", Body: "the newer entry", DiaryDate: day(2026, 6, 10)},
		{ID: "d1", Body: "the older, past-dated entry", DiaryDate: day(2026, 6, 1)},
	}
	fixture.diaries.splits = map[string][]DiarySplitRow{
		"d2": {
			{DiaryID: "d2", EpisodicMemoryID: "m1", Name: "the market", Mood: MoodJoy, CreatedUniverseTime: day(2026, 6, 12)},
			{DiaryID: "d2", EpisodicMemoryID: "m2", Name: "the walk", Mood: MoodCalm, CreatedUniverseTime: day(2026, 6, 12)},
		},
		// d1 is memory-less (past-dated, no memory launched).
	}

	page, err := fixture.service.GetDiaries(context.Background(), testScope(t), 10, "")
	if err != nil {
		t.Fatalf("GetDiaries failed: %v", err)
	}
	if len(page.Diaries) != 2 || page.NextPageToken != "" {
		t.Fatalf("page = %d entries, token %q; want 2 entries and no next page", len(page.Diaries), page.NextPageToken)
	}
	// A1/A2: reverse-chronological, verbatim body.
	if page.Diaries[0].ID != "d2" || page.Diaries[0].Body != "the newer entry" {
		t.Fatalf("first entry = %+v, want the newer diary verbatim", page.Diaries[0])
	}
	// A4: the split membership + a derived created_universe_time from the (shared) launch time.
	if len(page.Diaries[0].Memories) != 2 || page.Diaries[0].Memories[0].Name != "the market" {
		t.Fatalf("d2 memories = %+v, want the 2 split refs", page.Diaries[0].Memories)
	}
	if page.Diaries[0].CreatedUniverseTime == nil || !page.Diaries[0].CreatedUniverseTime.Equal(day(2026, 6, 12)) {
		t.Fatalf("d2 created_universe_time = %v, want the memories' launch date", page.Diaries[0].CreatedUniverseTime)
	}
	// A4/[I1]: a memory-less diary still lists, with zero chips and no launch time.
	if len(page.Diaries[1].Memories) != 0 || page.Diaries[1].CreatedUniverseTime != nil {
		t.Fatalf("d1 = %+v, want a memory-less record (no chips, nil launch time)", page.Diaries[1])
	}
	// A5: a listing read never spends or advances the clock.
	if len(fixture.spendGate.intents) != 0 || fixture.launches.txCount != 0 {
		t.Fatal("GetDiaries spent or wrote, want a free read")
	}
}

func TestGetDiariesPaginatesWithKeysetToken(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	fixture.diaries.pages = []DiaryPageRow{
		{ID: "d3", Body: "three", DiaryDate: day(2026, 6, 30)},
		{ID: "d2", Body: "two", DiaryDate: day(2026, 6, 20)},
		{ID: "d1", Body: "one", DiaryDate: day(2026, 6, 10)},
	}

	first, err := fixture.service.GetDiaries(context.Background(), testScope(t), 2, "")
	if err != nil {
		t.Fatalf("first page failed: %v", err)
	}
	if len(first.Diaries) != 2 || first.NextPageToken == "" {
		t.Fatalf("first page = %d entries, token %q; want 2 + a next token", len(first.Diaries), first.NextPageToken)
	}
	if first.Diaries[0].ID != "d3" || first.Diaries[1].ID != "d2" {
		t.Fatalf("first page order = [%s, %s], want [d3, d2]", first.Diaries[0].ID, first.Diaries[1].ID)
	}
	// A limit+1 fetch detects the next page without over-returning.
	if fixture.diaries.lastLimit != 3 {
		t.Fatalf("page fetch limit = %d, want page_size+1 = 3", fixture.diaries.lastLimit)
	}

	second, err := fixture.service.GetDiaries(context.Background(), testScope(t), 2, first.NextPageToken)
	if err != nil {
		t.Fatalf("second page failed: %v", err)
	}
	if len(second.Diaries) != 1 || second.NextPageToken != "" {
		t.Fatalf("second page = %d entries, token %q; want the last 1 + no token", len(second.Diaries), second.NextPageToken)
	}
	if second.Diaries[0].ID != "d1" {
		t.Fatalf("second page = %s, want d1 (continued strictly after the cursor)", second.Diaries[0].ID)
	}
}

func TestGetDiariesClampsPageSizeToTheConfiguredMax(t *testing.T) {
	t.Parallel()
	for _, requested := range []int{0, -5, values.DiaryReaderPageSize + 100} {
		fixture := newFixture(t)
		if _, err := fixture.service.GetDiaries(context.Background(), testScope(t), requested, ""); err != nil {
			t.Fatalf("GetDiaries(%d) failed: %v", requested, err)
		}
		// The clamp is invisible on the wire but bounds the fetch: default+1 for the has-more probe.
		if fixture.diaries.lastLimit != values.DiaryReaderPageSize+1 {
			t.Fatalf("page_size %d → fetch limit %d, want the clamped default+1 = %d", requested, fixture.diaries.lastLimit, values.DiaryReaderPageSize+1)
		}
	}
}

func TestGetDiariesRejectsBadTokenAndScope(t *testing.T) {
	t.Parallel()
	fixture := newFixture(t)
	if _, err := fixture.service.GetDiaries(context.Background(), testScope(t), 10, "!!!not-base64!!!"); !errors.Is(err, ErrDiaryPageTokenInvalid) {
		t.Fatalf("bad token err = %v, want ErrDiaryPageTokenInvalid", err)
	}
	if _, err := fixture.service.GetDiaries(context.Background(), platform.UserScope{}, 10, ""); !errors.Is(err, ErrScopeRequired) {
		t.Fatalf("empty scope err = %v, want ErrScopeRequired", err)
	}
}

func TestDiaryCursorRoundTrips(t *testing.T) {
	t.Parallel()
	cursor := DiaryCursor{DiaryDate: day(2026, 6, 15), ID: "diary-42"}
	decoded, err := decodeDiaryCursor(encodeDiaryCursor(cursor))
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if !decoded.DiaryDate.Equal(cursor.DiaryDate) || decoded.ID != cursor.ID {
		t.Fatalf("round-trip = %+v, want %+v", decoded, cursor)
	}
}
