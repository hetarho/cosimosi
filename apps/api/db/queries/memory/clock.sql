-- name: GetUniverseClock :one
SELECT current_universe_time
FROM universe_state
WHERE user_id = $1;

-- Serialize a user's clock birth window: a transaction-scoped advisory lock
-- keyed by user_id, held to commit. Unlike GetUniverseClockForUpdate it needs
-- no existing row, so concurrent first-launches (the unborn-clock window, where
-- the clock row cannot yet be locked) serialize here instead of racing the
-- monotonic guard against a stale nil clock ([I10]). One 64-bit key hashed from a
-- 'universe_state:' namespace and the user id, so unrelated users practically never share
-- the lock (a 32-bit hash of the id alone collided) and it never meets another advisory-lock
-- domain. Taken as the first step of every graph-changing transaction, before
-- release/clock/graph rows.
--
-- The same statement advances the user's universe revision [MEM-21]: the materialized CTE takes
-- the lock before the upsert reads its row, so the counter moves strictly inside the lock, once
-- per graph-mutating transaction, and a rollback undoes it. The first advance writes 1.
-- name: LockGraphMutation :exec
WITH graph_lock AS MATERIALIZED (
    SELECT pg_advisory_xact_lock(hashtextextended('universe_state:' || sqlc.arg(user_id)::text, 0)) AS locked
)
INSERT INTO universe_revisions (user_id, revision)
SELECT sqlc.arg(user_id)::text, 1
FROM graph_lock
ON CONFLICT (user_id) DO UPDATE SET revision = universe_revisions.revision + 1;

-- The launch guard's read: FOR UPDATE holds the clock row for the rest of the
-- launch transaction, so a concurrent launch cannot pass the monotonic guard
-- against a clock another transaction is about to advance ([I10]). The birth
-- window (no row yet to lock) is covered by LockGraphMutation above.
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
