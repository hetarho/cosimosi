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
    COUNT(em.id)::int AS connectivity
FROM neurons AS n
LEFT JOIN neuron_activations AS na
  ON na.user_id = n.user_id
 AND na.neuron_id = n.id
LEFT JOIN episodic_memories AS em
  ON em.user_id = na.user_id
 AND em.id = na.episodic_memory_id
 AND em.deleted_at IS NULL
WHERE n.user_id = $1
  AND n.sealed_at IS NULL
GROUP BY n.id, n.name, n.neuron_type, n.created_at, n.sealed_at
ORDER BY n.id;

-- name: ListUniverseNeuronActivations :many
SELECT
    na.episodic_memory_id,
    na.neuron_id,
    na.weight
FROM neuron_activations AS na
JOIN episodic_memories AS em
  ON em.user_id = na.user_id
 AND em.id = na.episodic_memory_id
 AND em.deleted_at IS NULL
JOIN neurons AS n
  ON n.user_id = na.user_id
 AND n.id = na.neuron_id
 AND n.sealed_at IS NULL
WHERE na.user_id = $1
ORDER BY na.episodic_memory_id, na.neuron_id;

-- name: ListUniverseSynapses :many
SELECT
    s.id,
    s.neuron_a_id,
    s.neuron_b_id,
    s.strength,
    s.co_activation_count,
    s.last_activated_universe_time,
    s.created_at
FROM synapses AS s
JOIN neurons AS neuron_a
  ON neuron_a.user_id = s.user_id
 AND neuron_a.id = s.neuron_a_id
 AND neuron_a.sealed_at IS NULL
JOIN neurons AS neuron_b
  ON neuron_b.user_id = s.user_id
 AND neuron_b.id = s.neuron_b_id
 AND neuron_b.sealed_at IS NULL
WHERE s.user_id = $1
ORDER BY s.neuron_a_id, s.neuron_b_id;
