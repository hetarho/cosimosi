-- name: InsertDiary :one
INSERT INTO diaries (
    id,
    user_id,
    body,
    diary_date,
    created_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5
)
RETURNING id, body, diary_date, created_at;

-- name: InsertEpisodicMemory :one
INSERT INTO episodic_memories (
    id,
    user_id,
    diary_id,
    name,
    current_text,
    seed,
    mood,
    valence,
    arousal,
    intensity,
    base_strength,
    recall_count,
    created_universe_time,
    last_recalled_universe_time,
    semantic_stage,
    semanticize_timer_reset_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14,
    $15,
    $16
)
RETURNING
    id,
    diary_id,
    name,
    current_text,
    seed,
    mood,
    valence,
    arousal,
    intensity,
    base_strength,
    recall_count,
    created_universe_time,
    last_recalled_universe_time,
    semantic_stage,
    semanticize_timer_reset_at,
    deleted_at,
    representation_revision;

-- name: UpsertNeuron :one
INSERT INTO neurons (
    id,
    user_id,
    name,
    neuron_type,
    created_at,
    sealed_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    neuron_type = EXCLUDED.neuron_type,
    representation_revision = CASE
        WHEN neurons.name IS DISTINCT FROM EXCLUDED.name
          OR neurons.neuron_type IS DISTINCT FROM EXCLUDED.neuron_type
        THEN neurons.representation_revision + 1
        ELSE neurons.representation_revision
    END
WHERE neurons.user_id = EXCLUDED.user_id
RETURNING id, name, neuron_type, created_at, sealed_at, representation_revision;

-- name: InsertNeuronActivation :one
INSERT INTO neuron_activations (
    episodic_memory_id,
    neuron_id,
    user_id,
    weight
) VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING episodic_memory_id, neuron_id, weight;

-- name: UpsertSynapse :one
INSERT INTO synapses (
    id,
    user_id,
    neuron_a_id,
    neuron_b_id,
    strength,
    co_activation_count,
    last_activated_universe_time,
    created_at
) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
ON CONFLICT (user_id, neuron_a_id, neuron_b_id) DO UPDATE
SET strength = EXCLUDED.strength,
    co_activation_count = synapses.co_activation_count + EXCLUDED.co_activation_count,
    last_activated_universe_time = GREATEST(synapses.last_activated_universe_time, EXCLUDED.last_activated_universe_time)
RETURNING id, neuron_a_id, neuron_b_id, strength, co_activation_count, last_activated_universe_time, created_at;

-- name: InsertEmbedding :one
INSERT INTO embeddings (
    neuron_id,
    user_id,
    vector
) VALUES (
    $1,
    $2,
    $3::vector(1024)
)
ON CONFLICT (neuron_id) DO UPDATE
SET vector = EXCLUDED.vector
WHERE embeddings.user_id = EXCLUDED.user_id
RETURNING neuron_id, vector;

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
