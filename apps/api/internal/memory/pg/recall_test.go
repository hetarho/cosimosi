package pg

import (
	"context"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// recallServiceDay is the fixed "today" the recall Service syncs to, so the persisted
// anchors are deterministic against the wall clock.
func recallServiceDay() time.Time { return time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC) }

func newRecallService(t *testing.T, store Store, launches memory.LaunchRepo, universe memory.UniverseReader, candidates memory.NeuronCandidateRepo) *memory.Service {
	t.Helper()
	adapters, err := ai.NewAdapters(ai.FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdapters failed: %v", err)
	}
	seed := int64(9001)
	service, err := memory.NewService(memory.ServiceDeps{
		Extractor:       adapters.Extractor,
		Embedder:        adapters.Embedder,
		Candidates:      candidates,
		Launches:        launches,
		Universe:        universe,
		Linker:          memory.NewLinkService(memory.LinkDeps{}),
		Progression:     memory.NoopAdvanceProgression{},
		Recalls:         store,
		SpendGate:       memory.AllowAllSpendGate{},
		Earn:            memory.NoEarnOnWrite{},
		PredictionError: adapters.PredictionError,
		Gists:           store,
		Signals:         store,
		Provenance:      store,
		Exports:         store,
		Diaries:         store,
		Now:             recallServiceDay,
		NewSeed:         func() int64 { return seed },
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

// TestRecallReconsolidatesAndReinforcesEndToEnd drives the full Recall use-case against a
// real database on the error branch: anchors reset, the co-activated synapse is LTP'd, the
// neighbor's forgetting offset is nudged, current_text/seed are rewritten, one provenance row
// is appended, and a regen job is enqueued — all in one transaction (A3/A5/A8/A10).
func TestRecallReconsolidatesAndReinforcesEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := "test-recall-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	seedRecallGraph(t, ctx, store, scope, base, day)

	service := newRecallService(t, store, store, store, store)
	result, err := service.Recall(ctx, scope, base+"-m1", "a wholly different afternoon fishing trip")
	if err != nil {
		t.Fatalf("Recall failed: %v", err)
	}
	if !result.Reconsolidated {
		t.Fatalf("reconsolidated = false, want true for a content change")
	}
	if result.Seed != 9001 || result.CurrentText != "a wholly different afternoon fishing trip" {
		t.Fatalf("result = %+v, want new seed 9001 + rewritten text", result)
	}
	if !result.Sync.Current.Equal(recallServiceDay()) {
		t.Fatalf("sync current = %v, want the service day", result.Sync.Current)
	}

	// Anchors persisted: recall_count += 1, last_recalled + gist timer at today.
	var recallCount int32
	var lastRecalled, timerReset time.Time
	var currentText string
	var seed int64
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT recall_count, last_recalled_universe_time, semanticize_timer_reset_at, current_text, seed FROM episodic_memories WHERE id = $1",
		base+"-m1",
	).Scan(&recallCount, &lastRecalled, &timerReset, &currentText, &seed); err != nil {
		t.Fatalf("read recalled memory failed: %v", err)
	}
	if recallCount != 1 || !lastRecalled.Equal(recallServiceDay()) || !timerReset.Equal(recallServiceDay()) {
		t.Fatalf("anchors = {count %d, last %v, timer %v}, want {1, today, today}", recallCount, lastRecalled, timerReset)
	}
	if currentText != "a wholly different afternoon fishing trip" || seed != 9001 {
		t.Fatalf("persisted representation = {%q, %d}, want the rewrite + new seed", currentText, seed)
	}

	// LTP: the co-activated synapse strengthened and co_activation incremented to 2.
	var strength float32
	var coActivation int32
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT strength, co_activation_count FROM synapses WHERE id = $1", base+"-syn",
	).Scan(&strength, &coActivation); err != nil {
		t.Fatalf("read synapse failed: %v", err)
	}
	if coActivation != 2 || strength <= 0.5 {
		t.Fatalf("synapse = {strength %v, co_activation %d}, want potentiated + count 2", strength, coActivation)
	}

	// Neighbor forgetting ±: the neighbor sharing one semantic neuron is slowed (< 0); the
	// recalled memory keeps its own offset at 0 (it recovers wholly [F5]).
	if got := readOffset(t, pool, userID, base+"-m2"); got >= 0 {
		t.Fatalf("neighbor offset = %v, want negative (slow) for a count-1 neighbor", got)
	}
	if got := readOffset(t, pool, userID, base+"-m1"); got != 0 {
		t.Fatalf("recalled memory offset = %v, want 0 (no self-offset)", got)
	}

	// One reconsolidated/user provenance row at today.
	var provCount int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM memory_provenance WHERE episodic_memory_id = $1 AND kind = 'reconsolidated' AND source = 'user'",
		base+"-m1",
	).Scan(&provCount); err != nil {
		t.Fatalf("count provenance failed: %v", err)
	}
	if provCount != 1 {
		t.Fatalf("provenance rows = %d, want 1", provCount)
	}

	// A regen job was enqueued for the remaining stage texts.
	var jobCount int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM jobs WHERE user_id = $1 AND kind = 'semanticize'", userID,
	).Scan(&jobCount); err != nil {
		t.Fatalf("count jobs failed: %v", err)
	}
	if jobCount != 1 {
		t.Fatalf("regen jobs = %d, want 1", jobCount)
	}
}

// TestRecallIsUserScoped verifies a recall targeting another user's memory is rejected — the
// per-user WHERE clauses isolate the read (A15).
func TestRecallIsUserScoped(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := "test-recall-scope-" + time.Now().Format("150405.000000000")
	ownerID := base + "-owner"
	intruderID := base + "-intruder"
	cleanupMemoryTestRows(t, pool, ownerID)
	cleanupMemoryTestRows(t, pool, intruderID)
	ownerScope, _ := platform.NewUserScope(ownerID)
	intruderScope, _ := platform.NewUserScope(intruderID)

	store := NewStore(pool.PgxPool())
	seedRecallGraph(t, ctx, store, ownerScope, base, time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC))

	service := newRecallService(t, store, store, store, store)
	if _, err := service.Recall(ctx, intruderScope, base+"-m1", "a different memory"); err == nil {
		t.Fatal("recalling another user's memory must be rejected")
	}
}

// seedRecallGraph plants a diary with two memories sharing one semantic neuron, plus a synapse
// among the recalled memory's neurons, so a recall of m1 reinforces the synapse and nudges m2.
func seedRecallGraph(t *testing.T, ctx context.Context, store Store, scope platform.UserScope, base string, day time.Time) {
	t.Helper()
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary", Body: "morning market run with mina", DiaryDate: day, CreatedAt: day})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	seed := int64(11)
	m1, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m1", DiaryID: diary.ID, Name: "Market run", CurrentText: "morning market run with mina",
		Seed: &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory m1 failed: %v", err)
	}
	m2, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m2", DiaryID: diary.ID, Name: "Lunch", CurrentText: "lunch with mina",
		Seed: &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory m2 failed: %v", err)
	}
	shared, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: base + "-n-shared", Type: memory.NeuronTypeSemantic, CreatedAt: day})
	if err != nil {
		t.Fatalf("UpsertNeuron shared failed: %v", err)
	}
	entity, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: base + "-n-entity", Type: memory.NeuronTypeEntity, CreatedAt: day})
	if err != nil {
		t.Fatalf("UpsertNeuron entity failed: %v", err)
	}
	for _, a := range []struct{ mem, neuron string }{
		{m1.ID, shared.ID}, {m1.ID, entity.ID}, {m2.ID, shared.ID},
	} {
		if _, err := store.InsertNeuronActivation(ctx, scope, memory.NeuronActivation{EpisodicMemoryID: a.mem, NeuronID: a.neuron, Weight: 0.7}); err != nil {
			t.Fatalf("InsertNeuronActivation(%s,%s) failed: %v", a.mem, a.neuron, err)
		}
	}
	if _, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
		ID: base + "-syn", NeuronAID: shared.ID, NeuronBID: entity.ID,
		Strength: 0.5, CoActivationCount: 1, LastActivatedUniverseTime: day, CreatedAt: day,
	}); err != nil {
		t.Fatalf("UpsertSynapse failed: %v", err)
	}
}
