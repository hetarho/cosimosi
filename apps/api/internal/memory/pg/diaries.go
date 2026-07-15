package pg

import (
	"context"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// DiaryPage implements memory.DiaryReader: one reverse-chronological keyset page of the user's
// immutable diaries ([D2]). A nil cursor starts at the newest entry; otherwise the query continues
// strictly before the (diary_date, id) tuple. Per-user scoped.
func (s Store) DiaryPage(ctx context.Context, scope platform.UserScope, cursor *memory.DiaryCursor, limit int) ([]memory.DiaryPageRow, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	params := dbgen.ListDiariesPageParams{
		UserID:    scope.UserID(),
		PageLimit: int32(limit),
	}
	if cursor != nil {
		params.CursorDate = pgDate(cursor.DiaryDate)
		params.CursorID = pgText(&cursor.ID)
	}
	rows, err := s.queries.ListDiariesPage(ctx, params)
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
