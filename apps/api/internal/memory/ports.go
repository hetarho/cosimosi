package memory

import (
	"context"
	"time"
)

type Extractor interface {
	Split(ctx context.Context, body string, diaryDate time.Time, existingNeurons []ExistingNeuron) (ExtractResult, error)
	ReviseSplit(ctx context.Context, prior ExtractResult, instruction string) (ExtractResult, error)
}

type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
}

type Semanticizer interface {
	GenerateSemanticStages(ctx context.Context, memory SemanticizeMemory) (SemanticStages, error)
}

type JobQueue interface {
	ClaimDue(ctx context.Context, now time.Time) (Job, error)
	Complete(ctx context.Context, job Job) error
	Retry(ctx context.Context, job Job, nextAttempts int32, nextRunAt time.Time) error
	Fail(ctx context.Context, job Job, nextAttempts int32) error
}

type EmbeddingWriter interface {
	UpsertEmbeddings(ctx context.Context, userID string, embeddings []Embedding) error
}

type SemanticStagesWriter interface {
	SaveSemanticStages(ctx context.Context, userID string, memoryID string, stages SemanticStages) error
}

type ExistingNeuron struct {
	ID   string
	Name string
	Type NeuronType
}

type ExtractResult struct {
	Memories []ExtractedMemory
}

type ExtractedMemory struct {
	Name    string
	Mood    Mood
	Neurons []ExtractedNeuron
}

type ExtractedNeuron struct {
	Name string
	Type NeuronType
}

type SemanticizeMemory struct {
	ID          string
	Name        string
	CurrentText string
	Mood        Mood
	Neurons     []ExtractedNeuron
}
