package pg

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/cosimosi/api/internal/memory"
	platformdb "github.com/cosimosi/api/internal/platform/db"
)

const maxTestJobDrainAttempts = 32

type singleRunJobRunner interface {
	RunOnce(context.Context) (bool, error)
}

type recordingJobQueue struct {
	Store
	claims []memory.Job
}

func (q *recordingJobQueue) ClaimDue(ctx context.Context, now time.Time) (memory.Job, error) {
	job, err := q.Store.ClaimDue(ctx, now)
	if err == nil {
		q.claims = append(q.claims, job)
	}
	return job, err
}

func (q *recordingJobQueue) claimSummary() string {
	if len(q.claims) == 0 {
		return "none"
	}
	claimed := make([]string, 0, len(q.claims))
	for _, job := range q.claims {
		claimed = append(claimed, fmt.Sprintf("%s/%s/%s", job.UserID, job.Kind, job.ID))
	}
	return strings.Join(claimed, ", ")
}

func drainJobToDone(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
	runner singleRunJobRunner,
	queue *recordingJobQueue,
	userID string,
	jobID string,
) {
	t.Helper()

	for attempt := 0; attempt < maxTestJobDrainAttempts; attempt++ {
		status := readTargetJobStatus(t, ctx, pool, userID, jobID)
		switch status {
		case memory.JobStatusDone:
			return
		case memory.JobStatusFailed, memory.JobStatusCanceled:
			t.Fatalf(
				"target job %s/%s reached terminal status %q; claimed: %s",
				userID,
				jobID,
				status,
				queue.claimSummary(),
			)
		}

		worked, err := runner.RunOnce(ctx)
		if err != nil {
			t.Fatalf(
				"drain target job %s/%s failed: %v; claimed: %s",
				userID,
				jobID,
				err,
				queue.claimSummary(),
			)
		}
		if !worked {
			t.Fatalf(
				"target job %s/%s remained %q with no due work; claimed: %s",
				userID,
				jobID,
				status,
				queue.claimSummary(),
			)
		}
	}

	status := readTargetJobStatus(t, ctx, pool, userID, jobID)
	t.Fatalf(
		"target job %s/%s remained %q after %d claims; claimed: %s",
		userID,
		jobID,
		status,
		maxTestJobDrainAttempts,
		queue.claimSummary(),
	)
}

func readTargetJobStatus(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
	userID string,
	jobID string,
) memory.JobStatus {
	t.Helper()

	var status memory.JobStatus
	if err := pool.PgxPool().QueryRow(
		ctx,
		"SELECT status FROM jobs WHERE user_id = $1 AND id = $2",
		userID,
		jobID,
	).Scan(&status); err != nil {
		t.Fatalf("read target job %s/%s failed: %v", userID, jobID, err)
	}
	return status
}

func findJobIDForTarget(
	t *testing.T,
	ctx context.Context,
	pool *platformdb.Pool,
	userID string,
	kind memory.JobKind,
	targetKind memory.JobTargetKind,
	targetID string,
) string {
	t.Helper()

	rows, err := pool.PgxPool().Query(ctx, `
		SELECT j.id
		FROM jobs AS j
		JOIN job_targets AS jt
		  ON jt.job_id = j.id
		 AND jt.user_id = j.user_id
		WHERE j.user_id = $1
		  AND j.kind = $2
		  AND jt.target_kind = $3
		  AND jt.target_id = $4
		ORDER BY j.created_at, j.id`, userID, kind, targetKind, targetID)
	if err != nil {
		t.Fatalf("find target job failed: %v", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			t.Fatalf("scan target job failed: %v", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate target jobs failed: %v", err)
	}
	if len(ids) != 1 {
		t.Fatalf(
			"target %s/%s/%s/%s matched job ids %v, want exactly one",
			userID,
			kind,
			targetKind,
			targetID,
			ids,
		)
	}
	return ids[0]
}

func valueOrNil[T any](value *T) any {
	if value == nil {
		return nil
	}
	return *value
}

func diagnosticValue(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("<%T: %v>", value, err)
	}
	return string(encoded)
}
