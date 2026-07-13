package memory

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

func TestEmbedJobHandlerWritesEmbeddingsForPayloadNeurons(t *testing.T) {
	embedder := &fakeEmbedder{vectors: [][]float32{{0.1, 0.2}, {0.3, 0.4}}}
	writer := &fakeEmbeddingWriter{}
	handler := NewEmbedJobHandler(embedder, writer)

	err := handler(context.Background(), Job{
		ID:      "job-1",
		UserID:  "user-1",
		Kind:    JobKindEmbed,
		Payload: []byte(`{"neurons":[{"id":"neuron-1","text":"market"},{"id":"neuron-2","text":"mina"}]}`),
	})
	if err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if !reflect.DeepEqual(embedder.texts, []string{"market", "mina"}) {
		t.Fatalf("embedder texts = %v", embedder.texts)
	}
	if writer.userID != "user-1" || len(writer.embeddings) != 2 || writer.embeddings[0].NeuronID != "neuron-1" {
		t.Fatalf("writer got user=%q embeddings=%+v", writer.userID, writer.embeddings)
	}
}

func TestSemanticizeJobHandlerWritesOnlySemanticStages(t *testing.T) {
	semanticizer := &fakeSemanticizer{stages: SemanticStages{"one", "two", "three", "four"}}
	writer := &fakeSemanticStagesWriter{}
	handler := NewSemanticizeJobHandler(semanticizer, writer)

	err := handler(context.Background(), Job{
		ID:      "job-1",
		UserID:  "user-1",
		Kind:    JobKindSemanticize,
		Payload: []byte(`{"memory_id":"memory-1","name":"Market","current_text":"Met Mina","mood":"CALM","neurons":[{"name":"market","type":"semantic"}]}`),
	})
	if err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if semanticizer.item.ID != "memory-1" || semanticizer.item.CurrentText != "Met Mina" {
		t.Fatalf("semanticizer item = %+v", semanticizer.item)
	}
	if writer.userID != "user-1" || writer.memoryID != "memory-1" || writer.stages != semanticizer.stages {
		t.Fatalf("writer got user=%q memory=%q stages=%v", writer.userID, writer.memoryID, writer.stages)
	}
}

func TestConsolidateJobHandlerReembedsCurrentNeuronTexts(t *testing.T) {
	embedder := &fakeEmbedder{vectors: [][]float32{{0.5, 0.6}}}
	writer := &fakeEmbeddingWriter{}
	// The payload carries identity only; the handler re-reads the authoritative texts at
	// execution, so a rename between enqueue and run embeds the current name — and the
	// unnamed neuron is skipped (nothing to re-embed), not failed.
	reader := &fakeNeuronTextReader{neurons: []ExistingNeuron{
		{ID: "n1", Name: "harbor renamed", Type: NeuronTypeSemantic},
		{ID: "n2", Name: "", Type: NeuronTypeEntity},
	}}
	handler := NewConsolidateJobHandler(embedder, writer, reader)

	err := handler(context.Background(), Job{
		ID:      "job-1",
		UserID:  "user-1",
		Kind:    JobKindConsolidate,
		Payload: []byte(`{"from_universe_time":"2026-01-01","to_universe_time":"2026-01-20","memory_ids":["m1"],"neuron_ids":["n1","n2"]}`),
	})
	if err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if reader.userID != "user-1" || !reflect.DeepEqual(reader.requested, []string{"n1", "n2"}) {
		t.Fatalf("reader got user=%q ids=%v", reader.userID, reader.requested)
	}
	if !reflect.DeepEqual(embedder.texts, []string{"harbor renamed"}) {
		t.Fatalf("embedder texts = %v, want the current named neuron only", embedder.texts)
	}
	if writer.userID != "user-1" || len(writer.embeddings) != 1 || writer.embeddings[0].NeuronID != "n1" {
		t.Fatalf("writer got user=%q embeddings=%+v", writer.userID, writer.embeddings)
	}
}

func TestJobHandlersValidateUserAndPayload(t *testing.T) {
	handler := NewEmbedJobHandler(&fakeEmbedder{}, &fakeEmbeddingWriter{})
	if err := handler(context.Background(), Job{Payload: []byte(`{"neurons":[]}`)}); !errors.Is(err, ErrJobUserRequired) {
		t.Fatalf("missing user error = %v, want ErrJobUserRequired", err)
	}
	if err := handler(context.Background(), Job{UserID: "user-1", Payload: []byte(`not-json`)}); !errors.Is(err, ErrJobPayload) {
		t.Fatalf("bad payload error = %v, want ErrJobPayload", err)
	}
}

type fakeEmbedder struct {
	texts   []string
	vectors [][]float32
}

func (f *fakeEmbedder) Embed(_ context.Context, texts []string) ([][]float32, error) {
	f.texts = append([]string(nil), texts...)
	return f.vectors, nil
}

type fakeEmbeddingWriter struct {
	userID     string
	embeddings []Embedding
}

func (f *fakeEmbeddingWriter) UpsertEmbeddings(_ context.Context, userID string, embeddings []Embedding) error {
	f.userID = userID
	f.embeddings = append([]Embedding(nil), embeddings...)
	return nil
}

type fakeSemanticizer struct {
	item   SemanticizeMemory
	stages SemanticStages
}

func (f *fakeSemanticizer) GenerateSemanticStages(_ context.Context, item SemanticizeMemory) (SemanticStages, error) {
	f.item = item
	return f.stages, nil
}

type fakeNeuronTextReader struct {
	userID    string
	requested []string
	neurons   []ExistingNeuron
}

func (f *fakeNeuronTextReader) NeuronEmbedTexts(_ context.Context, userID string, neuronIDs []string) ([]ExistingNeuron, error) {
	f.userID = userID
	f.requested = append([]string(nil), neuronIDs...)
	return f.neurons, nil
}

type fakeSemanticStagesWriter struct {
	userID   string
	memoryID string
	stages   SemanticStages
}

func (f *fakeSemanticStagesWriter) SaveSemanticStages(_ context.Context, userID string, memoryID string, stages SemanticStages) error {
	f.userID = userID
	f.memoryID = memoryID
	f.stages = stages
	return nil
}
