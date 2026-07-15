package pg

import (
	"context"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
)

// consolidateServiceDay is the fixed "today" the sync advances to, giving the interval its
// deterministic right edge.
func consolidateServiceDay() time.Time { return time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC) }

func newConsolidateService(t *testing.T, store Store) *memory.Service {
	t.Helper()
	adapters, err := ai.NewAdapters(ai.FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdapters failed: %v", err)
	}
	service, err := memory.NewService(memory.ServiceDeps{
		Extractor:  adapters.Extractor,
		Embedder:   adapters.Embedder,
		Candidates: store,
		Launches:   store,
		Universe:   store,
		Linker:     memory.NewLinkService(memory.LinkDeps{}),
		// The real Epic-E binding under test: the advance consolidates ([T4]).
		Progression:     memory.NewConsolidator(nil),
		Recalls:         store,
		SpendGate:       memory.AllowAllSpendGate{},
		Earn:            memory.NoEarnOnWrite{},
		PredictionError: adapters.PredictionError,
		Gists:           store,
		Signals:         store,
		Provenance:      store,
		Exports:         store,
		Diaries:         store,
		Now:             consolidateServiceDay,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

// TestSyncConsolidatesEndToEnd drives a real sync-to-today advance with the Consolidator
// bound and asserts the whole sleep landed atomically: gist stages risen with per-stage
// provenance and a consumed timer anchor, newly crossed decay-stage texts persisted, the
// touched replay set's synapses replay-marked, every synapse downscaled through the pure
// fn, the consolidate job enqueued — and the Diary untouched with no row deleted (A1–A12).
func TestSyncConsolidatesEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := "test-consolidate-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	created := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	today := consolidateServiceDay()

	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary", Body: "spring harbor morning", DiaryDate: created, CreatedAt: created})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	seed := int64(11)
	m1, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m1", DiaryID: diary.ID, Name: "Harbor walk",
		CurrentText: "I walked to the harbor and watched the boats until the sun went down.",
		Seed:        &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: created,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory m1 failed: %v", err)
	}
	// The gist ladder is pregenerated, so the advance must not re-enqueue semanticize.
	if err := store.SaveSemanticStages(ctx, userID, m1.ID, memory.SemanticStages{"g1", "g2", "g3", "g4"}); err != nil {
		t.Fatalf("SaveSemanticStages failed: %v", err)
	}
	// m2 shares a neuron with m1 (the shared-neuron neighbor); m3 is an unrelated island.
	// Both sit at the stage ceiling — with their ladders fully pregenerated, so the repair
	// pass has nothing to re-enqueue — and only m1 seeds the replay set.
	for _, id := range []string{base + "-m2", base + "-m3"} {
		if _, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
			ID: id, DiaryID: diary.ID, Name: "Ceiling " + id, CurrentText: "already fully risen",
			Seed: &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: created,
			SemanticStage: 4,
		}); err != nil {
			t.Fatalf("InsertEpisodicMemory %s failed: %v", id, err)
		}
		if err := store.SaveSemanticStages(ctx, userID, id, memory.SemanticStages{"g1", "g2", "g3", "g4"}); err != nil {
			t.Fatalf("SaveSemanticStages %s failed: %v", id, err)
		}
	}
	neurons := map[string]memory.NeuronType{
		base + "-n1": memory.NeuronTypeSemantic,
		base + "-n2": memory.NeuronTypeEntity,
		base + "-n3": memory.NeuronTypeSemantic,
		base + "-n4": memory.NeuronTypeEntity,
	}
	for id, neuronType := range neurons {
		if _, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: id, Type: neuronType, CreatedAt: created}); err != nil {
			t.Fatalf("UpsertNeuron %s failed: %v", id, err)
		}
	}
	for _, a := range []struct{ mem, neuron string }{
		{m1.ID, base + "-n1"}, {m1.ID, base + "-n2"},
		{base + "-m2", base + "-n1"},
		{base + "-m3", base + "-n3"}, {base + "-m3", base + "-n4"},
	} {
		if _, err := store.InsertNeuronActivation(ctx, scope, memory.NeuronActivation{EpisodicMemoryID: a.mem, NeuronID: a.neuron, Weight: 0.7}); err != nil {
			t.Fatalf("InsertNeuronActivation failed: %v", err)
		}
	}
	// syn-in sits inside m1's replay set; syn-out is the island's own edge — it must be
	// downscaled (slept) but never replay-touched (bounded); syn-fresh was last activated at
	// today itself, so it never slept through the interval and is outside the downscale set.
	for _, s := range []struct {
		id, a, b  string
		strength  float32
		activated time.Time
	}{
		{base + "-syn-in", base + "-n1", base + "-n2", 0.5, created},
		{base + "-syn-out", base + "-n3", base + "-n4", 0.8, created},
		{base + "-syn-fresh", base + "-n2", base + "-n3", 0.32, today},
	} {
		if _, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
			ID: s.id, NeuronAID: s.a, NeuronBID: s.b,
			Strength: s.strength, CoActivationCount: 1, LastActivatedUniverseTime: s.activated, CreatedAt: created,
		}); err != nil {
			t.Fatalf("UpsertSynapse %s failed: %v", s.id, err)
		}
	}
	// Birth the clock at the creation day so the sync crosses [created, today].
	if _, err := store.AdvanceUniverseClock(ctx, scope, created); err != nil {
		t.Fatalf("AdvanceUniverseClock failed: %v", err)
	}

	service := newConsolidateService(t, store)
	result, err := service.SyncToToday(ctx, scope)
	if err != nil {
		t.Fatalf("SyncToToday failed: %v", err)
	}
	if result.Previous == nil || !result.Previous.Equal(created) || !result.Current.Equal(today) {
		t.Fatalf("sync interval = {%v, %v}, want {created, today}", result.Previous, result.Current)
	}

	// Expected values through the same pure fns the handler uses (golden-parity math).
	strength := memory.EffectiveStrength(0.5, 0)
	wantUnits := memory.GistUnitsElapsed(today, created, emotion.Arousal, strength)
	wantStage := memory.Semanticize(0, wantUnits)
	if wantStage < 1 {
		t.Fatalf("fixture must cross at least one gist stage, got %d", wantStage)
	}
	wantDecayStage := memory.DecayStage(memory.EffectiveElapsedDays(today, nil, created, 0), emotion.Arousal, strength)
	if wantDecayStage < 1 {
		t.Fatal("fixture must cross at least one decay stage")
	}

	var gotStage int16
	var timerReset time.Time
	var decayStages []byte
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT semantic_stage, semanticize_timer_reset_at, decay_stages FROM episodic_memories WHERE id = $1",
		m1.ID,
	).Scan(&gotStage, &timerReset, &decayStages); err != nil {
		t.Fatalf("read m1 failed: %v", err)
	}
	if int(gotStage) != wantStage {
		t.Fatalf("semantic_stage = %d, want %d", gotStage, wantStage)
	}
	// The consumed anchor leaves zero whole units at today (A10 convergence), while staying
	// within the interval.
	if timerReset.Before(created) || timerReset.After(today) {
		t.Fatalf("timer anchor = %v, want within [created, today]", timerReset)
	}
	if got := memory.GistUnitsElapsed(today, timerReset, emotion.Arousal, strength); got != 0 {
		t.Fatalf("units at consumed anchor = %d, want 0", got)
	}

	// Per-stage semanticized/system provenance rows carrying the pregenerated texts.
	rows, err := pool.PgxPool().Query(ctx,
		"SELECT text FROM memory_provenance WHERE user_id = $1 AND episodic_memory_id = $2 AND kind = 'semanticized' AND source = 'system' ORDER BY created_at", userID, m1.ID)
	if err != nil {
		t.Fatalf("read provenance failed: %v", err)
	}
	texts := []string{}
	for rows.Next() {
		var text string
		if err := rows.Scan(&text); err != nil {
			t.Fatalf("scan provenance failed: %v", err)
		}
		texts = append(texts, text)
	}
	rows.Close()
	if len(texts) != wantStage {
		t.Fatalf("provenance rows = %d, want one per crossed stage %d", len(texts), wantStage)
	}
	pregenerated := memory.SemanticStages{"g1", "g2", "g3", "g4"}
	for i, text := range texts {
		if want := pregenerated[i]; text != want {
			t.Fatalf("provenance[%d] = %q, want %q", i, text, want)
		}
	}

	// Newly reached decay-stage texts persisted; deterministic via the shared algorithm.
	gotDecay := decayStagesSlice(decayStages)
	if len(gotDecay) != wantDecayStage {
		t.Fatalf("decay stages = %v, want %d filled", gotDecay, wantDecayStage)
	}
	if want := memory.DecayStageText(m1.CurrentText, 1, seed); gotDecay[0] != want {
		t.Fatalf("decay stage 1 = %q, want %q", gotDecay[0], want)
	}

	// Replay marker bounded to the touched replay set: the shared-neuron edge refreshed
	// to the advance day, the island edge untouched ([C2][I5]).
	readSynapse := func(id string) (float32, time.Time) {
		var s float32
		var last time.Time
		if err := pool.PgxPool().QueryRow(ctx,
			"SELECT strength, last_activated_universe_time FROM synapses WHERE id = $1", id).Scan(&s, &last); err != nil {
			t.Fatalf("read synapse %s failed: %v", id, err)
		}
		return s, last
	}
	inStrength, inTouched := readSynapse(base + "-syn-in")
	outStrength, outTouched := readSynapse(base + "-syn-out")
	freshStrength, _ := readSynapse(base + "-syn-fresh")
	if !inTouched.Equal(today) {
		t.Fatalf("replay-set synapse last_activated = %v, want the advance day", inTouched)
	}
	if !outTouched.Equal(created) {
		t.Fatalf("island synapse last_activated = %v, want untouched", outTouched)
	}

	// Downscale covers every slept edge exactly through the pure fn — expected values feed
	// the fn the float32-narrowed base the store read back (the `real` column round-trip),
	// not the float64 literal. The fresh edge is untouched; no row is removed ([C4][I1]).
	if want := float32(memory.Downscale(float64(float32(0.5)), 0.05)); inStrength != want {
		t.Fatalf("replay-set strength = %v, want %v", inStrength, want)
	}
	if want := float32(memory.Downscale(float64(float32(0.8)), 0.05)); outStrength != want {
		t.Fatalf("island strength = %v, want %v", outStrength, want)
	}
	if freshStrength != 0.32 {
		t.Fatalf("fresh synapse strength = %v, want untouched 0.32 (it never slept)", freshStrength)
	}
	var synapseCount int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM synapses WHERE user_id = $1", userID).Scan(&synapseCount); err != nil {
		t.Fatalf("count synapses failed: %v", err)
	}
	if synapseCount != 3 {
		t.Fatalf("synapse rows = %d, want 3 — downscale never removes an edge", synapseCount)
	}

	// The interval's heavy work is on the queue, not inline: one pending consolidate job.
	var jobCount int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM jobs WHERE user_id = $1 AND kind = 'consolidate' AND status = 'pending'", userID).Scan(&jobCount); err != nil {
		t.Fatalf("count consolidate jobs failed: %v", err)
	}
	if jobCount != 1 {
		t.Fatalf("consolidate jobs = %d, want 1", jobCount)
	}
	var semanticizeJobs int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM jobs WHERE user_id = $1 AND kind = 'semanticize'", userID).Scan(&semanticizeJobs); err != nil {
		t.Fatalf("count semanticize jobs failed: %v", err)
	}
	if semanticizeJobs != 0 {
		t.Fatal("pregenerated stages must not re-enqueue semanticize")
	}

	// The Diary is untouched ([I2]) and the same-day re-sync consolidates nothing further
	// (the held clock crosses no interval — A10).
	var body string
	if err := pool.PgxPool().QueryRow(ctx, "SELECT body FROM diaries WHERE id = $1", diary.ID).Scan(&body); err != nil {
		t.Fatalf("read diary failed: %v", err)
	}
	if body != "spring harbor morning" {
		t.Fatalf("diary body = %q, want untouched", body)
	}
	if _, err := service.SyncToToday(ctx, scope); err != nil {
		t.Fatalf("second SyncToToday failed: %v", err)
	}
	afterStrength, _ := readSynapse(base + "-syn-in")
	if afterStrength != inStrength {
		t.Fatalf("same-day re-sync downscaled again: %v → %v", inStrength, afterStrength)
	}
}

// TestConsolidationQueriesAreUserScopedAndMonotone pins the query-level guards: another
// user's rows are invisible to every consolidation statement, and the SQL GREATEST keeps a
// stage from ever decrementing (defense-in-depth under [C7]).
func TestConsolidationQueriesAreUserScopedAndMonotone(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := "test-consolidate-scope-" + time.Now().Format("150405.000000000")
	userID := base + "-user"
	otherID := base + "-other"
	cleanupMemoryTestRows(t, pool, userID)
	cleanupMemoryTestRows(t, pool, otherID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	otherScope, err := platform.NewUserScope(otherID)
	if err != nil {
		t.Fatalf("NewUserScope other failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion failed")
	}
	seed := int64(3)
	for _, owner := range []struct {
		scope platform.UserScope
		id    string
	}{{scope, base + "-mine"}, {otherScope, base + "-theirs"}} {
		diary, err := store.InsertDiary(ctx, owner.scope, memory.Diary{ID: owner.id + "-diary", Body: "b", DiaryDate: day, CreatedAt: day})
		if err != nil {
			t.Fatalf("InsertDiary failed: %v", err)
		}
		if _, err := store.InsertEpisodicMemory(ctx, owner.scope, memory.EpisodicMemory{
			ID: owner.id, DiaryID: diary.ID, Name: "n", CurrentText: "some words to keep around here",
			Seed: &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day, SemanticStage: 2,
		}); err != nil {
			t.Fatalf("InsertEpisodicMemory failed: %v", err)
		}
	}

	// The interval read sees only the caller's rows.
	mine, err := store.ListMemoriesForConsolidation(ctx, scope)
	if err != nil {
		t.Fatalf("ListMemoriesForConsolidation failed: %v", err)
	}
	if len(mine) != 1 || mine[0].ID != base+"-mine" {
		t.Fatalf("scoped read = %+v, want only the caller's memory", mine)
	}

	// A stage write scoped to the caller cannot move another user's row — and GREATEST
	// refuses to lower the caller's own stage.
	anchor := day.AddDate(0, 0, 10)
	if err := store.ApplyStageAdvances(ctx, scope, []memory.StageAdvance{
		{MemoryID: base + "-mine", Stage: 1, TimerResetAt: anchor},
		{MemoryID: base + "-theirs", Stage: 4, TimerResetAt: anchor},
	}); err != nil {
		t.Fatalf("ApplyStageAdvances failed: %v", err)
	}
	readStage := func(id string) int16 {
		var stage int16
		if err := pool.PgxPool().QueryRow(ctx, "SELECT semantic_stage FROM episodic_memories WHERE id = $1", id).Scan(&stage); err != nil {
			t.Fatalf("read stage %s failed: %v", id, err)
		}
		return stage
	}
	if got := readStage(base + "-mine"); got != 2 {
		t.Fatalf("own stage = %d, want GREATEST-held 2 (never decrements)", got)
	}
	if got := readStage(base + "-theirs"); got != 2 {
		t.Fatalf("other user's stage = %d, want untouched 2", got)
	}

	// The decay fill and downscale writes are equally scoped.
	if err := store.FillDecayStages(ctx, scope, base+"-theirs", []string{"x"}); err != nil {
		t.Fatalf("FillDecayStages failed: %v", err)
	}
	var theirDecay []byte
	if err := pool.PgxPool().QueryRow(ctx, "SELECT decay_stages FROM episodic_memories WHERE id = $1", base+"-theirs").Scan(&theirDecay); err != nil {
		t.Fatalf("read their decay failed: %v", err)
	}
	if len(theirDecay) != 0 {
		t.Fatalf("other user's decay_stages = %s, want untouched NULL", theirDecay)
	}

	strengths, err := store.ListSynapseStrengths(ctx, otherScope, day.AddDate(0, 0, 30))
	if err != nil {
		t.Fatalf("ListSynapseStrengths failed: %v", err)
	}
	if len(strengths) != 0 {
		t.Fatalf("other scope synapse read = %+v, want empty", strengths)
	}
}
