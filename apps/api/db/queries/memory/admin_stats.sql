-- Non-content aggregate reads the admin console consumes through memory's published behavior.
-- The per-user counts are user-scoped; the job-queue counts are deliberately global
-- (an operator queue-health read, allowlisted in check-persistence-isolation.mjs).

-- name: CountUserContentByUserIDs :many
WITH content_counts AS (
    SELECT user_id, count(*)::bigint AS diary_count, 0::bigint AS episodic_memory_count
    FROM diaries
    WHERE user_id = ANY(sqlc.arg(user_ids)::text[])
    GROUP BY user_id

    UNION ALL

    SELECT user_id, 0::bigint AS diary_count, count(*)::bigint AS episodic_memory_count
    FROM episodic_memories
    WHERE user_id = ANY(sqlc.arg(user_ids)::text[])
      AND deleted_at IS NULL
    GROUP BY user_id
)
SELECT user_id,
       sum(diary_count)::bigint AS diary_count,
       sum(episodic_memory_count)::bigint AS episodic_memory_count
FROM content_counts
GROUP BY user_id;

-- name: CountJobsByStatus :many
SELECT status, count(*)::bigint AS count
FROM jobs
GROUP BY status;

-- name: CountDeadLetteredJobs :one
SELECT count(*)::bigint AS count
FROM jobs
WHERE status = 'failed' AND attempts >= $1;
