-- Reconsolidation write-side queries ([R5][R8a], plan 32). Orchestrated by the recall use-case (job
-- 44) inside one transaction; the read side (변천사 + baseline synthesis) is plan 46 (Epic G) and
-- lives elsewhere. Every statement is scoped to the authenticated user ([U1], §4, lint:persistence).

-- Additively nudges the forgetting offset of a recalled memory's NEIGHBORS ([R5]): the caller
-- passes the neighbor id set (the recalled memory itself is excluded — it recovers wholly [F5]) and the
-- signed delta. `+=` accumulates across recalls; DEFAULT 0 means an untouched row stays put.
-- name: AddForgettingOffset :exec
UPDATE episodic_memories
SET forgetting_offset_days = forgetting_offset_days + sqlc.arg(delta)::real
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(memory_ids)::text[]);

-- Appends one 변천사 row ([R8a][D1], A8). Append-only: there is deliberately NO UPDATE and NO DELETE
-- query on memory_provenance in this repo (retained rows are immutable; the parent memory's ON DELETE
-- CASCADE is the only removal — Epic H's user full-delete sweep). created_at is DB-assigned with
-- clock_timestamp() — the transaction-constant now() would tie for the multiple rows one
-- consolidation appends inside a single advance (a multi-stage gist jump), and created_at is the
-- deterministic tiebreak same-universe-day timeline readers sort by.
-- name: AppendMemoryProvenance :exec
INSERT INTO memory_provenance (
    id,
    user_id,
    episodic_memory_id,
    kind,
    source,
    text,
    universe_time,
    created_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(user_id),
    sqlc.arg(episodic_memory_id),
    sqlc.arg(kind),
    sqlc.arg(source),
    sqlc.arg(text),
    sqlc.arg(universe_time),
    clock_timestamp()
);
