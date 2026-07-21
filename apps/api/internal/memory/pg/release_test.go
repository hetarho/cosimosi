package pg

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newReleaseService(t *testing.T, store Store, now func() time.Time) *memory.Service {
	t.Helper()
	adapters, err := ai.NewAdapters(ai.FactoryOptions{})
	if err != nil {
		t.Fatalf("NewAdapters failed: %v", err)
	}
	service, err := memory.NewService(memory.ServiceDeps{
		Extractor:       adapters.Extractor,
		Embedder:        adapters.Embedder,
		Candidates:      store,
		Launches:        store,
		Universe:        store,
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
		Releases:        store,
		SealSuggester:   adapters.SealSuggester,
		Now:             now,
	})
	if err != nil {
		t.Fatalf("NewService failed: %v", err)
	}
	return service
}

// releaseGraph seeds a two-diary universe: d1's memory m1 activates an orphan semantic neuron (m1 only)
// and a shared semantic neuron (also m2, in d2), joined by a synapse; d2's memory m2 keeps the shared
// neuron alive across a d1 release. Returns the ids used by the assertions.
type releaseGraph struct {
	d1, d2                string
	m1, m2                string
	orphan, shared        string
	spatial               string
	syn                   string
	preSharedContribution float32
}

func seedReleaseGraph(t *testing.T, ctx context.Context, store Store, scope platform.UserScope, base string, day time.Time) releaseGraph {
	t.Helper()
	emotion, _ := memory.NewEmotion(memory.MoodCalm)
	g := releaseGraph{
		d1: base + "-d1", d2: base + "-d2",
		m1: base + "-m1", m2: base + "-m2",
		orphan: base + "-n-orphan", shared: base + "-n-shared", spatial: base + "-n-spatial",
		syn: base + "-syn", preSharedContribution: 0.6,
	}
	for _, id := range []string{g.d1, g.d2} {
		if _, err := store.InsertDiary(ctx, scope, memory.Diary{ID: id, Body: "b", DiaryDate: day, CreatedAt: day}); err != nil {
			t.Fatalf("InsertDiary %s: %v", id, err)
		}
	}
	for id, diary := range map[string]string{g.m1: g.d1, g.m2: g.d2} {
		seed := int64(7)
		if _, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
			ID: id, DiaryID: diary, Name: "n", CurrentText: "t", Seed: &seed, Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
		}); err != nil {
			t.Fatalf("InsertEpisodicMemory %s: %v", id, err)
		}
	}
	for _, id := range []string{g.orphan, g.shared} {
		if _, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: id, Type: memory.NeuronTypeSemantic, CreatedAt: day}); err != nil {
			t.Fatalf("UpsertNeuron %s: %v", id, err)
		}
	}
	if _, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: g.spatial, Type: memory.NeuronTypeSpatial, CreatedAt: day}); err != nil {
		t.Fatalf("UpsertNeuron spatial: %v", err)
	}
	acts := []memory.NeuronActivation{
		{EpisodicMemoryID: g.m1, NeuronID: g.orphan, Weight: 1},
		{EpisodicMemoryID: g.m1, NeuronID: g.shared, Weight: 1},
		{EpisodicMemoryID: g.m1, NeuronID: g.spatial, Weight: 1},
		{EpisodicMemoryID: g.m2, NeuronID: g.shared, Weight: 1},
	}
	for _, a := range acts {
		if _, err := store.InsertNeuronActivation(ctx, scope, a); err != nil {
			t.Fatalf("InsertNeuronActivation: %v", err)
		}
	}
	if _, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
		ID: g.syn, NeuronAID: g.orphan, NeuronBID: g.shared, Strength: g.preSharedContribution, CoActivationCount: 1, LastActivatedUniverseTime: day, CreatedAt: day,
	}); err != nil {
		t.Fatalf("UpsertSynapse: %v", err)
	}
	return g
}

func TestReleaseThenRestoreEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-release-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, scope, base, day)

	clock := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, store, func() time.Time { return clock })

	pg := pool.PgxPool()
	count := func(query string, args ...any) int {
		var n int
		if err := pg.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			t.Fatalf("count query failed: %v", err)
		}
		return n
	}

	// --- Release ---
	result, err := service.Release(ctx, scope, g.d1)
	if err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	if len(result.EpisodicMemoryIDs) != 1 || result.EpisodicMemoryIDs[0] != g.m1 || !result.DeletedAt.Equal(clock) {
		t.Fatalf("release result = %+v, want [m1] at %v", result, clock)
	}
	// Ledger written: one group + one memory + one sealed orphan + one synapse delta.
	if n := count("SELECT count(*) FROM release_groups WHERE user_id = $1", userID); n != 1 {
		t.Fatalf("release_groups = %d, want 1", n)
	}
	// Full delete seals every orphan of the removal set regardless of type — here the m1-only semantic
	// neuron AND the m1-only spatial neuron (only letting-go is semantic-only). The shared neuron stays.
	if n := count("SELECT count(*) FROM release_sealed_neurons WHERE user_id = $1", userID); n != 2 {
		t.Fatalf("release_sealed_neurons = %d, want 2 (the semantic + spatial orphans)", n)
	}
	if n := count("SELECT count(*) FROM release_synapse_deltas WHERE user_id = $1", userID); n != 1 {
		t.Fatalf("release_synapse_deltas = %d, want 1", n)
	}
	var retentionDeadline time.Time
	if err := pg.QueryRow(ctx, `
		SELECT j.next_run_at
		FROM jobs AS j
		JOIN job_targets AS jt ON jt.job_id = j.id AND jt.user_id = j.user_id
		WHERE j.user_id = $1 AND j.kind = 'retention_sweep'
		  AND jt.target_kind = 'release_group'
	`, userID).Scan(&retentionDeadline); err != nil {
		t.Fatalf("read scheduled retention job: %v", err)
	}
	if want := clock.Add(time.Duration(values.ReleaseSoftDeleteRetentionDays) * 24 * time.Hour); !retentionDeadline.Equal(want) {
		t.Fatalf("retention deadline = %v, want %v", retentionDeadline, want)
	}
	// m1 soft-deleted, orphans sealed, shared kept, synapse Depressed — no hard delete.
	if n := count("SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL", userID); n != 1 {
		t.Fatalf("soft-deleted memories = %d, want 1", n)
	}
	if n := count("SELECT count(*) FROM neurons WHERE user_id = $1 AND sealed_at IS NOT NULL", userID); n != 2 {
		t.Fatalf("sealed neurons = %d, want 2 (the orphan + spatial, not the shared)", n)
	}
	if n := count("SELECT count(*) FROM neurons WHERE user_id = $1 AND id = $2 AND sealed_at IS NULL", userID, g.shared); n != 1 {
		t.Fatalf("shared neuron must stay unsealed")
	}
	var afterRelease float32
	if err := pg.QueryRow(ctx, "SELECT strength FROM synapses WHERE user_id = $1 AND id = $2", userID, g.syn).Scan(&afterRelease); err != nil {
		t.Fatalf("read synapse: %v", err)
	}
	if afterRelease >= g.preSharedContribution {
		t.Fatalf("synapse strength = %v, want Depressed below %v", afterRelease, g.preSharedContribution)
	}
	// A2: the released memory + sealed orphan leave GetUniverse; the shared neuron remains.
	facts, err := store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse: %v", err)
	}
	if memoryIDs(facts.EpisodicMemories)[g.m1] {
		t.Fatal("released memory still in GetUniverse")
	}
	if _, ok := neuronConnectivity(facts.Neurons)[g.orphan]; ok {
		t.Fatal("sealed orphan still in GetUniverse")
	}
	if _, ok := neuronConnectivity(facts.Neurons)[g.shared]; !ok {
		t.Fatal("shared neuron must remain visible")
	}
	// A2: a recall of a released memory is rejected.
	if _, err := service.Recall(ctx, scope, g.m1, "rewrite"); !errors.Is(err, memory.ErrRecallMemoryUnavailable) {
		t.Fatalf("Recall of released memory err = %v, want ErrRecallMemoryUnavailable", err)
	}

	// A1/A3: a second Release is a canonical no-op error, no double weaken.
	if _, err := service.Release(ctx, scope, g.d1); !errors.Is(err, memory.ErrAlreadyReleased) {
		t.Fatalf("double Release err = %v, want ErrAlreadyReleased", err)
	}
	var afterSecond float32
	_ = pg.QueryRow(ctx, "SELECT strength FROM synapses WHERE user_id = $1 AND id = $2", userID, g.syn).Scan(&afterSecond)
	if afterSecond != afterRelease {
		t.Fatal("a second Release weakened the shared synapse again")
	}

	// --- Restore within the window ---
	restore, err := service.Restore(ctx, scope, g.d1)
	if err != nil {
		t.Fatalf("Restore failed: %v", err)
	}
	if len(restore.EpisodicMemoryIDs) != 1 || restore.EpisodicMemoryIDs[0] != g.m1 {
		t.Fatalf("restore result = %+v, want [m1]", restore)
	}
	if n := count("SELECT count(*) FROM release_groups WHERE user_id = $1", userID); n != 0 {
		t.Fatalf("release group not retired on restore: %d", n)
	}
	if n := count("SELECT count(*) FROM jobs WHERE user_id = $1 AND kind = 'retention_sweep'", userID); n != 0 {
		t.Fatalf("restore left %d retention jobs, want 0", n)
	}
	if n := count("SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL", userID); n != 0 {
		t.Fatalf("deleted_at not cleared: %d still soft-deleted", n)
	}
	if n := count("SELECT count(*) FROM neurons WHERE user_id = $1 AND sealed_at IS NOT NULL", userID); n != 0 {
		t.Fatalf("orphan not unsealed: %d still sealed", n)
	}
	var restored float32
	_ = pg.QueryRow(ctx, "SELECT strength FROM synapses WHERE user_id = $1 AND id = $2", userID, g.syn).Scan(&restored)
	if diff := restored - g.preSharedContribution; diff < -1e-5 || diff > 1e-5 {
		t.Fatalf("restored synapse strength = %v, want the pre-release %v", restored, g.preSharedContribution)
	}
	if !memoryIDs(mustUniverse(t, store, ctx, scope).EpisodicMemories)[g.m1] {
		t.Fatal("restored memory not back in GetUniverse")
	}
}

func TestClaimedSemanticJobCannotPublishAfterRelease(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-release-job-fence-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, scope, base, day)
	var revision int64
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT representation_revision FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, g.m1).Scan(&revision); err != nil {
		t.Fatalf("read memory revision: %v", err)
	}
	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	job, err := store.EnqueueJob(ctx, scope, memory.Job{
		ID: base + "-semantic", Kind: memory.JobKindSemanticize, Payload: []byte(`{}`), Status: memory.JobStatusPending,
		NextRunAt: releaseAt.Add(-time.Minute), CreatedAt: releaseAt.Add(-time.Minute),
		Targets: []memory.JobTarget{{Kind: memory.JobTargetMemory, ID: g.m1, ExpectedRevision: revision}},
	})
	if err != nil {
		t.Fatalf("enqueue semantic job: %v", err)
	}
	claimed, err := store.ClaimDue(ctx, releaseAt)
	if err != nil || claimed.ID != job.ID {
		t.Fatalf("claim semantic job = (%+v, %v)", claimed, err)
	}
	service := newReleaseService(t, store, func() time.Time { return releaseAt })
	if _, err := service.Release(ctx, scope, g.d1); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	if err := store.SaveJobSemanticStages(ctx, claimed, g.m1, revision, memory.SemanticStages{"one", "two", "three", "four"}); err != nil {
		t.Fatalf("stale conditional write returned error: %v", err)
	}
	var status string
	var payload string
	var lease int64
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT status, payload::text, lease_generation FROM jobs WHERE user_id = $1 AND id = $2`, userID, job.ID).
		Scan(&status, &payload, &lease); err != nil {
		t.Fatalf("read cancelled job: %v", err)
	}
	if status != "cancelled" || payload != "{}" || lease == claimed.LeaseGeneration {
		t.Fatalf("cancelled job = status %q payload %q lease %d (claimed %d)", status, payload, lease, claimed.LeaseGeneration)
	}
	var stagesNull bool
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT semantic_stages IS NULL FROM episodic_memories WHERE user_id = $1 AND id = $2`, userID, g.m1).Scan(&stagesNull); err != nil {
		t.Fatalf("read semantic stages: %v", err)
	}
	if !stagesNull {
		t.Fatal("claimed job published semantic stages after Release")
	}
}

func TestScheduledRetentionWorkerSweepsWithoutAnotherUserRPC(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-retention-worker-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, scope, base, day)
	releaseAt := time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, store, func() time.Time { return releaseAt })
	if _, err := service.Release(ctx, scope, g.d1); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	due := releaseAt.Add(time.Duration(values.ReleaseSoftDeleteRetentionDays) * 24 * time.Hour)
	runner, err := memory.NewJobRunner(
		store, store, store, store, memory.NewRetentionSweeper(store), store,
		ai.NewMockEmbedder(), ai.NewMockSemanticizer(), memory.WorkerConfig{
			MaxAttempts:  int32(values.AiJobMaxAttempts),
			MaxClaims:    int32(values.AiJobMaxClaims),
			BackoffBase:  time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond,
			PollInterval: time.Millisecond,
			Now:          func() time.Time { return due },
		},
	)
	if err != nil {
		t.Fatalf("NewJobRunner failed: %v", err)
	}
	worked, err := runner.RunOnce(ctx)
	if err != nil || !worked {
		t.Fatalf("RunOnce = (%t, %v), want due retention work", worked, err)
	}
	var memories, diaries, groups int
	if err := pool.PgxPool().QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND id = $2),
		  (SELECT count(*) FROM diaries WHERE user_id = $1 AND id = $3),
		  (SELECT count(*) FROM release_groups WHERE user_id = $1)
	`, userID, g.m1, g.d1).Scan(&memories, &diaries, &groups); err != nil {
		t.Fatalf("inspect swept release: %v", err)
	}
	if memories != 0 || diaries != 0 || groups != 0 {
		t.Fatalf("inactive release remained: memories=%d diaries=%d groups=%d", memories, diaries, groups)
	}
}

func mustUniverse(t *testing.T, store Store, ctx context.Context, scope platform.UserScope) memory.UniverseFacts {
	t.Helper()
	facts, err := store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse: %v", err)
	}
	return facts
}

func TestRestoreRefusedAfterWindowAndSweep(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-restore-refuse-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, scope, base, day)

	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	clock := releaseAt
	service := newReleaseService(t, store, func() time.Time { return clock })

	if _, err := service.Release(ctx, scope, g.d1); err != nil {
		t.Fatalf("Release failed: %v", err)
	}
	// Past the window: Restore refuses, and the soft-delete is untouched.
	clock = releaseAt.Add(time.Duration(values.ReleaseSoftDeleteRetentionDays)*24*time.Hour + time.Hour)
	if _, err := service.Restore(ctx, scope, g.d1); !errors.Is(err, memory.ErrRestoreWindowExpired) {
		t.Fatalf("expired Restore err = %v, want ErrRestoreWindowExpired", err)
	}
	var stillDeleted int
	_ = pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL", userID).Scan(&stillDeleted)
	if stillDeleted != 1 {
		t.Fatalf("expired Restore changed the soft-delete state: %d deleted", stillDeleted)
	}
	// After the sweep removes the group, Restore reports not-released.
	if _, err := service.Sweep(ctx, scope, clock); err != nil {
		t.Fatalf("Sweep failed: %v", err)
	}
	if _, err := service.Restore(ctx, scope, g.d1); !errors.Is(err, memory.ErrRestoreNotReleased) {
		t.Fatalf("swept Restore err = %v, want ErrRestoreNotReleased", err)
	}
}

func TestSweepHardDeletesExpiredReleaseOnly(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-sweep-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, scope, base, day)

	// An embedding on the orphan + a retained provenance row on m1 must both go with the sweep.
	vector := make([]float32, values.AiEmbeddingDim)
	vector[0] = 0.3
	if _, err := store.InsertEmbedding(ctx, scope, memory.Embedding{NeuronID: g.orphan, Vector: vector}); err != nil {
		t.Fatalf("InsertEmbedding: %v", err)
	}
	pg := pool.PgxPool()
	if _, err := pg.Exec(ctx,
		"INSERT INTO memory_provenance (id, user_id, episodic_memory_id, kind, source, text, universe_time) VALUES ($1,$2,$3,'reconsolidated','user','t',$4)",
		base+"-prov", userID, g.m1, day); err != nil {
		t.Fatalf("insert provenance: %v", err)
	}

	releaseAt := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	clock := releaseAt
	service := newReleaseService(t, store, func() time.Time { return clock })
	if _, err := service.Release(ctx, scope, g.d1); err != nil {
		t.Fatalf("Release failed: %v", err)
	}

	count := func(query string, args ...any) int {
		var n int
		if err := pg.QueryRow(ctx, query, args...).Scan(&n); err != nil {
			t.Fatalf("count failed: %v", err)
		}
		return n
	}

	// A fresh release is not swept.
	if swept, err := service.Sweep(ctx, scope, releaseAt); err != nil || swept != 0 {
		t.Fatalf("fresh sweep = (%d, %v), want (0, nil)", swept, err)
	}
	if count("SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, g.m1) != 1 {
		t.Fatal("a fresh release was swept")
	}

	// Past the window the sweep hard-deletes the release group's user data.
	past := releaseAt.Add(time.Duration(values.ReleaseSoftDeleteRetentionDays)*24*time.Hour + time.Hour)
	swept, err := service.Sweep(ctx, scope, past)
	if err != nil || swept != 1 {
		t.Fatalf("expired sweep = (%d, %v), want (1, nil)", swept, err)
	}
	if count("SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, g.m1) != 0 {
		t.Fatal("expired release memory not hard-deleted")
	}
	if count("SELECT count(*) FROM memory_provenance WHERE user_id = $1 AND episodic_memory_id = $2", userID, g.m1) != 0 {
		t.Fatal("retained provenance not cascade-deleted with the memory")
	}
	if count("SELECT count(*) FROM neurons WHERE user_id = $1 AND id = $2", userID, g.orphan) != 0 {
		t.Fatal("exclusive sealed orphan neuron not hard-deleted")
	}
	if count("SELECT count(*) FROM embeddings WHERE user_id = $1 AND neuron_id = $2", userID, g.orphan) != 0 {
		t.Fatal("orphan embedding not hard-deleted")
	}
	if count("SELECT count(*) FROM diaries WHERE user_id = $1 AND id = $2", userID, g.d1) != 0 {
		t.Fatal("released diary row not hard-deleted")
	}
	if count("SELECT count(*) FROM release_groups WHERE user_id = $1", userID) != 0 {
		t.Fatal("release ledger not retired after sweep")
	}
	// Never a shared neuron, never the outside live memory/diary.
	if count("SELECT count(*) FROM neurons WHERE user_id = $1 AND id = $2", userID, g.shared) != 1 {
		t.Fatal("shared neuron was hard-deleted by the sweep")
	}
	if count("SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, g.m2) != 1 {
		t.Fatal("outside live memory was hard-deleted by the sweep")
	}
	if count("SELECT count(*) FROM diaries WHERE user_id = $1 AND id = $2", userID, g.d2) != 1 {
		t.Fatal("outside diary was hard-deleted by the sweep")
	}
}

func TestSuggestAndLetGoEndToEnd(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-letgo-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)
	scope, _ := platform.NewUserScope(userID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, scope, base, day)

	clock := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, store, func() time.Time { return clock })
	pg := pool.PgxPool()

	// A5: SuggestLetGo offers only the this-memory-only semantic neuron; the shared + spatial never surface.
	rowCountBefore := allRowCounts(t, ctx, pg, userID)
	suggestion, err := service.SuggestLetGo(ctx, scope, g.m1, "let this go")
	if err != nil {
		t.Fatalf("SuggestLetGo failed: %v", err)
	}
	if len(suggestion.Candidates) != 1 || suggestion.Candidates[0].NeuronID != g.orphan {
		t.Fatalf("candidates = %+v, want only the orphan semantic neuron", suggestion.Candidates)
	}
	if suggestion.HeavyState.Detected {
		t.Fatalf("heavy_state = %+v, want undetected for neutral words", suggestion.HeavyState)
	}
	if after := allRowCounts(t, ctx, pg, userID); !reflect.DeepEqual(after, rowCountBefore) {
		t.Fatalf("SuggestLetGo persisted state: before %+v after %+v", rowCountBefore, after)
	}

	// A6: a shared neuron id is rejected server-side, nothing sealed.
	if _, err := service.LetGo(ctx, scope, g.m1, []string{g.shared}); !errors.Is(err, memory.ErrLetGoInvalidApproved) {
		t.Fatalf("LetGo of shared neuron err = %v, want ErrLetGoInvalidApproved", err)
	}
	if n := sealedCount(t, ctx, pg, userID); n != 0 {
		t.Fatalf("a rejected LetGo sealed %d neurons, want 0", n)
	}

	// Emotion/seed snapshot before letting-go (these columns must survive — A8).
	var moodBefore string
	var valenceBefore, arousalBefore float32
	var seedBefore int64
	if err := pg.QueryRow(ctx, "SELECT mood, valence, arousal, seed FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, g.m1).
		Scan(&moodBefore, &valenceBefore, &arousalBefore, &seedBefore); err != nil {
		t.Fatalf("emotion snapshot: %v", err)
	}

	// A6/A7: the approved this-memory-only semantic neuron seals; no deleted_at, no ledger.
	result, err := service.LetGo(ctx, scope, g.m1, []string{g.orphan})
	if err != nil {
		t.Fatalf("LetGo failed: %v", err)
	}
	if len(result.SealedNeuronIDs) != 1 || result.SealedNeuronIDs[0] != g.orphan {
		t.Fatalf("sealed = %v, want [orphan]", result.SealedNeuronIDs)
	}
	var orphanSealed, sharedSealed bool
	_ = pg.QueryRow(ctx, "SELECT sealed_at IS NOT NULL FROM neurons WHERE user_id = $1 AND id = $2", userID, g.orphan).Scan(&orphanSealed)
	_ = pg.QueryRow(ctx, "SELECT sealed_at IS NOT NULL FROM neurons WHERE user_id = $1 AND id = $2", userID, g.shared).Scan(&sharedSealed)
	if !orphanSealed || sharedSealed {
		t.Fatalf("seal state orphan=%v shared=%v, want orphan sealed, shared kept", orphanSealed, sharedSealed)
	}
	var mDeleted bool
	_ = pg.QueryRow(ctx, "SELECT deleted_at IS NOT NULL FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, g.m1).Scan(&mDeleted)
	if mDeleted {
		t.Fatal("LetGo soft-deleted the memory — letting-go keeps the silent engram")
	}
	if n := 0; func() int {
		_ = pg.QueryRow(ctx, "SELECT count(*) FROM release_groups WHERE user_id = $1", userID).Scan(&n)
		return n
	}() != 0 {
		t.Fatal("LetGo wrote a release ledger row — it must be permanent, not restorable")
	}
	// A8: the memory's emotion + seed columns are byte-identical.
	var moodAfter string
	var valenceAfter, arousalAfter float32
	var seedAfter int64
	_ = pg.QueryRow(ctx, "SELECT mood, valence, arousal, seed FROM episodic_memories WHERE user_id = $1 AND id = $2", userID, g.m1).
		Scan(&moodAfter, &valenceAfter, &arousalAfter, &seedAfter)
	if moodAfter != moodBefore || valenceAfter != valenceBefore || arousalAfter != arousalBefore || seedAfter != seedBefore {
		t.Fatal("LetGo changed the memory's emotion/seed columns")
	}

	// Re-running the same approved id is an idempotent no-op (still sealed, no error).
	if _, err := service.LetGo(ctx, scope, g.m1, []string{g.orphan}); err != nil {
		t.Fatalf("re-run LetGo err = %v, want a no-op", err)
	}
	if n := sealedCount(t, ctx, pg, userID); n != 1 {
		t.Fatalf("sealed neurons after re-run = %d, want 1", n)
	}
}

func TestReleasePathsAreUserScoped(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-release-scope-%d", time.Now().UnixNano())
	ownerID, otherID := base+"-owner", base+"-other"
	cleanupMemoryTestRows(t, pool, ownerID)
	cleanupMemoryTestRows(t, pool, otherID)
	owner, _ := platform.NewUserScope(ownerID)
	other, _ := platform.NewUserScope(otherID)
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 10, 0, 0, 0, 0, time.UTC)
	g := seedReleaseGraph(t, ctx, store, owner, base, day)

	clock := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	service := newReleaseService(t, store, func() time.Time { return clock })

	// Another user cannot release the owner's diary (their own d1 has no memories) or touch the memory.
	if _, err := service.Release(ctx, other, g.d1); !errors.Is(err, memory.ErrReleaseNoLiveMemories) {
		t.Fatalf("cross-user Release err = %v, want ErrReleaseNoLiveMemories", err)
	}
	if _, err := service.SuggestLetGo(ctx, other, g.m1, "words"); !errors.Is(err, memory.ErrReleaseMemoryNotFound) {
		t.Fatalf("cross-user SuggestLetGo err = %v, want ErrReleaseMemoryNotFound", err)
	}
	if _, err := service.LetGo(ctx, other, g.m1, []string{g.orphan}); !errors.Is(err, memory.ErrReleaseMemoryNotFound) {
		t.Fatalf("cross-user LetGo err = %v, want ErrReleaseMemoryNotFound", err)
	}
	// The owner's data is untouched by the cross-user attempts.
	var deleted, sealed int
	_ = pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM episodic_memories WHERE user_id = $1 AND deleted_at IS NOT NULL", ownerID).Scan(&deleted)
	_ = pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM neurons WHERE user_id = $1 AND sealed_at IS NOT NULL", ownerID).Scan(&sealed)
	if deleted != 0 || sealed != 0 {
		t.Fatalf("cross-user calls mutated owner data: deleted=%d sealed=%d", deleted, sealed)
	}
	// The owner can still release + a cross-user Restore/Sweep never affects it.
	if _, err := service.Release(ctx, owner, g.d1); err != nil {
		t.Fatalf("owner Release failed: %v", err)
	}
	if _, err := service.Restore(ctx, other, g.d1); !errors.Is(err, memory.ErrRestoreNotReleased) {
		t.Fatalf("cross-user Restore err = %v, want ErrRestoreNotReleased", err)
	}
	if swept, err := service.Sweep(ctx, other, clock.Add(time.Duration(values.ReleaseSoftDeleteRetentionDays)*48*time.Hour)); err != nil || swept != 0 {
		t.Fatalf("cross-user Sweep = (%d, %v), want (0, nil)", swept, err)
	}
	if n := 0; func() int {
		_ = pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM release_groups WHERE user_id = $1", ownerID).Scan(&n)
		return n
	}() != 1 {
		t.Fatal("owner's release group was affected by a cross-user sweep")
	}
}

// allRowCounts snapshots every table the release path could write, so a SuggestLetGo read can be
// proven to persist nothing (the counts must be identical before and after).
func allRowCounts(t *testing.T, ctx context.Context, pg *pgxpool.Pool, userID string) map[string]int {
	t.Helper()
	tables := []string{
		"episodic_memories", "neurons", "neuron_activations", "synapses", "embeddings",
		"release_groups", "release_memories", "release_sealed_neurons", "release_synapse_deltas",
	}
	counts := make(map[string]int, len(tables))
	for _, table := range tables {
		var n int
		if err := pg.QueryRow(ctx, "SELECT count(*) FROM "+table+" WHERE user_id = $1", userID).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		counts[table] = n
	}
	return counts
}

func sealedCount(t *testing.T, ctx context.Context, pg *pgxpool.Pool, userID string) int {
	t.Helper()
	var n int
	if err := pg.QueryRow(ctx, "SELECT count(*) FROM neurons WHERE user_id = $1 AND sealed_at IS NOT NULL", userID).Scan(&n); err != nil {
		t.Fatalf("sealed count: %v", err)
	}
	return n
}
