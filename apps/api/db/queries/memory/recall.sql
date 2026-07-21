-- Recall use-case reads/writes (plan 33 / job 44), run by the recall transaction. The write
-- side (anchors, LTP via UpsertSynapse in launch.sql, neighbor ± + provenance in
-- reconsolidation.sql) and these reads land in one transaction. Every statement is scoped to
-- the authenticated user ([U1], §4, lint:persistence). The Diary is never written here ([I2]).

-- Loads the memory being recalled with the state the branch needs: current_text/seed for the
-- compare + reshape, semantic_stage/semantic_stages for the remaining-stage selection ([C7]),
-- and the forgetting anchors (forgetting_offset_days with the recall/created anchors) so the
-- spend-time accessibility signal derives from this same row ([F4][G4]). deleted_at is
-- returned so the use-case rejects a soft-deleted target with a distinct error; a missing row
-- (not the caller's) is ErrRecallMemoryNotFound.
-- name: LoadEpisodicMemoryForRecall :one
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
    semantic_stages,
    forgetting_offset_days,
    deleted_at,
    representation_revision
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(memory_id);

-- The recalled memory's live member neurons (the reconsolidation regen's semanticize inputs).
-- name: LoadRecallMemberNeurons :many
SELECT n.id, n.name, n.neuron_type, n.representation_revision
FROM neuron_activations AS na
JOIN neurons AS n
  ON n.user_id = na.user_id
 AND n.id = na.neuron_id
 AND n.sealed_at IS NULL
WHERE na.user_id = sqlc.arg(user_id)
  AND na.episodic_memory_id = sqlc.arg(memory_id)
ORDER BY n.id;

-- Every synapse whose BOTH endpoints are the recalled memory's member neurons — the
-- co-activated edges Reinforce batch-LTPs ([R3]). Only neuron↔neuron edges exist ([I4][I6]).
-- name: LoadRecallMemberSynapses :many
SELECT
    s.id,
    s.neuron_a_id,
    s.neuron_b_id,
    s.strength,
    s.co_activation_count,
    s.last_activated_universe_time,
    s.created_at
FROM synapses AS s
WHERE s.user_id = sqlc.arg(user_id)
  AND s.neuron_a_id IN (
      SELECT member_a.neuron_id FROM neuron_activations AS member_a
      JOIN neurons AS na ON na.id = member_a.neuron_id AND na.user_id = member_a.user_id AND na.sealed_at IS NULL
      WHERE member_a.user_id = sqlc.arg(user_id) AND member_a.episodic_memory_id = sqlc.arg(memory_id)
  )
  AND s.neuron_b_id IN (
      SELECT member_b.neuron_id FROM neuron_activations AS member_b
      JOIN neurons AS nb ON nb.id = member_b.neuron_id AND nb.user_id = member_b.user_id AND nb.sealed_at IS NULL
      WHERE member_b.user_id = sqlc.arg(user_id) AND member_b.episodic_memory_id = sqlc.arg(memory_id)
  )
ORDER BY s.neuron_a_id, s.neuron_b_id;

-- For each NEIGHBOR episodic memory, the count of SEMANTIC neurons it shares with the recalled
-- memory ([R5]): spatial/entity neurons are excluded and emotion is never a neuron ([I3]); sealed
-- neurons and soft-deleted neighbors drop out; the recalled memory itself is never a neighbor. The
-- 'semantic' literal is the canonical NeuronType value (a domain enum, not a tuning value).
-- name: NeighborSharedSemanticCounts :many
SELECT
    neighbor.episodic_memory_id AS neighbor_id,
    COUNT(*)::int AS shared_semantic_count
FROM neuron_activations AS self
JOIN neurons AS n
  ON n.user_id = self.user_id
 AND n.id = self.neuron_id
 AND n.neuron_type = 'semantic'
 AND n.sealed_at IS NULL
JOIN neuron_activations AS neighbor
  ON neighbor.user_id = self.user_id
 AND neighbor.neuron_id = self.neuron_id
 AND neighbor.episodic_memory_id <> self.episodic_memory_id
JOIN episodic_memories AS em
  ON em.user_id = neighbor.user_id
 AND em.id = neighbor.episodic_memory_id
 AND em.deleted_at IS NULL
WHERE self.user_id = sqlc.arg(user_id)
  AND self.episodic_memory_id = sqlc.arg(memory_id)
GROUP BY neighbor.episodic_memory_id
ORDER BY neighbor.episodic_memory_id;

-- Resets the recall anchors in one write ([R2][R3][C6a]): last_recalled and the gist timer to
-- the post-sync universe time, recall_count += 1. RETURNING the post-increment count and the
-- stored base strength lets the caller derive the bumped read-time EffectiveStrength. A
-- soft-deleted row updates nothing (no rows → ErrRecallMemoryNotFound).
-- name: ResetRecallAnchors :one
UPDATE episodic_memories
SET last_recalled_universe_time = sqlc.arg(universe_time),
    recall_count = recall_count + 1,
    semanticize_timer_reset_at = sqlc.arg(universe_time)
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(memory_id)
  AND deleted_at IS NULL
RETURNING recall_count, base_strength;

-- Writes ONLY the reconsolidation representation deltas ([R6][V5]): current_text and seed. Never
-- the Diary ([I2]); plain recall never runs this ([R4]).
-- name: ApplyReconsolidatedText :one
UPDATE episodic_memories
SET current_text = sqlc.arg(current_text),
    seed = sqlc.arg(seed),
    representation_revision = representation_revision + 1
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(memory_id)
  AND deleted_at IS NULL
RETURNING representation_revision;

-- The still-live episodic memories born from a diary with their forgetting/strength
-- anchors — the whole-diary recall set ([D3]) and the scalars its per-memory spend
-- pricing derives from ([F4][G4]), in one batch (no text or gist payload).
-- name: ListLiveDiaryRecallAnchors :many
SELECT
    id,
    arousal,
    base_strength,
    recall_count,
    created_universe_time,
    last_recalled_universe_time,
    forgetting_offset_days
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND diary_id = sqlc.arg(diary_id)
  AND deleted_at IS NULL
ORDER BY created_universe_time, id;
