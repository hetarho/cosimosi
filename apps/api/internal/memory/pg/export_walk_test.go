package pg

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

func TestExportWalkCrossesPagesFromOneSnapshotAndStopsOnCallbackError(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	user := fmt.Sprintf("export-walk-%d", time.Now().UnixNano())
	cleanupMemoryTestRows(t, pool, user)
	scope, err := platform.NewUserScope(user)
	if err != nil {
		t.Fatal(err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	count := values.DiaryReaderExportPageSize + 2
	for i := 0; i < count; i++ {
		_, err := store.InsertDiary(ctx, scope, memory.Diary{ID: fmt.Sprintf("%s-%05d", user, i), Body: "retained", DiaryDate: day, CreatedAt: day})
		if err != nil {
			t.Fatal(err)
		}
	}
	seen := make(map[string]bool)
	err = store.WalkExport(ctx, scope, func(diary memory.ExportDiary, members []memory.ExportMemory) error {
		if seen[diary.ID] || diary.Body != "retained" || len(members) != 0 {
			t.Fatalf("wrong diary: %+v / %+v", diary, members)
		}
		seen[diary.ID] = true
		if len(seen) == 1 {
			// This later commit sorts after the next cursor but must stay outside the read snapshot.
			_, err := store.InsertDiary(ctx, scope, memory.Diary{ID: user + "-zzzzz", Body: "later", DiaryDate: day, CreatedAt: day})
			return err
		}
		return nil
	})
	if err != nil || len(seen) != count {
		t.Fatalf("snapshot walk: %v / %d", err, len(seen))
	}
	stop := errors.New("delivery stopped")
	calls := 0
	err = store.WalkExport(ctx, scope, func(memory.ExportDiary, []memory.ExportMemory) error { calls++; return stop })
	if !errors.Is(err, stop) || calls != 1 {
		t.Fatalf("callback cancellation: %v / %d", err, calls)
	}
}
