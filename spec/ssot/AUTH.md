# AUTH authentication
> r1 | who the caller is: the client auth session, bearer-token verification, the per-request user identity and the gate between auth and the universe

## decisions
- AUTH-1 [o] Supabase Auth is the only identity provider: client sessions are Supabase sessions and the API trusts only Supabase-issued access tokens; what the product stores about an account →=ACCT-12
  - the request identity carries the Supabase subject alone →!AUTH-12
- AUTH-2 [o] the adapter contract offers two sign-in methods behind the facade, email+password and Google OAuth; which ones each app's entry offers →=ACCT-30 →~ACCT-5
  - `signUpWithPassword` resolves `signedIn` or `confirmationRequired`; confirmation-required settles the session `signedOut` through the existing transition and adds no status and no gate decision →~ACCT-31
- AUTH-3 [o] the client session lifecycle is one XState machine, `sessionMachine` (`packages/auth`), whose context holds only `status`, `userId`, `expiresAt`, `error` →=ARCH
  - statuses: `bootstrapping`, `signedOut`, `signingIn` (also while an OAuth flow is outside the app), `authenticated`, `refreshing`, `expired`, `failed`
  - `refreshing` keeps `userId`; a refresh failure while a `userId` is held returns to `authenticated` with `error`, never to a signed-out status
  - tokens, Supabase session objects, SDK clients and storage handles never enter the context; the adapter owns them
  - Google, password signup and OAuth cancel add no states or events
- AUTH-4 [o] the auth facade (`createAuthFacade`) is the only auth seam: lower layers see the snapshot, the actions and the token accessor, never a Supabase type or storage primitive
  - each app root owns at most one live facade, provided through `@cosimosi/auth/react`; releasing it never signs the user out, and an injected facade stays caller-owned
- AUTH-5 [o] every auth operation is fenced by an operation epoch: a result settling after a newer operation or a local sign-out never drives the machine ← a late bootstrap, sign-in or refresh would re-authenticate a signed-out user
  - adapter `signedOut`/`expired` events count even during the initial bootstrap, so a resolving bootstrap cannot restore a revoked session
  - an adapter `signedOut` during an in-flight sign-in, or over `failed`, is ignored, so it neither kills the sign-in nor wipes the visible failure
  - `signOut` settles `signedOut` at once and restores the prior snapshot if the adapter sign-out rejects
  - `forceLocalSignOut` ends the in-memory session without the network; later adapter `authenticated` events and refreshes are ignored →~AUTH-23
- AUTH-6 [o] Google OAuth is an external round trip that always ends retryable: abandoned or failed ⇒ `signedOut` or `failed`, never a stuck `signingIn`
  - web: full-page redirect with PKCE (no token in the return URL); `detectSessionInUrl` establishes the session on return
  - mobile: consent in the system browser, return through `cosimosi://auth-callback`; `OAuthCallbackBridge` feeds live and cold-start callback links to `completeOAuthSignIn` for the PKCE exchange; callback links never reach the route table
  - a callback must match the registered address exactly (only a query, fragment or path may follow), so a look-alike host never reaches the code exchange
  - `cancelSignIn` abandons only an attempt that left the app (web bfcache `pageshow`, mobile foreground); a password sign-in is left to resolve; a completion after a cancel drives a fresh sign-in
  - a denial return (`error`/`error_description`, no session) runs through `completeOAuthSignIn` to `failed` and the Google-failure copy; the params are stripped first, so a reload cannot repeat it
- AUTH-7 [o] Google returns to one fixed allowlisted URL per origin, `<origin>/`, never to the requested route ← a per-route return URL would widen the Supabase redirect allowlist
  - every served origin must be on the Supabase redirect allowlist, else Supabase silently falls back to the prod Site URL (DEPLOY.md)
  - a pre-OAuth `from` is never replayed; only the password path honours it →~AUTH-18
- AUTH-8 [o] session tokens persist only through the adapter's storage seam: browser storage on web, the injected `SecureTokenStorage` on mobile
  - the in-repo mobile store is in-memory: a session and a pending PKCE verifier survive backgrounding, not process death, until the app boundary supplies Keychain/Keystore storage
- AUTH-9 [o] the client attaches the bearer per RPC at call time: `createApiAuthInterceptor` sets `Authorization: Bearer <token>` only when `getAccessToken()` returns one
  - the Supabase adapter refreshes first when the token is expired or within `auth_session.access_token_refresh_skew_ms` of expiry
  - null unless the session is `authenticated` or `refreshing` with a `userId` and not locally signed out; an accessor error also yields null, so the call goes anonymous and the server refuses it
- AUTH-10 [o] the API admits a call without a bearer only for an allowlisted public procedure; the list is `PlatformService.Ping` alone
  - otherwise a missing, malformed, invalid, expired or policy-rejected bearer ⇒ `PLATFORM_UNAUTHENTICATED` (Unauthenticated); a JWKS fetch failure ⇒ `PLATFORM_AUTH_VERIFIER_UNAVAILABLE` (Unavailable) →=ERR
  - fail closed: no project URL (`SUPABASE_PROJECT_URL` or `SUPABASE_URL`) ⇒ no verifier, and the API starts refusing every protected RPC; `SUPABASE_JWT_SECRET` alone never enables verification
  - RPC handlers never parse tokens
- AUTH-11 [o] `SupabaseJWTVerifier` checks access tokens locally against the project JWKS, with no per-request call to Supabase
  - required: issuer `<project>/auth/v1`, audience `authenticated`, an expiry, a subject, role `authenticated`; `is_anonymous` tokens refused
  - RS*/ES* only; HS256 only when the server-only `SUPABASE_JWT_SECRET` is set
  - the JWKS is cached for `supabase_auth.jwks_cache_ttl_ms` and concurrent fetches coalesce; an unknown `kid` forces a refetch at most once per `supabase_auth.jwks_miss_refresh_interval_ms`, so rotation works and forged tokens cannot hammer Supabase
- AUTH-12 [o] the request identity is the verified Supabase subject only, stored in the request context and resolved by use-cases as `platform.UserScope` (`UserScopeFromContext`) →=ACCT-1
  - `UserIdentity` and `UserScope` carry the user id and nothing else, so no profile or directory field rides the auth boundary
  - no scope ⇒ the context's `*_SCOPE_REQUIRED` refusal (Unauthenticated) →=ERR
  - repositories take the user id from the scope or the use-case input, never from the wire
- AUTH-13 [o] per-user isolation is enforced in the application, not the database: every product table owns a real `user_id` column and every product statement is scoped by it →=ACCT-1
  - guard `pnpm lint:persistence`: every product relation must connect to an external user-id parameter; SQL outside its grammar fails closed
  - deliberate cross-user statements are allowlisted by name, each with its reason in its SQL comment; admin operator tables are exempt →=ADMIN
  - no Postgres row-level security
- AUTH-14 [o] on every Connect service the auth interceptor runs inside the shared chain (panic recovery, request id, error structuring, logging) and before the withdrawn-account check
  - the withdrawn-account check therefore sees only verified identities; it refuses all but `RestoreAccount` →=ACCT-23
  - a service-specific gate (the admin authorization) is appended after the shared chain →=ADMIN
- AUTH-15 [o] the dev sign-in bypass is local-only and closed in production by construction
  - web: `VITE_DEV_USER_ID` gives an always-authenticated fake session in dev builds; a production build with it set throws at start
  - API: `COSIMOSI_DEV_AUTH` with `COSIMOSI_DEV_USER_ID` accepts exactly `fake-token-<COSIMOSI_DEV_USER_ID>`; the flag without a pinned user stays off
  - without Supabase env the web falls back to `FakeAuthAdapter`, whose tokens never pass a real verifier
- AUTH-16 [o] the app-entry gate is one pure mapping, `gateDecision(status)` (`packages/auth`), used by web and mobile alike →!AUTH-3
  | status | decision |
  |---|---|
  | `authenticated` | `universe` |
  | `bootstrapping`, `refreshing` | `hold` |
  | `signedOut`, `signingIn`, `expired`, `failed` | `login` |
  - `hold` never redirects: a cold entry shows a neutral hold; a mounted product subtree stays mounted through `refreshing`; no signed-out flash
  - `failed` routes to the door, never an error screen; auth observability still fires
  - consumers branch through the exhaustive `requiresSignIn(decision)`, never `=== 'login'` ← a fourth arm must fail to compile, not let a signed-out user into the product
  - no landing arm: the marketing page has its own ungated address →=MKT-15
- AUTH-17 [o] web: every product route mounts under the pathless `authenticated` layout route, whose `beforeLoad` redirects a settled signed-out arrival to `/login` with the requested pathname as `from` →!AUTH-16
  - the layout follows the live snapshot: `bootstrapping` ⇒ neutral hold; `authenticated`/`refreshing` ⇒ the outlet; settling signed-out while mounted ⇒ `/login` with the current pathname
  - product reads mount only under the layout, so none issues without a session →=ACCT-1
  - the guard reads the facade's live `getSessionStatus` from the router context, never Supabase or the machine
  - `from` is the pathname only: an auth round trip returns `/me` to its default tab →~ACCT-36
- AUTH-18 [o] the door: `/` and `/login` render one entry screen, differing only in the guard's `from`; `/signup` renders its signup mode; each shows the form only on a `login` decision →!AUTH-16
  - authenticated ⇒ `loginReturnTarget(from)` (signup: `/universe`); `hold` ⇒ the neutral hold; `signingIn` stays on the form
  - `loginReturnTarget` accepts an internal single-slash pathname only, never `//host`, absolute, `/`, `/login`, `/signup` or `/invite/…`; else `/universe`
  - `/` has no `beforeLoad`, since a guard there would redirect away the visitor it exists for
  - the screen itself, its two modes and its side doors →=ACCT-30
  - `/invite/$token` captures the token into the pending-invite holder and replaces itself with `/signup`, so the token leaves the address bar and history →=ACCT-34
  - failure copy follows the method last attempted in this mount; a failure with no attempt (OAuth return, bootstrap) reads as a Google failure, on both platforms
- AUTH-19 [o] mobile: `NavigationRoot` mounts a stack by the same mapping: `login` ⇒ `Login`, `bootstrapping` ⇒ the `Boot` splash, else the `Universe` stack, kept through `refreshing` →!AUTH-16
  - a decision change swaps the stack, so sign-in and sign-out route with no manual reset
  - no landing on mobile, by waiver: whoever installed the app has already converted →=MKT-26
  - an invite link while signed out opens the stack on `SignUp`; while authenticated the captured token is dropped →=ACCT-34
- AUTH-20 [o] an authenticated session passes the profile gate, then the decoration bootstrap, before any product screen mounts; the door and diagnostics surfaces wait for neither
  - the profile gate's arms (hold, nickname step, first colour screen, children, refused) →=ACCT-32; it mounts only for `authenticated`/`refreshing`
  - decoration bootstrap (`DecorationBootstrap`, mobile `MobileDecorationBootstrap`): mood colours and ornament selection both settle before the product paints; an error settles too, entering on defaults →=MOOD →=DECOR
  - `LocaleBootstrap` and the achievement notice host mount only inside this subtree →=ACH
- AUTH-21 [o] a first-run user (a settled `GetUniverse` with zero memories) lands on the same universe scene, not a separate route: the latent field plus `universe_first_run_welcome` above the diary-writing entry →=ACCT-2
  - emptiness is derived from the read, never a stored flag; the first launch reveals in place →~VIS-7 →~WRITE-1
- AUTH-22 [o] sign-out routes to login on both apps and never deletes persisted data; the next sign-in re-reads that user's universe →~INV-1
  - a change of the scope key (`authScopeKey`: the user id, or `anonymous`) is a hard client-state boundary: the routed subtree is withheld until the user-scope reset completes →=CLIENT
- AUTH-23 [o] a committed withdrawal always ends the local session: `commitWithdrawalAndEndSession` signs out after `Withdraw` succeeds and falls back to `forceLocalSignOut` if the network sign-out fails →=ACCT-40
  - a failed `Withdraw` touches no auth state; a committed one never renders as a failed mutation or leaves a session every RPC refuses
- AUTH-24 [o] placement →=ARCH
  - `packages/auth`: session model and machine, facade, adapters, gate mapping, callback parsing, pending-invite holder, signup-completion flag, withdrawal coordinator; `@cosimosi/auth/react`: React bindings and `SessionScopeBoundary`
  - gate hosts: web `app/routes` (`guards/auth-gate.ts`), mobile `app/navigation/NavigationRoot.tsx` →=CLIENT
  - Go `internal/platform`: `AuthInterceptor`, `SupabaseJWTVerifier`, `UserScope`; context packages consume `UserScope`, never tokens

## flow
- sign-in: door(`login`) → Google(web redirect | system browser → `cosimosi://auth-callback` → PKCE exchange) or password → `authenticated` → `loginReturnTarget(from)` → profile gate(no profile: nickname step) → decoration bootstrap → product
- RPC: `getAccessToken`(refresh within skew) → `Bearer` → `AuthInterceptor`(public: pass | invalid: Unauthenticated | JWKS down: Unavailable | valid: `UserScope`) → withdrawn scope → handler

## constraints
- values keys owned by AUTH: `auth_session.access_token_refresh_skew_ms`, `supabase_auth.jwks_cache_ttl_ms`, `supabase_auth.jwks_miss_refresh_interval_ms`; the gate adds none
- environment, not values: the Supabase project URL and keys, `SUPABASE_JWT_SECRET`, JWT audience and issuer, the token storage choice

## chg
- r1 261102 initial
