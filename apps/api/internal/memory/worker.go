package memory

import (
	"errors"
	"time"

	"github.com/cosimosi/api/internal/platform/jobqueue"
)

var ErrJobDepsRequired = errors.New("memory job registrations require their embedder, semanticizer and stores")

// JobDeps are the collaborators memory's durable jobs run against.
type JobDeps struct {
	Embedder             Embedder
	Semanticizer         Semanticizer
	Sources              JobSourceReader
	EmbeddingWriter      JobEmbeddingWriter
	SemanticStagesWriter JobSemanticStagesWriter
	Releases             ReleaseRepo
	Now                  func() time.Time
}

// JobRegistrations publishes the job kinds memory produces with their handlers and retry policy;
// the roots compose them with the other producers' into one runner. The retention sweep is the only
// durable trigger for a hard delete the user cannot request again, so it retries forever.
func JobRegistrations(deps JobDeps) (map[string]jobqueue.Registration[jobqueue.Record], error) {
	if deps.Embedder == nil || deps.Semanticizer == nil || deps.Sources == nil ||
		deps.EmbeddingWriter == nil || deps.SemanticStagesWriter == nil {
		return nil, ErrJobDepsRequired
	}
	sweeper, err := NewRetentionSweeper(deps.Releases)
	if err != nil {
		return nil, err
	}
	now := deps.Now
	if now == nil {
		now = func() time.Time { return time.Now().UTC() }
	}
	return map[string]jobqueue.Registration[jobqueue.Record]{
		string(JobKindEmbed):       {Handler: NewEmbedJobHandler(deps.Embedder, deps.Sources, deps.EmbeddingWriter)},
		string(JobKindSemanticize): {Handler: NewSemanticizeJobHandler(deps.Semanticizer, deps.Sources, deps.SemanticStagesWriter)},
		string(JobKindConsolidate): {Handler: NewConsolidateJobHandler(deps.Embedder, deps.Sources, deps.EmbeddingWriter)},
		string(JobKindRetention):   {Handler: NewRetentionSweepJobHandler(sweeper, now), RetryForever: true},
	}, nil
}
