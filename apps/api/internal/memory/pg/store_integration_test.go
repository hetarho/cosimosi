package pg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
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
	retryAt := now.Add(2 * time.Minute)
	if err := store.Retry(ctx, job, 1, retryAt); err != nil {
		t.Fatalf("Retry failed: %v", err)
	}
	status, attempts := readJobStatus(t, pool, userID, job.ID)
	if status != string(memory.JobStatusPending) || attempts != 1 {
		t.Fatalf("after retry status=%q attempts=%d", status, attempts)
	}
	if err := store.Fail(ctx, job, int32(values.AiJobMaxAttempts)); err != nil {
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
