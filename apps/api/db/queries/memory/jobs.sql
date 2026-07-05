-- name: ClaimDueJob :one
WITH next_job AS (
    SELECT j.id
    FROM jobs AS j
    WHERE j.next_run_at <= sqlc.arg(now_at)
      AND j.status IN ('pending', 'running')
    ORDER BY j.next_run_at, j.created_at, j.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE jobs
SET status = 'running',
    next_run_at = sqlc.arg(lease_until),
    lease_generation = lease_generation + 1
WHERE id = (SELECT id FROM next_job)
RETURNING id, user_id, kind, payload, status, attempts, next_run_at, created_at, lease_generation;

-- name: CompleteJob :one
UPDATE jobs
SET status = 'done'
WHERE user_id = $1
  AND id = $2
  AND status = 'running'
  AND lease_generation = $3
RETURNING id, user_id, kind, payload, status, attempts, next_run_at, created_at, lease_generation;

-- name: RetryJob :one
UPDATE jobs
SET status = 'pending',
    attempts = $3,
    next_run_at = $4
WHERE user_id = $1
  AND id = $2
  AND status = 'running'
  AND lease_generation = $5
RETURNING id, user_id, kind, payload, status, attempts, next_run_at, created_at, lease_generation;

-- name: FailJob :one
UPDATE jobs
SET status = 'failed',
    attempts = $3
WHERE user_id = $1
  AND id = $2
  AND status = 'running'
  AND lease_generation = $4
RETURNING id, user_id, kind, payload, status, attempts, next_run_at, created_at, lease_generation;

-- name: SetSemanticStages :one
UPDATE episodic_memories
SET semantic_stages = $3::jsonb
WHERE user_id = $1
  AND id = $2
  AND deleted_at IS NULL
RETURNING id, semantic_stages;
