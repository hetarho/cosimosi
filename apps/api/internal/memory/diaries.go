package memory

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// GetDiaries use-case ([D2]) — the diary-reader archive read: one chronological page of immutable
// Diary entries, each carrying its split membership (the still-live episodic memories it launched,
// [D3]). It is free ([G4]): no clock advance ([T3]), no write, no Twinkle spend — it
// carries no SpendGate call. GET-eligible / NO_SIDE_EFFECTS (§2.7).

var (
	ErrDiaryPageTokenInvalid    = errors.New("get diaries page token is invalid")
	ErrDiarySearchQueryTooShort = errors.New("diary search query is too short")
	ErrDiaryMoodFilterInvalid   = errors.New("diary mood filter is invalid")
	ErrDiaryDateRangeInvalid    = errors.New("diary date range is invalid")
	ErrDiarySortInvalid         = errors.New("diary sort is invalid")
	ErrDiaryCountRangeInvalid   = errors.New("diary memory count range is invalid")
)

type DiarySort string

const (
	DiarySortNewest DiarySort = "NEWEST"
	DiarySortOldest DiarySort = "OLDEST"
)

type DiaryFilter struct {
	Keyword string
	Moods   []Mood
	From    *time.Time
	To      *time.Time
	// Inclusive bounds on the count of STILL-LIVE episodic memories a diary has. Pointers because zero
	// is a real bound — a diary whose every memory was let go still lists ([I1]) — so "no bound" cannot
	// be spelled 0.
	MinMemories *int
	MaxMemories *int
}

type DiaryQuery struct {
	Filter    DiaryFilter
	Sort      DiarySort
	PageSize  int
	PageToken string
}

// DiarySplitRef is one entry in a diary's split membership ([D3]): a still-live episodic memory the
// diary launched, named and mood-tagged (the client maps mood to a color [I3]).
type DiarySplitRef struct {
	EpisodicMemoryID string
	Name             string
	Mood             Mood
}

// DiaryEntry is one archived diary in the reader ([D2]): its immutable body ([I2][D4]), the date the
// user wrote it for, the universe-time its stars were launched at (all a diary's memories share it —
// nil when the diary launched none), and its split membership.
type DiaryEntry struct {
	ID                  string
	Body                string
	DiaryDate           time.Time
	CreatedUniverseTime *time.Time
	Memories            []DiarySplitRef
}

// DiaryPage is one keyset page of the archive plus the opaque cursor to the next (empty = last page).
type DiaryPage struct {
	Diaries       []DiaryEntry
	NextPageToken string
}

// DiaryCursor carries the ordering direction so a token cannot be reused after the user flips sort.
type DiaryCursor struct {
	DiaryDate time.Time
	ID        string
	Sort      DiarySort
}

// DiaryPageRow / DiarySplitRow are the reader port's domain-shaped rows (no proto/sqlc type crosses).
type DiaryPageRow struct {
	ID        string
	Body      string
	DiaryDate time.Time
}

type DiarySplitRow struct {
	DiaryID             string
	EpisodicMemoryID    string
	Name                string
	Mood                Mood
	CreatedUniverseTime time.Time
}

// DiaryReader is the diary archive's consumer-owned read port (§2.4). It exposes stored facts only;
// memory/pg implements it without leaking generated row types inward.
type DiaryReader interface {
	DiaryPage(ctx context.Context, scope platform.UserScope, filter DiaryFilter, sort DiarySort, cursor *DiaryCursor, limit int) ([]DiaryPageRow, error)
	// DiarySplitRefs returns the still-live split membership (deleted_at IS NULL) of the given diaries.
	DiarySplitRefs(ctx context.Context, scope platform.UserScope, diaryIDs []string) ([]DiarySplitRow, error)
	DiaryDays(ctx context.Context, scope platform.UserScope, from, to time.Time, cursor *DiaryCalendarCursor, limit int) ([]time.Time, error)
	DiaryDayMoodInputs(ctx context.Context, scope platform.UserScope, diaryDates []time.Time) ([]DiaryDayMoodInput, error)
}

// GetDiaries returns one page of the archive: fetch limit+1 rows to detect a next page, load the split
// refs of the page's diaries in one read, group them under each diary, and mint the next cursor. The
// page size is clamped to the configured maximum so a client cannot request an unbounded page. Free
// read — no clock, no spend (A5).
func (s *Service) GetDiaries(ctx context.Context, scope platform.UserScope, query DiaryQuery) (DiaryPage, error) {
	if scope.UserID() == "" {
		return DiaryPage{}, ErrScopeRequired
	}
	sort, err := normalizeDiarySort(query.Sort)
	if err != nil {
		return DiaryPage{}, err
	}
	filter, err := validateDiaryFilter(query.Filter)
	if err != nil {
		return DiaryPage{}, err
	}
	limit := query.PageSize
	if limit <= 0 || limit > values.DiaryReaderPageSize {
		limit = values.DiaryReaderPageSize
	}
	var cursor *DiaryCursor
	if query.PageToken != "" {
		decoded, decodeErr := decodeDiaryCursor(query.PageToken)
		if decodeErr != nil || decoded.Sort != sort {
			return DiaryPage{}, ErrDiaryPageTokenInvalid
		}
		cursor = &decoded
	}

	rows, err := s.diaries.DiaryPage(ctx, scope, filter, sort, cursor, limit+1)
	if err != nil {
		return DiaryPage{}, err
	}
	hasMore := len(rows) > limit
	if hasMore {
		rows = rows[:limit]
	}

	ids := make([]string, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	var refs []DiarySplitRow
	if len(ids) > 0 {
		refs, err = s.diaries.DiarySplitRefs(ctx, scope, ids)
		if err != nil {
			return DiaryPage{}, err
		}
	}
	byDiary := make(map[string][]DiarySplitRow, len(rows))
	for _, ref := range refs {
		byDiary[ref.DiaryID] = append(byDiary[ref.DiaryID], ref)
	}

	entries := make([]DiaryEntry, 0, len(rows))
	for _, row := range rows {
		entry := DiaryEntry{ID: row.ID, Body: row.Body, DiaryDate: row.DiaryDate}
		if diaryRefs := byDiary[row.ID]; len(diaryRefs) > 0 {
			// All of a diary's memories launched together, so they share created_universe_time.
			launched := diaryRefs[0].CreatedUniverseTime
			entry.CreatedUniverseTime = &launched
			entry.Memories = make([]DiarySplitRef, 0, len(diaryRefs))
			for _, ref := range diaryRefs {
				entry.Memories = append(entry.Memories, DiarySplitRef{
					EpisodicMemoryID: ref.EpisodicMemoryID,
					Name:             ref.Name,
					Mood:             ref.Mood,
				})
			}
		}
		entries = append(entries, entry)
	}

	var next string
	if hasMore && len(rows) > 0 {
		last := rows[len(rows)-1]
		next = encodeDiaryCursor(DiaryCursor{DiaryDate: last.DiaryDate, ID: last.ID, Sort: sort})
	}
	return DiaryPage{Diaries: entries, NextPageToken: next}, nil
}

func encodeDiaryCursor(cursor DiaryCursor) string {
	raw := cursor.DiaryDate.Format(time.DateOnly) + "|" + cursor.ID + "|" + strings.ToLower(string(cursor.Sort))
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

func decodeDiaryCursor(token string) (DiaryCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return DiaryCursor{}, err
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 3 || parts[1] == "" {
		return DiaryCursor{}, errors.New("malformed diary cursor")
	}
	parsed, err := time.Parse(time.DateOnly, parts[0])
	if err != nil {
		return DiaryCursor{}, err
	}
	sort, err := normalizeDiarySort(DiarySort(strings.ToUpper(parts[2])))
	if err != nil {
		return DiaryCursor{}, err
	}
	return DiaryCursor{DiaryDate: parsed, ID: parts[1], Sort: sort}, nil
}

func normalizeDiarySort(sort DiarySort) (DiarySort, error) {
	switch sort {
	case "", DiarySortNewest:
		return DiarySortNewest, nil
	case DiarySortOldest:
		return DiarySortOldest, nil
	default:
		return "", ErrDiarySortInvalid
	}
}

func validateDiaryFilter(filter DiaryFilter) (DiaryFilter, error) {
	filter.Keyword = strings.TrimSpace(filter.Keyword)
	if filter.Keyword != "" && len([]rune(filter.Keyword)) < values.DiaryReaderSearchMinQueryLength {
		return DiaryFilter{}, ErrDiarySearchQueryTooShort
	}
	validMoods := make(map[Mood]struct{}, len(AllMoods()))
	for _, mood := range AllMoods() {
		validMoods[mood] = struct{}{}
	}
	for _, mood := range filter.Moods {
		if _, ok := validMoods[mood]; !ok {
			return DiaryFilter{}, ErrDiaryMoodFilterInvalid
		}
	}
	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		return DiaryFilter{}, ErrDiaryDateRangeInvalid
	}
	// A negative bound and an inverted range are both unsatisfiable, and the reader cannot have meant
	// either — refused rather than silently clamped to "everything", which would answer a question
	// nobody asked.
	if filter.MinMemories != nil && *filter.MinMemories < 0 {
		return DiaryFilter{}, ErrDiaryCountRangeInvalid
	}
	if filter.MaxMemories != nil && *filter.MaxMemories < 0 {
		return DiaryFilter{}, ErrDiaryCountRangeInvalid
	}
	if filter.MinMemories != nil && filter.MaxMemories != nil && *filter.MinMemories > *filter.MaxMemories {
		return DiaryFilter{}, ErrDiaryCountRangeInvalid
	}
	if filter.Keyword != "" {
		filter.Keyword = escapeDiaryLikePattern(filter.Keyword)
	}
	return filter, nil
}

func escapeDiaryLikePattern(keyword string) string {
	return strings.NewReplacer(
		`\`, `\\`,
		`%`, `\%`,
		`_`, `\_`,
	).Replace(keyword)
}
