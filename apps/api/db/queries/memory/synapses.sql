-- Link consumes these two reads on top of the baseline synapse upsert
-- (UpsertSynapse in launch.sql). Every query is
-- user-scoped ([U1], ARCH-13). The graph grows only from neuron reuse +
-- Hebbian co-firing + the temporal bonus — no embeddings row is ever read [L3].

-- name: ListSynapseStrengths :many
-- The stored base strengths of every synapse whose BOTH endpoints are among the
-- launched neurons, so Link folds them via Potentiate on the repeat path [L8] with
-- one query instead of a SELECT per pair. Rows are canonical (neuron_a_id < b_id).
SELECT neuron_a_id, neuron_b_id, strength
FROM synapses
WHERE user_id = $1
  AND neuron_a_id = ANY($2::text[])
  AND neuron_b_id = ANY($2::text[]);

-- name: ListNeuronCoActivationDates :many
-- For the launched memory's neurons, every episodic memory each one is activated
-- by with that memory's created_universe_time (= diary_date). Link intersects two
-- neurons' memberships to find the memories that co-activate the pair, and times
-- the temporal bonus on those memories' dates — never on a neuron [L4][E6]. The
-- consumer folds rows into a per-neuron map, so no ordering is imposed.
SELECT
    na.neuron_id,
    na.episodic_memory_id,
    em.created_universe_time
FROM neuron_activations AS na
JOIN episodic_memories AS em
  ON em.user_id = na.user_id
 AND em.id = na.episodic_memory_id
 AND em.deleted_at IS NULL
WHERE na.user_id = $1
  AND na.neuron_id = ANY($2::text[]);

-- One scoped batch of already-computed strengths. No domain math is duplicated in SQL.
-- name: UpsertSynapses :exec
INSERT INTO synapses (id, user_id, neuron_a_id, neuron_b_id, strength,
 co_activation_count, last_activated_universe_time, created_at)
SELECT batch.id, sqlc.arg(user_id), batch.neuron_a_id, batch.neuron_b_id,
 batch.strength, batch.co_activation_count, batch.last_activated_universe_time, batch.created_at
FROM (SELECT
 UNNEST(sqlc.arg(ids)::text[]) AS id,
 UNNEST(sqlc.arg(neuron_a_ids)::text[]) AS neuron_a_id,
 UNNEST(sqlc.arg(neuron_b_ids)::text[]) AS neuron_b_id,
 UNNEST(sqlc.arg(strengths)::real[]) AS strength,
 UNNEST(sqlc.arg(counts)::int[]) AS co_activation_count,
 UNNEST(sqlc.arg(activated_ats)::date[]) AS last_activated_universe_time,
 UNNEST(sqlc.arg(created_ats)::timestamptz[]) AS created_at
) AS batch
WHERE sqlc.arg(user_id)::text IS NOT NULL
ON CONFLICT (user_id, neuron_a_id, neuron_b_id) DO UPDATE
SET strength = EXCLUDED.strength,
 co_activation_count = synapses.co_activation_count + EXCLUDED.co_activation_count,
 last_activated_universe_time = GREATEST(synapses.last_activated_universe_time, EXCLUDED.last_activated_universe_time)
WHERE synapses.user_id = sqlc.arg(user_id);
