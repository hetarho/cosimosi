package pg

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/memory"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestStoreRequiresUserScope(t *testing.T) {
	t.Parallel()

	_, err := (Store{}).InsertDiary(context.Background(), platform.UserScope{}, memory.Diary{})
	if !errors.Is(err, ErrUserScopeRequired) {
		t.Fatalf("InsertDiary error = %v, want ErrUserScopeRequired", err)
	}
}

func TestSynapseParamsCanonicalizeNeuronPair(t *testing.T) {
	t.Parallel()

	scope := mustScope(t)
	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	first, err := synapseParams(scope, memory.Synapse{
		ID:                        "synapse-1",
		NeuronAID:                 "neuron-b",
		NeuronBID:                 "neuron-a",
		Strength:                  0.4,
		CoActivationCount:         1,
		LastActivatedUniverseTime: day,
		CreatedAt:                 day,
	})
	if err != nil {
		t.Fatalf("synapseParams failed: %v", err)
	}
	second, err := synapseParams(scope, memory.Synapse{
		ID:                        "synapse-2",
		NeuronAID:                 "neuron-a",
		NeuronBID:                 "neuron-b",
		Strength:                  0.4,
		CoActivationCount:         1,
		LastActivatedUniverseTime: day,
		CreatedAt:                 day,
	})
	if err != nil {
		t.Fatalf("synapseParams failed: %v", err)
	}

	if first.NeuronAID != "neuron-a" || first.NeuronBID != "neuron-b" {
		t.Fatalf("first pair = (%q, %q), want canonical order", first.NeuronAID, first.NeuronBID)
	}
	if first.UserID != second.UserID || first.NeuronAID != second.NeuronAID || first.NeuronBID != second.NeuronBID {
		t.Fatalf("canonical identity mismatch: first=%+v second=%+v", first, second)
	}
}

func TestSynapseParamsRejectSameNeuronPair(t *testing.T) {
	t.Parallel()

	_, err := synapseParams(mustScope(t), memory.Synapse{
		ID:        "synapse-1",
		NeuronAID: "neuron-a",
		NeuronBID: "neuron-a",
	})
	if err == nil {
		t.Fatal("synapseParams unexpectedly accepted a self-synapse")
	}
}

func TestRowDomainMapping(t *testing.T) {
	t.Parallel()

	day := time.Date(2026, 7, 2, 0, 0, 0, 0, time.UTC)
	instant := time.Date(2026, 7, 2, 3, 4, 5, 0, time.UTC)
	seed := int64(99)
	name := "market"

	diary := mapDiary(dbgen.InsertDiaryRow{
		ID:        "diary-1",
		Body:      "body",
		DiaryDate: pgDate(day),
		CreatedAt: pgTime(instant),
	})
	if diary.ID != "diary-1" || diary.Body != "body" || !diary.DiaryDate.Equal(day) || !diary.CreatedAt.Equal(instant) {
		t.Fatalf("mapDiary = %+v", diary)
	}

	episodicMemory := mapEpisodicMemory(dbgen.InsertEpisodicMemoryRow{
		ID:                       "memory-1",
		DiaryID:                  "diary-1",
		Name:                     "Evening walk",
		CurrentText:              "walked home",
		Seed:                     pgtype.Int8{Int64: seed, Valid: true},
		Mood:                     string(memory.MoodCalm),
		Valence:                  0.7,
		Arousal:                  0.2,
		Intensity:                0.5,
		BaseStrength:             0.6,
		RecallCount:              2,
		CreatedUniverseTime:      pgDate(day),
		LastRecalledUniverseTime: pgDate(day),
		SemanticStage:            1,
		SemanticizeTimerResetAt:  pgDate(day),
		DeletedAt:                pgTime(instant),
	})
	if episodicMemory.Seed == nil || *episodicMemory.Seed != seed || episodicMemory.LastRecalledUniverseTime == nil || episodicMemory.DeletedAt == nil {
		t.Fatalf("mapEpisodicMemory lost nullable fields: %+v", episodicMemory)
	}
	if episodicMemory.Emotion.Mood != memory.MoodCalm || !near(episodicMemory.BaseStrength, 0.6) || episodicMemory.SemanticStage != 1 {
		t.Fatalf("mapEpisodicMemory mapped fields incorrectly: %+v", episodicMemory)
	}
	if !near(episodicMemory.Emotion.Valence, 0.7) || !near(episodicMemory.Emotion.Arousal, 0.2) || !near(episodicMemory.Emotion.Intensity, 0.5) {
		t.Fatalf("mapEpisodicMemory mapped emotion incorrectly: %+v", episodicMemory.Emotion)
	}

	neuron := mapNeuron(dbgen.UpsertNeuronRow{
		ID:         "neuron-1",
		Name:       pgtype.Text{String: name, Valid: true},
		NeuronType: string(memory.NeuronTypeSpatial),
		CreatedAt:  pgTime(instant),
	})
	if neuron.Name == nil || *neuron.Name != name || neuron.Type != memory.NeuronTypeSpatial || !neuron.CreatedAt.Equal(instant) {
		t.Fatalf("mapNeuron = %+v", neuron)
	}

	activation := mapNeuronActivation(dbgen.InsertNeuronActivationRow{
		EpisodicMemoryID: "memory-1",
		NeuronID:         "neuron-1",
		Weight:           0.75,
	})
	if activation.EpisodicMemoryID != "memory-1" || activation.NeuronID != "neuron-1" || activation.Weight != 0.75 {
		t.Fatalf("mapNeuronActivation = %+v", activation)
	}

	synapse := mapSynapse(dbgen.UpsertSynapseRow{
		ID:                        "synapse-1",
		NeuronAID:                 "neuron-a",
		NeuronBID:                 "neuron-b",
		Strength:                  0.9,
		CoActivationCount:         3,
		LastActivatedUniverseTime: pgDate(day),
		CreatedAt:                 pgTime(instant),
	})
	if synapse.NeuronAID != "neuron-a" || synapse.NeuronBID != "neuron-b" || synapse.CoActivationCount != 3 {
		t.Fatalf("mapSynapse = %+v", synapse)
	}

	job := mapJob(dbgen.Job{
		ID:        "job-1",
		UserID:    "user-1",
		Kind:      string(memory.JobKindEmbed),
		Payload:   []byte(`{"neuron_id":"neuron-1"}`),
		Status:    string(memory.JobStatusPending),
		Attempts:  1,
		NextRunAt: pgTime(instant),
		CreatedAt: pgTime(instant),
	})
	if job.UserID != "user-1" || job.Kind != memory.JobKindEmbed || job.Status != memory.JobStatusPending || job.Attempts != 1 {
		t.Fatalf("mapJob = %+v", job)
	}
}

func TestEmbeddingVectorLiteralUsesGeneratedDimension(t *testing.T) {
	t.Parallel()

	vector := make([]float32, values.AiEmbeddingDim)
	vector[0] = 0.25
	vector[1] = -1.5
	got, err := vectorLiteral(vector)
	if err != nil {
		t.Fatalf("vectorLiteral failed: %v", err)
	}
	if !stringsHasPrefix(got, "[0.25,-1.5") {
		t.Fatalf("vectorLiteral = %q, want formatted prefix", got)
	}
	if _, err := vectorLiteral([]float32{0.25}); err == nil {
		t.Fatal("vectorLiteral unexpectedly accepted the wrong dimension")
	}
}

func TestEmbeddingRowMappingParsesPgvectorLiteral(t *testing.T) {
	t.Parallel()

	embedding, err := mapEmbedding(dbgen.InsertEmbeddingRow{
		NeuronID: "neuron-1",
		Vector:   "[0.25,-1.5]",
	})
	if err != nil {
		t.Fatalf("mapEmbedding failed: %v", err)
	}
	if embedding.NeuronID != "neuron-1" || !reflect.DeepEqual(embedding.Vector, []float32{0.25, -1.5}) {
		t.Fatalf("mapEmbedding = %+v", embedding)
	}
}

func TestSemanticStagesMappingPreservesNullAndFourStages(t *testing.T) {
	t.Parallel()

	if stages := semanticStagesPtr(nil); stages != nil {
		t.Fatalf("nil semantic stages = %v, want nil", stages)
	}
	stages := semanticStagesPtr([]byte(`["one","two","three","four"]`))
	if stages == nil || *stages != (memory.SemanticStages{"one", "two", "three", "four"}) {
		t.Fatalf("semanticStagesPtr = %v", stages)
	}
	if stages := semanticStagesPtr([]byte(`["one"]`)); stages != nil {
		t.Fatalf("short semantic stages = %v, want nil", stages)
	}
}

func TestDecayStagesMappingPreservesNullAndStages(t *testing.T) {
	t.Parallel()

	// NULL/empty and malformed JSON both read as nil — the read is derivation-only, so the client
	// falls back to current_text rather than the read erroring on a bad stored value.
	if stages := decayStagesSlice(nil); stages != nil {
		t.Fatalf("nil decay stages = %v, want nil", stages)
	}
	if stages := decayStagesSlice([]byte(`not json`)); stages != nil {
		t.Fatalf("malformed decay stages = %v, want nil", stages)
	}
	stages := decayStagesSlice([]byte(`["나는 오늘 xxxx","나는 xxxx xxxx"]`))
	if len(stages) != 2 || stages[0] != "나는 오늘 xxxx" || stages[1] != "나는 xxxx xxxx" {
		t.Fatalf("decayStagesSlice = %v", stages)
	}
}

func mustScope(t *testing.T) platform.UserScope {
	t.Helper()

	scope, err := platform.NewUserScope("user-1")
	if err != nil {
		t.Fatalf("NewUserScope failed: %v", err)
	}
	return scope
}

func stringsHasPrefix(value, prefix string) bool {
	return len(value) >= len(prefix) && value[:len(prefix)] == prefix
}

func near(got, want float64) bool {
	const tolerance = 0.000001
	if got < want {
		return want-got <= tolerance
	}
	return got-want <= tolerance
}
