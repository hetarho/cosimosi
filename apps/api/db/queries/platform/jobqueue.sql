-- Shared queue envelopes, claims and lease transitions. Product source reads stay with their owner.

-- name: ClaimDueJob :one
WITH next_job AS (
    SELECT j.id
    FROM jobs AS j
    WHERE j.next_run_at <= sqlc.arg(now_at)
      AND j.status IN ('pending', 'running')
      AND j.terminal_at IS NULL
      AND EXISTS (
          SELECT 1
          FROM job_targets AS jt
          WHERE jt.job_id = j.id
            AND jt.user_id = j.user_id
      )
    ORDER BY j.next_run_at, j.created_at, j.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE jobs
SET status = 'running',
    next_run_at = sqlc.arg(lease_until),
    lease_generation = lease_generation + 1
WHERE id = (SELECT id FROM next_job)
RETURNING
    id, user_id, kind, payload, status, attempts, next_run_at, created_at,
    lease_generation, dedup_key, terminal_at, cancelled_by_release_id;


-- name: ListJobTargets :many
SELECT target_kind, target_id, expected_revision
FROM job_targets
WHERE user_id = sqlc.arg(user_id)
  AND job_id = sqlc.arg(job_id)
ORDER BY target_kind, target_id;


-- name: CompleteJob :one
UPDATE jobs
SET status = 'done',
    terminal_at = clock_timestamp()
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(id)
  AND status = 'running'
  AND lease_generation = sqlc.arg(lease_generation)
RETURNING
    id, user_id, kind, payload, status, attempts, next_run_at, created_at,
    lease_generation, dedup_key, terminal_at, cancelled_by_release_id;

-- Restore cancels the one account-withdrawal trigger by its user-scoped dedup identity.
-- The target cascades with the job; a missing row is an idempotent success.

-- name: CancelUserJob :execrows
DELETE FROM jobs
WHERE user_id = sqlc.arg(user_id)
  AND kind = sqlc.arg(kind)
  AND dedup_key = sqlc.arg(dedup_key);


-- name: RetryJob :one
UPDATE jobs
SET status = 'pending',
    attempts = sqlc.arg(attempts),
    next_run_at = sqlc.arg(next_run_at),
    terminal_at = NULL
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(id)
  AND status = 'running'
  AND lease_generation = sqlc.arg(lease_generation)
RETURNING
    id, user_id, kind, payload, status, attempts, next_run_at, created_at,
    lease_generation, dedup_key, terminal_at, cancelled_by_release_id;


-- name: FailJob :one
UPDATE jobs
SET status = 'failed',
    attempts = sqlc.arg(attempts),
    terminal_at = clock_timestamp()
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(id)
  AND status = 'running'
  AND lease_generation = sqlc.arg(lease_generation)
RETURNING
    id, user_id, kind, payload, status, attempts, next_run_at, created_at,
    lease_generation, dedup_key, terminal_at, cancelled_by_release_id;


-- name: PurgeTerminalJobs :many
-- This is the queue owner's sole bounded, global maintenance scan. Product
-- reads/writes remain user-scoped. A failed retention trigger stays until its
-- release group is gone, preserving eventual user-originated hard deletion.
WITH expired AS (
    SELECT j.id
    FROM jobs AS j
    WHERE j.terminal_at < sqlc.arg(cutoff)
      AND j.status IN ('done', 'failed', 'cancelled')
      AND NOT (
          j.kind = 'retention_sweep'
          AND EXISTS (
              SELECT 1
              FROM job_targets AS jt
              JOIN release_groups AS rg
                ON rg.id = jt.target_id
               AND rg.user_id = jt.user_id
              WHERE jt.job_id = j.id
                AND jt.user_id = j.user_id
                AND jt.target_kind = 'release_group'
          )
      )
    ORDER BY j.terminal_at, j.id
    FOR UPDATE SKIP LOCKED
    LIMIT sqlc.arg(batch_size)
)
DELETE FROM jobs AS j
USING expired
WHERE j.id = expired.id
RETURNING j.id;

-- name: EnqueueJob :one
WITH inserted_job AS (
    INSERT INTO jobs (
        id,
        user_id,
        kind,
        payload,
        status,
        attempts,
        next_run_at,
        created_at,
        dedup_key
    ) VALUES (
        sqlc.arg(id),
        sqlc.arg(user_id),
        sqlc.arg(kind),
        sqlc.arg(payload),
        sqlc.arg(status),
        sqlc.arg(attempts),
        sqlc.arg(next_run_at),
        sqlc.arg(created_at),
        sqlc.narg(dedup_key)
    )
    ON CONFLICT (user_id, kind, dedup_key) WHERE dedup_key IS NOT NULL
    DO UPDATE SET dedup_key = jobs.dedup_key
    RETURNING
        id, user_id, kind, payload, status, attempts, next_run_at, created_at,
        lease_generation, dedup_key, terminal_at, cancelled_by_release_id
), inserted_targets AS (
    INSERT INTO job_targets (
        job_id,
        user_id,
        target_kind,
        target_id,
        expected_revision
    )
    SELECT
        inserted_job.id,
        inserted_job.user_id,
        target.target_kind,
        target.target_id,
        NULLIF(target.expected_revision, 0)
    FROM inserted_job
    CROSS JOIN LATERAL (
        SELECT
            UNNEST(sqlc.arg(target_kinds)::text[]) AS target_kind,
            UNNEST(sqlc.arg(target_ids)::text[]) AS target_id,
            UNNEST(sqlc.arg(expected_revisions)::bigint[]) AS expected_revision
    ) AS target
    ON CONFLICT DO NOTHING
    RETURNING job_id
)
SELECT
    id, user_id, kind, payload, status, attempts, next_run_at, created_at,
    lease_generation, dedup_key, terminal_at, cancelled_by_release_id
FROM inserted_job;
