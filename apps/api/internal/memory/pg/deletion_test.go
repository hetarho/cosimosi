package pg

import (
	"context"
	"fmt"
	"testing"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
)

// TestDeletionSealsAndWeakensWithoutHardDeleteOrGhost exercises the full-delete rule pieces end to end:
// soft-delete + seal + contribution-weaken preserve every row, and the sealed facts drop out of the
// dynamics (A2/A3/A5/A6).
func TestDeletionSealsAndWeakensWithoutHardDeleteOrGhost(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-deletion-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	emotion, _ := memory.NewEmotion(memory.MoodCalm)

	// Two diaries so an outside memory keeps a neuron shared across the D1 delete.
	d1, d2 := base+"-d1", base+"-d2"
	for _, id := range []string{d1, d2} {
		if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: id, Body: "b", DiaryDate: day, CreatedAt: day}); err != nil {
			t.Fatalf("InsertDiary %s: %v", id, err)
		}
	}
	m1, m2 := base+"-m1", base+"-m2"
	for id, diary := range map[string]string{m1: d1, m2: d2} {
		if _, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
			ID: id, DiaryID: diary, Name: "n", CurrentText: "t", Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
		}); err != nil {
			t.Fatalf("InsertEpisodicMemory %s: %v", id, err)
		}
	}
	nOrphan, nShared := base+"-n-orphan", base+"-n-shared"
	for _, id := range []string{nOrphan, nShared} {
		if _, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: id, Type: memory.NeuronTypeSemantic, CreatedAt: day}); err != nil {
			t.Fatalf("UpsertNeuron %s: %v", id, err)
		}
	}
	// m1 activates both; m2 (outside D1) also activates nShared → nShared stays shared after D1 delete.
	acts := []memory.NeuronActivation{
		{EpisodicMemoryID: m1, NeuronID: nOrphan, Weight: 1}, {EpisodicMemoryID: m1, NeuronID: nShared, Weight: 1},
		{EpisodicMemoryID: m2, NeuronID: nShared, Weight: 1},
	}
	for _, a := range acts {
		if _, err := store.InsertNeuronActivation(ctx, scope, a); err != nil {
			t.Fatalf("InsertNeuronActivation: %v", err)
		}
	}
	syn := base + "-syn"
	if _, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
		ID: syn, NeuronAID: nOrphan, NeuronBID: nShared, Strength: 0.6, CoActivationCount: 1, LastActivatedUniverseTime: day, CreatedAt: day,
	}); err != nil {
		t.Fatalf("UpsertSynapse: %v", err)
	}

	pg := pool.PgxPool()
	countBefore := func(table string) int {
		var n int
		if err := pg.QueryRow(ctx, "SELECT count(*) FROM "+table+" WHERE user_id = $1", userID).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		return n
	}
	memBefore, neuronBefore, synBefore := countBefore("episodic_memories"), countBefore("neurons"), countBefore("synapses")

	// Full delete D1: soft-delete its memories, classify their neurons, seal orphans, weaken shared.
	removed, err := store.SoftDeleteDiaryMemories(ctx, scope, d1, time.Now().UTC())
	if err != nil || len(removed) != 1 || removed[0] != m1 {
		t.Fatalf("SoftDeleteDiaryMemories = (%v, %v), want [m1]", removed, err)
	}
	neuronSet, err := store.RemovalNeuronIDs(ctx, scope, removed, nil)
	if err != nil || len(neuronSet) != 2 {
		t.Fatalf("RemovalNeuronIDs = (%v, %v), want the 2 neurons", neuronSet, err)
	}
	facts, err := store.NeuronActivationFacts(ctx, scope, neuronSet)
	if err != nil {
		t.Fatalf("NeuronActivationFacts: %v", err)
	}
	orphans, shared := memory.ClassifyNeurons(removed, neuronSet, facts)
	if len(orphans) != 1 || orphans[0] != nOrphan || len(shared) != 1 || shared[0] != nShared {
		t.Fatalf("classify = (orphans %v, shared %v), want ([nOrphan], [nShared])", orphans, shared)
	}
	if err := store.SealNeurons(ctx, scope, orphans, time.Now().UTC()); err != nil {
		t.Fatalf("SealNeurons: %v", err)
	}
	if err := store.WeakenSharedContributions(ctx, scope, neuronSet, shared, values.DeletionContributionWeakenAmount); err != nil {
		t.Fatalf("WeakenSharedContributions: %v", err)
	}

	// A2/A3/A7: no row was hard-deleted anywhere.
	if countBefore("episodic_memories") != memBefore || countBefore("neurons") != neuronBefore || countBefore("synapses") != synBefore {
		t.Fatal("a row was hard-deleted; deletion must only soft-delete/seal/weaken")
	}
	// A3: the shared synapse's strength dropped (Depressed) but the edge endures.
	var strength float32
	if err := pg.QueryRow(ctx, "SELECT strength FROM synapses WHERE user_id = $1 AND id = $2", userID, syn).Scan(&strength); err != nil {
		t.Fatalf("read synapse strength: %v", err)
	}
	if strength >= 0.6 {
		t.Fatalf("synapse strength = %v, want it Depressed below 0.6", strength)
	}
	// A6: the sealed-endpoint edge leaves the Downscale selection — no invisible-but-renormalizing ghost.
	downscale, err := store.queries.ListSynapseStrengthsForDownscale(ctx, dbgen.ListSynapseStrengthsForDownscaleParams{
		UserID: userID, ActivatedBefore: pgDate(day.AddDate(1, 0, 0)),
	})
	if err != nil {
		t.Fatalf("ListSynapseStrengthsForDownscale: %v", err)
	}
	for _, row := range downscale {
		if row.ID == syn {
			t.Fatal("a sealed-endpoint synapse is still in the Downscale set (ghost)")
		}
	}
	// A6: the soft-deleted memory and the sealed neuron drop from the universe reads.
	universeMemories, err := store.queries.ListUniverseEpisodicMemories(ctx, userID)
	if err != nil {
		t.Fatalf("ListUniverseEpisodicMemories: %v", err)
	}
	for _, row := range universeMemories {
		if row.ID == m1 {
			t.Fatal("a soft-deleted memory still appears in GetUniverse")
		}
	}
	universeNeurons, err := store.queries.ListUniverseNeurons(ctx, userID)
	if err != nil {
		t.Fatalf("ListUniverseNeurons: %v", err)
	}
	for _, row := range universeNeurons {
		if row.ID == nOrphan {
			t.Fatal("a sealed neuron still appears in GetUniverse")
		}
	}
}

func TestDeletionMethodsAreUserScoped(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-deletion-scope-%d", time.Now().UnixNano())
	ownerID, otherID := base+"-owner", base+"-other"
	cleanupMemoryTestRows(t, pool, ownerID)
	cleanupMemoryTestRows(t, pool, otherID)
	owner, _ := platform.NewUserScope(ownerID)
	other, _ := platform.NewUserScope(otherID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)

	diaryID := base + "-diary"
	if _, err := store.InsertDiary(ctx, owner, memory.Diary{ID: diaryID, Body: "b", DiaryDate: day, CreatedAt: day}); err != nil {
		t.Fatalf("InsertDiary: %v", err)
	}
	emotion, _ := memory.NewEmotion(memory.MoodCalm)
	if _, err := store.InsertEpisodicMemory(ctx, owner, memory.EpisodicMemory{
		ID: base + "-m", DiaryID: diaryID, Name: "n", CurrentText: "t", Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	}); err != nil {
		t.Fatalf("InsertEpisodicMemory: %v", err)
	}

	// Another user's soft-delete of the same diary id touches nothing.
	removed, err := store.SoftDeleteDiaryMemories(ctx, other, diaryID, time.Now().UTC())
	if err != nil {
		t.Fatalf("SoftDeleteDiaryMemories (other): %v", err)
	}
	if len(removed) != 0 {
		t.Fatalf("cross-user soft-delete affected %d memories, want 0", len(removed))
	}
	// An empty scope is rejected before any query.
	if _, err := store.RemovalNeuronIDs(ctx, platform.UserScope{}, []string{base + "-m"}, nil); err == nil {
		t.Fatal("RemovalNeuronIDs with empty scope should error")
	}
}
