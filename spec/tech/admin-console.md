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
are undemotable — `RevokeAdmin` refuses **both** id seeds and email seeds (the target's email is resolved via
`AccountDirectory.EmailFor`, mirroring `IsAdmin`'s matching; unlike `IsAdmin`'s read-only fall-through, a directory
failure here fails **closed** — proceeding could delete the DB promotion that keeps an email-seed admin effective
during that same outage, and would record a misleading `revoke_admin` audit row). When `COSIMOSI_DEV_AUTH` is on (dev
bypass, never production), `IsAdmin` short-circuits to `true` for any authenticated caller so `pnpm dev` reaches
`/admin` without seeded ids.

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
model, then that provider's decrypted key) → env (`COSIMOSI_*`) → empty (keyless mock)**. A DB selection whose provider
key **row** is absent (cleared via `ClearProviderKey`, or never set) is treated as unresolvable and falls through to env
→ mock — it never yields a keyless DB config that the factory's provider-without-key fail-fast would reject, so an
operator's clear/reselect ordering cannot hard-fail the AI pipeline; each rebuild logs the resolved mode so the
degradation is visible in the process log. A key row that exists but is unusable — decrypt failure, empty ciphertext or
plaintext — is still a hard error (see §5 — encryption-key drift/corruption must fail loudly, not silently serve mock). `ai.ResolvingAdapters` wraps
the memory ports (`Extractor`/`Embedder`/`Semanticizer`/`PredictionError`/`SealSuggester`); on each call it re-resolves
and rebuilds the underlying real/mock adapters when the effective config's **fingerprint** changes (a sha256 of
source+provider+model+key, so a key rotation rebuilds too). Both `cmd/api` and `cmd/worker` resolve through it
over the same tables, so a change from the console reaches both processes without a redeploy. The metered wrapper, error
taxonomy, and keyless-mock fallback are unchanged (the swap is below the metering seam).

## 5. Secrets

`platform/secretbox` is AES-GCM (nonce ‖ ciphertext) keyed by `LLM_KEY_ENCRYPTION_KEY` (base64 32-byte, server-only).
**The same `LLM_KEY_ENCRYPTION_KEY` value must be set on every process that resolves runtime AI config — both `cmd/api`
and `cmd/worker`.** Keys are encrypted by the API at `SetProviderKey` time and decrypted by whichever process makes the
AI call; a worker with the env unset (fail-closed `Disabled` cipher) or set to a different value cannot decrypt any
stored key, so every resolve of a keyed DB selection errors and every AI-dependent job fails until the values match.
This is deliberate fail-loud behavior (not a fall-through to mock): key drift is an ops misconfiguration to surface,
and the two processes must be deployed with the secret from the same source.
`SetProviderKey` encrypts the key; `ListProviderKeys`/`GetAIConfig` return only `key_set` + a masked hint
(`secretbox.Hint`), never the plaintext. When the key env is unset, the fail-closed `Disabled` cipher refuses to encrypt
(provider-key writes are rejected) — the console otherwise runs. `SUPABASE_SERVICE_ROLE_KEY` (server-only) powers the
`AccountDirectory`; unset falls back to the keyless fake (empty user list).

## 6. Stardust grant

`admin.GrantStardust` validates `0 < amount ≤ twinkle.admin_grant_max`, **records first, credits second**: the
`admin_stardust_grants` + audit rows are written in one admin transaction (keyed by the grant id), then the
**additional** balance is credited via `twinkle.EarnAdminGrant` (idempotent per user + grant id). The globally-unique
grant row is the idempotency lock — a grant id already recorded for a **different** target/amount is refused with
`ErrGrantIDConflict` (→ `ADMIN_GRANT_ID_CONFLICT`) _before_ any credit (twinkle's dedup is per-user only, so
credit-first would let a reused id credit another user with no grant/audit row); a true replay (same target + amount)
re-runs the credit as a dedup no-op and returns the balance, and a crash between record and credit heals on that
replay. The two sides remain an **idempotent pairing** (not one cross-context transaction — contexts stay decoupled).
The grant id is **required and server-enforced**: an empty id is refused with `ErrGrantIDRequired`
(→ `ADMIN_GRANT_ID_REQUIRED`), never auto-minted — a minted id would make a retried direct-RPC call double-credit.

## 7. Test coverage

DB-backed integration tests (`internal/admin/pg/store_integration_test.go`, `internal/twinkle/pg/…`) are
**local-only**: they gate on `COSIMOSI_TEST_DATABASE_URL`/`DATABASE_URL` and skip when unset. CI provisions **no
Postgres service**, so a green CI proves the unit/contract layer only, never the DB transaction paths — run
`pnpm infra:up && pnpm db:migrate` and the gated tests locally before trusting a DB-touching change. (Revisit
alongside the CI-toolchain work if a CI Postgres service is ever added.)

## 8. Frontend

Web-only `pages/admin` composes `features/admin-ai-config`, `admin-users`, `admin-usage`, `admin-jobs`, mounted under
the authenticated route subtree at `/admin`; the page gates on `GetAdminSelf` (UX mirror; the BE interceptor is
authoritative). The four single-surface features are exempted from steiger's `insignificant-slice` rule (like the
settings/writing-flow verticals). All admin reads are classified user-scoped (never shared-CDN) in
`packages/client-cache`. No mobile surface (parity waived).
