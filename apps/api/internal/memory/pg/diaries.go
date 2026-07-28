package pg

import (
	"context"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/jackc/pgx/v5/pgtype"
)

func (s Store) DiaryPage(
	ctx context.Context,
	scope platform.UserScope,
	filter memory.DiaryFilter,
	sort memory.DiarySort,
	cursor *memory.DiaryCursor,
	limit int,
) ([]memory.DiaryPageRow, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	var keyword pgtype.Text
	if filter.Keyword != "" {
		keyword = pgText(&filter.Keyword)
	}
	moods := make([]string, len(filter.Moods))
	for i, mood := range filter.Moods {
		moods[i] = string(mood)
	}
	cursorDate := pgtype.Date{}
	cursorID := pgtype.Text{}
	if cursor != nil {
		cursorDate = pgDate(cursor.DiaryDate)
		cursorID = pgText(&cursor.ID)
	}

	if sort == memory.DiarySortOldest {
		rows, err := s.queries.ListDiariesPageAsc(ctx, dbgen.ListDiariesPageAscParams{
			UserID:     scope.UserID(),
			CursorDate: cursorDate,
			CursorID:   cursorID,
			FromDate:   pgDatePtr(filter.From),
			ToDate:     pgDatePtr(filter.To),
			Keyword:    keyword,
			Moods:      moods,
			PageLimit:  int32(limit),
		})
		if err != nil {
			return nil, err
		}
		diaries := make([]memory.DiaryPageRow, 0, len(rows))
		for _, row := range rows {
			diaries = append(diaries, memory.DiaryPageRow{
				ID:        row.ID,
				Body:      row.Body,
				DiaryDate: dateValue(row.DiaryDate),
			})
		}
		return diaries, nil
	}

	rows, err := s.queries.ListDiariesPageDesc(ctx, dbgen.ListDiariesPageDescParams{
		UserID:     scope.UserID(),
		CursorDate: cursorDate,
		CursorID:   cursorID,
		FromDate:   pgDatePtr(filter.From),
		ToDate:     pgDatePtr(filter.To),
		Keyword:    keyword,
		Moods:      moods,
		PageLimit:  int32(limit),
	})
	if err != nil {
		return nil, err
	}
	diaries := make([]memory.DiaryPageRow, 0, len(rows))
	for _, row := range rows {
		diaries = append(diaries, memory.DiaryPageRow{
			ID:        row.ID,
			Body:      row.Body,
			DiaryDate: dateValue(row.DiaryDate),
		})
	}
	return diaries, nil
}

// DiarySplitRefs implements memory.DiaryReader: the still-live split membership (deleted_at IS NULL) of
// the given diaries in one read. Per-user scoped.
func (s Store) DiarySplitRefs(ctx context.Context, scope platform.UserScope, diaryIDs []string) ([]memory.DiarySplitRow, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListDiarySplitRefs(ctx, dbgen.ListDiarySplitRefsParams{
		UserID:   scope.UserID(),
		DiaryIds: diaryIDs,
	})
	if err != nil {
		return nil, err
	}
	refs := make([]memory.DiarySplitRow, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, memory.DiarySplitRow{
			DiaryID:             row.DiaryID,
			EpisodicMemoryID:    row.ID,
			Name:                row.Name,
			Mood:                memory.Mood(row.Mood),
			CreatedUniverseTime: dateValue(row.CreatedUniverseTime),
		})
	}
	return refs, nil
}

func (s Store) DiaryDays(
	ctx context.Context,
	scope platform.UserScope,
	from, to time.Time,
	cursor *memory.DiaryCalendarCursor,
	limit int,
) ([]time.Time, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	params := dbgen.ListDiaryDaysInWindowParams{
		UserID:    scope.UserID(),
		FromDate:  pgDate(from),
		ToDate:    pgDate(to),
		PageLimit: int32(limit),
	}
	if cursor != nil {
		params.CursorDate = pgDate(cursor.DiaryDate)
	}
	rows, err := s.queries.ListDiaryDaysInWindow(ctx, params)
	if err != nil {
		return nil, err
	}
	dates := make([]time.Time, 0, len(rows))
	for _, row := range rows {
		dates = append(dates, dateValue(row))
	}
	return dates, nil
}

func (s Store) DiaryDayMoodInputs(
	ctx context.Context,
	scope platform.UserScope,
	diaryDates []time.Time,
) ([]memory.DiaryDayMoodInput, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	dates := make([]pgtype.Date, 0, len(diaryDates))
	for _, date := range diaryDates {
		dates = append(dates, pgDate(date))
	}
	rows, err := s.queries.ListDiaryDayMoodInputs(ctx, dbgen.ListDiaryDayMoodInputsParams{
		UserID:     scope.UserID(),
		DiaryDates: dates,
	})
	if err != nil {
		return nil, err
	}
	inputs := make([]memory.DiaryDayMoodInput, 0, len(rows))
	for _, row := range rows {
		inputs = append(inputs, memory.DiaryDayMoodInput{
			DiaryDate:    dateValue(row.DiaryDate),
			Mood:         memory.Mood(row.Mood),
			BaseStrength: float64(row.BaseStrength),
			RecallCount:  row.RecallCount,
		})
	}
	return inputs, nil
}
