package memory

import (
	"context"
	"errors"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"testing"
)

func TestNewJobRunnerRejectsDuplicateExtraHandlerKind(t *testing.T) {
	_, err := NewJobRunner(
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		WorkerConfig{},
		map[JobKind]jobqueue.Registration[Job]{
			JobKindEmbed: {Handler: func(context.Context, Job) error { return nil }},
		},
	)
	if !errors.Is(err, ErrDuplicateJobHandler) {
		t.Fatalf("NewJobRunner error = %v, want ErrDuplicateJobHandler", err)
	}
}
