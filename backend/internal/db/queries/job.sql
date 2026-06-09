-- Async job queue. The RecordMemory transaction enqueues; the embedding
-- worker claims/completes/fails. Jobs are never deleted — a give-up is
-- preserved as status='failed' (constitution §1/§2).

-- name: EnqueueJob :exec
-- Hands embedding/linking to the async worker. RecordMemory only enqueues.
INSERT INTO jobs (id, memory_id, kind, status)
VALUES ($1, $2, 'embed', 'pending');

-- name: ClaimJob :one
-- Atomically claim one job of the kind and mark it running. FOR UPDATE SKIP LOCKED
-- makes concurrent workers safe. Two cases are claimable:
--   (a) a due pending job (status='pending' AND next_run_at<=now()), or
--   (b) a STALE running job (status='running' whose updated_at is older than the
--       lease) — a worker that was killed/crashed/shut down after claiming but
--       before Complete/Fail left it stranded; the lease lets the next worker
--       reclaim it instead of it being orphaned forever. Reclaim does NOT bump
--       attempts (the interruption is not the job's fault). All pipeline steps are
--       idempotent, so reprocessing a reclaimed job is safe.
-- Returns no rows when nothing is claimable.
UPDATE jobs
SET status = 'running', updated_at = now()
WHERE id = (
    SELECT j.id FROM jobs j
    WHERE j.kind = @kind
      AND (
        (j.status = 'pending' AND j.next_run_at <= now())
        OR (j.status = 'running' AND j.updated_at < now() - make_interval(secs => @lease_seconds::float8))
      )
    ORDER BY j.next_run_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, memory_id, attempts;

-- name: CompleteJob :exec
UPDATE jobs SET status = 'done', updated_at = now() WHERE id = @id;

-- name: FailJob :exec
-- Records the failure and reschedules. The worker passes status='pending' with a
-- backed-off next_run_at to retry, or status='failed' once attempts hit the cap
-- (preserve, never delete). attempts is incremented here.
UPDATE jobs
SET status      = @status,
    attempts    = attempts + 1,
    error       = @error,
    next_run_at = @next_run_at,
    updated_at  = now()
WHERE id = @id;
