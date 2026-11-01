package pg

import (
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"testing"
	"time"
)

func TestMapJobPreservesPersistedEnvelope(t *testing.T) {
	instant := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	job := mapJob(dbgen.Job{
		ID:        "job-1",
		UserID:    "user-1",
		Kind:      "embed",
		Payload:   []byte(`{"neuron_id":"neuron-1"}`),
		Status:    string(jobqueue.StatusPending),
		Attempts:  1,
		NextRunAt: pgTime(instant),
		CreatedAt: pgTime(instant),
	})
	if job.UserID != "user-1" || job.Kind != jobqueue.Kind("embed") || job.Status != jobqueue.StatusPending || job.Attempts != 1 {
		t.Fatalf("mapJob = %+v", job)
	}
}
