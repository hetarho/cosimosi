-- Link use-case reads (plan 21): the two reads Link consumes on top of the
-- plan-16 baseline synapse upsert (UpsertSynapse, in launch.sql). Every query is
-- user-scoped ([U1], ARCHITECTURE §4). The graph grows only from neuron reuse +
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
