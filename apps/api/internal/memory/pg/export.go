package pg

import (
	"context"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// DiariesForExport implements memory.ExportReader: the user's retained immutable diaries, diary-date
// ordered. diaries has no deleted_at — the Diary is never soft-deleted ([I2]) — so a past-dated
// diary with no live memory is still returned (A8). Per-user scoped.
func (s Store) DiariesForExport(ctx context.Context, scope platform.UserScope) ([]memory.ExportDiary, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListDiariesForExport(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	diaries := make([]memory.ExportDiary, 0, len(rows))
	for _, row := range rows {
		diaries = append(diaries, memory.ExportDiary{
			ID:        row.ID,
			Body:      row.Body,
			DiaryDate: dateValue(row.DiaryDate),
		})
	}
	return diaries, nil
}

// LiveMemoriesForExport implements memory.ExportReader: the user's still-live memories (deleted_at IS
// NULL) — the letting-go exclusion honored in what is handed out ([I1][X3]). Per-user scoped.
func (s Store) LiveMemoriesForExport(ctx context.Context, scope platform.UserScope) ([]memory.ExportMemory, error) {
	if err := s.ready(scope); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListEpisodicMemoriesForExport(ctx, scope.UserID())
	if err != nil {
		return nil, err
	}
	memories := make([]memory.ExportMemory, 0, len(rows))
	for _, row := range rows {
		memories = append(memories, memory.ExportMemory{
			DiaryID:             row.DiaryID,
			Name:                row.Name,
			Mood:                memory.Mood(row.Mood),
			CreatedUniverseTime: dateValue(row.CreatedUniverseTime),
		})
	}
	return memories, nil
}
