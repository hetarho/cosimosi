-- Account profile reads and updates are always scoped to the authenticated user ([U1]).

-- CreateUserIfAbsent is the signup birth write. When the directory supplied a known provider,
-- its append-only linkage is recorded in the same statement as the new profile; a retry that
-- loses the ON CONFLICT race returns no created row and writes neither table.
-- name: CreateUserIfAbsent :one
WITH created AS (
    INSERT INTO users (user_id, nickname, timezone, locale)
    VALUES (sqlc.arg(user_id), sqlc.arg(nickname), sqlc.arg(timezone), sqlc.arg(locale))
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id, nickname, timezone, locale, created_at, deleted_at
),
recorded_provider AS (
    INSERT INTO auth_providers (user_id, provider, provider_user_id)
    SELECT created.user_id, sqlc.arg(provider), sqlc.arg(provider_user_id)
    FROM created
    WHERE sqlc.arg(provider)::text <> ''
      AND sqlc.arg(provider_user_id)::text <> ''
    ON CONFLICT (user_id, provider) DO NOTHING
    RETURNING user_id
)
SELECT created.user_id,
       created.nickname,
       created.timezone,
       created.locale,
       created.created_at,
       created.deleted_at
FROM created
LEFT JOIN recorded_provider ON recorded_provider.user_id = created.user_id;

-- name: GetUserProfile :one
SELECT user_id, nickname, timezone, locale, created_at, deleted_at
FROM users
WHERE user_id = sqlc.arg(user_id);

-- Batch form of the published timezone read used by Twinkle's admin balance enrichment. Missing
-- profile rows are omitted; account's service maps them to its UTC default.
-- name: ListUserTimezones :many
SELECT user_id, timezone
FROM users
WHERE user_id = ANY(sqlc.arg(user_ids)::text[]);

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
