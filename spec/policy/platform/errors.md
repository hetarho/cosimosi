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

An unexpected failure is always rebuilt at the outer API boundary as:

- Connect `Internal`;
- message `internal server error`;
- `reason=INTERNAL`, `domain=platform`;
- the authoritative request id;
- empty metadata and, by default, empty `debug_detail`.

The original cause stays server-side for logs and the unexpected-error reporter.
Production must never send raw error text, SQL, stack traces, secrets, diary or
memory content, generated content, tokens, or credentials. Metadata is limited to
non-content discriminators needed for safe recovery. The only diagnostic exception
is the exact non-production runtime setting `COSIMOSI_ERROR_DETAIL=verbose`, which
copies the raw cause into `debug_detail` only. Empty, misspelled, and unknown values
fail closed. Frontends never render `debug_detail`.

Every failed RPC receives a non-empty `request_id`; it is the join key shared by the
client presentation, API logs, and unexpected-error telemetry.

## 2. Reason registry

`FE` means the current shared presentation/recovery seam has reason-specific
behavior. `fallback` means localized copy comes from the coarse Connect code.

| Reason(s)                                                                                                                                | Domain   | Connect code               | FE                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------- | ------------------------------- |
| `INTERNAL`                                                                                                                               | platform | Internal                   | generic copy + request id       |
| `PLATFORM_UNAUTHENTICATED`                                                                                                               | platform | Unauthenticated            | coarse                          |
| `PLATFORM_AUTH_VERIFIER_UNAVAILABLE`                                                                                                     | platform | Unavailable                | coarse                          |
| `PLATFORM_<CONNECT_CODE>`                                                                                                                | platform | matching non-internal code | coarse                          |
| `ACCOUNT_UNKNOWN_PALETTE`                                                                                                                | account  | InvalidArgument            | fallback                        |
| `ACCOUNT_SCOPE_REQUIRED`                                                                                                                 | account  | Unauthenticated            | fallback                        |
| `ADMIN_FORBIDDEN`                                                                                                                        | admin    | PermissionDenied           | reason copy                     |
| `ADMIN_SEED_ADMIN_UNDEMOTABLE`                                                                                                           | admin    | FailedPrecondition         | fallback                        |
| `ADMIN_USER_ID_REQUIRED`, `ADMIN_GRANT_AMOUNT_RANGE`, `ADMIN_GRANT_ID_REQUIRED`                                                          | admin    | InvalidArgument            | fallback                        |
| `ADMIN_UNKNOWN_CAPABILITY`, `ADMIN_PROVIDER_REQUIRED`, `ADMIN_PROVIDER_KEY_REQUIRED`                                                     | admin    | InvalidArgument            | fallback                        |
| `ADMIN_UNKNOWN_PROVIDER`, `ADMIN_PROVIDER_CAPABILITY_MISMATCH`                                                                           | admin    | InvalidArgument            | fallback                        |
| `ADMIN_PROVIDER_NOT_IMPLEMENTED`, `ADMIN_PROVIDER_KEY_MISSING`, `ADMIN_SECRETBOX_DISABLED`                                               | admin    | FailedPrecondition         | fallback                        |
| `MEMORY_DIARY_DATE_INVALID`, `MEMORY_ENCODE_INPUT_REQUIRED`, `MEMORY_LAUNCH_INVALID_MEMORIES`                                            | memory   | InvalidArgument            | fallback                        |
| `MEMORY_RECALL_INPUT_REQUIRED`, `MEMORY_VIEW_SEMANTIC_INPUT_REQUIRED`, `MEMORY_PROVENANCE_INPUT_REQUIRED`                                | memory   | InvalidArgument            | fallback                        |
| `MEMORY_EXPORT_FORMAT_REQUIRED`, `MEMORY_DIARY_PAGE_TOKEN_INVALID`, `MEMORY_RELEASE_INPUT_REQUIRED`                                      | memory   | InvalidArgument            | fallback                        |
| `MEMORY_LET_GO_INVALID_APPROVED`, `MEMORY_OPERATION_ID_REQUIRED`                                                                         | memory   | InvalidArgument            | fallback                        |
| `MEMORY_OPERATION_CONFLICT`                                                                                                              | memory   | AlreadyExists              | reason copy                     |
| `MEMORY_RECALL_MEMORY_NOT_FOUND`, `MEMORY_VIEW_SEMANTIC_MEMORY_NOT_FOUND`, `MEMORY_RELEASE_MEMORY_NOT_FOUND`                             | memory   | NotFound                   | target-not-found copy           |
| `MEMORY_RECALL_NO_LIVE_MEMORIES`, `MEMORY_PROVENANCE_MEMORY_NOT_FOUND`, `MEMORY_RELEASE_NO_LIVE_MEMORIES`, `MEMORY_RESTORE_NOT_RELEASED` | memory   | NotFound                   | fallback                        |
| `MEMORY_RECALL_MEMORY_UNAVAILABLE`, `MEMORY_RELEASE_MEMORY_UNAVAILABLE`                                                                  | memory   | FailedPrecondition         | target-unavailable copy         |
| `MEMORY_VIEW_SEMANTIC_STAGE_NOT_RISEN`                                                                                                   | memory   | FailedPrecondition         | reason copy                     |
| `MEMORY_ALREADY_RELEASED`                                                                                                                | memory   | FailedPrecondition         | reason copy                     |
| `MEMORY_RESTORE_WINDOW_EXPIRED`                                                                                                          | memory   | FailedPrecondition         | reason copy                     |
| `MEMORY_SYNC_CONSENT_REQUIRED`                                                                                                           | memory   | FailedPrecondition         | consent recovery + reason copy  |
| `MEMORY_INSUFFICIENT_TWINKLE`                                                                                                            | memory   | ResourceExhausted          | charge recovery + stardust copy |
| `MEMORY_ENCODE_RETRY_EXHAUSTED`                                                                                                          | memory   | ResourceExhausted          | fallback                        |
| `MEMORY_SCOPE_REQUIRED`                                                                                                                  | memory   | Unauthenticated            | fallback                        |
| `TWINKLE_INVITE_INPUT_REQUIRED`, `TWINKLE_CHARGE_INPUT_REQUIRED`, `TWINKLE_QUOTE_INPUT_REQUIRED`                                         | twinkle  | InvalidArgument            | fallback                        |
| `TWINKLE_QUOTE_TARGET_NOT_FOUND`                                                                                                         | twinkle  | NotFound                   | fallback                        |
| `TWINKLE_INSUFFICIENT`                                                                                                                   | twinkle  | ResourceExhausted          | charge recovery + reason copy   |
| `TWINKLE_PAYMENT_VERIFICATION_UNAVAILABLE`, `TWINKLE_INVITE_RESOLUTION_UNAVAILABLE`                                                      | twinkle  | Unavailable                | fallback                        |
| `TWINKLE_PAYMENT_BENEFICIARY_MISMATCH`, `TWINKLE_INVITE_BENEFICIARY_MISMATCH`                                                            | twinkle  | PermissionDenied           | fallback                        |
| `TWINKLE_PAYMENT_NOT_VERIFIED`, `TWINKLE_INVITE_NOT_ELIGIBLE`, `TWINKLE_INVITE_GRANT_CONFLICT`                                           | twinkle  | FailedPrecondition         | fallback                        |
| `TWINKLE_QUOTE_TARGET_UNAVAILABLE`                                                                                                       | twinkle  | FailedPrecondition         | fallback                        |
| `TWINKLE_SCOPE_REQUIRED`                                                                                                                 | twinkle  | Unauthenticated            | fallback                        |

The platform reason constants and per-context `rpc/reasons.go` registries are the
code source for this table. Adding a canonical domain error requires a unique reason,
an existing/coherent Connect code, mapping coverage, and this registry update. An
unmapped cause must go through `apperr.Internal`; handlers may not construct ad-hoc
Connect errors.
