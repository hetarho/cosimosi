-- Consolidation use-case writes (plan 41 / job 52), run INSIDE the advance transaction the
-- progression hook fires on launch and sync ([T4]) — the interval read reuses
-- ListUniverseEpisodicMemories (universe.sql), the same non-deleted per-user shape the read
-- path sees. Every statement is scoped to the authenticated user (§4, lint:persistence).
-- Nothing here deletes a row or touches a Diary ([I1][I2]); no coordinate is stored ([I5]).

-- Batch stage advance ([C1][C6][C7]): the risen stage plus the consumed gist-timer anchor per
-- memory. GREATEST guards both in SQL too (defense-in-depth — a stage never decrements and the
-- timer anchor never rewinds [I10]), and the anchor write is what makes an already-consolidated
-- interval imply zero further units (A10 convergence).
-- name: ApplyConsolidationStageAdvances :exec
UPDATE episodic_memories AS em
SET semantic_stage = GREATEST(em.semantic_stage, advance.stage),
    semanticize_timer_reset_at = GREATEST(
        COALESCE(em.semanticize_timer_reset_at, em.created_universe_time),
        advance.timer_reset_at
    )
FROM (
    SELECT
        UNNEST(sqlc.arg(memory_ids)::text[]) AS memory_id,
        UNNEST(sqlc.arg(stages)::smallint[]) AS stage,
        UNNEST(sqlc.arg(timer_reset_ats)::date[]) AS timer_reset_at
) AS advance
WHERE em.user_id = sqlc.arg(user_id)
  AND em.id = advance.memory_id
  AND em.deleted_at IS NULL;

-- Whole-array decay-stage text write ([F1][R8a]): the use-case merges (existing entries are
-- never overwritten — the merge fills missing slots only) and the per-user advisory lock the
-- advance transaction holds serializes the read-merge-write.
-- name: FillConsolidationDecayStages :exec
UPDATE episodic_memories
SET decay_stages = sqlc.arg(decay_stages)::jsonb
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(memory_id)
  AND deleted_at IS NULL;

-- The live neurons activated by a memory set — the replay-set expansion step ([C2]).
-- name: ListReplaySetNeurons :many
SELECT DISTINCT n.id, n.name, n.neuron_type
FROM neuron_activations AS na
JOIN neurons AS n
  ON n.user_id = na.user_id
 AND n.id = na.neuron_id
 AND n.sealed_at IS NULL
WHERE na.user_id = sqlc.arg(user_id)
  AND na.episodic_memory_id = ANY(sqlc.arg(memory_ids)::text[])
ORDER BY n.id;

-- The non-deleted memories activating any of the given neurons — the shared-neuron neighbor
-- hop ([C2]).
-- name: ListMemoriesActivatingNeurons :many
SELECT DISTINCT na.episodic_memory_id
FROM neuron_activations AS na
JOIN episodic_memories AS em
  ON em.user_id = na.user_id
 AND em.id = na.episodic_memory_id
 AND em.deleted_at IS NULL
WHERE na.user_id = sqlc.arg(user_id)
  AND na.neuron_id = ANY(sqlc.arg(neuron_ids)::text[])
ORDER BY na.episodic_memory_id;

-- The replay marker ([C2][I5]): refresh the activation recency of every synapse with BOTH
-- endpoints inside the touched replay set — the same trace a recall's reinforcement leaves,
-- consumed at read (the synapse strength fade / effective strength), never a stored coordinate. GREATEST
-- keeps the marker forward-only ([I10]).
-- name: TouchReplaySetSynapses :exec
UPDATE synapses
SET last_activated_universe_time = GREATEST(last_activated_universe_time, sqlc.arg(universe_time)::date)
WHERE user_id = sqlc.arg(user_id)
  AND neuron_a_id = ANY(sqlc.arg(neuron_ids)::text[])
  AND neuron_b_id = ANY(sqlc.arg(neuron_ids)::text[]);

-- The Downscale input ([C4]): the user's synapses that actually slept through the interval —
-- an edge last activated at/after the advance target was linked in this very transaction (or
-- replay-refreshed) and did not exist through the slept days, so it is excluded.
-- name: ListSynapseStrengthsForDownscale :many
SELECT id, strength
FROM synapses
WHERE user_id = sqlc.arg(user_id)
  AND last_activated_universe_time < sqlc.arg(activated_before)::date
ORDER BY id;

-- The consolidate worker's execution-time re-read: the live (unsealed) neurons' current
-- embed texts, so a re-embed never writes a vector for a name that has since changed.
-- name: ListNeuronEmbedTexts :many
SELECT id, name, neuron_type
FROM neurons
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(neuron_ids)::text[])
  AND sealed_at IS NULL
ORDER BY id;

-- Batch base-strength write for the Downscale renormalization ([C4]): values are computed by
-- the pure domain fn (the source of truth) and written absolutely — rows update in place,
-- nothing is inserted or deleted ([I1]).
-- name: ApplySynapseDownscale :exec
UPDATE synapses AS s
SET strength = downscaled.strength
FROM (
    SELECT
        UNNEST(sqlc.arg(synapse_ids)::text[]) AS id,
        UNNEST(sqlc.arg(strengths)::real[]) AS strength
) AS downscaled
WHERE s.user_id = sqlc.arg(user_id)
  AND s.id = downscaled.id;
