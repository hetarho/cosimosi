-- name: ListUniverseEpisodicMemories :many
SELECT
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
    deleted_at
FROM episodic_memories
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_universe_time, id;

-- name: ListUniverseNeurons :many
SELECT
    n.id,
    n.name,
    n.neuron_type,
    n.created_at,
    n.sealed_at,
    COUNT(na.episodic_memory_id)::int AS connectivity
FROM neurons AS n
LEFT JOIN neuron_activations AS na
  ON na.user_id = n.user_id
 AND na.neuron_id = n.id
WHERE n.user_id = $1
  AND n.sealed_at IS NULL
GROUP BY n.id, n.name, n.neuron_type, n.created_at, n.sealed_at
ORDER BY n.id;

-- name: ListUniverseNeuronActivations :many
SELECT
    episodic_memory_id,
    neuron_id,
    weight
FROM neuron_activations
WHERE user_id = $1
ORDER BY episodic_memory_id, neuron_id;

-- name: ListUniverseSynapses :many
SELECT
    id,
    neuron_a_id,
    neuron_b_id,
    strength,
    co_activation_count,
    last_activated_universe_time,
    created_at
FROM synapses
WHERE user_id = $1
ORDER BY neuron_a_id, neuron_b_id;
