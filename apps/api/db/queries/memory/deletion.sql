-- Deletion rules (plan 48, Epic H): the sealing/soft-delete writes + the classification data reads +
-- the contribution-LTD step. NO DELETE statement anywhere — the system never hard-deletes ([I1]); the
-- only hard delete is job 60's user-initiated 30-day sweep. No UPDATE diaries (the Diary is immutable,
-- [I2]). Every statement is scoped to the authenticated user ([U1], §4, lint:persistence).

-- The removal set's live neuron ids: the distinct unsealed neurons activated by the given memories,
-- optionally narrowed to one neuron_type (letting-go passes 'semantic'; full delete passes NULL for all
-- types). This is the neuron set the domain classifier partitions.
-- name: ListRemovalNeuronIDs :many
SELECT DISTINCT n.id
FROM neuron_activations AS na
JOIN neurons AS n
  ON n.id = na.neuron_id
 AND n.user_id = na.user_id
 AND n.sealed_at IS NULL
WHERE na.user_id = sqlc.arg(user_id)
  AND na.episodic_memory_id = ANY(sqlc.arg(memory_ids)::text[])
  AND (sqlc.narg(neuron_type)::text IS NULL OR n.neuron_type = sqlc.narg(neuron_type)::text)
ORDER BY n.id;

-- The classification facts for the removal set's neurons: every activation tying one of the given
-- neurons to a memory, tagged with that memory's soft-delete state. The domain decides orphan (no live
-- memory outside the removal set) vs shared — the outside-set + liveness logic stays in code so it is
-- unit-testable without a DB (A1). Sealed neurons never enter (only live neurons are classified).
-- name: ListRemovalNeuronActivations :many
SELECT
    na.neuron_id,
    na.episodic_memory_id,
    (em.deleted_at IS NOT NULL)::boolean AS memory_deleted
FROM neuron_activations AS na
JOIN episodic_memories AS em
  ON em.id = na.episodic_memory_id
 AND em.user_id = na.user_id
WHERE na.user_id = sqlc.arg(user_id)
  AND na.neuron_id = ANY(sqlc.arg(neuron_ids)::text[]);

-- Full delete's soft-delete ([X1][X2]): mark every still-live memory born from the diary deleted, at the
-- caller-supplied timestamp (job 60 passes real-clock UTC). Returns the affected ids so the caller knows
-- the removal set. The Diary row is untouched ([I2]); rows persist for the restore window.
-- name: SoftDeleteDiaryMemories :many
UPDATE episodic_memories
SET deleted_at = sqlc.arg(deleted_at)
WHERE user_id = sqlc.arg(user_id)
  AND diary_id = sqlc.arg(diary_id)
  AND deleted_at IS NULL
RETURNING id;

-- Seal an explicit orphan-neuron id set (only those not already sealed — idempotent). No unseal here;
-- restore is job 60's.
-- name: SealNeurons :exec
UPDATE neurons
SET sealed_at = sqlc.arg(sealed_at)
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(neuron_ids)::text[])
  AND sealed_at IS NULL;

-- The synapses a removal weakens: edges internal to the removal set's neuron cloud (BOTH endpoints
-- co-activated by removed memories) with at least one SHARED (kept) endpoint. Doubly-orphaned edges are
-- skipped — both endpoints seal and the edge leaves via the alive-predicate, so weakening it is
-- redundant. The caller Depresses these strengths and writes them back (read-compute-write).
-- name: ListContributionSynapses :many
SELECT id, strength
FROM synapses
WHERE user_id = sqlc.arg(user_id)
  AND neuron_a_id = ANY(sqlc.arg(removal_neuron_ids)::text[])
  AND neuron_b_id = ANY(sqlc.arg(removal_neuron_ids)::text[])
  AND (
    neuron_a_id = ANY(sqlc.arg(shared_neuron_ids)::text[])
    OR neuron_b_id = ANY(sqlc.arg(shared_neuron_ids)::text[])
  )
ORDER BY id;

-- Write back the Depressed strengths for the weakened synapses (the ApplySynapseDownscale precedent) —
-- the base strength is lowered, the edge is NEVER deleted ([X1][I6]).
-- name: ApplyContributionWeaken :exec
UPDATE synapses AS s
SET strength = weakened.strength
FROM (
    SELECT
        UNNEST(sqlc.arg(synapse_ids)::text[]) AS id,
        UNNEST(sqlc.arg(strengths)::real[]) AS strength
) AS weakened
WHERE s.user_id = sqlc.arg(user_id)
  AND s.id = weakened.id;
