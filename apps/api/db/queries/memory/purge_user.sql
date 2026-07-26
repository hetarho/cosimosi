-- Account withdrawal's memory-context leg. Each statement is per-user and runs in
-- one memory-owned transaction, dependents before their parents.

-- The in-flight withdrawal job is identity-only queue bookkeeping. The runner must
-- retain it long enough to record completion; terminal cleanup removes it later.
-- name: PurgeUserJobTargets :exec
DELETE FROM job_targets
WHERE user_id = sqlc.arg(user_id)
  AND job_id <> sqlc.arg(keep_job_id);

-- name: PurgeUserJobs :exec
DELETE FROM jobs
WHERE user_id = sqlc.arg(user_id)
  AND id <> sqlc.arg(keep_job_id);

-- name: PurgeUserPaidActionReceipts :exec
DELETE FROM memory_paid_action_receipts
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserReleaseSynapseDeltas :exec
DELETE FROM release_synapse_deltas
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserReleaseSealedNeurons :exec
DELETE FROM release_sealed_neurons
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserReleaseMemories :exec
DELETE FROM release_memories
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserReleaseGroups :exec
DELETE FROM release_groups
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserMemoryProvenance :exec
DELETE FROM memory_provenance
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserNeuronActivations :exec
DELETE FROM neuron_activations
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserSynapses :exec
DELETE FROM synapses
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserEmbeddings :exec
DELETE FROM embeddings
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserEpisodicMemories :exec
DELETE FROM episodic_memories
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserNeurons :exec
DELETE FROM neurons
WHERE user_id = sqlc.arg(user_id);

-- The objective Diary body is never updated. Whole-row deletion occurs only after
-- the user's explicit account withdrawal has reached its retention deadline.
-- name: PurgeUserDiaries :exec
DELETE FROM diaries
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserUniverseState :exec
DELETE FROM universe_state
WHERE user_id = sqlc.arg(user_id);
