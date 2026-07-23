-- Admin console persistence (plan 58). All statements are deliberately cross-user (an operator
-- surface, not per-user product data), so the admin tables are allowlisted in
-- check-persistence-isolation.mjs — see that file's platformTables set.

-- name: IsPromotedAdmin :one
SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = $1
) AS promoted;

-- name: ListPromotedAdmins :many
SELECT user_id, granted_by, granted_at
FROM admin_users
ORDER BY granted_at ASC, user_id ASC;

-- name: PromoteAdmin :exec
INSERT INTO admin_users (user_id, granted_by)
VALUES ($1, $2)
ON CONFLICT (user_id) DO NOTHING;

-- name: RevokeAdmin :execrows
DELETE FROM admin_users WHERE user_id = $1;

-- name: InsertTwinkleGrant :execrows
INSERT INTO admin_stardust_grants (id, granted_by, target_user, amount, note)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO NOTHING;

-- name: ListTwinkleGrants :many
SELECT id, granted_by, target_user, amount, note, created_at
FROM admin_stardust_grants
ORDER BY created_at DESC, id DESC
LIMIT $1 OFFSET $2;

-- name: InsertAdminAuditLog :exec
INSERT INTO admin_audit_log (id, actor, action, target, detail)
VALUES ($1, $2, $3, $4, $5);

-- name: GetAIProviderConfig :one
SELECT capability, provider, model, base_url, api_key_encrypted, key_hint, updated_by, updated_at
FROM ai_provider_config
WHERE capability = $1;

-- name: UpsertAIProviderConfig :exec
INSERT INTO ai_provider_config (
    capability, provider, model, base_url, api_key_encrypted, key_hint, updated_by, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (capability) DO UPDATE SET
    provider = EXCLUDED.provider,
    model = EXCLUDED.model,
    base_url = EXCLUDED.base_url,
    api_key_encrypted = EXCLUDED.api_key_encrypted,
    key_hint = EXCLUDED.key_hint,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;
