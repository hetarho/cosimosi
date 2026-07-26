-- Auth-provider linkage reads are scoped to the authenticated user ([U1][U5]).

-- name: ListAuthProviders :many
SELECT user_id, provider, provider_user_id, linked_at
FROM auth_providers
WHERE user_id = sqlc.arg(user_id)
ORDER BY linked_at;

-- Linkage is append-only in v2. A repeated observation of the same provider keeps the original
-- linked_at instead of rewriting history.
-- name: RecordAuthProvider :exec
INSERT INTO auth_providers (user_id, provider, provider_user_id)
VALUES (sqlc.arg(user_id), sqlc.arg(provider), sqlc.arg(provider_user_id))
ON CONFLICT (user_id, provider) DO NOTHING;
