-- name: CreateEntry :one
INSERT INTO entries (id, entry_date, mood, note, artwork_spec, thumb_key)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetEntryByDate :one
SELECT * FROM entries WHERE entry_date = $1;

-- name: ListEntries :many
SELECT * FROM entries
ORDER BY entry_date DESC
LIMIT $1 OFFSET $2;

-- name: UpdateEntry :one
UPDATE entries
SET mood = $2, note = $3, artwork_spec = $4, thumb_key = $5, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteEntry :exec
DELETE FROM entries WHERE id = $1;
