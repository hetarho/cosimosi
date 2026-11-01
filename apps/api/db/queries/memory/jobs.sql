-- Memory-owned, deletion-safe worker source reads and completion writes.

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

-- The semanticize completion transaction's locked validation read: the claimed job's lease,
-- the target's liveness, and the expected representation revision are re-checked together
-- under row locks, and the LIVE stage/ladder/pending state comes back for the merge +
-- finalization. No row = the fence was lost (lease reclaimed, revision superseded, target
-- released) — the completion applies no side effect.
-- name: LockSemanticizeCompletion :one
SELECT
    em.semantic_stage,
    em.semantic_stages,
    em.pending_semantic_stage,
    em.pending_semantic_rise_at
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
FOR UPDATE OF em, jt, j;

-- The completion's single episodic-memory write: the merged ladder lands, a pending rise
-- (if any) becomes the visible stage (GREATEST — a stage never decrements [C7]), and the
-- pending marker clears. Runs only after LockSemanticizeCompletion validated the fence in
-- this same transaction.
-- name: FinalizeSemanticizeCompletion :exec
UPDATE episodic_memories
SET semantic_stages = sqlc.arg(semantic_stages)::jsonb,
    semantic_stage = GREATEST(semantic_stage, sqlc.arg(stage)::smallint),
    pending_semantic_stage = NULL,
    pending_semantic_rise_at = NULL
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(memory_id)
  AND deleted_at IS NULL;

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
