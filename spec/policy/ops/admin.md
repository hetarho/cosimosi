# policy: admin console

> Operational policy for the web-only admin console. Owned by plan
> [58.admin-console](../../plan/58.admin-console.md); the as-built context rules live in
> [tech/admin-console.md](../../tech/admin-console.md). Reinforces the constitution [I1][I2][I3].

## The rules

**1. Authorization — env-seed ∪ DB-promoted; seed admins are the undemotable trust anchor.**
An admin is any user whose id (or verified email) is in `ADMIN_USER_IDS` (env seed) **or** who has an `admin_users`
row (DB-promoted from the user list). Every `admin.v1` method is admin-gated by the admin-authorization interceptor
(layered on the plan-04 auth interceptor); a non-admin call returns `PermissionDenied` (distinct from an anonymous
call's `Unauthenticated`). The one exception is `GetAdminSelf`, the "am I admin?" probe — callable by any authenticated
user so the FE gate can resolve `{isAdmin:false}`. Seed admins **cannot be demoted** through the console (a
`RevokeAdmin` against a seed identity is refused); they can only change via env + redeploy. In the dev-auth bypass
(`COSIMOSI_DEV_AUTH`, never production) every authenticated caller is treated as an admin, so `pnpm dev` reaches
`/admin` without seeding ids.

**2. Privacy — the console is metadata-only ([I2]).**
Admin power is broad across _accounts_ and zero across _memory content_. No `admin.v1` response type carries diary
text, emotion, star meaning, position, or any memory content; the user list exposes only identity, signup date, admin
status, stardust balance, and non-content counts (# diaries / # stars). The `MemoryStats` port has no content field by
type — the privacy line is held by shape, not by discipline.

**3. Stardust grant — capped, append-only, audited ([I1][I3]).**
An admin grant (별가루 증정) credits the target's **additional** (permanent) balance via a new `admin_grant` earn,
capped by `twinkle.admin_grant_max`, idempotent per grant id. It writes an `admin_stardust_grants` row and an
`admin_audit_log` entry (one admin transaction) and credits Twinkle via a separate idempotent earn keyed by the same
grant id. A grant prices nothing, spends nothing, and deletes nothing — it is not a login/attendance bonus ([G3]).

**4. AI provider config — per-provider keys, then per-capability selection; DB override over env.**
API keys are managed **once per provider** (`SetProviderKey`/`ClearProviderKey`), encrypted at rest and **write-only**
across the RPC boundary — reads return only `key_set` + a masked hint, never the plaintext. Each capability (LLM,
embedding) then **selects a provider + model** among the providers that have a key, support that capability, and have a
built adapter (`SetAIConfig`); selecting one that is unkeyed, unsupported, or unimplemented is refused. The factory
resolves DB selection + provider key → env → keyless mock, applied without redeploy (see
[tech/admin-console.md](../../tech/admin-console.md)). Provider slots: openai, gemini, anthropic, deepseek, glm, kimi
(LLM) and openai, gemini, voyage (embedding).

**5. Accountability — every admin mutation is authorized and audited; keys are never logged.**
`GrantAdmin`/`RevokeAdmin`/`SetAIConfig`/`GrantStardust` each append an `admin_audit_log` row (actor, action, target,
non-secret detail). The audit log and grant log are append-only ([I1]); a plaintext API key never enters either.

**6. Web-only operational surface.**
The console is `/admin` on the web app only; the web↔mobile parity rule is deliberately waived for it.
