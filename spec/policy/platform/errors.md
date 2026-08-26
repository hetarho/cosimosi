# Platform error contract

> Authoritative error-classification and disclosure policy. Transport mapping lives
> in each context's `rpc` adapter; shared construction/masking lives in
> `apps/api/internal/platform/apperr`; cross-app decoding and presentation live in
> `packages/errors`.

## 1. Two classes

An expected domain refusal keeps its safe message and canonical Connect code. It
also carries exactly one `cosimosi.platform.v1.ErrorInfo` with a stable
`<CONTEXT>_<ERROR>` reason, lowercase domain, safe structured metadata, and the
server-authoritative request id.

**Masking and reporting are separate decisions.** An unexpected failure is both
masked and reported; a domain refusal is neither by default. A context may mark one
as **reported** (`apperr.Reported`) when the operator is the only one who can act on
it and nothing else watches for it — the refusal keeps its own code, reason, metadata
and copy on the wire and is additionally captured, grouped by reason, with
content-free attributes. The mark rides the Go error chain only: a client learns
nothing about what we monitor, and the context that owns the reason owns the
decision, so platform never holds a list of another context's reasons.

An unexpected failure is always rebuilt at the outer API boundary as:

- Connect `Internal`;
- message `internal server error`;
- `reason=INTERNAL`, `domain=platform`;
- the authoritative request id;
- empty metadata and, by default, empty `debug_detail`.

The original cause stays server-side for logs and the unexpected-error reporter.
Production must never send raw error text, SQL, stack traces, secrets, diary or
memory content, generated content, tokens, or credentials. Metadata is limited to
non-content discriminators needed for safe recovery.

This binds a **domain refusal's own message** too, not just the masked class. A domain
error whose text is assembled from model output or the writer's words cannot be sent,
so a refusal that needs to say _which_ rule it hit carries a closed discriminator —
`MEMORY_ENCODE_RETRY_EXHAUSTED` carries `violation_kind` (and the observed memory
count) in metadata, while the re-prompt instruction that quotes the passage and the
proposed name never leaves the process, on the wire, in a log line, or in telemetry. The only diagnostic exception
is the exact runtime setting `COSIMOSI_ERROR_DETAIL=verbose`, which copies the raw
cause into `debug_detail` only. Empty, misspelled, and unknown values fail closed.
It is **hard-gated off in production**: when the deployment signal
`SENTRY_ENVIRONMENT=production` is present, `debug_detail` is forced empty
regardless of the flag, so a flag leaked into a prod stack cannot expose raw causes
(a leaked flag still exposes in a non-production stack — keep it unset by default).
Frontends never render `debug_detail`.

Every failed RPC receives a non-empty `request_id`; it is the join key shared by the
client presentation, API logs, and unexpected-error telemetry.

## 2. Reason registry

`FE` means the current shared presentation/recovery seam has reason-specific
behavior. `fallback` means localized copy comes from the coarse Connect code.

| Reason(s)                                                                                                                                | Domain      | Connect code               | FE                                |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------- | --------------------------------- |
| `INTERNAL`                                                                                                                               | platform    | Internal                   | generic copy + request id         |
| `PLATFORM_UNAUTHENTICATED`                                                                                                               | platform    | Unauthenticated            | coarse                            |
| `PLATFORM_AUTH_VERIFIER_UNAVAILABLE`                                                                                                     | platform    | Unavailable                | coarse                            |
| `PLATFORM_ACCOUNT_WITHDRAWN`                                                                                                             | platform    | PermissionDenied           | job 93 restore screen             |
| `PLATFORM_<CONNECT_CODE>`                                                                                                                | platform    | matching non-internal code | coarse                            |
| `ACCOUNT_SCOPE_REQUIRED`                                                                                                                 | account     | Unauthenticated            | fallback                          |
| `ACCOUNT_NOT_PROVISIONED`                                                                                                                | account     | FailedPrecondition         | fallback                          |
| `ACCOUNT_SIGNUP_REQUIRED`                                                                                                                | account     | FailedPrecondition         | fallback                          |
| `ACCOUNT_NICKNAME_INVALID`, `ACCOUNT_TIMEZONE_INVALID`, `ACCOUNT_LOCALE_INVALID`, `ACCOUNT_MOOD_COLOR_INVALID`                           | account     | InvalidArgument            | fallback                          |
| `ACCOUNT_INVITE_LINK_UNAVAILABLE`                                                                                                        | account     | FailedPrecondition         | fallback                          |
| `ACCOUNT_NOT_WITHDRAWN`, `ACCOUNT_RESTORE_WINDOW_EXPIRED`                                                                                | account     | FailedPrecondition         | job 93 restore flow               |
| `ADMIN_FORBIDDEN`                                                                                                                        | admin       | PermissionDenied           | reason copy                       |
| `ADMIN_SEED_ADMIN_UNDEMOTABLE`                                                                                                           | admin       | FailedPrecondition         | fallback                          |
| `ADMIN_USER_ID_REQUIRED`, `ADMIN_GRANT_AMOUNT_RANGE`, `ADMIN_GRANT_ID_REQUIRED`                                                          | admin       | InvalidArgument            | fallback                          |
| `ADMIN_UNKNOWN_CAPABILITY`, `ADMIN_PROVIDER_REQUIRED`, `ADMIN_PROVIDER_KEY_REQUIRED`                                                     | admin       | InvalidArgument            | fallback                          |
| `ADMIN_UNKNOWN_PROVIDER`, `ADMIN_PROVIDER_CAPABILITY_MISMATCH`                                                                           | admin       | InvalidArgument            | fallback                          |
| `ADMIN_PROVIDER_NOT_IMPLEMENTED`, `ADMIN_PROVIDER_KEY_MISSING`, `ADMIN_SECRETBOX_DISABLED`, `ADMIN_GRANT_ID_CONFLICT`                    | admin       | FailedPrecondition         | fallback                          |
| `ADMIN_MODEL_LISTING_UNAVAILABLE`                                                                                                        | admin       | Unavailable                | fallback                          |
| `ADMIN_USER_SEARCH_TOO_BROAD`                                                                                                            | admin       | ResourceExhausted          | reason copy                       |
| `MEMORY_DIARY_DATE_INVALID`, `MEMORY_ENCODE_INPUT_REQUIRED`, `MEMORY_LAUNCH_INVALID_MEMORIES`                                            | memory      | InvalidArgument            | fallback                          |
| `MEMORY_RECALL_INPUT_REQUIRED`, `MEMORY_VIEW_SEMANTIC_INPUT_REQUIRED`, `MEMORY_PROVENANCE_INPUT_REQUIRED`                                | memory      | InvalidArgument            | fallback                          |
| `MEMORY_EXPORT_FORMAT_REQUIRED`, `MEMORY_DIARY_PAGE_TOKEN_INVALID`, `MEMORY_RELEASE_INPUT_REQUIRED`                                      | memory      | InvalidArgument            | fallback                          |
| `MEMORY_LET_GO_INVALID_APPROVED`, `MEMORY_OPERATION_ID_REQUIRED`                                                                         | memory      | InvalidArgument            | fallback                          |
| `MEMORY_ENCODE_BODY_TOO_LONG`, `MEMORY_DIARY_SEARCH_QUERY_TOO_SHORT`, `MEMORY_DIARY_MOOD_FILTER_INVALID`                                 | memory      | InvalidArgument            | fallback                          |
| `MEMORY_DIARY_DATE_RANGE_INVALID`, `MEMORY_DIARY_SORT_INVALID`, `MEMORY_DIARY_COUNT_RANGE_INVALID`                                       | memory      | InvalidArgument            | fallback                          |
| `MEMORY_OPERATION_CONFLICT`                                                                                                              | memory      | AlreadyExists              | reason copy                       |
| `MEMORY_RECALL_MEMORY_NOT_FOUND`, `MEMORY_VIEW_SEMANTIC_MEMORY_NOT_FOUND`, `MEMORY_RELEASE_MEMORY_NOT_FOUND`                             | memory      | NotFound                   | target-not-found copy             |
| `MEMORY_RECALL_NO_LIVE_MEMORIES`, `MEMORY_PROVENANCE_MEMORY_NOT_FOUND`, `MEMORY_RELEASE_NO_LIVE_MEMORIES`, `MEMORY_RESTORE_NOT_RELEASED` | memory      | NotFound                   | fallback                          |
| `MEMORY_RECALL_MEMORY_UNAVAILABLE`, `MEMORY_RELEASE_MEMORY_UNAVAILABLE`                                                                  | memory      | FailedPrecondition         | target-unavailable copy           |
| `MEMORY_VIEW_SEMANTIC_STAGE_NOT_RISEN`                                                                                                   | memory      | FailedPrecondition         | reason copy                       |
| `MEMORY_ALREADY_RELEASED`                                                                                                                | memory      | FailedPrecondition         | reason copy                       |
| `MEMORY_RESTORE_WINDOW_EXPIRED`                                                                                                          | memory      | FailedPrecondition         | reason copy                       |
| `MEMORY_SYNC_CONSENT_REQUIRED`                                                                                                           | memory      | FailedPrecondition         | consent recovery + reason copy    |
| `MEMORY_INSUFFICIENT_TWINKLE`                                                                                                            | memory      | ResourceExhausted          | earn recovery + stardust copy     |
| `MEMORY_ENCODE_RETRY_EXHAUSTED`                                                                                                          | memory      | Unavailable                | reason copy + reported            |
| `MEMORY_AI_CALL_CAP_REACHED`                                                                                                             | memory      | ResourceExhausted          | reason copy                       |
| `MEMORY_SCOPE_REQUIRED`                                                                                                                  | memory      | Unauthenticated            | fallback                          |
| `TWINKLE_INVITE_INPUT_REQUIRED`, `TWINKLE_QUOTE_INPUT_REQUIRED`, `TWINKLE_LEDGER_CURSOR_INVALID`                                         | twinkle     | InvalidArgument            | fallback                          |
| `TWINKLE_QUOTE_TARGET_NOT_FOUND`                                                                                                         | twinkle     | NotFound                   | fallback                          |
| `TWINKLE_INSUFFICIENT`                                                                                                                   | twinkle     | ResourceExhausted          | earn recovery + reason copy       |
| `TWINKLE_INVITE_RESOLUTION_UNAVAILABLE`                                                                                                  | twinkle     | Unavailable                | fallback                          |
| `TWINKLE_INVITE_BENEFICIARY_MISMATCH`                                                                                                    | twinkle     | PermissionDenied           | fallback                          |
| `TWINKLE_INVITE_NOT_ELIGIBLE`, `TWINKLE_INVITE_GRANT_CONFLICT`                                                                           | twinkle     | FailedPrecondition         | fallback                          |
| `TWINKLE_QUOTE_TARGET_UNAVAILABLE`                                                                                                       | twinkle     | FailedPrecondition         | fallback                          |
| `TWINKLE_SCOPE_REQUIRED`                                                                                                                 | twinkle     | Unauthenticated            | fallback                          |
| `STORE_ORNAMENT_UNKNOWN`                                                                                                                 | store       | InvalidArgument            | fallback                          |
| `STORE_ORNAMENT_NOT_PURCHASABLE`                                                                                                         | store       | FailedPrecondition         | fallback                          |
| `STORE_INSUFFICIENT_TWINKLE`                                                                                                             | store       | ResourceExhausted          | earn recovery + reason copy       |
| `STORE_SCOPE_REQUIRED`                                                                                                                   | store       | Unauthenticated            | fallback                          |
| `ACHIEVEMENT_SCOPE_REQUIRED`                                                                                                             | achievement | Unauthenticated            | reason copy                       |
| `ACHIEVEMENT_INPUT_REQUIRED`                                                                                                             | achievement | InvalidArgument            | reason copy                       |
| `ACHIEVEMENT_NOT_FOUND`                                                                                                                  | achievement | NotFound                   | reason copy + refetch the list    |
| `ACHIEVEMENT_NOT_ACHIEVED`                                                                                                               | achievement | FailedPrecondition         | reason copy + refetch the list    |
| `ACHIEVEMENT_REWARD_UNAVAILABLE`                                                                                                         | achievement | Unavailable                | reason copy, button STAYS enabled |

**`ACHIEVEMENT_REWARD_UNAVAILABLE` is the one refusal whose copy must not sound like a loss.** The claim WAS recorded and
only the payout failed, so the reward is kept and the next attempt replays it through the same dedup keys — the copy says
so, and the claim button **stays enabled**. Disabling it would strand the reward in exactly the crash window the replay
exists to heal. For the same reason there is **no `ALREADY_CLAIMED` reason at all**: a repeat claim is a replay that pays,
so it is success, not an error to map.

`ACHIEVEMENT_NOT_FOUND` and `ACHIEVEMENT_NOT_ACHIEVED` both mean the list the press came from was stale, so they toast
**and** refetch — silently refreshing under a press reads as the button having done nothing.

`STORE_INSUFFICIENT_TWINKLE` is deliberately **not** a reuse of `TWINKLE_INSUFFICIENT`: that copy cannot say what
happened to the save, and this one must — "nothing was saved" is the honest line, because the whole save is refused as
one thing. It is the one reason whose metadata names a domain object (`ornament_id`, beside the economy's own
`cost`/`eligible`/`shortfall`), so the panel can point at the row the balance ran out on; the generic copy never names
an item, since only the surface can resolve an id to a name.

`ADMIN_USER_SEARCH_TOO_BROAD` is the other reason whose copy cannot be the coarse code's. It means the directory walk
passed `admin.search_scan_max_accounts` before it could resolve the requested page, which the operator fixes by typing
MORE of the prefix — while the generic `ResourceExhausted` line reads as an allowance, a limit that was never reached
and that waiting would not restore. It is returned instead of a short page on purpose: an admin list quietly missing a
user reads as "this account does not exist".

**This is gated.** `pnpm lint:error-reasons` (`scripts/check-error-reasons.mjs`) diffs every `reason*` constant in
`apps/api/internal/*/rpc/reasons.go` against the FE `ERROR_REASONS` union **and** against the §2 table above, failing
on either gap — so this file is a parsed artifact and its row shape is load-bearing (reasons live in the first cell,
backticked, comma-separated). The check asserts **membership only**: a reason may deliberately fall back to its coarse
Connect-code line, and a registry entry no handler emits is reported as a note rather than a failure. `FE` in the table
means the shared presentation seam has reason-specific behavior; `fallback` means the copy comes from the coarse code.

The platform reason constants and per-context `rpc/reasons.go` registries are the
code source for this table. Adding a canonical domain error requires a unique reason,
an existing/coherent Connect code, mapping coverage, and this registry update. An
unmapped cause must go through `apperr.Internal`; handlers may not construct ad-hoc
Connect errors.
