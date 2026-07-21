package pg

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// seedDiaryAndMemory inserts one retained diary + one live episodic memory, returning the ids. The
// creation universe-time and the diary body are what the provenance baseline is synthesized from.
func seedDiaryAndMemory(t *testing.T, ctx context.Context, store Store, scope platform.UserScope, base string, day time.Time, body, name string) (string, string) {
	t.Helper()
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{
		ID: base + "-diary", Body: body, DiaryDate: day, CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	mem, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-memory", DiaryID: diary.ID, Name: name, CurrentText: "current representation",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory failed: %v", err)
	}
	return diary.ID, mem.ID
}

func TestMemoryOriginReadsTheDiaryBodyAndIsPerUserScoped(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-prov-origin-%d", time.Now().UnixNano())
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
	day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	_, memoryID := seedDiaryAndMemory(t, ctx, store, scope, base, day, "the immutable diary body", "the memory")

	origin, err := store.MemoryOrigin(ctx, scope, memoryID)
	if err != nil {
		t.Fatalf("MemoryOrigin failed: %v", err)
	}
	// A2/[I2]: the baseline text is the Diary body, not current_text; the universe-time is creation.
	if origin.DiaryBody != "the immutable diary body" {
		t.Fatalf("origin body = %q, want the Diary body", origin.DiaryBody)
	}
	if !origin.CreatedUniverseTime.Equal(day) {
		t.Fatalf("origin universe_time = %v, want %v", origin.CreatedUniverseTime, day)
	}

	// A10: another user's memory is the canonical not-found — no cross-user body leak.
	if _, err := store.MemoryOrigin(ctx, other, memoryID); err != memory.ErrProvenanceMemoryNotFound {
		t.Fatalf("cross-user MemoryOrigin err = %v, want ErrProvenanceMemoryNotFound", err)
	}

	// A8/§4: a soft-deleted memory's history is not opened (the default read filters deleted_at IS NULL).
	if _, err := pool.PgxPool().Exec(ctx, "UPDATE episodic_memories SET deleted_at = now() WHERE user_id = $1 AND id = $2", userID, memoryID); err != nil {
		t.Fatalf("soft-delete UPDATE failed: %v", err)
	}
	if _, err := store.MemoryOrigin(ctx, scope, memoryID); err != memory.ErrProvenanceMemoryNotFound {
		t.Fatalf("soft-deleted MemoryOrigin err = %v, want ErrProvenanceMemoryNotFound", err)
	}
}

func TestMemoryProvenanceHistoryIsUniverseTimeOrdered(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-prov-history-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	_, memoryID := seedDiaryAndMemory(t, ctx, store, scope, base, day, "body", "the memory")

	// A empty history is valid — the use-case still synthesizes the baseline.
	empty, err := store.MemoryProvenanceHistory(ctx, scope, memoryID)
	if err != nil {
		t.Fatalf("MemoryProvenanceHistory (empty) failed: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("history = %d, want 0 before any append", len(empty))
	}

	// Append out of order; the read must return them universe-time ascending (A1).
	// A semanticized event carries its stage identity (the materialization guard).
	stageOne := int16(1)
	appends := []memory.MemoryProvenance{
		{ID: base + "-p2", EpisodicMemoryID: memoryID, Kind: memory.ProvenanceKindReconsolidated, Source: memory.ProvenanceSourceUser, Text: "rewrite", UniverseTime: time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)},
		{ID: base + "-p1", EpisodicMemoryID: memoryID, Kind: memory.ProvenanceKindSemanticized, Source: memory.ProvenanceSourceSystem, Text: "gist", UniverseTime: time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC), SemanticStage: &stageOne},
	}
	for _, entry := range appends {
		if err := store.AppendMemoryProvenance(ctx, scope, entry); err != nil {
			t.Fatalf("AppendMemoryProvenance failed: %v", err)
		}
	}

	history, err := store.MemoryProvenanceHistory(ctx, scope, memoryID)
	if err != nil {
		t.Fatalf("MemoryProvenanceHistory failed: %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("history = %d, want 2", len(history))
	}
	if history[0].Kind != memory.ProvenanceKindSemanticized || history[1].Kind != memory.ProvenanceKindReconsolidated {
		t.Fatalf("order = [%s, %s], want [semanticized, reconsolidated] by universe-time", history[0].Kind, history[1].Kind)
	}
	if history[0].Text != "gist" || history[1].Text != "rewrite" {
		t.Fatalf("texts = [%q, %q], want the appended values", history[0].Text, history[1].Text)
	}
}

func TestExportReadsAreScopedAndHonorTheExclusion(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-export-%d", time.Now().UnixNano())
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
	day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	// One diary with a live memory + a soft-deleted one; one memory-less diary.
	diaryID, _ := seedDiaryAndMemory(t, ctx, store, scope, base+"-a", day, "diary with memories", "kept memory")
	emotion, _ := memory.NewEmotion(memory.MoodJoy)
	deleted, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-deleted-memory", DiaryID: diaryID, Name: "let-go memory", CurrentText: "gone",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory failed: %v", err)
	}
	if _, err := pool.PgxPool().Exec(ctx, "UPDATE episodic_memories SET deleted_at = now() WHERE user_id = $1 AND id = $2", userID, deleted.ID); err != nil {
		t.Fatalf("soft-delete UPDATE failed: %v", err)
	}
	if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-memoryless-diary", Body: "past-dated entry", DiaryDate: day, CreatedAt: day}); err != nil {
		t.Fatalf("InsertDiary (memoryless) failed: %v", err)
	}
	// Another user's diary must never appear in this user's export.
	if _, err := store.InsertDiary(ctx, other, memory.Diary{ID: base + "-other-diary", Body: "not yours", DiaryDate: day, CreatedAt: day}); err != nil {
		t.Fatalf("InsertDiary (other) failed: %v", err)
	}

	diaries, err := store.DiariesForExport(ctx, scope)
	if err != nil {
		t.Fatalf("DiariesForExport failed: %v", err)
	}
	// A8: both the memory-bearing and the memory-less diary are exported; the other user's is absent (A10).
	if len(diaries) != 2 {
		t.Fatalf("diaries = %d, want 2 (memory-bearing + memory-less), other user excluded", len(diaries))
	}

	memories, err := store.LiveMemoriesForExport(ctx, scope)
	if err != nil {
		t.Fatalf("LiveMemoriesForExport failed: %v", err)
	}
	// A8: the soft-deleted memory is excluded; only the live one is handed out.
	if len(memories) != 1 || memories[0].DiaryID != diaryID {
		t.Fatalf("live memories = %+v, want only the one live memory", memories)
	}
	if memories[0].Name != "kept memory" {
		t.Fatalf("live memory name = %q, want the kept memory (not the let-go one)", memories[0].Name)
	}
}
