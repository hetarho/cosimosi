-- The save's own statement ([P8]). The rest of what Decorate needs is already owned by
-- ornaments.sql: the ownership list it classifies against, and the insert whose affected-row count
-- IS the authoritative "newly acquired" answer.

-- Reverting a kind to its free default removes the applied row, because absence IS the default:
-- a row naming the default would be a second way to say the same thing. This is the user's own save
-- changing their own staging, never the erasure of anything they wrote ([I1]).
-- name: DeleteOrnamentSelection :exec
DELETE FROM ornament_selections
WHERE user_id = sqlc.arg(user_id)
  AND kind = sqlc.arg(kind);
