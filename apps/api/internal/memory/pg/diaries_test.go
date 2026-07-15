package pg

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

func TestDiaryPageIsReverseChronKeysetAndScoped(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-diary-page-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherID := base + "-other"
	cleanupMemoryTestRows(t, pool, userID)
	cleanupMemoryTestRows(t, pool, otherID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	other, err := platform.NewUserScope(otherID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())

	// Three diaries on distinct dates (insert out of order to prove the ORDER BY).
	dates := map[string]time.Time{
		base + "-d2": time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC),
		base + "-d1": time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC),
		base + "-d3": time.Date(2026, 6, 30, 0, 0, 0, 0, time.UTC),
	}
	for id, date := range dates {
		if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: id, Body: "body of " + id, DiaryDate: date, CreatedAt: date}); err != nil {
			t.Fatalf("InsertDiary %s failed: %v", id, err)
		}
	}
	// Another user's diary must never appear.
	if _, err := store.InsertDiary(ctx, other, memory.Diary{ID: base + "-other", Body: "not yours", DiaryDate: dates[base+"-d3"], CreatedAt: dates[base+"-d3"]}); err != nil {
		t.Fatalf("InsertDiary other failed: %v", err)
	}

	// Full page: reverse-chronological by diary_date.
	all, err := store.DiaryPage(ctx, scope, nil, 10)
	if err != nil {
		t.Fatalf("DiaryPage failed: %v", err)
	}
	if len(all) != 3 || all[0].ID != base+"-d3" || all[1].ID != base+"-d2" || all[2].ID != base+"-d1" {
		t.Fatalf("order = %+v, want [d3, d2, d1] reverse-chron, other user excluded", all)
	}

	// Keyset: a 2-limit page then a cursor after the second row yields the third only.
	firstTwo, err := store.DiaryPage(ctx, scope, nil, 2)
	if err != nil {
		t.Fatalf("DiaryPage page 1 failed: %v", err)
	}
	if len(firstTwo) != 2 || firstTwo[1].ID != base+"-d2" {
		t.Fatalf("page 1 = %+v, want [d3, d2]", firstTwo)
	}
	cursor := &memory.DiaryCursor{DiaryDate: firstTwo[1].DiaryDate, ID: firstTwo[1].ID}
	rest, err := store.DiaryPage(ctx, scope, cursor, 2)
	if err != nil {
		t.Fatalf("DiaryPage page 2 failed: %v", err)
	}
	if len(rest) != 1 || rest[0].ID != base+"-d1" {
		t.Fatalf("page 2 = %+v, want [d1] (strictly after the cursor)", rest)
	}
}

func TestDiarySplitRefsExcludeSoftDeletedAndVerbatimBody(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-diary-splits-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	launch := time.Date(2026, 6, 12, 0, 0, 0, 0, time.UTC)
	emotion, _ := memory.NewEmotion(memory.MoodJoy)

	diaryID := base + "-diary"
	if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: diaryID, Body: "the immutable diary body", DiaryDate: launch, CreatedAt: launch}); err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	live, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-live", DiaryID: diaryID, Name: "kept memory", CurrentText: "a rewritten representation",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: launch,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory live failed: %v", err)
	}
	deleted, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-deleted", DiaryID: diaryID, Name: "let-go memory", CurrentText: "gone",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: launch,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory deleted failed: %v", err)
	}
	if _, err := pool.PgxPool().Exec(ctx, "UPDATE episodic_memories SET deleted_at = now() WHERE user_id = $1 AND id = $2", userID, deleted.ID); err != nil {
		t.Fatalf("soft-delete UPDATE failed: %v", err)
	}
	// An empty (all-deleted / never-launched) diary must still list.
	emptyDiaryID := base + "-empty"
	if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: emptyDiaryID, Body: "past-dated entry", DiaryDate: launch, CreatedAt: launch}); err != nil {
		t.Fatalf("InsertDiary empty failed: %v", err)
	}

	// The body is byte-verbatim — never the memory's mutated current_text ([I2][D4]).
	page, err := store.DiaryPage(ctx, scope, nil, 10)
	if err != nil {
		t.Fatalf("DiaryPage failed: %v", err)
	}
	if len(page) != 2 {
		t.Fatalf("diaries = %d, want 2 (the split-bearing + the empty)", len(page))
	}
	var bodyByID = map[string]string{}
	for _, row := range page {
		bodyByID[row.ID] = row.Body
	}
	if bodyByID[diaryID] != "the immutable diary body" {
		t.Fatalf("diary body = %q, want it verbatim (not current_text)", bodyByID[diaryID])
	}

	refs, err := store.DiarySplitRefs(ctx, scope, []string{diaryID, emptyDiaryID})
	if err != nil {
		t.Fatalf("DiarySplitRefs failed: %v", err)
	}
	// A4/[I1]: only the live memory's ref; the soft-deleted one and the empty diary contribute none.
	if len(refs) != 1 || refs[0].EpisodicMemoryID != live.ID || refs[0].Name != "kept memory" {
		t.Fatalf("refs = %+v, want only the one live split ref", refs)
	}
	if refs[0].DiaryID != diaryID || !refs[0].CreatedUniverseTime.Equal(launch) {
		t.Fatalf("ref = %+v, want diary %s at launch %v", refs[0], diaryID, launch)
	}
}
