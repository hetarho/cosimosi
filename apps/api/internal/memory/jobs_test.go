package memory

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/platform"
)

func revisionedJob(kind JobKind, target JobTarget) Job {
	return Job{
		ID:              "job-1",
		UserID:          "user-1",
		Kind:            kind,
		Payload:         []byte(`{}`),
		Status:          JobStatusRunning,
		LeaseGeneration: 3,
		Targets:         []JobTarget{target},
	}
}

func TestEmbedJobHandlerReadsCurrentSourceAndWritesRevisionedEmbedding(t *testing.T) {
	reader := &fakeJobSourceReader{embedSources: []EmbedJobSource{
		{NeuronID: "neuron-1", Text: "market renamed", ExpectedRevision: 2},
		{NeuronID: "neuron-2", Text: "mina", ExpectedRevision: 1},
	}}
	embedder := &fakeEmbedder{vectors: [][]float32{{0.1, 0.2}, {0.3, 0.4}}}
	writer := &fakeEmbeddingWriter{}
	handler := NewEmbedJobHandler(embedder, reader, writer)
	job := revisionedJob(JobKindEmbed, JobTarget{Kind: JobTargetNeuron, ID: "neuron-1", ExpectedRevision: 2})
	job.Targets = append(job.Targets, JobTarget{Kind: JobTargetNeuron, ID: "neuron-2", ExpectedRevision: 1})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if !reflect.DeepEqual(embedder.texts, []string{"market renamed", "mina"}) {
		t.Fatalf("embedder texts = %v", embedder.texts)
	}
	if writer.job.ID != job.ID || len(writer.embeddings) != 2 || writer.embeddings[0].ExpectedRevision != 2 {
		t.Fatalf("writer got job=%+v embeddings=%+v", writer.job, writer.embeddings)
	}
}

func TestEmbedJobHandlerSkipsMissingSealedOrSupersededSources(t *testing.T) {
	reader := &fakeJobSourceReader{}
	embedder := &fakeEmbedder{}
	writer := &fakeEmbeddingWriter{}
	handler := NewEmbedJobHandler(embedder, reader, writer)
	job := revisionedJob(JobKindEmbed, JobTarget{Kind: JobTargetNeuron, ID: "stale", ExpectedRevision: 1})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if embedder.calls != 0 || writer.calls != 0 {
		t.Fatalf("stale target made external/write calls: embed=%d write=%d", embedder.calls, writer.calls)
	}
}

func TestSemanticizeJobHandlerReadsCurrentSourceAndKeepsRisenStages(t *testing.T) {
	kept := SemanticStages{"keep-0", "keep-1", "old-2", "old-3"}
	reader := &fakeJobSourceReader{
		semanticOK: true,
		semanticSource: SemanticizeJobSource{
			Engram: SemanticizeMemory{
				ID:          "memory-1",
				Name:        "Current name",
				CurrentText: "current text",
				Mood:        MoodCalm,
				Neurons:     []ExtractedNeuron{{Name: "harbor", Type: NeuronTypeSemantic}},
			},
			ExpectedRevision: 4,
			RisenStage:       2,
			CurrentStages:    &kept,
		},
	}
	semanticizer := &fakeSemanticizer{stages: SemanticStages{"gen-0", "gen-1", "gen-2", "gen-3"}}
	writer := &fakeSemanticStagesWriter{}
	handler := NewSemanticizeJobHandler(semanticizer, reader, writer)
	job := revisionedJob(JobKindSemanticize, JobTarget{Kind: JobTargetMemory, ID: "memory-1", ExpectedRevision: 4})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if semanticizer.item.CurrentText != "current text" || semanticizer.item.Name != "Current name" {
		t.Fatalf("semanticizer item = %+v", semanticizer.item)
	}
	want := SemanticStages{"keep-0", "keep-1", "gen-2", "gen-3"}
	if writer.memoryID != "memory-1" || writer.expectedRevision != 4 || writer.stages != want {
		t.Fatalf("writer = memory %q revision %d stages %v", writer.memoryID, writer.expectedRevision, writer.stages)
	}
}

func TestSemanticizeJobHandlerRepairsMissingRisenStageFromCurrentSource(t *testing.T) {
	current := SemanticStages{"keep-0", "", "old-2", "old-3"}
	reader := &fakeJobSourceReader{
		semanticOK: true,
		semanticSource: SemanticizeJobSource{
			Engram:           SemanticizeMemory{ID: "memory-1", CurrentText: "current text"},
			ExpectedRevision: 4,
			RisenStage:       2,
			CurrentStages:    &current,
		},
	}
	semanticizer := &fakeSemanticizer{stages: SemanticStages{"gen-0", "gen-1", "gen-2", "gen-3"}}
	writer := &fakeSemanticStagesWriter{}
	handler := NewSemanticizeJobHandler(semanticizer, reader, writer)
	job := revisionedJob(JobKindSemanticize, JobTarget{Kind: JobTargetMemory, ID: "memory-1", ExpectedRevision: 4})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	want := SemanticStages{"keep-0", "gen-1", "gen-2", "gen-3"}
	if writer.stages != want {
		t.Fatalf("writer stages = %v, want missing risen stage repaired as %v", writer.stages, want)
	}
}

func TestSemanticizeJobHandlerSkipsUnavailableSource(t *testing.T) {
	reader := &fakeJobSourceReader{}
	semanticizer := &fakeSemanticizer{}
	writer := &fakeSemanticStagesWriter{}
	handler := NewSemanticizeJobHandler(semanticizer, reader, writer)
	job := revisionedJob(JobKindSemanticize, JobTarget{Kind: JobTargetMemory, ID: "memory-1", ExpectedRevision: 1})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if semanticizer.calls != 0 || writer.calls != 0 {
		t.Fatalf("unavailable target made external/write calls: semantic=%d write=%d", semanticizer.calls, writer.calls)
	}
}

func TestConsolidateJobHandlerUsesSameCurrentSourceFence(t *testing.T) {
	reader := &fakeJobSourceReader{embedSources: []EmbedJobSource{{NeuronID: "n1", Text: "harbor renamed", ExpectedRevision: 7}}}
	embedder := &fakeEmbedder{vectors: [][]float32{{0.5, 0.6}}}
	writer := &fakeEmbeddingWriter{}
	handler := NewConsolidateJobHandler(embedder, reader, writer)
	job := revisionedJob(JobKindConsolidate, JobTarget{Kind: JobTargetNeuron, ID: "n1", ExpectedRevision: 7})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if !reflect.DeepEqual(embedder.texts, []string{"harbor renamed"}) || writer.embeddings[0].ExpectedRevision != 7 {
		t.Fatalf("embed=%v writes=%+v", embedder.texts, writer.embeddings)
	}
}

func TestJobHandlersRejectSourceBearingPayloadAndInvalidTarget(t *testing.T) {
	reader := &fakeJobSourceReader{}
	handler := NewEmbedJobHandler(&fakeEmbedder{}, reader, &fakeEmbeddingWriter{})
	job := revisionedJob(JobKindEmbed, JobTarget{Kind: JobTargetNeuron, ID: "n1", ExpectedRevision: 1})
	job.Payload = []byte(`{"text":"must not survive"}`)
	if err := handler(context.Background(), job); !errors.Is(err, ErrJobPayload) {
		t.Fatalf("source-bearing payload error = %v, want ErrJobPayload", err)
	}
	job.Payload = []byte(`{}`)
	job.Targets = nil
	if err := handler(context.Background(), job); !errors.Is(err, ErrJobPayload) {
		t.Fatalf("missing target error = %v, want ErrJobPayload", err)
	}
	job.UserID = ""
	if err := handler(context.Background(), job); !errors.Is(err, ErrJobUserRequired) {
		t.Fatalf("missing user error = %v, want ErrJobUserRequired", err)
	}
}

func TestRetentionSweepJobHandlerUsesReleaseTarget(t *testing.T) {
	now := time.Date(2026, 7, 21, 0, 0, 0, 0, time.UTC)
	sweeper := &fakeDueReleaseSweeper{}
	handler := NewRetentionSweepJobHandler(sweeper, func() time.Time { return now })
	job := revisionedJob(JobKindRetention, JobTarget{Kind: JobTargetRelease, ID: "release-1"})

	if err := handler(context.Background(), job); err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if sweeper.releaseID != "release-1" || sweeper.scope.UserID() != "user-1" || !sweeper.now.Equal(now) {
		t.Fatalf("sweeper got scope=%q release=%q now=%v", sweeper.scope.UserID(), sweeper.releaseID, sweeper.now)
	}
}

type fakeEmbedder struct {
	texts   []string
	vectors [][]float32
	err     error
	calls   int
}

func (f *fakeEmbedder) Embed(_ context.Context, texts []string) ([][]float32, error) {
	f.calls++
	f.texts = append([]string(nil), texts...)
	return f.vectors, f.err
}

type fakeEmbeddingWriter struct {
	job        Job
	embeddings []RevisionedEmbedding
	err        error
	calls      int
}

func (f *fakeEmbeddingWriter) SaveJobEmbeddings(_ context.Context, job Job, embeddings []RevisionedEmbedding) error {
	f.calls++
	f.job = job
	f.embeddings = append([]RevisionedEmbedding(nil), embeddings...)
	return f.err
}

type fakeSemanticizer struct {
	item   SemanticizeMemory
	stages SemanticStages
	err    error
	calls  int
}

func (f *fakeSemanticizer) GenerateSemanticStages(_ context.Context, item SemanticizeMemory) (SemanticStages, error) {
	f.calls++
	f.item = item
	return f.stages, f.err
}

type fakeJobSourceReader struct {
	embedSources   []EmbedJobSource
	semanticSource SemanticizeJobSource
	semanticOK     bool
	err            error
	job            Job
}

func (f *fakeJobSourceReader) EmbedJobSources(_ context.Context, job Job) ([]EmbedJobSource, error) {
	f.job = job
	return append([]EmbedJobSource(nil), f.embedSources...), f.err
}

func (f *fakeJobSourceReader) SemanticizeJobSource(_ context.Context, job Job) (SemanticizeJobSource, bool, error) {
	f.job = job
	return f.semanticSource, f.semanticOK, f.err
}

type fakeSemanticStagesWriter struct {
	job              Job
	memoryID         string
	expectedRevision int64
	stages           SemanticStages
	err              error
	calls            int
}

func (f *fakeSemanticStagesWriter) SaveJobSemanticStages(_ context.Context, job Job, memoryID string, expectedRevision int64, stages SemanticStages) error {
	f.calls++
	f.job = job
	f.memoryID = memoryID
	f.expectedRevision = expectedRevision
	f.stages = stages
	return f.err
}

type fakeDueReleaseSweeper struct {
	scope     platform.UserScope
	releaseID string
	now       time.Time
	swept     bool
	err       error
}

func (f *fakeDueReleaseSweeper) SweepRelease(_ context.Context, scope platform.UserScope, releaseID string, now time.Time) (bool, error) {
	f.scope = scope
	f.releaseID = releaseID
	f.now = now
	return f.swept, f.err
}
