-- The achievement context's whole persistence surface: the counter facts conditions are evaluated
-- against, the two non-derivable progress facts, and the withdrawal purge. Every statement is
-- conjunctively scoped by user_id ([U1]); no statement performs date arithmetic on any column —
-- both timestamps are write-only now() stamps, which is what lets the Go context own no clock
-- ([A1a]). The write primitives ship with the table's owner and are first composed by
-- the tracking use-case's RecordProgress/ClaimAchievement — the owner provides, the use-case composes.

-- name: ListAchievementCounters :many
SELECT counter_key, value
FROM achievement_counters
WHERE user_id = sqlc.arg(user_id)
ORDER BY counter_key;

-- name: ListAchievementProgress :many
SELECT achievement_id, achieved_at, claimed_at, claim_id
FROM achievement_progress
WHERE user_id = sqlc.arg(user_id)
ORDER BY achievement_id;

-- name: GetAchievementProgress :one
SELECT achievement_id, achieved_at, claimed_at, claim_id
FROM achievement_progress
WHERE user_id = sqlc.arg(user_id)
  AND achievement_id = sqlc.arg(achievement_id);

-- :execrows because the affected-row count is the first-touch signal: DO NOTHING skips a row that
-- already exists, so 1 means THIS statement created the counter — the fact the derived variety
-- counters (mood_variety, ornament_kind_variety) are bumped on, with no second condition kind and
-- no dynamic SQL ([M2][A2]).
-- name: CreateAchievementCounter :execrows
INSERT INTO achievement_counters (user_id, counter_key, value)
VALUES (sqlc.arg(user_id), sqlc.arg(counter_key), 0)
ON CONFLICT (user_id, counter_key) DO NOTHING;

-- Accumulate-mode write: a monotonic sum. The domain refuses delta <= 0 before this statement
-- runs, so no decrement path exists ([I1][A1]).
-- name: AddAchievementCounter :one
UPDATE achievement_counters
SET value = value + sqlc.arg(delta), updated_at = now()
WHERE user_id = sqlc.arg(user_id)
  AND counter_key = sqlc.arg(counter_key)
RETURNING value;

-- Reach-mode write: a high-water mark — GREATEST never lowers the stored value, which is how
-- "단계 도달" is expressed without a rate or a window ([A1a][I1]).
-- name: RaiseAchievementCounter :one
UPDATE achievement_counters
SET value = GREATEST(value, sqlc.arg(level)), updated_at = now()
WHERE user_id = sqlc.arg(user_id)
  AND counter_key = sqlc.arg(counter_key)
RETURNING value;

-- The PK is the dedup guard: a re-crossed threshold marks nothing, so achieved_at keeps its first
-- value forever ([I1][A4]). achieved_at comes from the DDL default now().
-- name: MarkAchievementAchieved :execrows
INSERT INTO achievement_progress (user_id, achievement_id)
VALUES (sqlc.arg(user_id), sqlc.arg(achievement_id))
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- The claimed_at IS NULL arm is the double-payout guard's first half (the PK is the second): a
-- second claim affects zero rows BEFORE any credit moves, so the reward leg keyed on claim_id is
-- never reached twice ([A4]).
-- name: ClaimAchievementReward :execrows
UPDATE achievement_progress
SET claimed_at = now(), claim_id = sqlc.arg(claim_id)
WHERE user_id = sqlc.arg(user_id)
  AND achievement_id = sqlc.arg(achievement_id)
  AND claimed_at IS NULL;

-- Account withdrawal's achievement leg: the user's own counters and progress, hard-deleted by
-- their own sweep with claimed_at intact until the row goes — the single exception [I1] names.


-- name: PurgeUserAchievementCounters :exec
DELETE FROM achievement_counters
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserAchievementProgress :exec
DELETE FROM achievement_progress
WHERE user_id = sqlc.arg(user_id);
