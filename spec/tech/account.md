# tech: account profile and identity model

> As-built backend shape for plans [60](../plan/60.account-profile-model.md),
> [61](../plan/61.signup-and-invite-usecase.md), and [62](../plan/62.withdrawal-usecase.md). The `account` supporting
> context owns product profile and lifecycle behavior while Supabase Auth remains the credential and email authority.

## Persistence

Migration `00016_account_identity.sql` creates three product-owned, user-scoped tables without foreign keys to
`users`:

- `users(user_id, nickname, timezone, locale, created_at, deleted_at)` — no email column;
- `auth_providers(user_id, provider, provider_user_id, linked_at)` — composite key and a
  `GOOGLE | PASSWORD` check;
- `invites(id, user_id, invitee_user_id, token, created_at, bound_at, rewarded_at)` — unique token, unique invitee,
  non-self, bound-only rows, and no `deleted_at`.

Color storage is two tables:

- `mood_colors(user_id, mood, color, updated_at)` has one optional lowercase color per mood;
- `mood_color_counts(mood, hue_bucket, color, count)` is a deliberately anonymous aggregate with
  no user id.

`SetMoodColor` serializes each `(user_id, mood)` transaction with a transaction advisory lock so
two simultaneous first writes cannot increment the aggregate twice. It decrements the old exact
swatch, upserts the user row, and increments the new exact swatch atomically. Identical retries do
not move a counter.

Static sqlc queries live in `db/queries/account`. Every statement is conjunctively scoped by `user_id` except
`FindSettleableInviteForInvitee`, the single-row authenticated-invitee lookup recorded in the global-query
allowlist. `BindInviteToInvitee` remains conjunctively inviter-scoped and needs no exception. The platform-table
allowlist is unchanged. `account/pg` is the only row-to-domain seam.

## Package and transport shape

The context stays one flat Go package split by aggregate files: `profile.go`, `authprovider.go`, `invite.go`,
`palette.go`, `types.go`, `ports.go`, `errors.go`, and `service.go`. The existing `account/pg` and `account/rpc`
packages remain the persistence and Connect adapters. Domain files import no proto, sqlc, pgx, or neighboring
context.

`cosimosi.account.v1.AccountService` publishes `GetProfile`, `UpdateProfile`, `ListAuthProviders`,
`GetInviteLink`, and the `SignUp` mutation alongside coarse and per-mood palette methods. No request
can name a user id. `GetMoodColors` returns only the caller's explicit rows. `SetMoodColor` accepts
only closed-set mood plus lowercase `#rrggbb`, then snaps lightness before storage.
`GetMoodColorStats` returns exactly bucket, optional share, and swatch color; it has no individual
account field. Side-effect-free reads are `NO_SIDE_EFFECTS`.

The context's OkLab/OkLCH port is pinned to the TypeScript package by
`internal/account/testdata/mood-color-parity.json`. The generated palette values control bucket
width, near-neutral chroma, recommendation count, and share floor.

## Supabase directory

`internal/platform/supabase.Directory` is the shared GoTrue Admin HTTP adapter. It returns only platform-owned
`Account` DTOs and exposes directory primitives; it imports no product context. The composition root translates the
same concrete independently into:

- `account.Directory`, limited to current email and provider identities;
- `admin.AccountDirectory`, preserving the operator console’s directory view.

The keyless `supabase.Fake` remains the development/test fallback. Account provider reads use stored rows when its
identity lookup is unavailable.

For withdrawal, `supabase.Directory` additionally implements the narrow `CredentialDirectory` mutation port. It
updates the Auth user with `ban_duration=876000h` (or `none` for operator recovery) and permanently deletes through the
server-only Admin endpoint; a missing user is idempotent success. API and worker composition reject the keyless fake
when `SENTRY_ENVIRONMENT=production`.

## Timezone publication and consumption

`account.Service.ZoneFor` publishes an IANA name and normalizes an absent or unresolvable stored name to `UTC`.
Memory owns the consuming `UserZone` port; `cmd/api` resolves the name to `*time.Location`.

Only four real-clock truncations use this port:

1. launch future-date rejection;
2. `SyncStatus.Today`;
3. `syncToToday`;
4. the spend-signal/recall baseline.

`forgetting.go`, `semanticization.go`, and `clock.go` continue to operate on zone-free universe dates.
`UTCUserZone` preserves the minimal/test composition default. Both API and worker binaries blank-import
`time/tzdata` because the static production image has no system zoneinfo.

## Invite capability

The token format is:

`base64url(inviter) . base64url(issued_at_unix) . base64url(32-byte nonce) . base64url(HMAC-SHA256(payload))`

`INVITE_TOKEN_SIGNING_KEY` is standard base64 and must decode to at least 32 bytes. Construction, the signer’s
zero value, and missing configuration all fail closed. Production composition refuses to boot when the key is absent;
development and tests may compose the unavailable signer, whose capability error is propagated by invite binding
rather than disguised as an invalid token. Issuance first reads only the caller's live profile, then derives the token
without reading or writing `invites`; verification performs no database access. Verification checks the MAC with
`hmac.Equal` before decoding trusted payload fields and enforces the generated invite TTL. A bind persists the
presented token later; there is deliberately no select-by-token query.

## Signup and deferred settlement

`SignUp` validates a trimmed rune-bounded nickname, rejects control characters and Unicode line/paragraph separators,
and validates a resolvable IANA timezone. The advisory TypeScript predicate rejects the same character classes;
`packages/auth/fixtures/nickname-validation.json` is the single accept/reject case table asserted by both TS and Go.
Signup coerces an unknown negotiated locale to `en`, reads the first known provider from the directory, and runs the data-changing
`CreateUserIfAbsent` CTE plus optional `AcceptInvite` in one account transaction. The CTE inserts `users` and the
initial `auth_providers` row atomically only for the winning first insert; conflict callers read and return the
existing profile. Only the winner may bind. A bind infrastructure failure rolls back profile birth, so a retry can
perform the same first write instead of being stranded unbound.

`AcceptInvite` verifies the HMAC token, takes the inviter id from its authenticated payload, and inserts the
bound-only `invites` row against a live inviter. Unique token and invitee constraints turn consumed links and
concurrent binds into `invite_bound=false`. Invalid and expired tokens remain best-effort refusals; signer
unavailability and unexpected verification faults surface so the signup transaction rolls back observably. There is
no token lookup and no `AcceptInvite` RPC.

`memory.SignupSettlementPort` fires after a successful launch transaction and only when the diary was not
past-dated. Its production adapter calls `account.Service.SettleSignup`; the no-error, scope-only port means
settlement cannot fail a committed launch or inspect memory content. Production construction requires this port,
the concrete account-backed `twinkle.InviteResolver`, and both account-owned granter ports.

Settlement is an idempotent cross-context pairing rather than a shared transaction: account probes the invite,
serializes by inviter on a dedicated session advisory lock, twinkle writes both dedup-keyed credits, account stamps
`rewarded_at`, and twinkle independently writes the dedup-keyed signup bonus. Credits-first ordering makes a crash
before the stamp recoverable by replay. Twinkle also serializes and counts inviter ledger credits inside its own
transaction; this crash-safe backstop prevents a credited-but-unstamped invite from opening an extra cap slot and
admits an exact dedup replay so the stamp can recover. The account-private settlement context marker makes the real
resolver fail closed from the legacy `ClaimInvite` RPC. The as-built values are a `500` signup bonus and a lifetime
cap of `10` rewarded invites per inviter.

## Cross-language fixtures and generated values

The locale contract is mirrored byte-for-byte at `packages/i18n/fixtures/locales.json` and
`internal/account/testdata/locales.json`, with TypeScript and Go drift guards. Nickname accept/reject cases live once
at `packages/auth/fixtures/nickname-validation.json`; both runtimes assert the same trimmed Unicode, boundary,
control-character, and line-separator cases. Generated values provide nickname bounds `2…24` runes, a 7-day invite
TTL, and the independent 30-day account-withdrawal retention window.

## Withdrawal admission and scheduling

`Withdraw` and `RestoreAccount` are mutations on the existing AccountService with empty requests, so authenticated
scope is unforgeable and neither method is cache-classified. The responses carry RFC3339 UTC timestamps.
`platform.WithdrawnScopeInterceptor` consumes only `AccountStatusReader`; the composition root binds the account
service and exactly one exemption, `AccountServiceRestoreAccountProcedure`. It runs after authentication and before
all registered context handlers, fails closed when the reader is absent or errors, and treats an absent `users` row
as an unprovisioned account rather than a withdrawal.

The account service caches the published withdrawn fact for five seconds per user in a 4,096-entry LRU, with a
generation fence around misses. `Withdraw` replaces the entry after commit and `RestoreAccount` invalidates it
immediately after its clearing transaction commits, before cancellation; a concurrent older miss therefore cannot
reintroduce stale withdrawn state. The current production topology declares one API container per environment in
`docker-compose.prod.yml`, which is the consistency boundary for this local cache. A future multi-replica API must
replace it with a coherently invalidated shared status source before scaling out. Both the account behavior and
platform metadata deadline use the one Go-side duration derived from `account.withdrawal_retention_days`.

The queue remains memory-owned. `memory.WithdrawalSweepJobIdentity(scope)` is the only constructor for the
`withdrawal:<userID>` dedup identity. `memory.UserJobService` directly implements account's `Schedule`/`Cancel` port
and alone constructs the empty payload and `(user, scope.UserID())` target, so API and worker cannot drift.
`memory.NewJobRunner` accepts composition-root extra handlers and rejects duplicate kinds. Both worker roots bind
`withdrawal_sweep` to `account.Service.SweepWithdrawnAccount`; withdrawal failures bypass the terminal claim ceiling
and remain durably retryable.

The worker composes error-returning unavailable invite/signup-bonus granters because its only account entry point is
the withdrawal sweep. An accidental future call to `SettleSignup` therefore fails the job loudly instead of reporting
success without credits.

## Withdrawal purge ownership

Migration `00017_withdrawal_sweep.sql` permits revisionless `user` job targets and amends the Twinkle table comments.
Purge SQL stays in each owning context:

- memory removes receipts, release effects/groups, provenance, activations, graph rows, diaries, universe state, and
  all user jobs except the running sweep;
- twinkle removes only the withdrawing user's ledger and balance;
- account removes auth-provider rows, invites where `invites.user_id` is the withdrawing inviter, the palette
  preference, per-mood color rows, and finally `users`. Anonymous aggregate counts retain no
  account key.

Memory and Twinkle each publish their own `WithdrawalPurger`; API, dev worker, and production worker inject those
types directly into account's consumer-owned port. No binary-local scheduler/purger adapter or duplicate missing-job
error remains.

Web and mobile keep their platform-specific withdrawal UI, but share
`commitWithdrawalAndEndSession` from `@cosimosi/auth`: only a failed `Withdraw` is a failed mutation. Once the server
commit succeeds, adapter sign-out is attempted and a failure falls back to an in-memory session teardown.

`SweepWithdrawnAccount` locks the account row, re-derives the deadline, and runs named legs memory → twinkle before
account dependents. It then bans and deletes the Supabase credential and deletes `users` last. Each earlier leg owns
its transaction and is replay-safe. The exact sqlc hard-delete allowlist in `lint:persistence` prevents another call
site, while the DB integration test derives all `user_id` product tables from migrations, cross-checks the live schema,
and allows only the in-flight identity-only job row to survive.
