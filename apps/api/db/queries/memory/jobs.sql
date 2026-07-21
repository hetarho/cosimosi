-- Worker-owned queue transitions and deletion-safe current-source persistence.

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

-- name: ListLiveNeuronJobSources :many
SELECT n.id, n.name, jt.expected_revision
FROM neurons AS n
JOIN job_targets AS jt
  ON jt.user_id = n.user_id
 AND jt.target_kind = 'neuron'
 AND jt.target_id = n.id
 AND jt.expected_revision = n.representation_revision
JOIN jobs AS j
  ON j.id = jt.job_id
 AND j.user_id = jt.user_id
WHERE j.user_id = sqlc.arg(user_id)
  AND j.id = sqlc.arg(job_id)
  AND j.status = 'running'
  AND j.terminal_at IS NULL
  AND j.lease_generation = sqlc.arg(lease_generation)
  AND n.sealed_at IS NULL
  AND n.name IS NOT NULL
  AND btrim(n.name) <> ''
ORDER BY n.id;

-- name: LoadLiveSemanticizeJobSource :one
SELECT
    em.id,
    em.name,
    em.current_text,
    em.mood,
    em.semantic_stage,
    em.semantic_stages,
    em.representation_revision,
    COALESCE(
        ARRAY_AGG(n.name::text ORDER BY n.id)
            FILTER (WHERE n.id IS NOT NULL AND n.name IS NOT NULL AND btrim(n.name) <> ''),
        ARRAY[]::text[]
    )::text[] AS neuron_names,
    COALESCE(
        ARRAY_AGG(n.neuron_type::text ORDER BY n.id)
            FILTER (WHERE n.id IS NOT NULL AND n.name IS NOT NULL AND btrim(n.name) <> ''),
        ARRAY[]::text[]
    )::text[] AS neuron_types
FROM episodic_memories AS em
JOIN job_targets AS jt
  ON jt.user_id = em.user_id
 AND jt.target_kind = 'episodic_memory'
 AND jt.target_id = em.id
 AND jt.expected_revision = em.representation_revision
JOIN jobs AS j
  ON j.id = jt.job_id
 AND j.user_id = jt.user_id
LEFT JOIN neuron_activations AS na
  ON na.episodic_memory_id = em.id
 AND na.user_id = em.user_id
LEFT JOIN neurons AS n
  ON n.id = na.neuron_id
 AND n.user_id = na.user_id
 AND n.sealed_at IS NULL
WHERE j.user_id = sqlc.arg(user_id)
  AND j.id = sqlc.arg(job_id)
  AND j.kind = 'semanticize'
  AND j.status = 'running'
  AND j.terminal_at IS NULL
  AND j.lease_generation = sqlc.arg(lease_generation)
  AND em.deleted_at IS NULL
GROUP BY em.id;

-- name: SaveJobSemanticStages :execrows
WITH eligible AS MATERIALIZED (
    SELECT em.id
    FROM episodic_memories AS em
    JOIN job_targets AS jt
      ON jt.user_id = em.user_id
     AND jt.target_kind = 'episodic_memory'
     AND jt.target_id = em.id
     AND jt.expected_revision = em.representation_revision
    JOIN jobs AS j
      ON j.id = jt.job_id
     AND j.user_id = jt.user_id
    WHERE j.user_id = sqlc.arg(user_id)
      AND j.id = sqlc.arg(job_id)
      AND j.kind = 'semanticize'
      AND j.status = 'running'
      AND j.terminal_at IS NULL
      AND j.lease_generation = sqlc.arg(lease_generation)
      AND em.id = sqlc.arg(memory_id)
      AND em.representation_revision = sqlc.arg(expected_revision)
      AND em.deleted_at IS NULL
    FOR UPDATE OF em, jt, j
)
UPDATE episodic_memories AS em
SET semantic_stages = sqlc.arg(semantic_stages)::jsonb
FROM eligible
WHERE em.id = eligible.id;

-- name: UpsertJobEmbedding :one
WITH eligible AS MATERIALIZED (
    SELECT n.id, n.user_id
    FROM neurons AS n
    JOIN job_targets AS jt
      ON jt.user_id = n.user_id
     AND jt.target_kind = 'neuron'
     AND jt.target_id = n.id
     AND jt.expected_revision = n.representation_revision
    JOIN jobs AS j
      ON j.id = jt.job_id
     AND j.user_id = jt.user_id
    WHERE j.user_id = sqlc.arg(user_id)
      AND j.id = sqlc.arg(job_id)
      AND j.status = 'running'
      AND j.terminal_at IS NULL
      AND j.lease_generation = sqlc.arg(lease_generation)
      AND n.id = sqlc.arg(neuron_id)
      AND n.representation_revision = sqlc.arg(expected_revision)
      AND n.sealed_at IS NULL
    FOR UPDATE OF n, jt, j
), upserted AS (
    INSERT INTO embeddings (neuron_id, user_id, vector)
    SELECT id, user_id, sqlc.arg(vector)::vector(1024)
    FROM eligible
    ON CONFLICT (neuron_id) DO UPDATE
    SET vector = EXCLUDED.vector
    WHERE embeddings.user_id = EXCLUDED.user_id
    RETURNING neuron_id
)
SELECT count(*)::bigint AS rows_written FROM upserted;

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
