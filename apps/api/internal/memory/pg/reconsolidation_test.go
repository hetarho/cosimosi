package pg

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

func TestReconsolidationRequiresUserScope(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	if err := (Store{}).AddForgettingOffset(ctx, platform.UserScope{}, []string{"m1"}, 1); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("AddForgettingOffset error = %v, want ErrUserScopeRequired", err)
	}
	if err := (Store{}).AppendMemoryProvenance(ctx, platform.UserScope{}, memory.MemoryProvenance{
		Kind: memory.ProvenanceKindReconsolidated, Source: memory.ProvenanceSourceUser,
	}); !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("AppendMemoryProvenance error = %v, want ErrUserScopeRequired", err)
	}
}

func TestAppendMemoryProvenanceRejectsInvalidEnum(t *testing.T) {
	t.Parallel()

	// NewStore(nil) passes readiness with a valid scope, so the enum guard is reached before any query.
	scope, err := platform.NewUserScope("test-prov-enum-user")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(nil)
	ctx := context.Background()

	// The read-synthesized 'created' baseline is never stored (CC5).
	if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: "p", EpisodicMemoryID: "m", Kind: memory.ProvenanceKindCreated, Source: memory.ProvenanceSourceOriginal, Text: "x",
	}); !errors.Is(err, ErrProvenanceKindInvalid) {
		t.Fatalf("AppendMemoryProvenance(created) error = %v, want ErrProvenanceKindInvalid", err)
	}
	if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: "p", EpisodicMemoryID: "m", Kind: memory.ProvenanceKind("bogus"), Source: memory.ProvenanceSourceUser, Text: "x",
	}); !errors.Is(err, ErrProvenanceKindInvalid) {
		t.Fatalf("AppendMemoryProvenance(bogus kind) error = %v, want ErrProvenanceKindInvalid", err)
	}
	if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: "p", EpisodicMemoryID: "m", Kind: memory.ProvenanceKindReconsolidated, Source: memory.ProvenanceSource("bogus"), Text: "x",
	}); !errors.Is(err, ErrProvenanceSourceInvalid) {
		t.Fatalf("AppendMemoryProvenance(bogus source) error = %v, want ErrProvenanceSourceInvalid", err)
	}
}

func TestForgettingOffsetAccumulatesAdditively(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-offset-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	first, second := seedTwoMemories(t, ctx, store, scope, base)

	// Existing rows read a zero offset — no backfill needed ([A7]).
	if got := readOffset(t, pool, userID, first); got != 0 {
		t.Fatalf("fresh offset = %v, want 0", got)
	}

	// Additive across two recalls to the same neighbor; the recalled memory's own id is never in the set.
	if err := store.AddForgettingOffset(ctx, scope, []string{first}, memory.NeighborForgettingDelta(1)); err != nil {
		t.Fatalf("AddForgettingOffset slow failed: %v", err)
	}
	if err := store.AddForgettingOffset(ctx, scope, []string{first}, memory.NeighborForgettingDelta(2)); err != nil {
		t.Fatalf("AddForgettingOffset speed failed: %v", err)
	}
	want := float32(memory.NeighborForgettingDelta(1) + memory.NeighborForgettingDelta(2))
	if got := readOffset(t, pool, userID, first); got != want {
		t.Fatalf("accumulated offset = %v, want %v", got, want)
	}
	// A memory outside the neighbor set is untouched.
	if got := readOffset(t, pool, userID, second); got != 0 {
		t.Fatalf("non-neighbor offset = %v, want 0", got)
	}
	// An empty neighbor set is a no-op, not an error.
	if err := store.AddForgettingOffset(ctx, scope, nil, 5); err != nil {
		t.Fatalf("AddForgettingOffset(empty) failed: %v", err)
	}
}

func TestMemoryProvenanceAppendsAndCascades(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-prov-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	memoryID, _ := seedTwoMemories(t, ctx, store, scope, base)

	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: base + "-p1", EpisodicMemoryID: memoryID, Kind: memory.ProvenanceKindReconsolidated,
		Source: memory.ProvenanceSourceUser, Text: "first rewrite", UniverseTime: day,
	}); err != nil {
		t.Fatalf("append p1 failed: %v", err)
	}
	if err := store.AppendMemoryProvenance(ctx, scope, memory.MemoryProvenance{
		ID: base + "-p2", EpisodicMemoryID: memoryID, Kind: memory.ProvenanceKindReconsolidated,
		Source: memory.ProvenanceSourceUser, Text: "second rewrite", UniverseTime: day.AddDate(0, 0, 3),
	}); err != nil {
		t.Fatalf("append p2 failed: %v", err)
	}

	texts := readProvenanceTexts(t, pool, userID, memoryID)
	if len(texts) != 2 || texts[0] != "first rewrite" || texts[1] != "second rewrite" {
		t.Fatalf("provenance timeline = %v, want [first rewrite, second rewrite]", texts)
	}

	// ON DELETE CASCADE: the post-window full-delete sweep removes provenance with the parent memory
	// ([A8]). No provenance UPDATE/DELETE query exists — only the parent cascade.
	if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, memoryID); err != nil {
		t.Fatalf("parent delete failed: %v", err)
	}
	if remaining := readProvenanceTexts(t, pool, userID, memoryID); len(remaining) != 0 {
		t.Fatalf("provenance after parent delete = %v, want none (CASCADE)", remaining)
	}
}

// seedTwoMemories inserts a diary and two episodic memories, returning their ids.
func seedTwoMemories(t *testing.T, ctx context.Context, store Store, scope platform.UserScope, base string) (string, string) {
	t.Helper()

	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary", Body: "seed", DiaryDate: day, CreatedAt: day})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	ids := [2]string{base + "-m1", base + "-m2"}
	for _, id := range ids {
		if _, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
			ID: id, DiaryID: diary.ID, Name: id, CurrentText: "seed",
			Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
		}); err != nil {
			t.Fatalf("InsertEpisodicMemory(%s) failed: %v", id, err)
		}
	}
	return ids[0], ids[1]
}

func readOffset(t *testing.T, pool *platformdb.Pool, userID string, memoryID string) float32 {
	t.Helper()

	var offset float32
	if err := pool.PgxPool().QueryRow(context.Background(),
		"SELECT forgetting_offset_days FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, memoryID).Scan(&offset); err != nil {
		t.Fatalf("read offset failed: %v", err)
	}
	return offset
}

func readProvenanceTexts(t *testing.T, pool *platformdb.Pool, userID string, memoryID string) []string {
	t.Helper()

	rows, err := pool.PgxPool().Query(context.Background(),
		"SELECT text FROM memory_provenance WHERE user_id = $1 AND episodic_memory_id = $2 ORDER BY universe_time, created_at", userID, memoryID)
	if err != nil {
		t.Fatalf("read provenance failed: %v", err)
	}
	defer rows.Close()
	var texts []string
	for rows.Next() {
		var text string
		if err := rows.Scan(&text); err != nil {
			t.Fatalf("scan provenance failed: %v", err)
		}
		texts = append(texts, text)
	}
	return texts
}
