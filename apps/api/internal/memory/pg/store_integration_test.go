package pg

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	platformdb "github.com/cosimosi/api/internal/platform/db"
	"github.com/cosimosi/api/internal/platform/values"
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
