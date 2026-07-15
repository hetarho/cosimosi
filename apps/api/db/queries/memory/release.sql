-- Release use-case (plan 49, Epic H): the release-effect ledger writes/reads, the restore reversal
-- writes, the this-memory-only-semantic candidate read, and the retention sweep. The sweep DELETEs
-- (and the shared release_groups delete restore/sweep both use to retire a release) are the ONLY DELETE
-- statements in db/queries — every one is user-scoped ([U1], §4) and release-group-bound, and no DELETE
-- of memory/neuron data ever touches a deleted_at IS NULL (live) row or a shared neuron ([I1]). The
-- soft-delete/seal/contribution-Depress writes are job 59's (reused, never duplicated here). No UPDATE
-- diaries anywhere — the Diary body is immutable while retained ([I2]); the sweep removes the whole row
-- as the user's explicit post-window deletion.

-- The live release group for one diary, if any — the already-released guard (Release) and the restore
-- target (Restore). A row's presence means the diary is currently released (Restore/sweep delete it).
-- name: GetReleaseGroupForDiary :one
-- FOR UPDATE locks the group row so a Restore and a concurrent Release-triggered Sweep of the same
-- group serialize (never interleave into a half-swept restored diary). No row (unreleased diary) locks
-- nothing — Release's insert is then guarded by UNIQUE(user_id, diary_id).
SELECT id, diary_id, deleted_at
FROM release_groups
WHERE user_id = sqlc.arg(user_id)
  AND diary_id = sqlc.arg(diary_id)
FOR UPDATE;

-- Insert the release record at the caller's real-clock UTC deleted_at (created_at defaults).
-- name: InsertReleaseGroup :exec
INSERT INTO release_groups (id, user_id, diary_id, deleted_at)
VALUES (sqlc.arg(id), sqlc.arg(user_id), sqlc.arg(diary_id), sqlc.arg(deleted_at));

-- Record the release's removal set (the soft-deleted memory ids).
-- name: InsertReleaseMemories :exec
INSERT INTO release_memories (release_id, user_id, episodic_memory_id)
SELECT sqlc.arg(release_id), sqlc.arg(user_id), UNNEST(sqlc.arg(episodic_memory_ids)::text[]);

-- Record the orphan neurons this release sealed.
-- name: InsertReleaseSealedNeurons :exec
INSERT INTO release_sealed_neurons (release_id, user_id, neuron_id)
SELECT sqlc.arg(release_id), sqlc.arg(user_id), UNNEST(sqlc.arg(neuron_ids)::text[]);

-- Record the LTD amount removed from each shared-contribution synapse (for exact restore).
-- name: InsertReleaseSynapseDeltas :exec
INSERT INTO release_synapse_deltas (release_id, user_id, synapse_id, applied_delta)
SELECT
    sqlc.arg(release_id),
    sqlc.arg(user_id),
    UNNEST(sqlc.arg(synapse_ids)::text[]),
    UNNEST(sqlc.arg(applied_deltas)::real[]);

-- Restore reads: the release's memory ids and the neurons it sealed.
-- name: ListReleaseMemories :many
SELECT episodic_memory_id
FROM release_memories
WHERE user_id = sqlc.arg(user_id)
  AND release_id = sqlc.arg(release_id)
ORDER BY episodic_memory_id;

-- name: ListReleaseSealedNeurons :many
SELECT neuron_id
FROM release_sealed_neurons
WHERE user_id = sqlc.arg(user_id)
  AND release_id = sqlc.arg(release_id)
ORDER BY neuron_id;

-- Restore's synapse reversal ([X2]): add each recorded LTD amount back to the edge's CURRENT strength,
-- clamped to [0, cap], atomically in SQL — so a concurrent LTP/downscale/weaken between read and write is
-- never lost (the reversal composes with interim activity instead of overwriting an absolute stale value).
-- name: ReverseReleaseSynapseDeltas :exec
UPDATE synapses AS s
SET strength = GREATEST(0::real, LEAST(sqlc.arg(strength_cap)::real, s.strength + d.applied_delta))
FROM release_synapse_deltas AS d
WHERE d.user_id = sqlc.arg(user_id)
  AND d.release_id = sqlc.arg(release_id)
  AND s.id = d.synapse_id
  AND s.user_id = d.user_id;

-- Restore's soft-delete reversal: clear deleted_at for the release's memories (only the still-soft-deleted
-- ones — idempotent), returning them to every dynamic.
-- name: ClearReleaseMemoriesDeletedAt :exec
UPDATE episodic_memories
SET deleted_at = NULL
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(episodic_memory_ids)::text[])
  AND deleted_at IS NOT NULL;

-- Restore's unseal: unseal exactly the orphan neurons this release sealed (only the still-sealed ones —
-- idempotent). No other neuron is touched.
-- name: UnsealReleaseNeurons :exec
UPDATE neurons
SET sealed_at = NULL
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(neuron_ids)::text[])
  AND sealed_at IS NOT NULL;

-- The this-memory-only semantic candidate set for letting-go ([X4][X6]): unsealed semantic neurons this
-- memory activates that NO OTHER LIVE memory activates. The AI ranks only within this already-safe set;
-- LetGo re-validates every approved id against it server-side (§2.9#8).
-- name: ListThisMemoryOnlySemanticNeurons :many
SELECT n.id, n.name
FROM neurons AS n
JOIN neuron_activations AS na
  ON na.neuron_id = n.id
 AND na.user_id = n.user_id
WHERE n.user_id = sqlc.arg(user_id)
  AND na.episodic_memory_id = sqlc.arg(memory_id)
  AND n.neuron_type = 'semantic'
  AND n.sealed_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM neuron_activations AS other
    JOIN episodic_memories AS em
      ON em.id = other.episodic_memory_id
     AND em.user_id = other.user_id
    WHERE other.user_id = n.user_id
      AND other.neuron_id = n.id
      AND other.episodic_memory_id <> sqlc.arg(memory_id)
      AND em.deleted_at IS NULL
  )
ORDER BY n.id;

-- LetGo's server-side re-validation set ([X6], §2.9#8): the this-memory-only semantic neuron ids,
-- INCLUDING already-sealed ones — so re-approving a neuron this memory already let go is an idempotent
-- no-op, while a shared/foreign/non-semantic id is still absent and rejected. Distinct from the
-- suggestion read above (which hides sealed neurons — they need no re-suggesting).
-- name: ListThisMemoryOnlySemanticNeuronIDs :many
SELECT n.id
FROM neurons AS n
JOIN neuron_activations AS na
  ON na.neuron_id = n.id
 AND na.user_id = n.user_id
WHERE n.user_id = sqlc.arg(user_id)
  AND na.episodic_memory_id = sqlc.arg(memory_id)
  AND n.neuron_type = 'semantic'
  AND NOT EXISTS (
    SELECT 1
    FROM neuron_activations AS other
    JOIN episodic_memories AS em
      ON em.id = other.episodic_memory_id
     AND em.user_id = other.user_id
    WHERE other.user_id = n.user_id
      AND other.neuron_id = n.id
      AND other.episodic_memory_id <> sqlc.arg(memory_id)
      AND em.deleted_at IS NULL
  )
ORDER BY n.id;

-- Sweep read: release groups whose deleted_at is older than the retention cutoff (now − window),
-- computed in the use-case. A restored group has been deleted, so it never appears — a restored release
-- is a sweep no-op by construction.
-- name: ListExpiredReleaseGroups :many
-- FOR UPDATE SKIP LOCKED so the sweep serializes with a concurrent Restore on the same group: a group a
-- Restore is holding is skipped (Restore will retire it), and a group the sweep holds makes a concurrent
-- Restore's FOR UPDATE read wait, then find it gone. No half-swept restored diary either way.
SELECT id, diary_id, deleted_at
FROM release_groups
WHERE user_id = sqlc.arg(user_id)
  AND deleted_at < sqlc.arg(cutoff)
ORDER BY deleted_at, id
FOR UPDATE SKIP LOCKED;

-- Sweep eligibility: of this release's sealed orphan neurons, the ones NO activation outside the release
-- set references — the exclusive dependents safe to hard-delete. A neuron another memory still activates
-- is spared (conservative — never over-deletes, never a shared neuron).
-- name: ListExclusiveReleaseNeurons :many
SELECT rsn.neuron_id
FROM release_sealed_neurons AS rsn
WHERE rsn.user_id = sqlc.arg(user_id)
  AND rsn.release_id = sqlc.arg(release_id)
  AND NOT EXISTS (
    SELECT 1
    FROM neuron_activations AS na
    WHERE na.user_id = rsn.user_id
      AND na.neuron_id = rsn.neuron_id
      AND na.episodic_memory_id <> ALL(sqlc.arg(release_memory_ids)::text[])
  )
ORDER BY rsn.neuron_id;

-- Sweep deletes, in FK-safe order. Each is user-scoped and bound to the release's own rows.
-- Activations of the swept memories (removes the memory↔neuron edges before the memories/neurons go).
-- name: DeleteReleaseActivations :exec
DELETE FROM neuron_activations
WHERE user_id = sqlc.arg(user_id)
  AND episodic_memory_id = ANY(sqlc.arg(episodic_memory_ids)::text[]);

-- Synapses touching an exclusive orphan neuron (a sealed-endpoint edge is already dead) — removed before
-- the neuron so the endpoint FK holds; a shared neuron on the other end stays.
-- name: DeleteReleaseSynapses :exec
DELETE FROM synapses
WHERE user_id = sqlc.arg(user_id)
  AND (
    neuron_a_id = ANY(sqlc.arg(neuron_ids)::text[])
    OR neuron_b_id = ANY(sqlc.arg(neuron_ids)::text[])
  );

-- The exclusive orphan neurons' embeddings, then the neurons themselves.
-- name: DeleteReleaseEmbeddings :exec
DELETE FROM embeddings
WHERE user_id = sqlc.arg(user_id)
  AND neuron_id = ANY(sqlc.arg(neuron_ids)::text[]);

-- name: DeleteReleaseNeurons :exec
DELETE FROM neurons
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(neuron_ids)::text[]);

-- The released memories (their retained memory_provenance rides job 43's ON DELETE CASCADE). Only ever a
-- still-soft-deleted row — a restored (deleted_at IS NULL) memory is never touched ([I1]).
-- name: DeleteReleaseMemories :exec
DELETE FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(episodic_memory_ids)::text[])
  AND deleted_at IS NOT NULL;

-- The original Diary row/body — the user-origin exception ([I2]), removed only once no memory references
-- it (the release's memories are already swept above).
-- name: DeleteReleaseDiary :exec
DELETE FROM diaries AS d
WHERE d.user_id = sqlc.arg(user_id)
  AND d.id = sqlc.arg(diary_id)
  AND NOT EXISTS (
    SELECT 1
    FROM episodic_memories AS em
    WHERE em.user_id = d.user_id
      AND em.diary_id = d.id
  );

-- Retire the release group (Restore reverses then deletes it; the sweep deletes it last). The effect
-- tables cascade off it, so this one delete clears release_memories/sealed_neurons/synapse_deltas too.
-- name: DeleteReleaseGroup :exec
DELETE FROM release_groups
WHERE user_id = sqlc.arg(user_id)
  AND id = sqlc.arg(id);
