package memory

import (
	"log"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
)

type WorkerConfig struct {
	MaxAttempts  int32
	MaxClaims    int32
	BackoffBase  time.Duration
	PollInterval time.Duration
	Now          func() time.Time
	Logger       *log.Logger
}

type WorkerStore interface {
	JobQueue
	EmbeddingWriter
	SemanticStagesWriter
}

func DefaultWorkerConfig(pollInterval time.Duration, logger *log.Logger) WorkerConfig {
	return WorkerConfig{
		MaxAttempts:  int32(values.AiJobMaxAttempts),
		MaxClaims:    int32(values.AiJobMaxClaims),
		BackoffBase:  time.Duration(values.AiJobBackoffBaseMs) * time.Millisecond,
		PollInterval: pollInterval,
		Logger:       logger,
	}
}

func NewDefaultJobRunner(
	store WorkerStore,
	embedder Embedder,
	semanticizer Semanticizer,
	pollInterval time.Duration,
	logger *log.Logger,
) (jobqueue.Runner[Job], error) {
	return NewJobRunner(
		store,
		store,
		store,
		embedder,
		semanticizer,
		DefaultWorkerConfig(pollInterval, logger),
	)
}

func NewJobRunner(
	queue JobQueue,
	embeddingWriter EmbeddingWriter,
	semanticStagesWriter SemanticStagesWriter,
	embedder Embedder,
	semanticizer Semanticizer,
	cfg WorkerConfig,
) (jobqueue.Runner[Job], error) {
	handlers := map[string]jobqueue.Handler[Job]{
		string(JobKindEmbed):       NewEmbedJobHandler(embedder, embeddingWriter),
		string(JobKindSemanticize): NewSemanticizeJobHandler(semanticizer, semanticStagesWriter),
	}
	return jobqueue.NewRunner[Job](queue, handlers, jobqueue.Config{
		MaxAttempts:  cfg.MaxAttempts,
		MaxClaims:    cfg.MaxClaims,
		BackoffBase:  cfg.BackoffBase,
		PollInterval: cfg.PollInterval,
		Now:          cfg.Now,
		Logger:       cfg.Logger,
	})
}
