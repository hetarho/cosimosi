-- Per-user account preference storage. Every statement is scoped to the authenticated user
-- ([U1], §4, lint:persistence): the palette id belongs to exactly one user's row.

-- The user's stored palette id; no row when the user never chose one — the account context reads
-- that absence as the default id, so a missing row is not an error.
-- name: GetPalettePreference :one
SELECT palette_id
FROM palette_preferences
WHERE user_id = sqlc.arg(user_id);

-- Store the user's chosen palette id, replacing any prior choice (one preference row per user).
-- name: UpsertPalettePreference :one
INSERT INTO palette_preferences (user_id, palette_id, updated_at)
VALUES (sqlc.arg(user_id), sqlc.arg(palette_id), now())
ON CONFLICT (user_id)
DO UPDATE SET palette_id = EXCLUDED.palette_id, updated_at = now()
RETURNING palette_id;
