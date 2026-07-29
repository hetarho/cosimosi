-- Account withdrawal's store leg: the user's own ownership history and their applied
-- selections, hard-deleted by the user's own sweep — the single exception [I1] names.

-- name: PurgeUserOrnamentOwnerships :exec
DELETE FROM ornament_ownerships
WHERE user_id = sqlc.arg(user_id);

-- name: PurgeUserOrnamentSelections :exec
DELETE FROM ornament_selections
WHERE user_id = sqlc.arg(user_id);
