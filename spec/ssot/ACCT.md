# ACCT account & access

> r2 | who the user is to the product and how they come in, stay and leave: per-user isolation, the profile and its time zone, signup and invites, withdrawal, and the entry and my-page surfaces

## decisions
- ACCT-1 [o] only an authenticated user reaches their own universe, and every product row is isolated per user by `user_id` →!AUTH
  - the scope comes only from the verified session (`platform.UserScope`); no per-user request message carries a `user_id`, so a caller can name no other user
  - `platform.UserIdentity` and the scope carry only the Supabase subject; no profile or directory field enters them
  - every account statement is conjunctively scoped by `user_id` (`pnpm lint:persistence`, `scripts/check-persistence-isolation.mjs`); `users` names its key `user_id` so the gate sees an owned scope column
  - the only cross-user account statements, allowlisted with their reason: `account/invites.sql#FindSettleableInviteForInvitee` (one row, keyed by the authenticated invitee →~ACCT-20) and `account/users.sql#ListUserTimezones` (zone names for the authorized admin list →=ADMIN)
  - a session without a profile mounts no product route or read →=ACCT-32; a withdrawn session reaches no context handler →=ACCT-23
- ACCT-2 [o] a new universe starts empty: signup seeds no `Diary`, `EpisodicMemory`, `Neuron` or sample content, and memories arise only from launching a diary →=ENC
  - signup writes only the `users` row, its first `auth_providers` row and, when a link token binds, one `invites` row →=ACCT-19
  - the first-run view is the empty sky over the latent field →~VIS-7
  - the demo's sample universe never reaches a real account →=DEMO
- ACCT-3 [o] the universe is a navigable 3D space: camera movement, focus and flight →=VIS
- ACCT-4 [o] the landing page is v2 scope: product introduction, theory summary and the demo CTA for signed-out visitors →=MKT
  - on web it lives at `/about`; the first screen a signed-out visitor meets at `/` is the entry screen, which links to the demo and to `/about` →=ACCT-30
  - native has no marketing route →=MKT
- ACCT-5 [o] two ways in, the closed `AuthProvider` set `GOOGLE | PASSWORD`, and one user may have both linked
  - the set is written three times and never widened: Go constants, the `auth_providers` CHECK, the proto enum `AuthProviderKind` (`AUTH_PROVIDER_KIND_UNSPECIFIED = 0`)
  - current membership is what the Supabase directory reports; `auth_providers.linked_at` is when the product first observed a linkage
  - directory unavailable ⇒ `ListAuthProviders` falls back to the stored rows
  - signup records the provider the directory reports for the subject, never a client claim →=ACCT-19; nothing records a later linkage, so a provider linked afterwards lists with an empty `linked_at`
  - linkage is append-only: no link, unlink or merge RPC, message, query or UI; a Google sign-in matching an existing email is settled by Supabase's identity-linking setting
  - password strength is the Supabase project setting: the client holds no password rule, and there is no in-app password reset or email OTP
  - which methods each app's entry offers →=ACCT-30
- ACCT-6 [o] signup asks for exactly one thing, the nickname, which stays editable in `/me` ← the product's core objection is effort, and a registration form adds it before the first diary
  - accepted: trimmed, length in Unicode code points within `account.nickname_min_length`..`account.nickname_max_length`, no control character, no Unicode line or paragraph separator
  - refused ⇒ `ACCOUNT_NICKNAME_INVALID` (InvalidArgument)
  - not unique, since no surface shows one user's nickname to another: no availability check, no lookup RPC, no unique index
  - the TS predicate (`packages/auth/src/nickname.ts`) is advisory and the server is authoritative; both run the case table `packages/auth/fixtures/nickname-validation.json`
  - the time zone and the locale are never questions →=ACCT-7/15
- ACCT-7 [o] the profile time zone `users.timezone` (an IANA name) is detected at signup, never asked, changeable in `/me`, and alone decides the user's "today" ← every real-clock day boundary must agree, and asking adds signup friction
  - "today" = the calendar day in that zone; it is the only real-clock day input: the `SMALL` reset →=TWINK-2, the launch future-date bound →=TIME-13, `SyncStatus.today` and the recall sync target →=TIME-12, the post-sync date a recall cost quote prices
  - published as `account.Service.ZoneFor` (the name only; `ZonesFor` is the batch form for the admin list); each consumer declares its own port (`memory.UserZone`, twinkle's zone port) and resolves the name at the composition root
  - no profile row, an empty name, or a name that no longer resolves ⇒ `UTC` on read; the stored value is not rewritten
  - the port does not fail closed: memory's `UTCUserZone` default loses no data and serves minimal and test roots, while production binds the account-backed reader
  - writers refuse a name `time.LoadLocation` cannot resolve, and `Local`: `ACCOUNT_TIMEZONE_INVALID` (InvalidArgument), never silently defaulted
  - detection: `resolveDeviceTimeZone()` (`packages/i18n`, `Intl`) on both apps; no zone reported ⇒ the client sends `UTC`, never an empty string
  - universe dates stay zone-free: the monotonic launch rule, elapsed days, forgetting and semanticization compare stored dates with no zone →=TIME-7
  - a zone change writes only `users`: no grant window, balance, ledger entry or clock moves, so switching zones mints no second `SMALL` grant →~TWINK-2
  - the diary default date is a client default taken from the device's local calendar day, not the profile zone →=WRITE-5; the server's future-date bound is the enforcement
  - both Go binaries embed `time/tzdata`: the distroless static image has no zoneinfo, and without it every zone reads as `UTC` (guard `cmd/api/timezone_test.go`)
- ACCT-8 [o] an invite binds through a link, never a typed code: signing up after arriving through an invite link binds it automatically (`AcceptInvite`), and rewards follow →=TWINK-3/6
  - the only field on the account surface that takes a token is `SignUpRequest.invite_token`, filled by link capture; no code-entry field exists in either app and there is no `AcceptInvite` RPC
  - the token →!ACCT-17, binding →=ACCT-18, capture →=ACCT-34, the reward condition →=ACCT-20
- ACCT-9 [o] `/me` is the one signed-in account home with exactly five tabs in this order, and account is not one of them ← identity, ways in, sign-out and withdrawal are facts about the person the profile is about
  | tab id | holds | owner |
  | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
  | `profile` | nickname, language, time zone, the invite link, the onboarding replay; at the foot, behind a separating rule: identity, linked providers, sign-out, withdrawal | ACCT; replay row →=ONB-5 |
  | `mood-colors` | the per-mood colour editor for the 13 moods | →=MOOD |
  | `stardust` | both balances and the chronological ledger | →=TWINK-7 |
  | `achievements` | the achievement list and its claims | →=ACH-4 |
  | `diary` | Export as CSV or Markdown | →=ACCT-41 |
  - the account rows sit last, behind the rule, so a stray press does not reach sign-out or withdrawal
  - feeling colours earn a tab of their own: emotion vocabulary, not decoration, free →=DECOR-10; they reach no meaning field →!INV-11
  - no decoration here: no background, shader, camera, effect, ornament or staging control →=DECOR-5
  - no purchase, charge or payment affordance anywhere on `/me`
  - `/me` is time-inert: no clock control and no RPC that advances universe time →~TIME-3
- ACCT-10 [o] a user may withdraw from `/me`; withdrawal reuses the 30-day soft-delete promise at account scope: restorable inside the window, hard-deleted after it →~DEL-2
  - window: `account.withdrawal_retention_days` of real-clock UTC time, independent of `release.soft_delete_retention_days`; the use-cases, the sweep and the admission metadata share one Go duration derived from it
  - the confirmation must offer Export (CSV or Markdown) in place before withdrawing →=WRITE-6; the export itself →=DIARY-14
  - during the window every product procedure refuses the owner, except restore →=ACCT-23
  - at the deadline the sweep hard-deletes every per-user product row, the clock row `universe_state` included, then the credential →=ACCT-27
  - no client can shorten the window: no `PurgeAccount` RPC and no immediate-delete field on `WithdrawRequest` →!INV-1
  - operators get no withdraw, restore or purge action →~ADMIN
  - withdraw →=ACCT-22, restore →=ACCT-24, the client entry to restore →~ACCT-25
- ACCT-11 [o] a new account receives a one-time signup bonus of `twinkle.earn_signup_bonus` `GENERAL` Twinkle; it is not a login bonus, and no login bonus exists →~TWINK-3
  - signup pays nothing: the bonus settles after the account's first non-past-dated launch →=ACCT-21
  - at most once per account: dedup key `signup_bonus:<userID>`, ledger reason `signup_bonus` →=TWINK
  - paid whether or not an invite qualifies, so onboarding is never empty
  - withdrawing cannot re-arm it: a withdrawn scope cannot call `SignUp` →=ACCT-23, and a swept subject never recurs →~ACCT-26
- ACCT-12 [o] Supabase Auth owns credentials, email, email verification and provider membership; the product `users` row owns only nickname, time zone, locale, `created_at` and the withdrawal marker `deleted_at` ← a copied email goes stale at the user's next change
  - no email column: profile responses join the current directory email at read time
  - a directory failure while reading the email fails `GetProfile` and `UpdateProfile`; the profile gate then shows its refused arm →~ACCT-32
  - the GoTrue Admin adapter lives in `internal/platform/supabase`, returns platform-owned DTOs and imports no product context; `account` and `admin` each bind it through their own port at `cmd/api` →=ADMIN
  - account's view is narrow: `Directory` (email, email-verified-at, identities) and `CredentialDirectory` (ban, delete), the only identity mutation it consumes
  - the keyless `supabase.Fake` serves development and tests; production refuses to compose with it →=ACCT-26
- ACCT-13 [o] authenticated but unprovisioned is a legal state: with no `users` row there is no profile, and only `SignUp` creates one
  - `GetProfileResponse.profile` unset = not provisioned; never a synthesized nickname and never an error reason
  - no read writes a row (no lazy provisioning); a Supabase account that predates its profile walks the nickname step at its next sign-in, so nothing is backfilled
  - every account RPC except `GetProfile` and `SignUp` needs a live profile, otherwise `ACCOUNT_SIGNUP_REQUIRED` (FailedPrecondition)
- ACCT-14 [o] `UpdateProfile` replaces the whole editable surface `{nickname, timezone, locale}` at once and is its only writer →!INV-11
  - no partial mask, so "clear the time zone" is not expressible
  - validation as at signup →!ACCT-6/7, except that an unknown locale is refused: `ACCOUNT_LOCALE_INVALID` (InvalidArgument) →=ACCT-15
  - a withdrawn row cannot be updated (`deleted_at IS NULL` in the write)
  - the request has no field for a mood, coordinate, strength or memory id
- ACCT-15 [o] `users.locale` holds a shipped locale (`en` or `ko`): signup coerces an unknown or empty negotiated tag to `en`, while `UpdateProfile` refuses one ← a negotiated guess is a preference, but an explicit choice must not be silently rewritten
  - effective locale: the signed-in server value, then the stored local choice (web only), then the device or browser, then `en` →=CLIENT
  - the shipped set is pinned by the byte-identical pair `packages/i18n/fixtures/locales.json` and `apps/api/internal/account/testdata/locales.json`, asserted from TS and Go
  - the `/me` language row is the only locale write →=ACCT-37
- ACCT-16 [o] the account tables are product-owned, scoped by `user_id`, and have no foreign key to `users`
  | table | key | invariants |
  | ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `users` | `user_id` | no email column; `deleted_at` written only by withdrawal and restore |
  | `auth_providers` | `(user_id, provider)` | `provider IN ('GOOGLE','PASSWORD')` |
  | `invites` | `id`; `user_id` is the inviter | `token` unique; `invitee_user_id` unique; `invitee_user_id <> user_id`; `invitee_user_id` and `bound_at` NOT NULL; `rewarded_at` null or ≥ `bound_at`; no `deleted_at` |
  - an `invites` row exists only once an invitee bound it: an unbound invite is unrepresentable
  - a withdrawn inviter's rows are hidden by joining `users.deleted_at`, never by a copied flag, so restore is exact and `rewarded_at` survives
  - per-mood colour rows (`mood_colors`, the anonymous `mood_color_counts`) live in this context, but their rules →=MOOD
  - `account/pg` is the only row-to-domain seam; queries live in `db/queries/account/`
- ACCT-17 [o] an invite token is a stateless HMAC-SHA256 capability over the inviter id, an issued-at and a fresh 32-byte nonce, valid for `account.invite_link_ttl_days` from its signed issued-at ← verification then needs no cross-user lookup
  - shape: `base64url(inviter).base64url(issued_at_unix).base64url(nonce).base64url(mac)`
  - `GetInviteLink` (NO_SIDE_EFFECTS) requires the caller's profile, then derives a fresh token; it never touches `invites` and returns `{token, expires_at}`
  - verification compares the MAC in constant time before trusting any payload field, then checks the TTL; malformed, tampered or expired ⇒ refused
  - no query selects `invites` by token: the inviter id comes only from the verified payload
  - key: env `INVITE_TOKEN_SIGNING_KEY`, standard base64 decoding to ≥32 bytes; a secret, never a values key
  - fail closed: an absent, short or zero-value key issues nothing (`ACCOUNT_INVITE_LINK_UNAVAILABLE`, FailedPrecondition); production refuses to boot without the key, so an unsigned token cannot exist
- ACCT-18 [o] binding is best-effort and happens only inside the first signup: a refused token binds nothing and never fails the signup →!ACCT-17
  - binds only when this `SignUp` created the profile and carried a token; a retry or a later call binds nothing
  - one `invites` insert from the verified payload: `user_id` = the inviter, `created_at` = the issued-at, `bound_at` = now
  - inert (`invite_bound = false`): invalid, expired, self, a consumed token, an invitee already bound, an inviter withdrawn or unprovisioned
  - one link binds one friend, so each rewardable invite costs the inviter a deliberate act: sharing a link with three people binds only the first
  - an unavailable signer or a persistence fault is an operational error, not an invalid invite: it surfaces and rolls back the profile birth so a retry can bind
  - `invite_bound` is an acknowledgment only; no message tells a link holder whose link it is
- ACCT-19 [o] `SignUp` is the only provisioning mutation: it takes the nickname, the detected time zone, the negotiated locale and an optional link token, and nothing else →!ACCT-6
  - no provider claim, amount or balance field; `SignUp` holds no economy port, so no signup path can pay →!ACCT-11
  - once-born and idempotent: `CreateUserIfAbsent` (insert, on conflict do nothing) and the optional bind run in one account transaction; a retried or concurrent call returns the existing profile and overwrites nothing
  - the initial `auth_providers` row is written in the same statement, only by the winning insert; a directory failure leaves it unwritten and signup still succeeds
  - a withdrawn scope cannot reach `SignUp` →=ACCT-23
  - the response carries nickname, time zone, locale and `invite_bound`
- ACCT-20 [o] a valid signup, the condition for paying both invite legs, is judged at settlement and needs all four conditions, checked in this order →~TWINK-6 ← each fake account must cost an LLM encode round trip
  | # | condition | when it fails |
  | --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
  | 1 | a bound, unrewarded invite whose inviter is distinct and live | permanent; one indexed read |
  | 2 | the invitee launched an `EpisodicMemory` | cannot fail: the only caller is the launch hook |
  | 3 | the inviter's rewarded invites are fewer than `twinkle.invite_reward_max_per_inviter` (lifetime) | permanent |
  | 4 | the invitee's email is verified; a `GOOGLE` linkage counts as verified | transient: judged again at the next launch |
  - a launched memory, not a saved diary, is the activity: a past-dated diary exists with no memory →~TIME-1
  - failing any condition pays neither leg; the invitee still gets the signup bonus →=ACCT-11
  - past the cap, links still bind but no longer pay
  - `ResolveInviteSettlement` refuses any caller without the account-private settlement context marker, so no wire method can settle
- ACCT-21 [o] settlement runs only from the launch path: after a launch commits and was not past-dated, `memory.SignupSettlementPort.OnEngramsLaunched(scope)` calls `account.Service.SettleSignup` →!ACCT-20
  - the port carries the scope only and returns nothing: settlement cannot read the launched meaning or fail a committed launch; errors are logged at the composition root
  - production refuses to build without the port, the account-backed `twinkle.InviteResolver` and both granters; the worker binds granters and an achievement recorder that refuse, so a stray worker settlement fails loudly
  - an idempotent pairing, not a shared transaction: probe the invite, then under the per-inviter session advisory lock credit both legs →=TWINK, report `invite_settled` for the inviter →=ACH-20, and only then stamp `invites.rewarded_at`; the signup bonus follows independently
  - the counter report precedes the stamp: a failed report leaves the invite settleable, and the next settlement heals it with dedup-keyed credits
  - credits before the stamp: a crash replays dedup-keyed no-ops and never loses or doubles a reward
  - dedup keys `invite:<inviteID>` (inviter), `invite_signup:<inviteID>` (invitee), `signup_bonus:<userID>`; twinkle enforces the cap again inside its ledger transaction
  - the bonus is attempted after every admitted launch; its dedup key makes the steady state a no-op
  - no settled reward is ever reversed, by withdrawal or anything else →!INV-1
- ACCT-22 [o] `Withdraw` stamps `users.deleted_at` with real-clock UTC and schedules one deduplicated `withdrawal_sweep` job due at the deadline; `deleted_at` is the only withdrawal fact and the source of the deadline →!ACCT-10
  - order: prove the profile exists (none ⇒ `ACCOUNT_SIGNUP_REQUIRED` and nothing scheduled), schedule, then mark: an idempotent pairing, not a shared transaction
  - a job left by a failed mark is inert, because every sweep re-reads the marker
  - a retry returns the original `withdrawn_at` and `restore_deadline_at` (RFC3339 UTC); the window never moves
  - no withdrawal ledger, group table or per-effect rows; the user's pending enrichment jobs keep running, so restore returns the account intact
  - account owns the job: `account.WithdrawalSweepJobIdentity(scope)` alone builds the `withdrawal:<userID>` identity, and the scheduling spec has no payload or target field (the target is the user) →=ARCH-9
- ACCT-23 [o] a withdrawn scope may call only `RestoreAccount`: the platform admission gate refuses every other procedure, `SignUp` included, before any context handler runs →!ACCT-1
  - refusal `PLATFORM_ACCOUNT_WITHDRAWN` (PermissionDenied, never Unauthenticated, which would drive session refresh) with metadata `withdrawn_at` and `restore_deadline_at`
  - `platform.WithdrawnScopeInterceptor` runs directly after authentication, consumes only `AccountStatusReader`, and exempts exactly `AccountServiceRestoreAccountProcedure`
  - an absent `users` row is unprovisioned, not withdrawn; a reader error or a missing reader refuses the request (fail closed)
  - no status RPC: the withdrawn state reaches a client only as this refusal
  - the status is cached per user for `account.withdrawal_status_cache_ttl_ms` in an LRU of `account.withdrawal_status_cache_max_entries`, generation-fenced; `Withdraw` replaces the entry and `RestoreAccount` drops it right after its commit
  - the cache is process-local and holds only while one API container serves an environment; a multi-replica API needs a shared, coherently invalidated status source first
- ACCT-24 [o] `RestoreAccount` clears `deleted_at` only before the deadline, then cancels the sweep job, and writes no compensation
  - refusals (FailedPrecondition): not withdrawn ⇒ `ACCOUNT_NOT_WITHDRAWN`; at or past the deadline ⇒ `ACCOUNT_RESTORE_WINDOW_EXPIRED`
  - restore and sweep serialize on the locked `users` row and are disjoint: the sweep refuses before the deadline, restore from the deadline on
  - a failed cancel is safe: the stale job finds a live account and completes as a no-op
  - the account returns whole: ledger and balances untouched, a stale `SMALL` anchor yields a fresh full grant with no carry →=TWINK-2, ornaments and claimed achievements restored, never granted again →~ACH-28
  - a diary release whose own window ends inside the account window is swept by its own job and does not come back →=DEL-2
- ACCT-25 [?] how a withdrawn user reaches `RestoreAccount`: no client calls it, and the profile gate's refused arm offers only retry and sign-out
  - the server side exists: the admission exemption and the `withdrawn_at` / `restore_deadline_at` metadata on `PLATFORM_ACCOUNT_WITHDRAWN`
  - the intended shape, a restore screen on both apps driven by that refusal's metadata, has no client wrapper, screen or reason-specific handling
  - until it exists, a withdrawn user cannot restore by themselves
- ACCT-26 [o] credentials stay usable through the window; the sweep bans and then deletes the Supabase user ← a ban at withdrawal would block the sign-in that restore needs
  - at withdrawal only `deleted_at` changes; a valid session still reads nothing because of the admission gate →=ACCT-23
  - at the sweep the ban comes first, so no new session starts during the purge, and the credential delete comes last; a missing user counts as deleted; un-banning exists only for operator recovery after a failed sweep
  - the delete removes the last copy of the email, frees the address, and keeps the subject and its dedup keys from recurring
  - production API and worker refuse to compose without real Supabase Admin credentials
- ACCT-27 [o] the withdrawal sweep is the account call site of the one user-originated hard delete: owning-context legs, then account rows, then the credential, then `users` →!INV-1
  - trigger: only the scheduled `withdrawal_sweep` job on the shared worker loop, which fires for a user who never returns; no cron and no RPC
  - due-ness is derived again from `deleted_at` under the `users` row lock: no marker ⇒ completes as a no-op; early ⇒ retries at the deadline
  - order: `UserDataPurger` legs memory, twinkle, store, achievement; account dependents (`auth_providers`, `invites` as inviter, `mood_colors`); ban; credential delete; `users`
  - each leg runs its own transaction, deletes only by `user_id` and is replay-safe; `users` goes last as the completion marker
  - memory's leg removes the whole memory footprint, `universe_state` included, keeping only the running sweep job row →=MEM
  - a spent retry budget never fails this job and the claim ceiling never fires for it; only the unregistered-kind stop can end it →=AI-36
  - every root that runs the sweep (`cmd/worker` and the API's dev worker) binds `withdrawal_sweep` and registers all four legs, store and achievement included; a missing leg would leave that context's rows behind a hard-deleted account
  - production refuses to compose without the scheduler, the credential directory and at least one named, unique purge leg
- ACCT-28 [o] the sweep removes only the withdrawn user's own rows
  | rows | during the window | at the sweep |
  | -------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
  | memory aggregate, diaries, `release_*`, `universe_state` | untouched, unreachable | deleted |
  | Twinkle balance and ledger | untouched | deleted |
  | ornament ownerships and selections | untouched, unreachable | deleted →=DECOR |
  | achievement counters and progress, `claimed_at` included | untouched, unreachable | deleted →=ACH-28 |
  | `invites` naming the user as inviter | kept; the link is inert; `rewarded_at` survives | deleted |
  | `invites` naming the user as invitee | another user's row | untouched; `invitee_user_id` dangles |
  | the counterpart's ledger rows from a settled invite | untouched | untouched: no reward is reversed |
  | `mood_colors` | unreachable | deleted |
  | `mood_color_counts`, `admin_*` | untouched | untouched: no account key; operator records outlive accounts |
- ACCT-29 [o] two guards keep the sweep complete and the only hard delete →!INV-1
  - `pnpm lint:persistence`: a `DELETE` on a `user_id`-bearing product table must appear by exact name in the hard-delete allowlist
  - a DB integration test derives every `user_id` table from the migrations, cross-checks the live schema, seeds each, sweeps, and lets only the in-flight job row survive; a new per-user table fails until its leg is registered
- ACCT-30 [o] on web the entry screen is the origin root: `/`, `/login` and `/signup` render one screen in sign-in or sign-up mode
  - the screen: the empty sky, the large brand mark, the mode's one sentence (`login_title`, `signup_title`) as the screen's `h1`, not the panel's heading, and the credential form in a glass card beneath it; one lockup, read like the hero
  - one screen with nothing below the fold; a short viewport grows and scrolls instead of clipping the submit
  - the sky is the shared `widgets/empty-sky`, never a second copy, and the page imports neither `pages/landing` nor a router: every destination (mode switch, demo, `/about`) arrives as a callback from `app/routes` →=MKT
  - two side doors under the panel, the quietest shape (small text outside the card) separated by colour, not weight, so neither competes with Google: the demo (`primary`) before `/about` (`secondary`) →=MKT-3
  - on web Google is the only way in while `CREDENTIAL_ENTRY_ENABLED` (`pages/login`) is off: the email and password fields and the submit stay visible but disabled, `login_google_only` states why directly under the Google button, before the fields, and turning the flag on restores the wired form
  - mobile offers Google and password and has no marketing route: a plain centred card; this is the one flagged parity divergence
  - mobile's login stack holds `Login` and `SignUp`, and neither screen is a deep-link target
  - sign-in and sign-up link to each other on both apps
  - which screen a session status gets at `/` →=AUTH; `/login` exists to carry the `from` return target, and a target of `/`, `/login`, `/signup` or `/invite/…` resolves to `/universe`
  - an authenticated session at `/signup` goes on to `/universe`, where the profile gate takes over →=ACCT-32
  - the entry screen and the landing stand on the same night sky, whichever a visitor meets first →~MKT
- ACCT-31 [o] a password sign-up ends in `signedIn` or `confirmationRequired`; confirmation required settles the session signed out and shows a confirmation-sent state, never a failure →=AUTH
  - `AuthFacade.signUpWithPassword` adds no session status and no gate decision
  - the credential step's control state is `signupCredentialMachine`: `form → creating → confirmationSent | failed`
  - Google has no separate sign-up: `signInWithGoogle` creates the Supabase user through the fixed, allowlisted redirect
- ACCT-32 [o] an app-layer profile gate reads `GetProfile` before any product route, palette read or universe read mounts, and resolves to exactly one arm →!ACCT-13
  | read | renders |
  | ------------------------------- | -------------------------------------- |
  | pending | a hold |
  | profile absent | the nickname step |
  | present, signup handoff waiting | the first colour screen →=ACCT-33 |
  | present | the routed children |
  | refused | a neutral line with retry and sign-out |
  - web `app/providers/profile-gate.tsx` sits above `PaletteBootstrap`, mobile's twin above `MobilePaletteBootstrap`; the arms are the same on both apps
  - absence is the unset field; the gate never interprets an error reason or text
  - mounted only for authenticated or refreshing sessions, it reads unconditionally, so no disabled-query branch can hold forever
  - the nickname step is a component, not a route: it cannot be linked or skipped, and every entry path converges on it with no wizard state (password sign-up, first Google sign-in, a late confirmation link, a force-quit)
  - it submits `SignUp` with the trimmed nickname, the detected time zone, the negotiated locale and any held invite token, through `asyncCommandMachine`
  - an abandoned signup deletes nothing: the credential has no profile until the next sign-in
- ACCT-33 [o] after the first successful nickname write both apps show one colour screen before the universe; what it offers →=MOOD
  - exposure rides the in-memory, take-once signup-completion handoff (`packages/auth/src/signup-completion.ts`), never the absence of colour rows; nothing records it as seen or skipped
  - continuing with the recommendations for the rest is always reachable, enters the universe at once, and stores nothing for untouched moods
  - the gate consumes the handoff while the screen shows and re-arms it on release, so the onboarding tour still gets its trigger →=ONB-3
  - the handoff belongs to the new user and is in the user-state reset registry →=CLIENT
- ACCT-34 [o] invite capture: the token leaves the address bar at once, survives the OAuth round trip, and can attach only to a brand-new account →!ACCT-8
  - one helper defines the link path, `inviteLinkPath(token)` (`packages/auth`), for capture and for sharing
  - web `/invite/$token` stores the token in the pending-invite holder and replaces itself with `/signup`; mobile captures `cosimosi://invite/<token>` on the inbound-link seam, the token being the whole remainder of the path, and keeps it out of navigation linking
  - holder storage: `sessionStorage` on web, process memory on mobile
  - the holder stays outside the user-state reset registry because it must survive the sign-in; it clears when `SignUp` consumes it or the gate finds an established profile
  - the sign-up surface acknowledges an invite in one line (`invite_acknowledgment`) naming no inviter and no amount; no RPC resolves a token before signup
  - no invite-failure branch exists: a stale link never blocks profile creation
  - an `https` invite link opens the web surface on a phone; universal and App Links are not configured
- ACCT-35 [o] public entry copy is quiet and factual: no therapeutic claim, brain analogy, decorative emoji or reward promise →=INV-12
  - keys `login_*`, `signup_*` and `invite_*` name a UI role and exist in both catalogues
- ACCT-36 [o] `/me` addressing: web `/me` under the authenticated subtree keeps the open tab in the `tab` search param; mobile `Me` keeps it in screen state, seeded by an optional validated `tab` param
  - reached from an affordance on the universe page; the way back returns there
  - a missing or unknown value, `account` included, shows `profile`; a tab change replaces the current history entry
  - the header: the way back on the left as a bare arrow and label, and a centred title naming the open tab, the same header as the diary reader →=UI
  - a tab is a location, so no state machine selects it
  - `pages/me` owns only the tab ids and the composition table, and imports no router, `three` or visual entity; web keeps the ids in `pages/me/model/tabs.ts` and mobile inlines them, since a byte-identical pure module in both apps fails `lint:fsd:layout` R4
  - tabs use the controlled `Tabs` primitive pair in `packages/ui`, which is not a toggle group →=UI
  - web and mobile carry all five tabs, with no waiver
- ACCT-37 [o] profile facts are edited one at a time: nickname, language and time zone are separate rows, each saving with one complete `UpdateProfile` →!ACCT-14
  - nickname: guided by the generated length bounds; the server's refusal is authoritative
  - language: two options labelled by autonym; a choice applies at once, then persists, and a failed write restores the previous locale and shows the error; web also stores it in `localStorage["cosimosi.locale"]`, mobile stores nothing locally
  - on an authenticated boot the non-blocking `LocaleBootstrap` applies the server locale beside the palette bootstrap →=CLIENT
  - time zone: one action, "match this device" (`resolveDeviceTimeZone()`); no free-text field and no zone list; read-only when the device reports no zone or it already matches
  - the time-zone row states that changing it does not refill today's small stardust (`me_timezone_notice`)
  - a successful update invalidates the `GetProfile` query; nothing polls
- ACCT-38 [o] the profile tab carries the inviter's share surface: the composed link, its expiry, one line naming the inviter's reward, and copy on web or the share sheet on mobile →!ACCT-17
  - the amount is read from `twinkle.earn_invite_inviter`, never computed
  - no invitee list, invite count or reward status: the response carries none
  - no link available ⇒ the quiet `invite_unavailable` line
- ACCT-39 [o] the account rows at the foot of the profile show the identity (the email, else the subject) and the linked providers read-only, with a one-press sign-out ← signing out destroys nothing, and the login screen is the way back in
  - no provider link or unlink, no email or password change, no billing
  - sign-out deletes nothing and asks no confirmation; withdrawal keeps its own →=ACCT-40
  - `/me` offers no restore control, no hard delete and no client-supplied user scope
- ACCT-40 [o] withdrawal takes two presses: a start press opens a confirmation that states the retention period, offers Export in place, and then withdraws →!ACCT-10
  - the period is interpolated from `account.withdrawal_retention_days`, never a literal (`withdraw_description`)
  - the offer (`withdraw_export_offer`) asks whether to export the diaries now as CSV or Markdown, with the Export control beside it →=ACCT-41
  - on confirm: `Withdraw`, then `commitWithdrawalAndEndSession` (`@cosimosi/auth`) ends the session; only a failed `Withdraw` is a failed mutation, and a failed remote sign-out falls back to local teardown
  - after a withdrawal every request is refused, so no withdrawn session stays on screen
- ACCT-41 [o] the diary-management tab and the withdrawal confirmation share one Export feature: CSV or Markdown through the account-scoped `Export` RPC →=DIARY-14
  - the tab shows the reassurance line, the format choice and one action (`me_export_*`) →~WRITE-6
  - an imperative call through a mutation, never a cached query, so no diary text stays in the query cache
  - web downloads the bytes under the server's filename; mobile decodes once and hands the text to the native share sheet; no new native dependency
- ACCT-42 [o] BE placement: one flat Go package `internal/account`, files split by aggregate, with `account/pg` for rows and `account/rpc` for thin handlers →=ARCH
  - domain files import no proto, sqlc, pgx or other context; `account` imports neither `memory` nor `twinkle`, and neither imports `account`
  - every cross-context edge is a consumer-owned port bound at `cmd/api` and `cmd/worker`: the zone, settlement (port, granters, `twinkle.InviteResolver`), withdrawal (`UserDataPurger`, `WithdrawalSweepScheduler`, `CredentialDirectory`, `platform.AccountStatusReader`) and achievement counters
  - FE shared pieces live in `packages/auth` (nickname rule, pending invite, signup handoff, credential machine, withdrawal teardown) and `packages/api-client/src/account.ts`
  - the app slices `features/{sign-up,account-profile,account-settings,invite-link,withdraw-account,export-diaries}` hold only `ui` (and the export sink) →=ARCH
- ACCT-43 [o] `cosimosi.account.v1.AccountService` is the whole account wire surface, and no request names a user
  | RPC | kind | rule |
  | ---------------------------------------------------- | --------------- | --------- |
  | `SignUp` | mutation | →=ACCT-19 |
  | `GetProfile` | read | →=ACCT-13 |
  | `UpdateProfile` | mutation | →=ACCT-14 |
  | `ListAuthProviders` | read | →=ACCT-5 |
  | `GetInviteLink` | read | →=ACCT-17 |
  | `Withdraw` | mutation | →=ACCT-22 |
  | `RestoreAccount` | mutation | →=ACCT-24 |
  | `GetMoodColors`, `SetMoodColor`, `GetMoodColorStats` | per-mood colour | →=MOOD |
  - each read is NO_SIDE_EFFECTS with exactly one `userScopedUnaryReadPolicy` entry in `packages/client-cache/src/http-policy.ts`; mutations are plain POSTs with none
  - absent on purpose: `AcceptInvite`, any unlink, `PurgeAccount`, a withdrawal-status read, a withdrawal reason or exit-survey field, and any profile field for a mood, coordinate, strength or memory id
- ACCT-44 [o] account refusal reasons, mirrored in `packages/errors/src/core.ts` →=ERR
  | reason | code | when |
  | -------------------------------------------------------------------------------- | ------------------ | -------------------------------------------- |
  | `PLATFORM_ACCOUNT_WITHDRAWN` | PermissionDenied | a withdrawn scope calls anything but restore |
  | `ACCOUNT_SIGNUP_REQUIRED` | FailedPrecondition | no profile yet |
  | `ACCOUNT_NICKNAME_INVALID`, `ACCOUNT_TIMEZONE_INVALID`, `ACCOUNT_LOCALE_INVALID` | InvalidArgument | a profile field is refused |
  | `ACCOUNT_INVITE_LINK_UNAVAILABLE` | FailedPrecondition | no signing key |
  | `ACCOUNT_NOT_WITHDRAWN`, `ACCOUNT_RESTORE_WINDOW_EXPIRED` | FailedPrecondition | restore outside its window |
  | `ACCOUNT_SCOPE_REQUIRED` | Unauthenticated | no scope reached the use-case |
  - settlement errors never reach the wire: settlement has no RPC
  - `ACCOUNT_NOT_PROVISIONED` is registered on both sides but no use-case raises it
  - `ACCOUNT_MOOD_COLOR_INVALID` →=MOOD

## flow
- signup: entry screen(Google | password: signedIn | confirmationRequired → later confirmation link) → session → profile gate(absent: nickname step → `SignUp`(held token: bound | inert) → colour screen → universe | present: universe | refused: retry or sign-out)
- invite reward: the invitee's first non-past-dated launch → `SettleSignup` → valid signup(no: neither leg | yes: both legs → `rewarded_at`) → signup bonus(once)
- withdrawal: `/me` profile foot → confirmation(Export offer) → `Withdraw`(schedule → mark) → session ends → admission gate(only `RestoreAccount`) → before the deadline: restore(clear → cancel) | at the deadline: sweep(legs → account rows → ban → credential delete → `users`)

## constraints
- every account surface (entry, signup, profile gate, `/me`) exists on web and mobile; the web Google-only entry is the one flagged divergence →=ARCH
- TS and Go agree through shared fixtures, not a golden-parity harness: the nickname case table and the byte-identical locale set; no zone-to-date conversion is mirrored, since it is a tzdata lookup and the client's date is only a default
- account numbers live in the `account` values group (nickname bounds, invite TTL, withdrawal window, status cache); a new account scalar joins that group, never a new one →=ARCH
- reward numbers are Twinkle keys read here: `twinkle.earn_signup_bonus`, `twinkle.invite_reward_max_per_inviter`, `twinkle.earn_invite_inviter`, `twinkle.earn_invite_invitee` →=TWINK

## chg

- r2 261102 ACCT-22✎ memory-owned withdrawal scheduling→account-owned identity and handler over the infrastructure queue; persisted kind, dedup key and target unchanged
- r1 261102 initial
