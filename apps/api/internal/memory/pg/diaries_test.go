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
	all, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("DiaryPage failed: %v", err)
	}
	if len(all) != 3 || all[0].ID != base+"-d3" || all[1].ID != base+"-d2" || all[2].ID != base+"-d1" {
		t.Fatalf("order = %s, want [d3, d2, d1] reverse-chron, other user excluded", diagnosticValue(all))
	}

	// Keyset: a 2-limit page then a cursor after the second row yields the third only.
	firstTwo, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, nil, 2)
	if err != nil {
		t.Fatalf("DiaryPage page 1 failed: %v", err)
	}
	if len(firstTwo) != 2 || firstTwo[1].ID != base+"-d2" {
		t.Fatalf("page 1 = %s, want [d3, d2]", diagnosticValue(firstTwo))
	}
	cursor := &memory.DiaryCursor{DiaryDate: firstTwo[1].DiaryDate, ID: firstTwo[1].ID, Sort: memory.DiarySortNewest}
	rest, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, cursor, 2)
	if err != nil {
		t.Fatalf("DiaryPage page 2 failed: %v", err)
	}
	if len(rest) != 1 || rest[0].ID != base+"-d1" {
		t.Fatalf("page 2 = %s, want [d1] (strictly after the cursor)", diagnosticValue(rest))
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
	page, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, nil, 10)
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
		t.Fatalf("refs = %s, want only the one live split ref", diagnosticValue(refs))
	}
	if refs[0].DiaryID != diaryID || !refs[0].CreatedUniverseTime.Equal(launch) {
		t.Fatalf("ref = %s, want diary %s at launch %v", diagnosticValue(refs[0]), diaryID, launch)
	}

	releaseID := base + "-release"
	if err := store.InsertReleaseGroup(ctx, scope, memory.ReleaseGroup{
		ID:        releaseID,
		DiaryID:   diaryID,
		DeletedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("InsertReleaseGroup failed: %v", err)
	}
	page, err = store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("DiaryPage after release failed: %v", err)
	}
	if len(page) != 1 || page[0].ID != emptyDiaryID {
		t.Fatalf("released page = %s, want only the never-launched diary", diagnosticValue(page))
	}
	for name, filter := range map[string]memory.DiaryFilter{
		"search": {Keyword: "immutable"},
		"mood":   {Moods: []memory.Mood{memory.MoodJoy}},
	} {
		filtered, err := store.DiaryPage(ctx, scope, filter, memory.DiarySortNewest, nil, 10)
		if err != nil {
			t.Fatalf("%s after release failed: %v", name, err)
		}
		if len(filtered) != 0 {
			t.Fatalf("%s after release = %s, want the released diary excluded", name, diagnosticValue(filtered))
		}
	}
	days, err := store.DiaryDays(ctx, scope, launch, launch, nil, 10)
	if err != nil {
		t.Fatalf("DiaryDays after release failed: %v", err)
	}
	if len(days) != 1 {
		t.Fatalf("released days = %s, want the day retained because another diary is still visible", diagnosticValue(days))
	}
	moodInputs, err := store.DiaryDayMoodInputs(ctx, scope, []time.Time{launch})
	if err != nil {
		t.Fatalf("DiaryDayMoodInputs after release failed: %v", err)
	}
	if len(moodInputs) != 0 {
		t.Fatalf("released calendar moods = %s, want no facts from the released diary", diagnosticValue(moodInputs))
	}
	if err := store.DeleteReleaseGroup(ctx, scope, releaseID); err != nil {
		t.Fatalf("DeleteReleaseGroup (Restore state transition) failed: %v", err)
	}
	page, err = store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("DiaryPage after restore failed: %v", err)
	}
	if len(page) != 2 {
		t.Fatalf("restored page = %s, want the diary to reappear without a Diary write", diagnosticValue(page))
	}
	for name, filter := range map[string]memory.DiaryFilter{
		"search": {Keyword: "immutable"},
		"mood":   {Moods: []memory.Mood{memory.MoodJoy}},
	} {
		filtered, err := store.DiaryPage(ctx, scope, filter, memory.DiarySortNewest, nil, 10)
		if err != nil {
			t.Fatalf("%s after restore failed: %v", name, err)
		}
		if len(filtered) != 1 || filtered[0].ID != diaryID {
			t.Fatalf("%s after restore = %s, want the restored diary", name, diagnosticValue(filtered))
		}
	}
	moodInputs, err = store.DiaryDayMoodInputs(ctx, scope, []time.Time{launch})
	if err != nil {
		t.Fatalf("DiaryDayMoodInputs after restore failed: %v", err)
	}
	if len(moodInputs) != 1 || moodInputs[0].Mood != memory.MoodJoy {
		t.Fatalf("restored calendar moods = %s, want the live mood to reappear", diagnosticValue(moodInputs))
	}
}

func TestDiarySearchMoodSortAndCalendarQueries(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-diary-search-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	var extensionExists bool
	if err := pool.PgxPool().QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm')").Scan(&extensionExists); err != nil {
		t.Fatalf("inspect pg_trgm failed: %v", err)
	}
	var indexExists bool
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM pg_indexes
			WHERE schemaname = current_schema()
			  AND indexname = 'diaries_body_trgm_idx'
			  AND indexdef LIKE '%gin_trgm_ops%'
		)`).Scan(&indexExists); err != nil {
		t.Fatalf("inspect trigram index failed: %v", err)
	}
	if !extensionExists || !indexExists {
		t.Fatalf("pg_trgm/index = %v/%v, want both installed", extensionExists, indexExists)
	}
	firstDay := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	secondDay := time.Date(2026, 6, 2, 0, 0, 0, 0, time.UTC)
	thirdDay := time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC)

	diaries := []memory.Diary{
		{ID: base + "-d1", Body: "아침에 커피를 마셨다", DiaryDate: firstDay, CreatedAt: firstDay},
		{ID: base + "-d2", Body: "차를 마셨다", DiaryDate: secondDay, CreatedAt: secondDay},
		{ID: base + "-d3", Body: "커피 콩을 샀다", DiaryDate: thirdDay, CreatedAt: thirdDay},
		{ID: base + "-d4", Body: `같은 날의 기록 100% _ \`, DiaryDate: thirdDay, CreatedAt: thirdDay},
	}
	for _, diary := range diaries {
		if _, err := store.InsertDiary(ctx, scope, diary); err != nil {
			t.Fatalf("InsertDiary %s failed: %v", diary.ID, err)
		}
	}
	joy, _ := memory.NewEmotion(memory.MoodJoy)
	calm, _ := memory.NewEmotion(memory.MoodCalm)
	inputs := []memory.EpisodicMemory{
		{ID: base + "-m1", DiaryID: diaries[0].ID, Name: "coffee", CurrentText: "representation", Emotion: joy, BaseStrength: 0.4, CreatedUniverseTime: firstDay},
		{ID: base + "-m2", DiaryID: diaries[0].ID, Name: "morning", CurrentText: "representation", Emotion: calm, BaseStrength: 0.5, CreatedUniverseTime: firstDay},
		{ID: base + "-m3", DiaryID: diaries[2].ID, Name: "beans", CurrentText: "representation", Emotion: joy, BaseStrength: 0.6, CreatedUniverseTime: thirdDay},
	}
	for _, input := range inputs {
		if _, err := store.InsertEpisodicMemory(ctx, scope, input); err != nil {
			t.Fatalf("InsertEpisodicMemory %s failed: %v", input.ID, err)
		}
	}

	keywordRows, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{Keyword: "커피"}, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("Korean substring search failed: %v", err)
	}
	if len(keywordRows) != 2 || keywordRows[0].ID != diaries[2].ID || keywordRows[1].ID != diaries[0].ID {
		t.Fatalf("Korean substring rows = %s, want [d3, d1]", diagnosticValue(keywordRows))
	}
	for _, escaped := range []string{`\%`, `\_`, `\\`} {
		rows, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{Keyword: escaped}, memory.DiarySortNewest, nil, 10)
		if err != nil {
			t.Fatalf("literal wildcard search %q failed: %v", escaped, err)
		}
		if len(rows) != 1 || rows[0].ID != diaries[3].ID {
			t.Fatalf("literal wildcard search %q = %s, want d4 only", escaped, diagnosticValue(rows))
		}
	}

	moodFilter := memory.DiaryFilter{Moods: []memory.Mood{memory.MoodJoy, memory.MoodCalm}}
	moodRows, err := store.DiaryPage(ctx, scope, moodFilter, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("mood filter failed: %v", err)
	}
	if len(moodRows) != 2 || moodRows[0].ID == moodRows[1].ID {
		t.Fatalf("mood rows = %s, want two unique diaries despite d1 having two matching memories", diagnosticValue(moodRows))
	}
	firstMoodPage, err := store.DiaryPage(ctx, scope, moodFilter, memory.DiarySortNewest, nil, 1)
	if err != nil {
		t.Fatalf("mood page 1 failed: %v", err)
	}
	moodCursor := &memory.DiaryCursor{
		DiaryDate: firstMoodPage[0].DiaryDate,
		ID:        firstMoodPage[0].ID,
		Sort:      memory.DiarySortNewest,
	}
	secondMoodPage, err := store.DiaryPage(ctx, scope, moodFilter, memory.DiarySortNewest, moodCursor, 1)
	if err != nil {
		t.Fatalf("mood page 2 failed: %v", err)
	}
	if len(secondMoodPage) != 1 || secondMoodPage[0].ID == firstMoodPage[0].ID {
		t.Fatalf("mood keyset pages = %s / %s, want stable unique diaries", diagnosticValue(firstMoodPage), diagnosticValue(secondMoodPage))
	}

	unfiltered, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("unfiltered read failed: %v", err)
	}
	if len(unfiltered) != 4 {
		t.Fatalf("unfiltered rows = %s, want the no-memory diaries too", diagnosticValue(unfiltered))
	}
	ranged, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{From: &secondDay, To: &thirdDay}, memory.DiarySortNewest, nil, 10)
	if err != nil {
		t.Fatalf("inclusive date filter failed: %v", err)
	}
	if len(ranged) != 3 || !ranged[len(ranged)-1].DiaryDate.Equal(secondDay) {
		t.Fatalf("inclusive date rows = %s, want both bounds included", diagnosticValue(ranged))
	}
	oldest, err := store.DiaryPage(ctx, scope, memory.DiaryFilter{}, memory.DiarySortOldest, nil, 10)
	if err != nil {
		t.Fatalf("oldest read failed: %v", err)
	}
	for i := range unfiltered {
		if unfiltered[i].ID != oldest[len(oldest)-1-i].ID {
			t.Fatalf("newest = %s, oldest = %s; want exact reverse including same-date id ties", diagnosticValue(unfiltered), diagnosticValue(oldest))
		}
	}

	days, err := store.DiaryDays(ctx, scope, firstDay, thirdDay, nil, 10)
	if err != nil {
		t.Fatalf("DiaryDays failed: %v", err)
	}
	if len(days) != 3 {
		t.Fatalf("days = %s, want three distinct written days (same-day diaries kept together)", diagnosticValue(days))
	}
	firstPage, err := store.DiaryDays(ctx, scope, firstDay, thirdDay, nil, 1)
	if err != nil {
		t.Fatalf("DiaryDays first page failed: %v", err)
	}
	if len(firstPage) != 2 || !firstPage[0].Equal(firstDay) {
		t.Fatalf("day probe = %s, want one visible day plus one has-more probe", diagnosticValue(firstPage))
	}
	nextPage, err := store.DiaryDays(ctx, scope, firstDay, thirdDay, &memory.DiaryCalendarCursor{DiaryDate: firstPage[0]}, 1)
	if err != nil {
		t.Fatalf("DiaryDays second page failed: %v", err)
	}
	if len(nextPage) != 2 || !nextPage[0].Equal(secondDay) {
		t.Fatalf("day page 2 = %s, want the next whole day", diagnosticValue(nextPage))
	}
}
