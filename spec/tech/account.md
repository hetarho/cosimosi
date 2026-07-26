# tech: account profile and identity model

> As-built backend shape for plan [60](../plan/60.account-profile-model.md). The `account` supporting context owns
> product profile behavior while Supabase Auth remains the credential and email authority.

## Persistence

Migration `00016_account_identity.sql` creates three product-owned, user-scoped tables without foreign keys to
`users`:

- `users(user_id, nickname, timezone, locale, created_at, deleted_at)` — no email column;
- `auth_providers(user_id, provider, provider_user_id, linked_at)` — composite key and a
  `GOOGLE | PASSWORD` check;
- `invites(id, user_id, invitee_user_id, token, created_at, bound_at, rewarded_at)` — unique token, unique invitee,
  non-self, bound-only rows, and no `deleted_at`.

Static sqlc queries live in `db/queries/account`. Every statement is conjunctively scoped by `user_id`; neither the
global-query nor platform-table persistence allowlist is widened. `account/pg` is the only row-to-domain seam.

## Package and transport shape

The context stays one flat Go package split by aggregate files: `profile.go`, `authprovider.go`, `invite.go`,
`palette.go`, `types.go`, `ports.go`, `errors.go`, and `service.go`. The existing `account/pg` and `account/rpc`
packages remain the persistence and Connect adapters. Domain files import no proto, sqlc, pgx, or neighboring
context.

`cosimosi.account.v1.AccountService` publishes `GetProfile`, `UpdateProfile`, `ListAuthProviders`, and
`GetInviteLink` alongside the existing palette methods. No request can name a user id. All three read RPCs are
classified exactly once as private user-scoped `NO_SIDE_EFFECTS` reads.

## Supabase directory

`internal/platform/supabase.Directory` is the shared GoTrue Admin HTTP adapter. It returns only platform-owned
`Account` DTOs and exposes directory primitives; it imports no product context. The composition root translates the
same concrete independently into:

- `account.Directory`, limited to current email and provider identities;
- `admin.AccountDirectory`, preserving the operator console’s directory view.

The keyless `supabase.Fake` remains the development/test fallback. Account provider reads use stored rows when its
identity lookup is unavailable.

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
zero value, and missing configuration all fail closed. Issuance and verification perform no database access.
Verification checks the MAC with `hmac.Equal` before decoding trusted payload fields and enforces the generated
invite TTL. A bind persists the presented token later; there is deliberately no select-by-token query.

## Cross-language fixtures and generated values

The locale contract is mirrored byte-for-byte at `packages/i18n/fixtures/locales.json` and
`internal/account/testdata/locales.json`, with TypeScript and Go drift guards. Generated values provide nickname
bounds `2…24` runes and a 7-day invite TTL.
