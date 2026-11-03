# ADMIN admin console
> r3 | the operator console: who is an admin, what an admin may read and change (accounts, Twinkle grants, AI provider config, operational health), and how every change is audited

## decisions
- ADMIN-1 [o] the admin console is a web-only operator surface at `/admin`; the web↔mobile parity rule is waived for it →=ARCH
  - mounted under the authenticated layout route and loaded by dynamic import →=AUTH; no product surface links to it
  - `pages/admin` composes `features/admin-users`, `admin-ai-config`, `admin-usage`, `admin-jobs` as tabs (users, provider keys, AI models, usage, jobs) and holds no domain logic
  - copy resolves through `admin_*` i18n keys; a plain, utilitarian voice is allowed, not the product's literary voice
  - a failed admin read shows `admin_load_error`, never an empty list or a zero
- ADMIN-2 [o] an admin is a user whose id or verified email is in `ADMIN_USER_IDS` (env seed), or who has an `admin_users` row (DB-promoted)
  - `ADMIN_USER_IDS`: comma-separated Supabase ids and emails (an entry with `@` is an email, matched case-insensitively), parsed at construction
  - email seeds are resolved through the account directory only when email seeds exist; a directory failure there grants nothing and falls through to the DB row
  - with `COSIMOSI_DEV_AUTH` on, every authenticated caller is an admin; the flag is never set in production →=AUTH
- ADMIN-3 [o] every `admin.v1` method except `GetAdminSelf` is admin-gated by `AuthorizationInterceptor`, attached to the admin service only and run after the shared auth chain →!ADMIN-2
  - non-admin ⇒ `ADMIN_FORBIDDEN` (PermissionDenied); anonymous ⇒ `PLATFORM_UNAUTHENTICATED` (Unauthenticated) →=AUTH; a failed membership check ⇒ Internal, never a pass
  - `GetAdminSelf` is the "am I admin?" probe: any authenticated caller gets `is_admin`, so a non-admin learns `false` rather than a refusal
  - the page gate is a UX mirror of the interceptor: pending ⇒ a loading line, settled non-admin ⇒ back to `/universe`
- ADMIN-4 [o] seed admins are the undemotable trust anchor: `RevokeAdmin` refuses an id or email seed with `ADMIN_SEED_ADMIN_UNDEMOTABLE` (FailedPrecondition); a seed changes only through env and redeploy ← the service must never lock itself out of its own console
  - the revoke-time email-seed check fails closed: a directory failure refuses the demotion and writes no audit row
  - `GrantAdmin` (idempotent) adds an `admin_users` row with `granted_by`/`granted_at`; `RevokeAdmin` removes a promoted row; `ListAdmins` lists seeds first, then promoted rows
- ADMIN-5 [o] the console is metadata-only: no `admin.v1` message carries diary text, emotion, memory meaning, position, connection or any memory content →~INV-2
  - admin power is broad across accounts and zero across memory content; the line is held by type: the `MemoryStats` port returns two counts and nothing else
  - no impersonation, no "log in as user", no content moderation or takedown
- ADMIN-6 [o] `ListUsers` is the authorized cross-user account read: per account the id, email, signup time, admin and seed flags, `SMALL`/`GENERAL`/total balance, diary count and episodic-memory count →!ADMIN-5
  - identity and the enumerable account set come from the Supabase Auth Admin API directory (`SUPABASE_SERVICE_ROLE_KEY`, server-only); unset ⇒ a keyless fake with an empty list
  - the `AccountDirectory` port binds the shared `internal/platform/supabase` adapter through admin's own composition-root adapter →~ACCT-12
  - a page costs a fixed number of batch reads (time zones via account `ZonesFor`, balances, counts, promoted admins), never one per user
  - balances derive per account in its own time zone, as `GetBalance` does; a missing balance row keeps the lazy default →=TWINK; a missing memory row reads as zero counts
  - pages are 0-based; `admin.user_list_page_size` is both the default and the ceiling
- ADMIN-7 [o] search is an email/id prefix over the live directory, refused rather than shortened when one search would walk more than `admin.search_scan_max_accounts` accounts ← a list silently missing an account reads as proof the account does not exist
  - refusal: `ADMIN_USER_SEARCH_TOO_BROAD` (ResourceExhausted); the bound is checked one page late, so a directory ending exactly on it still gets the page that reveals its end
  - the directory has no prefix filter: a searched page is an ordinal in the filtered stream, built by walking raw provider pages; `has_more` describes that stream; each provider page honours the caller's deadline
  - tripping the bound signals that a local account projection is due; none exists until then
  - web: a draft commits after `admin.search_debounce_ms` idle; the committed prefix keys the query, so a superseded request aborts and older rows never show under a newer prefix; paging and row actions are disabled while the draft is unsettled
- ADMIN-8 [o] a Twinkle grant credits `GENERAL` Twinkle through an `admin_grant` earn, at most `twinkle.admin_grant_max` per grant →=TWINK-3
  - `0 < amount ≤ twinkle.admin_grant_max`, else `ADMIN_GRANT_AMOUNT_RANGE` (InvalidArgument); a larger gift is several grants, each audited
  - it prices, spends and deletes nothing, and it is not a login bonus; make-goods use it, never payment reversal
  - the response carries the target's balance total after the grant
- ADMIN-9 [o] a grant is idempotent by its client-supplied `grant_id`, which the server requires and never mints ← a server-minted id would let a retried call double-credit
  - empty ⇒ `ADMIN_GRANT_ID_REQUIRED` (InvalidArgument)
  - record first, credit second: the `admin_stardust_grants` row and its audit row commit in one admin transaction, then `EarnAdminGrant` credits, deduped per user and grant id →=TWINK
  - the globally unique grant row is the lock: an id already recorded for another target or amount ⇒ `ADMIN_GRANT_ID_CONFLICT` (FailedPrecondition) before any credit
  - a true replay re-runs the credit as a no-op and returns the balance, healing a crash between record and credit
  - an idempotent pairing across two contexts, never one cross-context transaction
  - `ListTwinkleGrants` returns the grant history, newest first
- ADMIN-10 [o] the web grant form preserves operator intent before the irreversible append →!ADMIN-9
  - the amount must be decimal digits forming a safe integer in `1..twinkle.admin_grant_max`; a decimal or exponent spelling is refused visibly, never truncated
  - a new `grant_id` is minted per deliberate submit, after validation; transport retries keep the id already sent
  - a refusal keeps amount and note; only success clears them; the controls lock while a mutation is pending
- ADMIN-11 [o] AI provider API keys are managed once per provider and are write-only across the RPC boundary: reads return `key_set` and a masked hint, never plaintext
  - `SetProviderKey` encrypts at rest with `platform/secretbox` (AES-GCM keyed by the server-only `LLM_KEY_ENCRYPTION_KEY`); `ClearProviderKey` removes the row; an unknown slot ⇒ `ADMIN_UNKNOWN_PROVIDER`
  - key env unset ⇒ the fail-closed `Disabled` cipher refuses key writes (`ADMIN_SECRETBOX_DISABLED`, FailedPrecondition) while the rest of the console runs
  - provider slots, capability support and adapter implementation come from the AI registry through the `ProviderCatalog` port →=AI-11
  - LLM: one `openrouter` key serves every curated model; no per-vendor LLM key and no BYOK fan-out →=AI-11
  - dormant legacy provider-key rows stay until an operator removes them; nothing deletes them automatically →=AI-24
- ADMIN-12 [o] each capability (`llm`, `embedding`) selects one provider and model via `SetAIConfig`, only among providers that support it, have an adapter and hold a stored key →!ADMIN-11
  - refusals: `ADMIN_UNKNOWN_CAPABILITY`, `ADMIN_UNKNOWN_PROVIDER`, `ADMIN_PROVIDER_CAPABILITY_MISMATCH` (InvalidArgument); `ADMIN_PROVIDER_NOT_IMPLEMENTED`, `ADMIN_PROVIDER_KEY_MISSING` (FailedPrecondition)
  - `GetAIConfig` reports each capability's provider, model and source: `db`, `env` or `unset`
  - `ListProviderModels` sits behind the same eligibility chain; the stored key is used server-side only and never crosses the contract
  - embedding: the listing (Voyage's catalog) is advisory and `SetAIConfig` does no model-list validation; the dimension is enforced when the client is built →=AI-8
  - embedding: a listing failure ⇒ `ADMIN_MODEL_LISTING_UNAVAILABLE` (Unavailable) and manual entry; the control preselects the saved id, keeps an unlisted id selectable (marked unlisted) and offers manual entry
  - LLM selection is fixed-provider and curated-only →!ADMIN-19
  - a provider endpoint is adapter-owned code, never an env, DB or console setting →=AI-16
- ADMIN-19 [o] the LLM row is fixed-provider and curated-only: the provider is always `openrouter`, and a model is saved only from the current curated intersection →=AI-18 ← an unreviewed model must never reach a production call
  - `SetAIConfig(llm)` normalizes the provider to `openrouter`, requires its stored key and a non-empty model, fetches the current intersection and refuses a model outside it →=ERR-12
  | `SetAIConfig(llm)` refusal | reason |
  |---|---|
  | empty model | `ADMIN_MODEL_REQUIRED` |
  | model outside the current intersection, an empty intersection included | `ADMIN_MODEL_NOT_CURATED` |
  | listing or auth failure | `ADMIN_MODEL_LISTING_UNAVAILABLE` |
  - a refused new save keeps the current selection visible as current state, and it cannot be re-saved outside the intersection
  - console: the server-reported `openrouter` identity shows as fixed text; the model control offers only the returned list, with no default, unlisted, custom-ID or listing-failure manual path, and saving stays disabled until a listed model is chosen
  - no model id is copied into TS or i18n; the allowlist is adapter code →=AI-18
  - no RPC, field, table, query or migration changes; the existing rows hold `openrouter` and a `vendor/model` →~AI-24
  - LLM and embedding policies never leak into each other: embedding keeps the advisory flow →~ADMIN-12
  - a stored non-`openrouter` LLM selection is never reinterpreted with its old key →=AI-23
- ADMIN-13 [o] every process that resolves runtime AI config (`cmd/api`, `cmd/worker`) carries the same `LLM_KEY_ENCRYPTION_KEY` the console encrypts with; a missing or different value makes every keyed DB selection fail, never fall back to mock ← key drift is an ops misconfiguration to surface, not to mask
  - a console write applies without redeploy: both processes resolve the same tables per call and rebuild on a fingerprint change, a key rotation included, logging each rebuild's mode; resolution order and rebuild →=AI-14 →=AI-15
  - a selection whose key row is absent (cleared or never set) degrades to env → mock, so a clear-then-reselect order never hard-fails the pipeline; an existing but unusable key row is a hard error →=AI-14
  - a stored non-`openrouter` LLM selection never falls through: it stops both processes before they serve work, checked before key lookup →=AI-23
  - the swap sits below the metering seam: caps, caching and the error taxonomy are unchanged →~AI-25
- ADMIN-14 [o] two read-only operational boards: `GetAIUsage` and `GetJobHealth`
  - `GetAIUsage`: today's per-capability calls against `ai.daily_call_cap`, plus `ai.per_call_token_cap`, for the UTC day it names; the meter is in-process, so the response flags `process_local` and covers only the serving API process →=AI
  - no durable cross-process usage store
  - `GetJobHealth`: global `jobs` counts by status (pending, running, done, failed) plus `dead_lettered` = `failed` rows with `attempts ≥ ai.job_max_attempts`, the spent retry budgets; it never mutates the queue →~AI-35
  - a `DeadLetter` safety stop also ends `failed` with its cause only logged, so it counts under `failed` and reaches `dead_lettered` only if its attempts are spent too →~AI-36
- ADMIN-15 [o] every admin mutation appends an `admin_audit_log` row (actor, action, target, non-secret detail) in the mutation's own transaction →~INV-1
  - audited actions: `grant_admin`, `revoke_admin`, `set_provider_key`, `clear_provider_key`, `set_ai_config`, `grant_stardust`
  - `admin_audit_log` and `admin_stardust_grants` are append-only: never updated or deleted
  - a plaintext API key never enters either log, the process log or a response
- ADMIN-16 [o] admin tables are service-global operator state, exempt from the per-user isolation guard: `admin_users`, `ai_provider_keys`, `ai_provider_config`, `admin_stardust_grants`, `admin_audit_log` →=AUTH
  - the admin job-health and user-list enrichment statements sit on the guard's cross-user allowlist; they return counts, timezone names and balance facts only
  - operator records outlive accounts: the withdrawal sweep never touches `admin_*` rows →=ACCT-28
  - admin reads are GET-eligible but classified user-scoped, never shared-CDN cacheable →=CLIENT
- ADMIN-17 [o] `internal/admin` is a standalone context (the operator console, not a core domain) exposing `admin.v1.AdminService` (Connect, unary); no product code calls it →=ARCH-6
  - it imports no other context's internals (`account`, `twinkle`, `memory`, `ai`); cross-context work goes through consumer-owned ports in `admin/ports.go`, bound at `cmd/api`
  - ports: `AccountDirectory`, `TwinkleGranter`, `MemoryStats`, `AIUsageReader`, `JobHealthReader`, `Store`, `Cipher`, `ProviderCatalog`, `ModelCatalog`, `AIEnvConfig`
  - only `admin/pg` imports `dbgen`; it may import `internal/ai` for the `ConfigReader` type, and `internal/ai` imports nothing from admin
  - handlers map proto↔domain; authorization, caps, validation and seed protection live in the use-case
- ADMIN-18 [o] out of scope: no mobile console, no billing, refund or payment administration, no memory-content access, no `values.yaml` key for provider identity or keys
  - `ADMIN_USER_IDS`, `LLM_KEY_ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only env secrets

## flow
- admin call: auth interceptor(anonymous: Unauthenticated) → `AuthorizationInterceptor`(`GetAdminSelf`: pass | non-admin: PermissionDenied) → use-case → mutation + audit row(one transaction)
- grant: form validation(refused: keep input) → mint `grant_id` → `GrantStardust` → record grant + audit(id conflict: refuse) → `EarnAdminGrant`(dedup) → balance total

## constraints
- values keys owned by ADMIN: `admin.user_list_page_size`, `admin.search_debounce_ms`, `admin.search_scan_max_accounts`; the grant cap `twinkle.admin_grant_max` sits in the Twinkle group
- DB-backed admin and Twinkle integration tests run only with a local database (`COSIMOSI_TEST_DATABASE_URL` or `DATABASE_URL`); CI has no Postgres, so a green CI never proves the admin transaction paths

## chg
- r3 261103 ADMIN-19✎ one unnamed typed refusal→empty model `ADMIN_MODEL_REQUIRED`, outside the intersection (empty included) `ADMIN_MODEL_NOT_CURATED`, listing or auth failure `ADMIN_MODEL_LISTING_UNAVAILABLE`
- r2 261102 ADMIN-12✎ advisory model list + manual entry for both capabilities→embedding only · ADMIN-19+ LLM fixed `openrouter`, curated-only save, outage blocks a new save · ADMIN-11✎ any LLM provider key→one `openrouter` key, legacy rows kept · ADMIN-13✎ legacy LLM selection falls through→fails closed
- r1 261102 initial
