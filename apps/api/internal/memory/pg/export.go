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
