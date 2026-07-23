-- Non-content aggregate reads the admin console consumes through memory's published behavior
-- (plan 58). The per-user counts are user-scoped; the job-queue counts are deliberately global
-- (an operator queue-health read, allowlisted in check-persistence-isolation.mjs).

-- name: CountUserDiaries :one
SELECT count(*)::bigint AS count FROM diaries WHERE user_id = $1;

-- name: CountUserStars :one
SELECT count(*)::bigint AS count
FROM episodic_memories
WHERE user_id = $1 AND deleted_at IS NULL;

-- name: CountJobsByStatus :many
SELECT status, count(*)::bigint AS count
FROM jobs
GROUP BY status;

-- name: CountDeadLetteredJobs :one
SELECT count(*)::bigint AS count
FROM jobs
WHERE status = 'failed' AND attempts >= $1;
