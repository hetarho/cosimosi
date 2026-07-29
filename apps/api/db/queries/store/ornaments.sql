-- The store context's whole persistence surface: what a user owns, what the universe wears, and
-- the withdrawal purge. Every statement is conjunctively scoped by user_id ([U1]).

-- name: ListOrnamentOwnerships :many
SELECT ornament_id, acquired_via, acquired_at
FROM ornament_ownerships
WHERE user_id = sqlc.arg(user_id)
ORDER BY ornament_id;

-- name: ListOrnamentSelections :many
SELECT kind, ornament_id
FROM ornament_selections
WHERE user_id = sqlc.arg(user_id)
ORDER BY kind;

-- The primary key IS the dedup key, so a replayed purchase or achievement claim never
-- double-grants and an existing row is never overwritten — ownership is permanent ([P9][I1]).
--
-- :execrows because the affected-row count is load-bearing, not diagnostic: DO NOTHING skips a row
-- the user already owns, so 1 means THIS statement acquired it. That is what a save's charge is
-- summed over — two concurrent identical saves serialize on the primary key, and the loser is told 0.
-- name: InsertOrnamentOwnership :execrows
INSERT INTO ornament_ownerships (user_id, ornament_id, acquired_via)
VALUES (sqlc.arg(user_id), sqlc.arg(ornament_id), sqlc.arg(acquired_via))
ON CONFLICT (user_id, ornament_id) DO NOTHING;

-- name: UpsertOrnamentSelection :exec
INSERT INTO ornament_selections (user_id, kind, ornament_id)
VALUES (sqlc.arg(user_id), sqlc.arg(kind), sqlc.arg(ornament_id))
ON CONFLICT (user_id, kind)
DO UPDATE SET ornament_id = EXCLUDED.ornament_id, selected_at = now();
