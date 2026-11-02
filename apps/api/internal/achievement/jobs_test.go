package achievement

import (
	"context"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"testing"
	"time"
)

type settlementQueue struct{ jobs []jobqueue.Record }

func (q *settlementQueue) EnqueueJob(_ context.Context, _ platform.UserScope, job jobqueue.Record) (jobqueue.Record, error) {
	q.jobs = append(q.jobs, job)
	return job, nil
}
func (*settlementQueue) CancelUserJob(context.Context, platform.UserScope, jobqueue.Kind, string) error {
	panic("settlement does not cancel")
}

type claimSettler struct{ users []string }

func (s *claimSettler) SettleClaims(_ context.Context, scope platform.UserScope) error {
	s.users = append(s.users, scope.UserID())
	return nil
}

func TestSettlementJobIdentityIsPerClaimAndHandlerRejectsForgedTargets(t *testing.T) {
	now := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	queue := &settlementQueue{}
	scheduler, err := NewSettlementJobScheduler(queue, func() time.Time { return now }, func() string { return "job" })
	if err != nil {
		t.Fatal(err)
	}
	scope, err := platform.NewUserScope("owner")
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"first", "second"} {
		if err := scheduler.Schedule(context.Background(), scope, id); err != nil {
			t.Fatal(err)
		}
	}
	if len(queue.jobs) != 2 || *queue.jobs[0].DedupKey != "achievement_settle:owner:first" || *queue.jobs[1].DedupKey != "achievement_settle:owner:second" {
		t.Fatalf("claim identities: %+v", queue.jobs)
	}
	settler := &claimSettler{}
	handler := NewSettlementJobHandler(settler)
	job := queue.jobs[0]
	if err := handler(context.Background(), job); err != nil {
		t.Fatal(err)
	}
	if len(settler.users) != 1 || settler.users[0] != "owner" {
		t.Fatalf("settlement scope: %v", settler.users)
	}
	job.Targets = []jobqueue.Target{{Kind: jobqueue.TargetUser, ID: "other"}}
	if err := handler(context.Background(), job); err == nil || len(settler.users) != 1 {
		t.Fatal("forged target reached settlement")
	}
}

// Persisted job rows name their kind by this string; renaming it would strand every queued job.
func TestSettlementJobKindIsPinned(t *testing.T) {
	if SettlementJobKind != "achievement_settle" {
		t.Fatalf("SettlementJobKind = %q, want %q", SettlementJobKind, "achievement_settle")
	}
}
