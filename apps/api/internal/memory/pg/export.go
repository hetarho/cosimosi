package pg

import (
	"context"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// WalkExport preserves a consistent retained-data snapshot while bounding materialized rows.
func (s Store) WalkExport(ctx context.Context, scope platform.UserScope, visit func(memory.ExportDiary, []memory.ExportMemory) error) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	if s.txer == nil {
		return ErrTxStarterRequired
	}
	tx, err := s.txer.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	queries := s.queries.WithTx(tx)
	params := dbgen.ListDiariesForExportPageParams{UserID: scope.UserID(), PageLimit: values.DiaryReaderExportPageSize}
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		diaries, err := queries.ListDiariesForExportPage(ctx, params)
		if err != nil {
			return err
		}
		if len(diaries) == 0 {
			break
		}
		ids := make([]string, len(diaries))
		for i, diary := range diaries {
			ids[i] = diary.ID
		}
		refs, err := queries.ListDiarySplitRefs(ctx, dbgen.ListDiarySplitRefsParams{UserID: scope.UserID(), DiaryIds: ids})
		if err != nil {
			return err
		}
		members := make(map[string][]memory.ExportMemory, len(diaries))
		for _, ref := range refs {
			members[ref.DiaryID] = append(members[ref.DiaryID], memory.ExportMemory{DiaryID: ref.DiaryID, Name: ref.Name, Mood: memory.Mood(ref.Mood), CreatedUniverseTime: dateValue(ref.CreatedUniverseTime)})
		}
		for _, diary := range diaries {
			if err := visit(memory.ExportDiary{ID: diary.ID, Body: diary.Body, DiaryDate: dateValue(diary.DiaryDate)}, members[diary.ID]); err != nil {
				return err
			}
		}
		last := diaries[len(diaries)-1]
		params.CursorDate, params.CursorID = last.DiaryDate, pgtype.Text{String: last.ID, Valid: true}
		if len(diaries) < values.DiaryReaderExportPageSize {
			break
		}
	}
	return tx.Commit(ctx)
}

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
