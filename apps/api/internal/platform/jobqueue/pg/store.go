package pg

import (
	"context"
	"encoding/json"
	"errors"
	dbgen "github.com/cosimosi/api/db/gen"
	"github.com/cosimosi/api/internal/platform"
	"github.com/cosimosi/api/internal/platform/jobqueue"
	"github.com/cosimosi/api/internal/platform/values"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"time"
)

var ErrQueriesRequired = errors.New("job store requires database queries")
var ErrUserScopeRequired = errors.New("job store requires authenticated user scope")

type Store struct{ queries *dbgen.Queries }

func NewStore(db dbgen.DBTX) Store { return Store{queries: dbgen.New(db)} }
func (s Store) ready(scope platform.UserScope) error {
	if scope.UserID() == "" {
		return ErrUserScopeRequired
	}
	if s.queries == nil {
		return ErrQueriesRequired
	}
	return nil
}
func (s Store) readyJob(job jobqueue.Record) error {
	if job.ID == "" {
		return errors.New("job requires an id")
	}
	scope, err := platform.NewUserScope(job.UserID)
	if err != nil {
		return ErrUserScopeRequired
	}
	return s.ready(scope)
}
func pgTime(v time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: v, Valid: !v.IsZero()} }
func pgText(v *string) pgtype.Text {
	if v == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *v, Valid: true}
}
func timeOrNow(v time.Time) time.Time {
	if v.IsZero() {
		return time.Now().UTC()
	}
	return v
}
func timeValue(v pgtype.Timestamptz) time.Time { return v.Time }
func timePtr(v pgtype.Timestamptz) *time.Time {
	if !v.Valid {
		return nil
	}
	return &v.Time
}
func textPtr(v pgtype.Text) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}
func (s Store) EnqueueJob(ctx context.Context, scope platform.UserScope, job jobqueue.Record) (jobqueue.Record, error) {
	if err := s.ready(scope); err != nil {
		return jobqueue.Record{}, err
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(job.Payload, &payload); err != nil || payload == nil || len(payload) != 0 {
		return jobqueue.Record{}, errors.New("memory job payload must be an empty object")
	}
	if len(job.Targets) == 0 {
		return jobqueue.Record{}, errors.New("memory job requires at least one target")
	}
	targetKinds := make([]string, 0, len(job.Targets))
	targetIDs := make([]string, 0, len(job.Targets))
	expectedRevisions := make([]int64, 0, len(job.Targets))
	for _, target := range job.Targets {
		if target.Kind == "" || target.ID == "" {
			return jobqueue.Record{}, errors.New("memory job target requires kind and id")
		}
		targetKinds = append(targetKinds, string(target.Kind))
		targetIDs = append(targetIDs, target.ID)
		expectedRevisions = append(expectedRevisions, target.ExpectedRevision)
	}
	row, err := s.queries.EnqueueJob(ctx, dbgen.EnqueueJobParams{
		ID:                job.ID,
		UserID:            scope.UserID(),
		Kind:              string(job.Kind),
		Payload:           job.Payload,
		Status:            string(job.Status),
		Attempts:          job.Attempts,
		NextRunAt:         pgTime(timeOrNow(job.NextRunAt)),
		CreatedAt:         pgTime(timeOrNow(job.CreatedAt)),
		DedupKey:          pgText(job.DedupKey),
		TargetKinds:       targetKinds,
		TargetIds:         targetIDs,
		ExpectedRevisions: expectedRevisions,
	})
	if err != nil {
		return jobqueue.Record{}, err
	}
	mapped := mapEnqueuedJob(row)
	mapped.Targets = append([]jobqueue.Target(nil), job.Targets...)
	return mapped, nil
}

func (s Store) ClaimDue(ctx context.Context, now time.Time) (jobqueue.Record, error) {
	if s.queries == nil {
		return jobqueue.Record{}, ErrQueriesRequired
	}
	claimAt := timeOrNow(now)
	row, err := s.queries.ClaimDueJob(ctx, dbgen.ClaimDueJobParams{
		LeaseUntil: pgTime(jobLeaseUntil(claimAt)),
		NowAt:      pgTime(claimAt),
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return jobqueue.Record{}, jobqueue.ErrNoJob
	}
	if err != nil {
		return jobqueue.Record{}, err
	}
	job := mapJob(row)
	targetRows, err := s.queries.ListJobTargets(ctx, dbgen.ListJobTargetsParams{
		UserID: job.UserID,
		JobID:  job.ID,
	})
	if err != nil {
		return jobqueue.Record{}, err
	}
	job.Targets = mapJobTargets(targetRows)
	return job, nil
}

func (s Store) Complete(ctx context.Context, job jobqueue.Record) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	_, err := s.queries.CompleteJob(ctx, dbgen.CompleteJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		LeaseGeneration: job.LeaseGeneration,
	})
	return ignoreLostLease(err)
}

// HasActiveTargetJob reports whether a pending or running job of kind already targets the row at
// the expected revision, so a producer can avoid stacking duplicate work on an unfinished job.
func (s Store) HasActiveTargetJob(ctx context.Context, scope platform.UserScope, kind jobqueue.Kind, target jobqueue.Target) (bool, error) {
	if err := s.ready(scope); err != nil {
		return false, err
	}
	return s.queries.HasActiveTargetJob(ctx, dbgen.HasActiveTargetJobParams{
		UserID:           scope.UserID(),
		TargetKind:       string(target.Kind),
		TargetID:         target.ID,
		ExpectedRevision: target.ExpectedRevision,
		Kind:             string(kind),
	})
}

func (s Store) CancelUserJob(
	ctx context.Context,
	scope platform.UserScope,
	kind jobqueue.Kind,
	dedupKey string,
) error {
	if err := s.ready(scope); err != nil {
		return err
	}
	_, err := s.queries.CancelUserJob(ctx, dbgen.CancelUserJobParams{
		UserID:   scope.UserID(),
		Kind:     string(kind),
		DedupKey: pgtype.Text{String: dedupKey, Valid: true},
	})
	return err
}

func (s Store) Retry(ctx context.Context, job jobqueue.Record, nextAttempts int32, nextRunAt time.Time) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	_, err := s.queries.RetryJob(ctx, dbgen.RetryJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		Attempts:        nextAttempts,
		NextRunAt:       pgTime(nextRunAt),
		LeaseGeneration: job.LeaseGeneration,
	})
	return ignoreLostLease(err)
}

// DeadLetter ends a job the runner refuses to run again. It is the same terminal write as Fail —
// the row survives, so nothing is deleted and an operator can still see and requeue it — kept as a
// separate method so a queue wrapper that overrides the retry policy cannot also disable the
// runner's kill-loop breaker.
func (s Store) DeadLetter(ctx context.Context, job jobqueue.Record, _ jobqueue.DeadLetterCause) error {
	return s.Fail(ctx, job, job.Attempts)
}

func (s Store) Fail(ctx context.Context, job jobqueue.Record, nextAttempts int32) error {
	if err := s.readyJob(job); err != nil {
		return err
	}
	_, err := s.queries.FailJob(ctx, dbgen.FailJobParams{
		UserID:          job.UserID,
		ID:              job.ID,
		Attempts:        nextAttempts,
		LeaseGeneration: job.LeaseGeneration,
	})
	return ignoreLostLease(err)
}

// ignoreLostLease swallows the no-rows result of a fenced terminal transition: the
// job's lease was superseded by another worker's re-claim, so this worker no longer
// owns it and must not treat the missed update as an error.
func ignoreLostLease(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	return err
}

func (s Store) PurgeTerminalJobs(ctx context.Context, cutoff time.Time, batchSize int32) (int, error) {
	if s.queries == nil {
		return 0, ErrQueriesRequired
	}
	if batchSize <= 0 {
		return 0, errors.New("terminal job purge requires a positive batch size")
	}
	ids, err := s.queries.PurgeTerminalJobs(ctx, dbgen.PurgeTerminalJobsParams{
		Cutoff:    pgTime(cutoff),
		BatchSize: batchSize,
	})
	return len(ids), err
}

func jobLeaseUntil(now time.Time) time.Time {
	return now.Add(jobLeaseDuration())
}

// The lease only has to outlast one handler run — long enough that a healthy worker
// finishes before another can re-claim, short enough that a dead worker's job frees up
// promptly. It is its own knob, not coupled to the (exponential) retry backoff.
func jobLeaseDuration() time.Duration {
	return time.Duration(values.AiJobLeaseMs) * time.Millisecond
}

func mapJob(row dbgen.Job) jobqueue.Record {
	return jobqueue.Record{
		ID:                  row.ID,
		UserID:              row.UserID,
		Kind:                jobqueue.Kind(row.Kind),
		Payload:             row.Payload,
		Status:              jobqueue.Status(row.Status),
		Attempts:            row.Attempts,
		NextRunAt:           timeValue(row.NextRunAt),
		CreatedAt:           timeValue(row.CreatedAt),
		DedupKey:            textPtr(row.DedupKey),
		TerminalAt:          timePtr(row.TerminalAt),
		CanceledByReleaseID: textPtr(row.CancelledByReleaseID),
		LeaseGeneration:     row.LeaseGeneration,
	}
}

func mapEnqueuedJob(row dbgen.EnqueueJobRow) jobqueue.Record {
	return jobqueue.Record{
		ID:                  row.ID,
		UserID:              row.UserID,
		Kind:                jobqueue.Kind(row.Kind),
		Payload:             row.Payload,
		Status:              jobqueue.Status(row.Status),
		Attempts:            row.Attempts,
		NextRunAt:           timeValue(row.NextRunAt),
		CreatedAt:           timeValue(row.CreatedAt),
		DedupKey:            textPtr(row.DedupKey),
		TerminalAt:          timePtr(row.TerminalAt),
		CanceledByReleaseID: textPtr(row.CancelledByReleaseID),
		LeaseGeneration:     row.LeaseGeneration,
	}
}

func mapJobTargets(rows []dbgen.ListJobTargetsRow) []jobqueue.Target {
	targets := make([]jobqueue.Target, 0, len(rows))
	for _, row := range rows {
		targets = append(targets, jobqueue.Target{
			Kind:             jobqueue.TargetKind(row.TargetKind),
			ID:               row.TargetID,
			ExpectedRevision: row.ExpectedRevision.Int64,
		})
	}
	return targets
}
