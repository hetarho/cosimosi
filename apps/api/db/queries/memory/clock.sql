-- name: GetUniverseClock :one
SELECT current_universe_time
FROM universe_state
WHERE user_id = $1;

-- The launch guard's read: FOR UPDATE holds the clock row for the rest of the
-- launch transaction, so a concurrent launch cannot pass the monotonic guard
-- against a clock another transaction is about to advance ([I10]).
-- name: GetUniverseClockForUpdate :one
SELECT current_universe_time
FROM universe_state
WHERE user_id = $1
FOR UPDATE;

-- The guard baseline while a user's clock row is unborn: the latest launched
-- memory date. Keeps the one-release read fallback and the launch guard in
-- agreement, so a pre-clock universe can never launch (and birth the clock at)
-- a date before its newest memory.
-- name: LatestLaunchedUniverseTime :one
SELECT created_universe_time
FROM episodic_memories
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_universe_time DESC, id DESC
LIMIT 1;

-- The SQL GREATEST mirrors the domain AdvanceClock as defense-in-depth ([I10] enforced at
-- two layers, like the synapse CHECK): even a direct write can never rewind the clock, and
-- the single-row upsert (user_id PK) serializes concurrent launches without duplicates.
-- name: AdvanceUniverseClock :one
INSERT INTO universe_state (
    user_id,
    current_universe_time
) VALUES (
    $1,
    $2
)
ON CONFLICT (user_id) DO UPDATE
SET current_universe_time = GREATEST(universe_state.current_universe_time, EXCLUDED.current_universe_time),
    updated_at = now()
RETURNING current_universe_time;
