-- Account profile reads and updates are always scoped to the authenticated user ([U1]).

-- name: GetUserProfile :one
SELECT user_id, nickname, timezone, locale, created_at, deleted_at
FROM users
WHERE user_id = sqlc.arg(user_id);

-- UpdateProfile is the sole writer of the editable profile fields. A withdrawn row cannot be
-- changed during its retention window.
-- name: UpdateUserProfile :one
UPDATE users
SET nickname = sqlc.arg(nickname),
    timezone = sqlc.arg(timezone),
    locale = sqlc.arg(locale)
WHERE user_id = sqlc.arg(user_id)
  AND deleted_at IS NULL
RETURNING user_id, nickname, timezone, locale, created_at, deleted_at;
