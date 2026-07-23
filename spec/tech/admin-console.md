# tech: admin console

> As-built rules for the `internal/admin` bounded context, its storage, and the runtime AI-provider-config seam it
> introduces. Architecture frame: [ARCHITECTURE.md](../ARCHITECTURE.md) §2.2–§2.6, §2.7, §4. Product shape:
> [58.admin-console](../plan/58.admin-console.md). Domain/ops policy: [policy/ops/admin.md](../policy/ops/admin.md).
> Modifies [28.ai-provider-abstraction](../plan/28.ai-provider-abstraction.md)'s env-only selection stance.

## 1. Boundaries (CC8)

`internal/admin` is a **standalone core context**: it imports no other context's internals (`memory`, `twinkle`,
`account`, `ai`). All cross-context work goes through consumer-owned ports declared in `admin/ports.go` and bound at
`cmd/api`: `AccountDirectory` (Supabase Auth Admin API / keyless fake), `StardustGranter` (over twinkle's
`GetBalance` + `EarnAdminGrant`), `MemoryStats` (memory's non-content counts), `AIUsageReader` (the `ai.Meter`
snapshot), `JobHealthReader` (memory's job-status counts), `Store` (admin/pg), `Cipher` (`platform/secretbox`),
`AIProviderValidator` (`ai.ProviderValidator`), `AIEnvConfig`. Only `admin/pg` imports `dbgen`. `admin/pg` may import
`internal/ai` for the `ConfigReader` return type (core→supporting is allowed); `internal/ai` imports no admin.

## 2. Authorization

`ADMIN_USER_IDS` (comma-separated Supabase UUIDs and/or emails) is parsed at construction into a seed-id set + seed-email
set. `IsAdmin(userID)` = seed-id ∪ (seed-email resolved via `AccountDirectory.EmailFor`, only when email seeds exist) ∪
`admin_users` row. The `admin/rpc.AuthorizationInterceptor` is attached to the admin service handler **only** (via
`connect.WithInterceptors` appended after the shared chain), so it runs after the plan-04 auth interceptor has put the
user id in context. It returns `PermissionDenied` for a non-admin; `GetAdminSelf` (the FE probe) is exempt. Seed admins
are undemotable (`RevokeAdmin` refuses them). When `COSIMOSI_DEV_AUTH` is on (dev bypass, never production), `IsAdmin`
short-circuits to `true` for any authenticated caller so `pnpm dev` reaches `/admin` without seeded ids.

## 3. Storage (migration 00015)

`admin_users` (DB-promoted admins), `ai_provider_config` (per-capability runtime config; encrypted key), and the
append-only `admin_stardust_grants` + `admin_audit_log`. All four are **service-global** (cross-user by design, the
sanctioned §4 exception) and allowlisted in `check-persistence-isolation.mjs` (`platformTables`). Each mutating
`admin/pg` method writes the mutation and its `admin_audit_log` row in one pgx transaction. The append-only logs are
never `UPDATE`d/`DELETE`d.

## 4. Runtime AI-provider config (the AI-provider-abstraction change)

Two levels: **per-provider keys** (`ai_provider_keys`, one row per provider slot) and **per-capability selection**
(`ai_provider_config`, one row per capability → provider+model, no key). Keys are managed once via
`SetProviderKey`/`ClearProviderKey`; a capability then selects a keyed, capability-supported, implemented provider via
`SetAIConfig` (no key). Provider slots + per-capability support + adapter-implementation come from the AI registry
through the consumer-owned `ProviderCatalog` port (admin imports no registry). Slots: openai/gemini/anthropic/deepseek/
glm/kimi (LLM) and openai/gemini/voyage (embedding); the `glm` slot is z.ai/Zhipu.

`internal/ai.RuntimeConfigSource` resolves each capability's effective config as **DB (capability's selected provider +
model, then that provider's decrypted key) → env (`COSIMOSI_*`) → empty (keyless mock)**. `ai.ResolvingAdapters` wraps
the memory ports (`Extractor`/`Embedder`/`Semanticizer`/`PredictionError`/`SealSuggester`); on each call it re-resolves
and rebuilds the underlying real/mock adapters when the effective config's **fingerprint** changes (a sha256 of
source+provider+model+key, so a key rotation rebuilds too). Both `cmd/api` and `cmd/worker` resolve through it
over the same tables, so a change from the console reaches both processes without a redeploy. The metered wrapper, error
taxonomy, and keyless-mock fallback are unchanged (the swap is below the metering seam).

## 5. Secrets

`platform/secretbox` is AES-GCM (nonce ‖ ciphertext) keyed by `LLM_KEY_ENCRYPTION_KEY` (base64 32-byte, server-only).
`SetProviderKey` encrypts the key; `ListProviderKeys`/`GetAIConfig` return only `key_set` + a masked hint
(`secretbox.Hint`), never the plaintext. When the key env is unset, the fail-closed `Disabled` cipher refuses to encrypt
(provider-key writes are rejected) — the console otherwise runs. `SUPABASE_SERVICE_ROLE_KEY` (server-only) powers the
`AccountDirectory`; unset falls back to the keyless fake (empty user list).

## 6. Stardust grant

`admin.GrantStardust` validates `0 < amount ≤ twinkle.admin_grant_max`, credits **additional** balance via
`twinkle.EarnAdminGrant` (idempotent by the client grant id), then records the `admin_stardust_grants` + audit rows in
one admin transaction (also keyed by the grant id). The two sides are an **idempotent pairing** (not one cross-context
transaction — contexts stay decoupled), safe under retry because both dedup on the same id.

## 7. Frontend

Web-only `pages/admin` composes `features/admin-ai-config`, `admin-users`, `admin-usage`, `admin-jobs`, mounted under
the authenticated route subtree at `/admin`; the page gates on `GetAdminSelf` (UX mirror; the BE interceptor is
authoritative). The four single-surface features are exempted from steiger's `insignificant-slice` rule (like the
settings/writing-flow verticals). All admin reads are classified user-scoped (never shared-CDN) in
`packages/client-cache`. No mobile surface (parity waived).
