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
    deleted_at;

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
    neuron_type = EXCLUDED.neuron_type
WHERE neurons.user_id = EXCLUDED.user_id
RETURNING id, name, neuron_type, created_at, sealed_at;

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
RETURNING neuron_id, vector;

-- name: EnqueueJob :one
INSERT INTO jobs (
    id,
    user_id,
    kind,
    payload,
    status,
    attempts,
    next_run_at,
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
RETURNING id, kind, payload, status, attempts, next_run_at, created_at;
