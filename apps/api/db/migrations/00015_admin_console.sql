-- +goose Up

-- admin_users — DB-promoted admins (plan 58). The env-seed ADMIN_USER_IDS set is the undemotable
-- trust anchor and is NOT stored here; this table holds only the runtime-promoted additions.
-- Effective admin = env-seed ∪ this table. Cross-user by design (an operator surface, not per-user
-- product data), so its statements carry no UserScope filter and its table is allowlisted in
-- check-persistence-isolation.mjs.
CREATE TABLE admin_users (
    user_id    TEXT PRIMARY KEY,             -- the promoted user (Supabase id)
    granted_by TEXT NOT NULL,                -- the admin who promoted them
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ai_provider_config — service-global runtime AI provider selection (plan 58's change to plan 28's
-- env-only stance): one row per capability. The factory resolves DB row → env → keyless mock, so a
-- SetAIConfig here takes effect without redeploy. The API key is stored ENCRYPTED (AES-GCM, key
-- from LLM_KEY_ENCRYPTION_KEY) and is never returned by the read — only key_hint (a masked tail) is.
CREATE TABLE ai_provider_config (
    capability        TEXT PRIMARY KEY,          -- 'llm' | 'embedding'
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL DEFAULT '',
    base_url          TEXT NOT NULL DEFAULT '',
    api_key_encrypted BYTEA,                     -- NULL = no stored key (config falls back to env/mock)
    key_hint          TEXT NOT NULL DEFAULT '',  -- masked tail for display; never the plaintext key
    updated_by        TEXT NOT NULL DEFAULT '',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_stardust_grants — append-only audit of admin 별가루 증정 (who granted, to whom, how much,
-- why, when). The balance effect is a twinkle admin_grant earn; this row is the accountability
-- record, and its id (the client grant id) is the idempotency source. Never UPDATEd/DELETEd ([I1]).
CREATE TABLE admin_stardust_grants (
    id          TEXT PRIMARY KEY,               -- client grant id (idempotency key)
    granted_by  TEXT NOT NULL,
    target_user TEXT NOT NULL,
    amount      INT  NOT NULL CHECK (amount > 0),
    note        TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- admin_audit_log — append-only record of every sensitive admin mutation (promote/demote, AI-config
-- change, stardust grant): accountability for the console's powers ([I1] spirit). detail is a small
-- JSON object and NEVER contains a plaintext API key. Never UPDATEd/DELETEd.
CREATE TABLE admin_audit_log (
    id         TEXT PRIMARY KEY,
    actor      TEXT NOT NULL,                   -- the admin who acted
    action     TEXT NOT NULL,                   -- 'grant_admin' | 'revoke_admin' | 'set_ai_config' | 'grant_stardust'
    target     TEXT NOT NULL DEFAULT '',        -- affected user/capability
    detail     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_stardust_grants_created_at_idx ON admin_stardust_grants (created_at DESC);
CREATE INDEX admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);

-- +goose Down
DROP TABLE admin_audit_log;
DROP TABLE admin_stardust_grants;
DROP TABLE ai_provider_config;
DROP TABLE admin_users;
