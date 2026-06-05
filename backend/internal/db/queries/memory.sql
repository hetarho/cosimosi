-- records is immutable (constitution §1): there are deliberately NO UPDATE or
-- DELETE queries here. Order matters — record → memory → job — because
-- memories.record_id is a NOT NULL FK to records.id.

-- name: FindMemoryByIdempotencyKey :one
-- Idempotency: return the existing memory_id for a (user_id, idempotency_key) pair.
SELECT m.id AS memory_id
FROM records r
JOIN memories m ON m.record_id = r.id
WHERE r.user_id = $1 AND r.idempotency_key = $2;

-- name: InsertRecord :exec
-- The immutable original. No memory_id column (the star points to the record, not
-- the reverse). idempotency_key is nullable.
INSERT INTO records (id, user_id, body, entry_date, mood, intensity, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- name: InsertMemory :one
-- The star. record_id (NOT NULL FK) links back to the original; mood/intensity/
-- entry_date live only on records (read via JOIN).
INSERT INTO memories (id, user_id, record_id)
VALUES ($1, $2, $3)
RETURNING id;

-- name: GetMemoryForEmbed :one
-- Loads what the embedding worker needs (spec 05): the star's owner, the original
-- diary body, and its entry_date (for the temporal_bonus baseline). body/entry_date
-- live on the immutable records row, read via JOIN.
SELECT m.user_id, r.body, r.entry_date
FROM memories m
JOIN records r ON r.id = m.record_id
WHERE m.id = $1;

-- name: ListMemoriesByUser :many
-- Every star for the user, dormant included (no brightness filter — constitution
-- §2). mood/intensity are sourced from records via JOIN.
SELECT m.id AS memory_id, r.mood, r.intensity, m.last_recalled_at
FROM memories m
JOIN records r ON r.id = m.record_id
WHERE m.user_id = $1
ORDER BY m.created_at;
