package pg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/ai"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
)

func TestGetUniverseReturnsOnlyVisibleGraph(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-universe-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}

	diary, err := store.InsertDiary(ctx, scope, memory.Diary{
		ID:        base + "-diary",
		Body:      "test diary",
		DiaryDate: day,
		CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	visibleMemory, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID:                  base + "-memory-visible",
		DiaryID:             diary.ID,
		Name:                "Visible memory",
		CurrentText:         "visible memory",
		Emotion:             emotion,
		BaseStrength:        0.5,
		CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory visible failed: %v", err)
	}
	deletedMemory, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID:                  base + "-memory-deleted",
		DiaryID:             diary.ID,
		Name:                "Deleted memory",
		CurrentText:         "deleted memory",
		Emotion:             emotion,
		BaseStrength:        0.5,
		CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory deleted failed: %v", err)
	}
	if _, err := pool.PgxPool().Exec(ctx, "UPDATE episodic_memories SET deleted_at = $1 WHERE id = $2", day, deletedMemory.ID); err != nil {
		t.Fatalf("mark deleted memory failed: %v", err)
	}

	visibleNeuronA, err := store.UpsertNeuron(ctx, scope, memory.Neuron{
		ID:        base + "-neuron-visible-a",
		Type:      memory.NeuronTypeSemantic,
		CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("UpsertNeuron visible A failed: %v", err)
	}
	visibleNeuronB, err := store.UpsertNeuron(ctx, scope, memory.Neuron{
		ID:        base + "-neuron-visible-b",
		Type:      memory.NeuronTypeEntity,
		CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("UpsertNeuron visible B failed: %v", err)
	}
	sealedAt := day.Add(time.Hour)
	sealedNeuron, err := store.UpsertNeuron(ctx, scope, memory.Neuron{
		ID:        base + "-neuron-sealed",
		Type:      memory.NeuronTypeSpatial,
		CreatedAt: day,
		SealedAt:  &sealedAt,
	})
	if err != nil {
		t.Fatalf("UpsertNeuron sealed failed: %v", err)
	}

	insertActivation := func(episodicMemoryID, neuronID string) {
		t.Helper()
		if _, err := store.InsertNeuronActivation(ctx, scope, memory.NeuronActivation{
			EpisodicMemoryID: episodicMemoryID,
			NeuronID:         neuronID,
			Weight:           0.7,
		}); err != nil {
			t.Fatalf("InsertNeuronActivation(%s, %s) failed: %v", episodicMemoryID, neuronID, err)
		}
	}
	insertActivation(visibleMemory.ID, visibleNeuronA.ID)
	insertActivation(deletedMemory.ID, visibleNeuronA.ID)
	insertActivation(visibleMemory.ID, sealedNeuron.ID)

	visibleSynapse, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
		ID:                        base + "-synapse-visible",
		NeuronAID:                 visibleNeuronA.ID,
		NeuronBID:                 visibleNeuronB.ID,
		Strength:                  0.8,
		CoActivationCount:         1,
		LastActivatedUniverseTime: day,
		CreatedAt:                 day,
	})
	if err != nil {
		t.Fatalf("UpsertSynapse visible failed: %v", err)
	}
	if _, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
		ID:                        base + "-synapse-hidden",
		NeuronAID:                 visibleNeuronA.ID,
		NeuronBID:                 sealedNeuron.ID,
		Strength:                  0.8,
		CoActivationCount:         1,
		LastActivatedUniverseTime: day,
		CreatedAt:                 day,
	}); err != nil {
		t.Fatalf("UpsertSynapse hidden failed: %v", err)
	}

	facts, err := store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse failed: %v", err)
	}

	if got := memoryIDs(facts.EpisodicMemories); len(got) != 1 || !got[visibleMemory.ID] {
		t.Fatalf("GetUniverse memories = %v, want only visible memory", got)
	}
	connectivity := neuronConnectivity(facts.Neurons)
	if len(connectivity) != 2 || connectivity[visibleNeuronA.ID] != 1 || connectivity[visibleNeuronB.ID] != 0 {
		t.Fatalf("GetUniverse neurons/connectivity = %v, want visible A=1 and visible B=0", connectivity)
	}
	if got := activationIDs(facts.Activations); len(got) != 1 || !got[visibleMemory.ID+"/"+visibleNeuronA.ID] {
		t.Fatalf("GetUniverse activations = %v, want only visible activation", got)
	}
	if len(facts.Synapses) != 1 || facts.Synapses[0].ID != visibleSynapse.ID {
		t.Fatalf("GetUniverse synapses = %+v, want only visible synapse", facts.Synapses)
	}
}

// A8 [L5][L8]: the atomic weighted upsert is idempotent on the canonical pair —
// the same (user, neuron_a, neuron_b) written repeatedly advances ONE row: strength
// = the last written base, co_activation_count incremented, last_activated advanced
// via GREATEST (an earlier date never rolls it back).
func TestUpsertSynapseConflictAdvancesSingleRow(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-synapse-upsert-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)

	neuronA, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: base + "-a", Type: memory.NeuronTypeSemantic, CreatedAt: day})
	if err != nil {
		t.Fatalf("UpsertNeuron A failed: %v", err)
	}
	neuronB, err := store.UpsertNeuron(ctx, scope, memory.Neuron{ID: base + "-b", Type: memory.NeuronTypeEntity, CreatedAt: day})
	if err != nil {
		t.Fatalf("UpsertNeuron B failed: %v", err)
	}

	upsert := func(id string, aID string, bID string, strength float32, activated time.Time) {
		t.Helper()
		if _, err := store.UpsertSynapse(ctx, scope, memory.Synapse{
			ID:                        id,
			NeuronAID:                 aID,
			NeuronBID:                 bID,
			Strength:                  strength,
			CoActivationCount:         1,
			LastActivatedUniverseTime: activated,
			CreatedAt:                 activated,
		}); err != nil {
			t.Fatalf("UpsertSynapse %s failed: %v", id, err)
		}
	}
	later := day.AddDate(0, 0, 5)
	upsert(base+"-syn-1", neuronA.ID, neuronB.ID, 0.32, day)
	upsert(base+"-syn-2", neuronB.ID, neuronA.ID, 0.5, later)                 // reversed order: same canonical row
	upsert(base+"-syn-3", neuronA.ID, neuronB.ID, 0.6, day.AddDate(0, 0, -5)) // earlier: GREATEST keeps `later`

	var rows int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM synapses WHERE user_id = $1", userID).Scan(&rows); err != nil {
		t.Fatalf("count synapses failed: %v", err)
	}
	if rows != 1 {
		t.Fatalf("synapse rows = %d, want 1 (idempotent on the canonical pair)", rows)
	}

	var strength float32
	var count int32
	var lastActivated time.Time
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT strength, co_activation_count, last_activated_universe_time FROM synapses WHERE user_id = $1", userID,
	).Scan(&strength, &count, &lastActivated); err != nil {
		t.Fatalf("read synapse failed: %v", err)
	}
	if !near32(strength, 0.6) {
		t.Fatalf("strength = %v, want the last written base 0.6", strength)
	}
	if count != 3 {
		t.Fatalf("co_activation_count = %d, want 3", count)
	}
	if !lastActivated.UTC().Equal(later) {
		t.Fatalf("last_activated = %v, want the latest date %v (GREATEST)", lastActivated.UTC(), later)
	}

	strengths, err := store.SynapseStrengths(ctx, scope, []string{neuronA.ID, neuronB.ID})
	if err != nil {
		t.Fatalf("SynapseStrengths failed: %v", err)
	}
	if len(strengths) != 1 || !near32(float32(strengths[0].Strength), 0.6) {
		t.Fatalf("SynapseStrengths = %+v, want one pair at the last written base 0.6", strengths)
	}
}

// A10 (§4): synapse reads and writes are per-user isolated — user B never sees
// user A's synapse base or co-activations.
func TestSynapseReadsAreUserScoped(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-synapse-scope-%d", time.Now().UnixNano())
	userA := base + "-a-user"
	userB := base + "-b-user"
	cleanupMemoryTestRows(t, pool, userA)
	cleanupMemoryTestRows(t, pool, userB)

	scopeA, err := platform.NewUserScope(userA)
	if err != nil {
		t.Fatalf("NewUserScope A failed: %v", err)
	}
	scopeB, err := platform.NewUserScope(userB)
	if err != nil {
		t.Fatalf("NewUserScope B failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}

	nA1, err := store.UpsertNeuron(ctx, scopeA, memory.Neuron{ID: base + "-a-n1", Type: memory.NeuronTypeSemantic, CreatedAt: day})
	if err != nil {
		t.Fatalf("UpsertNeuron A1 failed: %v", err)
	}
	nA2, err := store.UpsertNeuron(ctx, scopeA, memory.Neuron{ID: base + "-a-n2", Type: memory.NeuronTypeEntity, CreatedAt: day})
	if err != nil {
		t.Fatalf("UpsertNeuron A2 failed: %v", err)
	}
	diaryA, err := store.InsertDiary(ctx, scopeA, memory.Diary{ID: base + "-a-diary", Body: "diary", DiaryDate: day, CreatedAt: day})
	if err != nil {
		t.Fatalf("InsertDiary A failed: %v", err)
	}
	memA, err := store.InsertEpisodicMemory(ctx, scopeA, memory.EpisodicMemory{
		ID: base + "-a-memory", DiaryID: diaryA.ID, Name: "memory", CurrentText: "memory",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory A failed: %v", err)
	}
	for _, id := range []string{nA1.ID, nA2.ID} {
		if _, err := store.InsertNeuronActivation(ctx, scopeA, memory.NeuronActivation{EpisodicMemoryID: memA.ID, NeuronID: id, Weight: 0.7}); err != nil {
			t.Fatalf("InsertNeuronActivation A failed: %v", err)
		}
	}
	if _, err := store.UpsertSynapse(ctx, scopeA, memory.Synapse{
		ID: base + "-a-syn", NeuronAID: nA1.ID, NeuronBID: nA2.ID, Strength: 0.4, CoActivationCount: 1, LastActivatedUniverseTime: day, CreatedAt: day,
	}); err != nil {
		t.Fatalf("UpsertSynapse A failed: %v", err)
	}

	if strengths, err := store.SynapseStrengths(ctx, scopeB, []string{nA1.ID, nA2.ID}); err != nil || len(strengths) != 0 {
		t.Fatalf("user B SynapseStrengths = (%+v, %v), want empty", strengths, err)
	}
	strengthsA, err := store.SynapseStrengths(ctx, scopeA, []string{nA1.ID, nA2.ID})
	if err != nil || len(strengthsA) != 1 || !near32(float32(strengthsA[0].Strength), 0.4) {
		t.Fatalf("user A SynapseStrengths = (%+v, %v), want one pair at 0.4", strengthsA, err)
	}

	if activations, err := store.CoActivations(ctx, scopeB, []string{nA1.ID, nA2.ID}); err != nil || len(activations) != 0 {
		t.Fatalf("user B CoActivations = (%v, %v), want empty", activations, err)
	}
	activations, err := store.CoActivations(ctx, scopeA, []string{nA1.ID, nA2.ID})
	if err != nil {
		t.Fatalf("user A CoActivations failed: %v", err)
	}
	if len(activations) != 2 {
		t.Fatalf("user A CoActivations = %d rows, want 2", len(activations))
	}
	for _, activation := range activations {
		if activation.MemoryID != memA.ID || !activation.MemoryDate.Equal(day) {
			t.Fatalf("CoActivation = %+v, want memory %s dated %v", activation, memA.ID, day)
		}
	}
}

func TestInsertEmbeddingUpdatesExistingNeuronVector(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-embedding-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	neuron, err := store.UpsertNeuron(ctx, scope, memory.Neuron{
		ID:        base + "-neuron",
		Type:      memory.NeuronTypeSemantic,
		CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("UpsertNeuron failed: %v", err)
	}

	first := make([]float32, values.AiEmbeddingDim)
	first[0] = 0.1
	if _, err := store.InsertEmbedding(ctx, scope, memory.Embedding{NeuronID: neuron.ID, Vector: first}); err != nil {
		t.Fatalf("first InsertEmbedding failed: %v", err)
	}

	second := make([]float32, values.AiEmbeddingDim)
	second[0] = 0.9
	second[len(second)-1] = -0.25
	embedding, err := store.InsertEmbedding(ctx, scope, memory.Embedding{NeuronID: neuron.ID, Vector: second})
	if err != nil {
		t.Fatalf("second InsertEmbedding failed: %v", err)
	}

	if len(embedding.Vector) != values.AiEmbeddingDim || !near32(embedding.Vector[0], 0.9) || !near32(embedding.Vector[len(embedding.Vector)-1], -0.25) {
		t.Fatalf("updated embedding vector = first %v last %v len %d", embedding.Vector[0], embedding.Vector[len(embedding.Vector)-1], len(embedding.Vector))
	}
}

func TestClaimDueJobsAreDisjointAcrossConcurrentClaimants(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-jobs-claim-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	for _, id := range []string{base + "-job-a", base + "-job-b"} {
		if _, err := store.EnqueueJob(ctx, scope, memory.Job{
			ID:        id,
			Kind:      memory.JobKindEmbed,
			Payload:   []byte(`{"neurons":[]}`),
			Status:    memory.JobStatusPending,
			NextRunAt: now.Add(-time.Minute),
			CreatedAt: now,
		}); err != nil {
			t.Fatalf("EnqueueJob failed: %v", err)
		}
	}

	claims := make(chan memory.Job, 2)
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func() {
			job, err := store.ClaimDue(ctx, now)
			if err != nil {
				errs <- err
				return
			}
			claims <- job
		}()
	}
	claimedIDs := make([]string, 0, 2)
	for i := 0; i < 2; i++ {
		select {
		case err := <-errs:
			t.Fatalf("ClaimDue failed: %v", err)
		case job := <-claims:
			if job.UserID != userID || job.Status != memory.JobStatusRunning {
				t.Fatalf("claimed job = %+v", job)
			}
			if job.ID == "" {
				t.Fatal("claimed job id is empty")
			}
			claimedIDs = append(claimedIDs, job.ID)
		case <-time.After(5 * time.Second):
			t.Fatal("ClaimDue timed out")
		}
	}

	seen := map[string]bool{}
	for _, id := range claimedIDs {
		if seen[id] {
			t.Fatalf("job %s claimed twice", id)
		}
		seen[id] = true
	}
	if len(seen) != 2 {
		t.Fatalf("claimed ids = %v, want two disjoint jobs", seen)
	}

	var runningCount int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT count(*) FROM jobs WHERE user_id = $1 AND status = 'running'", userID).Scan(&runningCount); err != nil {
		t.Fatalf("read running count failed: %v", err)
	}
	if runningCount != 2 {
		t.Fatalf("running job count = %d, want 2", runningCount)
	}
}

func TestRunningJobCanBeReclaimedAfterLeaseExpires(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-jobs-lease-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	job, err := store.EnqueueJob(ctx, scope, memory.Job{
		ID:        base + "-job",
		Kind:      memory.JobKindEmbed,
		Payload:   []byte(`{"neurons":[]}`),
		Status:    memory.JobStatusPending,
		NextRunAt: now.Add(-time.Minute),
		CreatedAt: now,
	})
	if err != nil {
		t.Fatalf("EnqueueJob failed: %v", err)
	}

	claimed, err := store.ClaimDue(ctx, now)
	if err != nil {
		t.Fatalf("first ClaimDue failed: %v", err)
	}
	if claimed.ID != job.ID || claimed.Status != memory.JobStatusRunning || !claimed.NextRunAt.Equal(jobLeaseUntil(now)) {
		t.Fatalf("claimed job = %+v", claimed)
	}

	if _, err := store.ClaimDue(ctx, now.Add(jobLeaseDuration()-time.Second)); !errors.Is(err, jobqueue.ErrNoJob) {
		t.Fatalf("ClaimDue before lease expiry error = %v, want ErrNoJob", err)
	}

	reclaimed, err := store.ClaimDue(ctx, now.Add(jobLeaseDuration()+time.Second))
	if err != nil {
		t.Fatalf("reclaim ClaimDue failed: %v", err)
	}
	if reclaimed.ID != job.ID || reclaimed.Status != memory.JobStatusRunning {
		t.Fatalf("reclaimed job = %+v", reclaimed)
	}
}

func TestEnqueueJobCanSharePersistTransaction(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-jobs-tx-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	tx, err := pool.PgxPool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		t.Fatalf("BeginTx failed: %v", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()
	txStore := NewStore(tx)

	if _, err := txStore.InsertDiary(ctx, scope, memory.Diary{
		ID:        base + "-diary",
		Body:      "transactional diary",
		DiaryDate: day,
		CreatedAt: day,
	}); err != nil {
		t.Fatalf("InsertDiary in tx failed: %v", err)
	}
	if _, err := txStore.EnqueueJob(ctx, scope, memory.Job{
		ID:        base + "-job",
		Kind:      memory.JobKindEmbed,
		Payload:   []byte(`{"neurons":[]}`),
		Status:    memory.JobStatusPending,
		NextRunAt: day,
		CreatedAt: day,
	}); err != nil {
		t.Fatalf("EnqueueJob in tx failed: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("Commit failed: %v", err)
	}
	committed = true

	if body := readDiaryBody(t, pool, userID, base+"-diary"); body != "transactional diary" {
		t.Fatalf("diary body = %q, want transactional diary", body)
	}
	status, _ := readJobStatus(t, pool, userID, base+"-job")
	if status != string(memory.JobStatusPending) {
		t.Fatalf("job status = %q, want pending", status)
	}
}

func TestJobRetryAndFailKeepRows(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-jobs-retry-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	job, err := store.EnqueueJob(ctx, scope, memory.Job{
		ID:        base + "-job",
		Kind:      memory.JobKindEmbed,
		Payload:   []byte(`{"neurons":[]}`),
		Status:    memory.JobStatusPending,
		NextRunAt: now,
		CreatedAt: now,
	})
	if err != nil {
		t.Fatalf("EnqueueJob failed: %v", err)
	}
	// A terminal transition is fenced: it applies only while the caller still holds the
	// lease it claimed under, so claim before retrying.
	claimed, err := store.ClaimDue(ctx, now)
	if err != nil {
		t.Fatalf("ClaimDue failed: %v", err)
	}
	retryAt := now.Add(2 * time.Minute)
	if err := store.Retry(ctx, claimed, 1, retryAt); err != nil {
		t.Fatalf("Retry failed: %v", err)
	}
	status, attempts := readJobStatus(t, pool, userID, job.ID)
	if status != string(memory.JobStatusPending) || attempts != 1 {
		t.Fatalf("after retry status=%q attempts=%d", status, attempts)
	}

	// Re-claim (a new lease generation), then prove the stale first lease can no longer
	// finalize the row — a lease-expired worker's Complete is a silent no-op (R001 fence).
	reclaimed, err := store.ClaimDue(ctx, retryAt.Add(time.Second))
	if err != nil {
		t.Fatalf("reclaim ClaimDue failed: %v", err)
	}
	if err := store.Complete(ctx, claimed); err != nil {
		t.Fatalf("stale Complete returned error, want silent no-op: %v", err)
	}
	if status, _ := readJobStatus(t, pool, userID, job.ID); status != string(memory.JobStatusRunning) {
		t.Fatalf("stale lease clobbered the row: status=%q, want running", status)
	}

	if err := store.Fail(ctx, reclaimed, int32(values.AiJobMaxAttempts)); err != nil {
		t.Fatalf("Fail failed: %v", err)
	}
	status, attempts = readJobStatus(t, pool, userID, job.ID)
	if status != string(memory.JobStatusFailed) || attempts != int32(values.AiJobMaxAttempts) {
		t.Fatalf("after fail status=%q attempts=%d", status, attempts)
	}
}

func TestWorkerJobsFillEmbeddingsAndSemanticStagesOnNextRead(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-worker-e2e-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{
		ID:        base + "-diary",
		Body:      "original diary body",
		DiaryDate: day,
		CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	episodicMemory, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID:                  base + "-memory",
		DiaryID:             diary.ID,
		Name:                "Market",
		CurrentText:         "Met Mina",
		Emotion:             emotion,
		BaseStrength:        0.5,
		CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory failed: %v", err)
	}
	neuron, err := store.UpsertNeuron(ctx, scope, memory.Neuron{
		ID:        base + "-neuron",
		Type:      memory.NeuronTypeSemantic,
		CreatedAt: day,
	})
	if err != nil {
		t.Fatalf("UpsertNeuron failed: %v", err)
	}
	before, err := store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse before failed: %v", err)
	}
	if len(before.EpisodicMemories) != 1 || before.EpisodicMemories[0].SemanticStages != nil {
		t.Fatalf("semantic stages before worker = %+v, want one memory with nil stages", before.EpisodicMemories)
	}

	embedPayload, _ := json.Marshal(memory.EmbedJobPayload{
		Neurons: []memory.EmbedJobNeuron{{ID: neuron.ID, Text: "market"}},
	})
	semanticPayload, _ := json.Marshal(memory.SemanticizeJobPayload{
		MemoryID:    episodicMemory.ID,
		Name:        episodicMemory.Name,
		CurrentText: episodicMemory.CurrentText,
		Mood:        episodicMemory.Emotion.Mood,
		Neurons:     []memory.SemanticJobNeuron{{Name: "market", Type: memory.NeuronTypeSemantic}},
	})
	now := day.Add(time.Hour)
	for _, job := range []memory.Job{
		{ID: base + "-job-embed", Kind: memory.JobKindEmbed, Payload: embedPayload, Status: memory.JobStatusPending, NextRunAt: now, CreatedAt: now},
		{ID: base + "-job-semanticize", Kind: memory.JobKindSemanticize, Payload: semanticPayload, Status: memory.JobStatusPending, NextRunAt: now, CreatedAt: now},
	} {
		if _, err := store.EnqueueJob(ctx, scope, job); err != nil {
			t.Fatalf("EnqueueJob %s failed: %v", job.ID, err)
		}
	}
	runner, err := memory.NewJobRunner(
		store,
		store,
		store,
		ai.NewMockEmbedder(),
		ai.NewMockSemanticizer(),
		memory.WorkerConfig{
			MaxAttempts:  int32(values.AiJobMaxAttempts),
			BackoffBase:  time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond,
			PollInterval: time.Millisecond,
			Now:          func() time.Time { return now },
		},
	)
	if err != nil {
		t.Fatalf("NewJobRunner failed: %v", err)
	}
	for i := 0; i < 2; i++ {
		worked, err := runner.RunOnce(ctx)
		if err != nil {
			t.Fatalf("RunOnce %d failed: %v", i, err)
		}
		if !worked {
			t.Fatalf("RunOnce %d did not claim a job", i)
		}
	}

	if got := readEmbeddingCount(t, pool, userID, neuron.ID); got != 1 {
		t.Fatalf("embedding count = %d, want 1", got)
	}
	after, err := store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse after failed: %v", err)
	}
	if len(after.EpisodicMemories) != 1 || after.EpisodicMemories[0].SemanticStages == nil {
		t.Fatalf("semantic stages after worker = %+v, want filled stages", after.EpisodicMemories)
	}
	if body := readDiaryBody(t, pool, userID, diary.ID); body != "original diary body" {
		t.Fatalf("diary body = %q, want original unchanged", body)
	}
}

func TestLaunchTxAdvancesClockAtomicallyAndUniverseReadsIt(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-clock-tx-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}

	// Pre-clock universe: launch rows exist but no universe_state row — the
	// facts carry a nil clock (the service's one-release fallback path).
	err = store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
		diary, err := tx.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary-0", Body: "pre-clock", DiaryDate: day, CreatedAt: day})
		if err != nil {
			return err
		}
		_, err = tx.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
			ID: base + "-memory-0", DiaryID: diary.ID, Name: "Pre-clock", CurrentText: "pre-clock",
			Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
		})
		return err
	})
	if err != nil {
		t.Fatalf("pre-clock launch tx failed: %v", err)
	}
	facts, err := store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse failed: %v", err)
	}
	if facts.UniverseClock != nil {
		t.Fatalf("pre-clock facts clock = %v, want nil (fallback path)", facts.UniverseClock)
	}

	// A launch-shaped transaction advances the clock atomically with its rows.
	later := day.AddDate(0, 0, 4)
	err = store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
		diary, err := tx.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary-1", Body: "launch", DiaryDate: later, CreatedAt: later})
		if err != nil {
			return err
		}
		if _, err := tx.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
			ID: base + "-memory-1", DiaryID: diary.ID, Name: "Launch", CurrentText: "launch",
			Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: later,
		}); err != nil {
			return err
		}
		_, err = tx.AdvanceUniverseClock(ctx, scope, later)
		return err
	})
	if err != nil {
		t.Fatalf("launch tx with advance failed: %v", err)
	}
	facts, err = store.GetUniverse(ctx, scope)
	if err != nil {
		t.Fatalf("GetUniverse after advance failed: %v", err)
	}
	if facts.UniverseClock == nil || !facts.UniverseClock.Equal(later) {
		t.Fatalf("facts clock = %v, want the stored %v", facts.UniverseClock, later)
	}

	// A failed transaction rolls the advance back with the rows.
	failedDay := later.AddDate(0, 0, 3)
	err = store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
		if _, err := tx.AdvanceUniverseClock(ctx, scope, failedDay); err != nil {
			return err
		}
		return errors.New("injected rollback")
	})
	if err == nil {
		t.Fatal("expected the injected rollback to surface")
	}
	clock, err := store.UniverseClock(ctx, scope)
	if err != nil {
		t.Fatalf("UniverseClock after rollback failed: %v", err)
	}
	if clock == nil || !clock.Equal(later) {
		t.Fatalf("clock after rollback = %v, want unchanged %v", clock, later)
	}
}

func TestUniverseClockLazyBirthAndMonotonicUpsert(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-clock-%d", time.Now().UnixNano())
	userID := base + "-user"
	otherUserID := base + "-other"
	cleanupMemoryTestRows(t, pool, userID)
	cleanupMemoryTestRows(t, pool, otherUserID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	otherScope, err := platform.NewUserScope(otherUserID)
	if err != nil {
		t.Fatalf("NewUserScope other failed: %v", err)
	}
	store := NewStore(pool.PgxPool())

	// Lazy birth: no launches → no row → nil universe time.
	clock, err := store.UniverseClock(ctx, scope)
	if err != nil {
		t.Fatalf("UniverseClock before birth failed: %v", err)
	}
	if clock != nil {
		t.Fatalf("unborn clock = %v, want nil", clock)
	}

	first := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	advanced, err := store.AdvanceUniverseClock(ctx, scope, first)
	if err != nil {
		t.Fatalf("AdvanceUniverseClock birth failed: %v", err)
	}
	if !advanced.Equal(first) {
		t.Fatalf("birth advance = %v, want %v", advanced, first)
	}

	// An out-of-order (earlier) advance never rewinds: the GREATEST upsert holds the clock.
	earlier := first.AddDate(0, 0, -3)
	held, err := store.AdvanceUniverseClock(ctx, scope, earlier)
	if err != nil {
		t.Fatalf("AdvanceUniverseClock earlier failed: %v", err)
	}
	if !held.Equal(first) {
		t.Fatalf("earlier advance moved the clock to %v, want held at %v", held, first)
	}

	later := first.AddDate(0, 0, 6)
	moved, err := store.AdvanceUniverseClock(ctx, scope, later)
	if err != nil {
		t.Fatalf("AdvanceUniverseClock later failed: %v", err)
	}
	if !moved.Equal(later) {
		t.Fatalf("later advance = %v, want %v", moved, later)
	}

	// Repeat upserts stay a single row per user.
	var rows int
	if err := pool.PgxPool().QueryRow(ctx, "SELECT COUNT(*) FROM universe_state WHERE user_id = $1", userID).Scan(&rows); err != nil {
		t.Fatalf("count universe_state failed: %v", err)
	}
	if rows != 1 {
		t.Fatalf("universe_state rows = %d, want 1", rows)
	}

	// Per-user isolation: another user's clock is unaffected and reads nil.
	otherClock, err := store.UniverseClock(ctx, otherScope)
	if err != nil {
		t.Fatalf("UniverseClock other failed: %v", err)
	}
	if otherClock != nil {
		t.Fatalf("other user's clock = %v, want nil", otherClock)
	}

	readBack, err := store.UniverseClock(ctx, scope)
	if err != nil {
		t.Fatalf("UniverseClock read-back failed: %v", err)
	}
	if readBack == nil || !readBack.Equal(later) {
		t.Fatalf("read-back clock = %v, want %v", readBack, later)
	}
}

// TestLockUniverseClockSerializesConcurrentBirth pins the birth-window fix
// ([I10][T1]). While the clock row is unborn, GetUniverseClockForUpdate can lock
// no row, so two concurrent first-launches would both read a nil clock and one
// could launch a memory a serial run would have past-dated. LockUniverseClock —
// a per-user advisory xact lock that needs no row — closes that window.
//
// Tx A takes the lock and births the clock, holding its transaction open. Tx B
// starts while A holds the lock; its LockUniverseClock must block until A commits
// (proven deterministically by watching pg_locks for a non-granted advisory
// lock, not a sleep), and only then does B's guard read see A's committed clock —
// exactly the observation that past-dates a concurrent earlier diary.
func TestLockUniverseClockSerializesConcurrentBirth(t *testing.T) {
	pool := openMemoryTestPool(t)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-clock-lock-%d", time.Now().UnixNano())
	userID := base + "-user"
	cleanupMemoryTestRows(t, pool, userID)

	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	born := time.Date(2026, 7, 10, 0, 0, 0, 0, time.UTC)

	aLocked := make(chan struct{})    // closed once A holds the advisory lock
	aMayCommit := make(chan struct{}) // closed to release A after B is proven to be waiting

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
			if err := tx.LockUniverseClock(ctx, scope); err != nil {
				return err
			}
			close(aLocked)
			<-aMayCommit
			_, advErr := tx.AdvanceUniverseClock(ctx, scope, born)
			return advErr
		}); err != nil {
			t.Errorf("tx A (birth under lock) failed: %v", err)
		}
	}()

	select {
	case <-aLocked:
	case <-ctx.Done():
		t.Fatalf("tx A never acquired the lock: %v", ctx.Err())
	}

	var bSaw *time.Time
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := store.InLaunchTx(ctx, func(tx memory.LaunchTx) error {
			if err := tx.LockUniverseClock(ctx, scope); err != nil {
				return err
			}
			clock, readErr := tx.UniverseClockForUpdate(ctx, scope)
			if readErr != nil {
				return readErr
			}
			bSaw = clock
			return nil
		}); err != nil {
			t.Errorf("tx B (waiter) failed: %v", err)
		}
	}()

	// Deterministically wait until B is blocked on the advisory lock. Tests in
	// this package run serially, so the sole non-granted advisory lock is B's.
	for {
		select {
		case <-ctx.Done():
			t.Fatalf("tx B never blocked on the advisory lock: %v", ctx.Err())
		default:
		}
		var waiting int
		if err := pool.PgxPool().QueryRow(ctx,
			"SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted").Scan(&waiting); err != nil {
			t.Fatalf("poll pg_locks failed: %v", err)
		}
		if waiting > 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	close(aMayCommit)
	wg.Wait()

	// The lock forced B to observe A's committed birth rather than the nil clock
	// it would have raced to concurrently.
	if bSaw == nil || !bSaw.Equal(born) {
		t.Fatalf("tx B saw clock %v, want A's committed %v (the advisory lock did not serialize the birth window)", bSaw, born)
	}
	// That serialized read is exactly what past-dates a concurrent earlier diary:
	// B guards against the born clock, not the nil it would otherwise have seen.
	earlier := born.AddDate(0, 0, -5)
	if memory.CanLaunchAt(earlier, bSaw) {
		t.Fatalf("an earlier diary %v would still launch against the serialized clock %v — birth-window guard failed", earlier, born)
	}
}

// TestViewSemanticEndToEndReadsWithoutWriting drives the gist read + the full
// ViewSemantic use-case against a real database (plan 34 / job 45): the owner gets
// the stored stage texts (JSONB → domain mapping, NULL → nil), another user and a
// soft-deleted row are not-found (A9), and the write-probe proves the view changed
// no row and birthed no clock (A1/A7 — [R8][I2][I10]).
func TestViewSemanticEndToEndReadsWithoutWriting(t *testing.T) {
	pool := openMemoryTestPool(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	base := fmt.Sprintf("test-gist-%d", time.Now().UnixNano())
	userID := base + "-user"
	intruderID := base + "-intruder"
	cleanupMemoryTestRows(t, pool, userID)
	cleanupMemoryTestRows(t, pool, intruderID)
	scope, err := platform.NewUserScope(userID)
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	intruderScope, err := platform.NewUserScope(intruderID)
	if err != nil {
		t.Fatalf("NewUserScope intruder failed: %v", err)
	}
	store := NewStore(pool.PgxPool())
	day := time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC)
	emotion, ok := memory.NewEmotion(memory.MoodCalm)
	if !ok {
		t.Fatal("NewEmotion(MoodCalm) failed")
	}
	diary, err := store.InsertDiary(ctx, scope, memory.Diary{ID: base + "-diary", Body: "gist day", DiaryDate: day, CreatedAt: day})
	if err != nil {
		t.Fatalf("InsertDiary failed: %v", err)
	}
	risen, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m1", DiaryID: diary.ID, Name: "Risen", CurrentText: "a concrete account",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day, SemanticStage: 2,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory risen failed: %v", err)
	}
	unrisen, err := store.InsertEpisodicMemory(ctx, scope, memory.EpisodicMemory{
		ID: base + "-m2", DiaryID: diary.ID, Name: "Unrisen", CurrentText: "another account",
		Emotion: emotion, BaseStrength: 0.5, CreatedUniverseTime: day,
	})
	if err != nil {
		t.Fatalf("InsertEpisodicMemory unrisen failed: %v", err)
	}
	stages := memory.SemanticStages{"stage one", "stage two", "stage three", "stage four"}
	if err := store.SaveSemanticStages(ctx, userID, risen.ID, stages); err != nil {
		t.Fatalf("SaveSemanticStages failed: %v", err)
	}

	// Row snapshot before the views — the [R8] write-probe baseline.
	const rowSnapshot = `SELECT current_text, coalesce(seed, 0), recall_count,
		last_recalled_universe_time IS NULL, semanticize_timer_reset_at IS NULL,
		semantic_stage, coalesce(semantic_stages::text, ''), deleted_at IS NULL
		FROM episodic_memories WHERE id = $1`
	type snapshot struct {
		text                             string
		seed                             int64
		recallCount                      int32
		noLastRecalled, noTimer, noneDel bool
		stage                            int16
		stagesJSON                       string
	}
	readSnapshot := func(id string) snapshot {
		var s snapshot
		if err := pool.PgxPool().QueryRow(ctx, rowSnapshot, id).Scan(
			&s.text, &s.seed, &s.recallCount, &s.noLastRecalled, &s.noTimer,
			&s.stage, &s.stagesJSON, &s.noneDel); err != nil {
			t.Fatalf("row snapshot %s failed: %v", id, err)
		}
		return s
	}
	before := readSnapshot(risen.ID)

	// The pg read maps JSONB → the domain stage array; NULL → nil.
	gist, err := store.EpisodicMemoryGist(ctx, scope, risen.ID)
	if err != nil {
		t.Fatalf("EpisodicMemoryGist failed: %v", err)
	}
	if gist.SemanticStage != 2 || gist.SemanticStages == nil || *gist.SemanticStages != stages {
		t.Fatalf("gist = %+v, want stage 2 + the saved texts", gist)
	}
	unrisenGist, err := store.EpisodicMemoryGist(ctx, scope, unrisen.ID)
	if err != nil {
		t.Fatalf("EpisodicMemoryGist unrisen failed: %v", err)
	}
	if unrisenGist.SemanticStages != nil {
		t.Fatalf("unrisen stages = %+v, want nil for a NULL semantic_stages", unrisenGist.SemanticStages)
	}

	// The full use-case over the real store returns the stored stage text…
	service := newRecallService(t, store, store, store, store)
	result, err := service.ViewSemantic(ctx, scope, risen.ID, 2)
	if err != nil {
		t.Fatalf("ViewSemantic failed: %v", err)
	}
	if result.Text != "stage two" || result.Stage != 2 || result.ReachedStage != 2 {
		t.Fatalf("result = %+v, want stage two's text + meta", result)
	}
	// …refuses the unrisen stage server-authoritatively (A3)…
	if _, err := service.ViewSemantic(ctx, scope, risen.ID, 3); !errors.Is(err, memory.ErrViewSemanticStageNotRisen) {
		t.Fatalf("stage 3 err = %v, want ErrViewSemanticStageNotRisen", err)
	}
	// …and is invisible to another user (A9).
	if _, err := service.ViewSemantic(ctx, intruderScope, risen.ID, 1); !errors.Is(err, memory.ErrViewSemanticMemoryNotFound) {
		t.Fatalf("intruder err = %v, want ErrViewSemanticMemoryNotFound", err)
	}

	// Write-probe (A1/A7): the viewed row is byte-identical and no clock row was born.
	if after := readSnapshot(risen.ID); after != before {
		t.Fatalf("row changed by a view: before %+v, after %+v", before, after)
	}
	var clockRows int
	if err := pool.PgxPool().QueryRow(ctx,
		"SELECT count(*) FROM universe_state WHERE user_id = $1", userID).Scan(&clockRows); err != nil {
		t.Fatalf("count universe_state failed: %v", err)
	}
	if clockRows != 0 {
		t.Fatalf("universe_state rows = %d, want 0 — a view must not advance or birth the clock", clockRows)
	}

	// A soft-deleted memory's gist is not viewable (§4 not-found, plan 48 owns release).
	if _, err := pool.PgxPool().Exec(ctx, "UPDATE episodic_memories SET deleted_at = $1 WHERE id = $2", day, risen.ID); err != nil {
		t.Fatalf("soft-delete failed: %v", err)
	}
	if _, err := store.EpisodicMemoryGist(ctx, scope, risen.ID); !errors.Is(err, memory.ErrViewSemanticMemoryNotFound) {
		t.Fatalf("soft-deleted err = %v, want ErrViewSemanticMemoryNotFound", err)
	}
}

func openMemoryTestPool(t *testing.T) *platformdb.Pool {
	t.Helper()

	url := os.Getenv("COSIMOSI_TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv(platformdb.EnvDatabaseURL)
	}
	if url == "" {
		t.Skip("set COSIMOSI_TEST_DATABASE_URL or DATABASE_URL after starting the local postgres service")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := platformdb.Open(ctx, platformdb.Config{URL: url})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func cleanupMemoryTestRows(t *testing.T, pool *platformdb.Pool, userID string) {
	t.Helper()

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		tables := []string{
			"universe_state",
			"jobs",
			"embeddings",
			"synapses",
			"neuron_activations",
			"episodic_memories",
			"neurons",
			"diaries",
		}
		for _, table := range tables {
			if _, err := pool.PgxPool().Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID); err != nil {
				t.Fatalf("cleanup %s failed: %v", table, err)
			}
		}
	})
}

func readJobStatus(t *testing.T, pool *platformdb.Pool, userID string, jobID string) (string, int32) {
	t.Helper()

	var status string
	var attempts int32
	if err := pool.PgxPool().QueryRow(context.Background(), "SELECT status, attempts FROM jobs WHERE user_id = $1 AND id = $2", userID, jobID).Scan(&status, &attempts); err != nil {
		t.Fatalf("read job status failed: %v", err)
	}
	return status, attempts
}

func readEmbeddingCount(t *testing.T, pool *platformdb.Pool, userID string, neuronID string) int {
	t.Helper()

	var count int
	if err := pool.PgxPool().QueryRow(context.Background(), "SELECT count(*) FROM embeddings WHERE user_id = $1 AND neuron_id = $2", userID, neuronID).Scan(&count); err != nil {
		t.Fatalf("read embedding count failed: %v", err)
	}
	return count
}

func readDiaryBody(t *testing.T, pool *platformdb.Pool, userID string, diaryID string) string {
	t.Helper()

	var body string
	if err := pool.PgxPool().QueryRow(context.Background(), "SELECT body FROM diaries WHERE user_id = $1 AND id = $2", userID, diaryID).Scan(&body); err != nil {
		t.Fatalf("read diary body failed: %v", err)
	}
	return body
}

func memoryIDs(memories []memory.EpisodicMemory) map[string]bool {
	ids := make(map[string]bool, len(memories))
	for _, item := range memories {
		ids[item.ID] = true
	}
	return ids
}

func neuronConnectivity(neurons []memory.NeuronWithConnectivity) map[string]int32 {
	connectivity := make(map[string]int32, len(neurons))
	for _, item := range neurons {
		connectivity[item.ID] = item.Connectivity
	}
	return connectivity
}

func activationIDs(activations []memory.NeuronActivation) map[string]bool {
	ids := make(map[string]bool, len(activations))
	for _, item := range activations {
		ids[item.EpisodicMemoryID+"/"+item.NeuronID] = true
	}
	return ids
}

func near32(got, want float32) bool {
	const tolerance = 0.000001
	if got < want {
		return want-got <= tolerance
	}
	return got-want <= tolerance
}
