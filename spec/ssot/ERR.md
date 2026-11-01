# ERR error contract
> r1 | how a failed RPC travels from a Go context to the user: the two error classes, the `ErrorInfo` detail, the reason registry, masking and reporting, and the shared FE decode, copy and recovery seam

## decisions
- ERR-1 [o] every RPC failure is exactly one of two classes, decided by its Connect code after the owning context's mapping: a domain refusal (any code but `Internal`/`Unknown`) or an unexpected failure (`Internal`/`Unknown`)
  - a domain refusal keeps its safe message, its canonical Connect code and one `ErrorInfo` with a stable reason; it is neither masked nor reported unless its context marks it →~ERR-9
  - an unexpected failure is masked →!ERR-5 and reported →=OBS
  - both classes carry the request id →!ERR-4
  - ERR owns how a refusal travels and reads, never which situations are refusals: each domain decides its own refusals and their Connect codes
- ERR-2 [o] `cosimosi.platform.v1.ErrorInfo` rides every failed RPC as a Connect error detail: the Connect code stays the coarse transport signal, `reason` is the stable machine contract clients branch on
  - fields: `reason` →!ERR-3, `domain` (owning context, lowercase), `request_id` →!ERR-4, `metadata` →!ERR-8, `debug_detail` →!ERR-7
  - exactly one `ErrorInfo` per error: the boundary keeps the first, drops duplicates and preserves every other detail
  - declared in `proto/cosimosi/platform/v1/platform.proto`
- ERR-3 [o] a reason is `<CONTEXT>_<ERROR>` in SCREAMING_SNAKE, one per mapped domain error; the string is the contract, its prefix names the owning context
  - `apperr` derives `domain` from the prefix, lowercased; `INTERNAL`, `UNKNOWN` and a prefix that is not plain uppercase letters map to `platform`
  - platform reasons are `INTERNAL`, `UNKNOWN` and `PLATFORM_*`, declared as constants in `internal/platform/apperr`
  - many refusals share one Connect code (memory alone has several `FailedPrecondition` refusals); only the reason tells them apart
- ERR-4 [o] every failed RPC carries a non-empty `request_id`, the server-authoritative correlation id and the one join key between the client presentation, API logs and unexpected-error telemetry
  - the outer error interceptor writes it onto the `ErrorInfo` (`apperr.WithRequestID`), so it arrives even when an errored call has no response header; handlers never set it
  - an error that reaches the boundary without an `ErrorInfo` gains one: reason `apperr.DefaultReason(code)` (`INTERNAL` for `Internal`/`Unknown`, else `PLATFORM_<CODE>`), domain `platform`
  - the id is `X-Request-Id`: a client value is kept only as a safe token (at most 128 chars of `A-Z a-z 0-9 . _ - :`), otherwise the server mints one →=OBS
  - users see it only for the internal bucket →=ERR-15
- ERR-5 [o] an unexpected failure is rebuilt at the outer boundary as Connect `Internal`, message `internal server error`, reason `INTERNAL`, domain `platform`, the request id, empty metadata and an empty `debug_detail` unless the env gate opens it →!ERR-7
  - covers Connect `Unknown` and recovered panics alike: `StructuredErrorInterceptor` and `PanicRecoveryInterceptor` both return `apperr.MaskedInternal`
  - the raw cause stays server-side: `LoggingInterceptor` logs it before masking with the request id; the reporter gets a safe `error_type` or `panic_type` discriminator, never the raw text →=OBS
  - interceptor order, outer to inner: panic recovery → request id → structured error → logging → auth → withdrawn scope (`internal/platform/handler.go`); logging sits inside masking so it sees the raw cause
- ERR-6 [o] production never sends raw error text, SQL, stack traces, secrets, diary or memory content, generated content, tokens or credentials ← information disclosure; masking stays, and the request id is what makes a masked failure traceable
  - binds a domain refusal's own message too: a message assembled from model output or the writer's words is never sent
  - a refusal that must say which rule it hit carries a closed discriminator in metadata instead →!ERR-8
  - the encode repair instruction that quotes the passage and the proposed name never leaves the process: not on the wire, in a log line or in telemetry →~ENC
- ERR-7 [o] `debug_detail` is filled only when the runtime env `COSIMOSI_ERROR_DETAIL` is exactly `verbose`, and never when `SENTRY_ENVIRONMENT` is `production` ← a flag leaked into a production stack must not expose raw causes
  - empty, misspelled and unknown values fail closed; the production match is trimmed and case-insensitive (`apperr.ExposeDetail`)
  - a production stack sets `SENTRY_ENVIRONMENT=production` even with Sentry disabled; outside production the flag stays unset by default
  - only the raw cause is copied, into `debug_detail` alone; message and metadata stay masked; frontends never render it →=ERR-15
- ERR-8 [o] `metadata` carries only the non-content discriminators a client needs for safe recovery; a reason not listed here carries none
  - `PLATFORM_ACCOUNT_WITHDRAWN`: `withdrawn_at`, `restore_deadline_at` (RFC 3339, UTC)
  - `MEMORY_ENCODE_RETRY_EXHAUSTED`: `violation_kind`, plus `memories` (the observed count) when one exists
  - `TWINKLE_INSUFFICIENT`: `cost`, `eligible`, `shortfall`
  - `STORE_INSUFFICIENT_TWINKLE`: `cost`, `ornament_id`, and `eligible` / `shortfall` only when the economy supplied them (a zero shortfall omits both, never reports 0) →~ERR-19
  - built from the domain error's `Detail()` map: a consumer reads keys, never parses a message →~TWINK
- ERR-9 [o] masking and reporting are separate decisions: an unexpected failure is masked and reported, a domain refusal is neither unless its owning context marks it `apperr.Reported` ← the operator is the only one who can act on it and nothing else watches for it
  - a reported refusal keeps its code, reason, metadata and copy on the wire and is also captured, grouped by reason, with content-free attributes: never its message, which can quote the writer's passage →=OBS
  - the mark rides the Go error chain only, never the wire: a client learns nothing about what is monitored
  - the owning context decides; `platform` holds no list of another context's reasons
  - telemetry never fails the request
  - reported reasons: `MEMORY_ENCODE_RETRY_EXHAUSTED`
- ERR-10 [o] handwritten BE code never builds a Connect error directly: every error goes through `internal/platform/apperr` (`Domain`, `Internal`, `Reported`; the boundary's `MaskedInternal` and `WithRequestID`)
  - guard: `TestHandwrittenBoundariesUseAppErrorConstructors` fails on `connect.NewError(`, `connect.NewErrorf(` or `connect.NewWireError(` anywhere under `internal/` outside `platform/apperr`, generated code and tests
- ERR-11 [o] each context's `rpc` adapter owns its domain-error → (Connect code, reason) mapping, with its reason constants in `internal/<ctx>/rpc/reasons.go` beside it ← the taxonomy is shared, the mappings stay per context so no context imports another →~ARCH
  - every mapping ends in an explicit `return apperr.Internal(err)`: an unmapped domain error is a mapping gap to fix, never a raw passthrough (guard `TestContextRPCMappingsKeepAnExplicitInternalFallback`)
  - contexts with a `reasons.go`: account, achievement, admin, memory, store, twinkle; platform reasons stay `apperr` constants →=ERR-3
  - a new refusal needs a unique reason string, a coherent existing Connect code, mapping coverage, a registry row →!ERR-12 and an `ERROR_REASONS` key →!ERR-14
  - a transport call with no authenticated user is refused by platform as `PLATFORM_UNAUTHENTICATED`; a context's `<CTX>_SCOPE_REQUIRED` answers its use-case's own empty-scope guard
- ERR-12 [o] the reason registry: every reason a context's `reasons.go` declares, every `apperr` platform reason and every `ERROR_REASONS` member has a row; the Connect code is the one its mapping emits
  | reason(s) | domain | Connect code | FE handling |
  |---|---|---|---|
  | `INTERNAL` | platform | Internal | generic copy with the request id |
  | `UNKNOWN` | platform | Unknown | client-assigned, never sent by the server; coarse |
  | `PLATFORM_UNAUTHENTICATED` | platform | Unauthenticated | coarse |
  | `PLATFORM_AUTH_VERIFIER_UNAVAILABLE` | platform | Unavailable | coarse |
  | `PLATFORM_ACCOUNT_WITHDRAWN` | platform | PermissionDenied | coarse; a withdrawn session lands on the profile gate's refused arm (retry, sign out), and no client calls `RestoreAccount` →~ACCT-25 |
  | `PLATFORM_<CODE>` | platform | the matching non-internal code | coarse; any failure that reached the boundary without an `ErrorInfo` |
  | `ACCOUNT_SCOPE_REQUIRED` | account | Unauthenticated | coarse |
  | `ACCOUNT_NOT_PROVISIONED` | account | FailedPrecondition | coarse; mapped but never raised: no account path returns `ErrNotProvisioned` |
  | `ACCOUNT_SIGNUP_REQUIRED`, `ACCOUNT_INVITE_LINK_UNAVAILABLE` | account | FailedPrecondition | coarse |
  | `ACCOUNT_NICKNAME_INVALID`, `ACCOUNT_TIMEZONE_INVALID`, `ACCOUNT_LOCALE_INVALID`, `ACCOUNT_MOOD_COLOR_INVALID` | account | InvalidArgument | coarse |
  | `ACCOUNT_NOT_WITHDRAWN`, `ACCOUNT_RESTORE_WINDOW_EXPIRED` | account | FailedPrecondition | coarse; the `RestoreAccount` refusals, which no client can reach →~ACCT-25 |
  | `ADMIN_FORBIDDEN` | admin | PermissionDenied | reason copy |
  | `ADMIN_USER_ID_REQUIRED`, `ADMIN_GRANT_AMOUNT_RANGE`, `ADMIN_GRANT_ID_REQUIRED`, `ADMIN_UNKNOWN_CAPABILITY` | admin | InvalidArgument | coarse |
  | `ADMIN_PROVIDER_REQUIRED`, `ADMIN_PROVIDER_KEY_REQUIRED`, `ADMIN_UNKNOWN_PROVIDER`, `ADMIN_PROVIDER_CAPABILITY_MISMATCH` | admin | InvalidArgument | coarse |
  | `ADMIN_SEED_ADMIN_UNDEMOTABLE`, `ADMIN_GRANT_ID_CONFLICT`, `ADMIN_PROVIDER_NOT_IMPLEMENTED`, `ADMIN_PROVIDER_KEY_MISSING`, `ADMIN_SECRETBOX_DISABLED` | admin | FailedPrecondition | coarse |
  | `ADMIN_MODEL_LISTING_UNAVAILABLE` | admin | Unavailable | coarse |
  | `ADMIN_USER_SEARCH_TOO_BROAD` | admin | ResourceExhausted | reason copy →=ERR-20 |
  | `MEMORY_DIARY_DATE_INVALID`, `MEMORY_ENCODE_INPUT_REQUIRED`, `MEMORY_ENCODE_BODY_TOO_LONG`, `MEMORY_LAUNCH_INVALID_MEMORIES` | memory | InvalidArgument | coarse (`error_invalid_argument`), no reason copy; `MEMORY_ENCODE_INPUT_REQUIRED` also answers a future-dated launch →=TIME-13 |
  | `MEMORY_RECALL_INPUT_REQUIRED`, `MEMORY_VIEW_SEMANTIC_INPUT_REQUIRED`, `MEMORY_PROVENANCE_INPUT_REQUIRED`, `MEMORY_EXPORT_FORMAT_REQUIRED` | memory | InvalidArgument | coarse |
  | `MEMORY_RELEASE_INPUT_REQUIRED`, `MEMORY_LET_GO_INVALID_APPROVED`, `MEMORY_OPERATION_ID_REQUIRED` | memory | InvalidArgument | coarse |
  | `MEMORY_DIARY_PAGE_TOKEN_INVALID`, `MEMORY_DIARY_SEARCH_QUERY_TOO_SHORT`, `MEMORY_DIARY_MOOD_FILTER_INVALID` | memory | InvalidArgument | coarse |
  | `MEMORY_DIARY_DATE_RANGE_INVALID`, `MEMORY_DIARY_SORT_INVALID`, `MEMORY_DIARY_COUNT_RANGE_INVALID` | memory | InvalidArgument | coarse |
  | `MEMORY_OPERATION_CONFLICT` | memory | AlreadyExists | reason copy |
  | `MEMORY_RECALL_MEMORY_NOT_FOUND`, `MEMORY_VIEW_SEMANTIC_MEMORY_NOT_FOUND`, `MEMORY_RELEASE_MEMORY_NOT_FOUND` | memory | NotFound | shared target-not-found copy |
  | `MEMORY_RECALL_NO_LIVE_MEMORIES`, `MEMORY_PROVENANCE_MEMORY_NOT_FOUND`, `MEMORY_RELEASE_NO_LIVE_MEMORIES`, `MEMORY_RESTORE_NOT_RELEASED` | memory | NotFound | coarse |
  | `MEMORY_RECALL_MEMORY_UNAVAILABLE`, `MEMORY_RELEASE_MEMORY_UNAVAILABLE` | memory | FailedPrecondition | shared target-unavailable copy |
  | `MEMORY_VIEW_SEMANTIC_STAGE_NOT_RISEN`, `MEMORY_RESTORE_WINDOW_EXPIRED` | memory | FailedPrecondition | reason copy |
  | `MEMORY_ALREADY_RELEASED` | memory | FailedPrecondition | reason copy; the diary already has a live full delete (`Release`), not a letting-go →=DEL-2 |
  | `MEMORY_SYNC_CONSENT_REQUIRED` | memory | FailedPrecondition | recovery `sync-consent` (the consent modal), else reason copy →=TIME-16 |
  | `MEMORY_INSUFFICIENT_TWINKLE` | memory | ResourceExhausted | recovery `earn`, Twinkle-shortfall copy |
  | `MEMORY_ENCODE_RETRY_EXHAUSTED` | memory | Unavailable | reason copy; reported →=ERR-9 |
  | `MEMORY_AI_CALL_CAP_REACHED` | memory | ResourceExhausted | reason copy →=ERR-21 |
  | `MEMORY_SCOPE_REQUIRED` | memory | Unauthenticated | coarse |
  | `TWINKLE_INVITE_INPUT_REQUIRED`, `TWINKLE_QUOTE_INPUT_REQUIRED`, `TWINKLE_LEDGER_CURSOR_INVALID` | twinkle | InvalidArgument | coarse |
  | `TWINKLE_QUOTE_TARGET_NOT_FOUND` | twinkle | NotFound | coarse |
  | `TWINKLE_INSUFFICIENT` | twinkle | ResourceExhausted | recovery `earn`, Twinkle-shortfall copy |
  | `TWINKLE_INVITE_RESOLUTION_UNAVAILABLE` | twinkle | Unavailable | coarse |
  | `TWINKLE_INVITE_BENEFICIARY_MISMATCH` | twinkle | PermissionDenied | coarse |
  | `TWINKLE_INVITE_NOT_ELIGIBLE`, `TWINKLE_INVITE_GRANT_CONFLICT`, `TWINKLE_QUOTE_TARGET_UNAVAILABLE` | twinkle | FailedPrecondition | coarse |
  | `TWINKLE_SCOPE_REQUIRED` | twinkle | Unauthenticated | coarse |
  | `STORE_ORNAMENT_UNKNOWN` | store | InvalidArgument | coarse |
  | `STORE_ORNAMENT_NOT_PURCHASABLE` | store | FailedPrecondition | coarse; an unowned achievement-only ornament is not for sale, not too expensive |
  | `STORE_INSUFFICIENT_TWINKLE` | store | ResourceExhausted | reason copy (the whole save refused), no `earn` recovery →=ERR-19 |
  | `STORE_SCOPE_REQUIRED` | store | Unauthenticated | coarse |
  | `ACHIEVEMENT_SCOPE_REQUIRED` | achievement | Unauthenticated | reason copy |
  | `ACHIEVEMENT_INPUT_REQUIRED` | achievement | InvalidArgument | reason copy |
  | `ACHIEVEMENT_NOT_FOUND` | achievement | NotFound | reason copy, refetch the list →=ACH-24 |
  | `ACHIEVEMENT_NOT_ACHIEVED` | achievement | FailedPrecondition | reason copy, refetch the list →=ACH-24 |
  | `ACHIEVEMENT_REWARD_UNAVAILABLE` | achievement | Unavailable | reason copy that must not read as a loss, refetch, the claim stays actionable →=ACH-24 |
  - FE handling terms: coarse = the Connect-code line; reason copy = an `error_*` key `presentAppError` selects for that reason →=ERR-15; `earn` / `sync-consent` = `classifyErrorRecovery` →=ERR-18
  - only backticked codes in a row's first cell count as registered, comma-separated →!ERR-13
- ERR-13 [o] `pnpm lint:error-reasons` (`scripts/check-error-reasons.mjs`) fails when a `reason*` constant in any `apps/api/internal/*/rpc/reasons.go` is missing from `ERROR_REASONS` or from the ERR-12 table →!ERR-12
  - membership only: a reason may fall back to coarse copy, bespoke copy stays optional by design
  - a registry entry no `reasons.go` declares is a note, not a failure; the five `apperr` platform reasons are allowlisted
  - only the `reasonX = "REASON"` constant form and the `ERROR_REASONS` object literal count: a string built at a call site is not registered
  - runs in `pnpm lint`; the parser self-test `pnpm lint:error-reasons:probe` runs in `pnpm test:guards`
- ERR-14 [o] the FE decodes every failure through one function, `toAppError(unknown)` (`@cosimosi/errors/core`), into `AppError {connectCode, reason, domain, requestId, metadata, debugDetail, retriable}`; no surface guesses from a raw catch
  - it reads the `ErrorInfo` detail; with none: `Internal` ⇒ `INTERNAL`, `Unknown` ⇒ `UNKNOWN`, any other code ⇒ `PLATFORM_<CODE>`, all in domain `platform`
  - a non-Connect error ⇒ `UNKNOWN` with code `Unknown`
  - `ERROR_REASONS` (`packages/errors/src/core.ts`) is the FE union of every reason; `isReason(error, reason)` is the reason test →!ERR-13
  - `retriable` derives from the Connect code alone (`Unknown`, `DeadlineExceeded`, `ResourceExhausted`, `Aborted`, `Internal`, `Unavailable`) and feeds display severity only; retry counts stay the client-cache policy →=CLIENT
  - the `core` subpath is decoder-only, so `packages/observability` reads the request id without the copy layer →=OBS
- ERR-15 [o] `presentAppError(error)` is the one headless presentation, `{severity, message, showId}`, used verbatim by web and mobile; only the Toast and the boundary rendering are per platform
  - message: reason `INTERNAL` with a request id ⇒ `error_internal`, the only error copy with a `{requestId}` placeholder; else the reason's own `error_*` key; else the coarse Connect-code line (`codeMessage`); a non-Connect error reads `error_unknown`
  - domain refusals never show the id: their message is the meaningful part
  - reason copy exists only for reasons a surface branches on; every other reason reads the coarse line
  - raw exception messages and `debug_detail` are never user copy
  - severity: `Canceled` ⇒ info; a retriable code or a Twinkle shortfall (`TWINKLE_INSUFFICIENT`, `MEMORY_INSUFFICIENT_TWINKLE`, `STORE_INSUFFICIENT_TWINKLE`) ⇒ warning; anything else ⇒ danger
  - copy lives in `packages/i18n/messages/*.json` →=CLIENT
- ERR-16 [o] errors surface through `useErrorToast()` (`@cosimosi/errors/react`), which pushes into the app's single toast queue under the owner `error`, last-wins ← a failing API raises a burst of the same refusal, and queued they would show a minute of stale toasts
  - a new error drops only the previous error toast; another owner's entry, such as an achievement notice, stays →~ACH
  - dwell `errors.toast_auto_dismiss_ms`, read from generated config by the app host
  - `ErrorToastProvider` is shared and only pushes; each app's toast host wraps it and renders the one Toast in the tree →=UI
  - `useErrorToast` outside a provider throws, so a wiring bug fails loud
  - a settled query failure with no surface of its own is forwarded to the toast so it shows its correlation id instead of failing silently: `GetBalance` (stardust overlay), `SyncStatus` (recall flow, diary reader), the achievement read
- ERR-17 [o] each app root wraps its tree in `ObservedErrorBoundary` (`packages/observability`); the fallback renders `presentAppError` copy plus a retry that resets the boundary, so a fatal render failure shows the generic line with its correlation id
  - parity: web `apps/web/src/app/App.tsx`, mobile `apps/mobile/src/app/providers/MobileAppProviders.tsx`; retry label `common_retry`
- ERR-18 [o] `classifyErrorRecovery(error, syncConsentGiven)` maps a failure to what the user can do, a closed set `sync-consent | earn | none` ← recovery names the user's next action, not what went wrong
  - `MEMORY_SYNC_CONSENT_REQUIRED` while consent is not yet given ⇒ `sync-consent`: re-open the consent modal and retry under a fresh operation id →=TIME-16
  - once consent was given nothing returns `sync-consent`, so a later refusal never loops back to consent
  - `MEMORY_INSUFFICIENT_TWINKLE` or `TWINKLE_INSUFFICIENT` ⇒ `earn`: the reason copy plus the earn guide, an explanation of how Twinkle is earned and never a purchase →=TWINK-3
  - `STORE_INSUFFICIENT_TWINKLE` ⇒ `none`: the decoration panel's own shortfall line answers it →~ERR-19
  - callers: the recall flow, the diary reader's whole-diary recall, the gist view (`earn` only)
  - paid actions also split a known refusal (fresh operation id) from an ambiguous failure (same id, so a resubmit replays) by Connect code →=RECALL
- ERR-19 [o] `STORE_INSUFFICIENT_TWINKLE` is deliberately not `TWINKLE_INSUFFICIENT`: its copy says the whole save was refused and nothing was saved ← the save is refused as one thing, and the Twinkle copy cannot say what happened to it
  - its metadata names `ornament_id` so the decoration panel can point at the row the balance ran out on →=DECOR
  - the generic copy never names an item: only the surface resolves an id to a name
- ERR-20 [o] `ADMIN_USER_SEARCH_TOO_BROAD` means the directory walk passed `admin.search_scan_max_accounts` before resolving the requested page; its copy tells the operator to type more of the prefix ← the coarse `ResourceExhausted` line reads as an allowance that waiting would restore
  - returned instead of a short page: an admin list quietly missing a user reads as "this account does not exist" →=ADMIN
- ERR-21 [o] only a real allowance may read as one: `MEMORY_AI_CALL_CAP_REACHED` is the one memory refusal that is an allowance, `MEMORY_ENCODE_RETRY_EXHAUSTED` is not
  - the encode-retry copy says the split did not come together and another try may land differently, never a limit; the repair budget →=ENC
  - the call-cap window is the UTC day (`ai.daily_call_cap`), so its copy promises no local reset time →=AI
- ERR-22 [o] placement: the BE contract lives in `internal/platform` (`apperr`, the interceptor chain) and `proto/cosimosi/platform/v1`; the FE seam in `packages/errors`, copy in `packages/i18n` →=ARCH
  - `packages/errors` exports `.` (decode and presentation), `./core` (decoder only) and `./react` (context, `useErrorToast`, `ErrorToastProvider`)
  - web and mobile import `@cosimosi/errors/react` directly, so lower FSD layers use the hook without importing upward from `app`
  - only the toast host (`app/providers/toast-provider.tsx`) and the boundary fallback are forked per app

## flow
- failure: context mapping(known: `apperr.Domain` | unmapped: `apperr.Internal`) → structured-error interceptor(domain: request id, capture if `Reported` | internal: capture → mask) → wire `ErrorInfo` → `toAppError` → `classifyErrorRecovery`(sync-consent: consent modal | earn: toast + earn guide | none: toast via `presentAppError`)

## constraints
- the only `values.yaml` key ERR owns is `errors.toast_auto_dismiss_ms`; reasons, `ErrorInfo` and the `debug_detail` gate are contract or runtime env, never values

## chg
- r1 261102 initial
