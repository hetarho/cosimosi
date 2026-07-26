# tech: auth and client session scope

> As-built frontend session-lifetime and client-state isolation rules. Plan
> [04](../plan/04.auth-session.md) owns authentication; plan
> [53](../plan/53.auth-universe-gate.md) owns route destinations.

## Session scope boundary

`@cosimosi/auth/react` derives the stable client scope key from the session user id (`anonymous`
when absent). Each app mounts `SessionScopeBoundary` inside its auth/cache provider stack. When
that key changes, the boundary withholds routed children, synchronously clears the injected or
owned QueryClient and all registered user-owned client singletons, and only then commits the new
scope. Store resets run from an effect, never during render. An owned QueryClient is still cleared
on provider unmount; an injected QueryClient participates in scope changes but remains caller-owned.

This is the presentation-side complement to server/RPC user scoping. It does not delete persisted
memories or records. It prevents an already-loaded A snapshot, draft, target, balance, release group,
or action from appearing or firing under B's credentials.

## Supabase and product-account split

Supabase Auth remains authoritative for credentials, email, email verification, and current provider membership.
The promoted `internal/platform/supabase` GoTrue Admin adapter exposes those directory facts as platform-owned DTOs;
it imports no product context.

The product-owned `users` row adds only nickname, IANA timezone, shipped locale, creation time, and the withdrawal
marker. It deliberately has no email column. `auth_providers` records the first product-observed linkage timestamp,
while directory identities remain membership truth. `platform.UserIdentity` and the authenticated
`platform.UserScope` still carry only the Supabase subject, so callers cannot inject profile or directory fields
through the auth boundary.

## Signup credential and profile gate

`AuthAdapter.signUpWithPassword` returns an authenticated session or `null` when Supabase created
the credential but requires email confirmation. `AuthFacade.signUpWithPassword` exposes those as
the explicit outcomes `'signedIn'` and `'confirmationRequired'`. A session uses the existing
authenticated transition; confirmation-required settles through the existing `SIGN_OUT`
transition. The session status set and `gateDecision` arms are unchanged. The local
`signupCredentialMachine` alone owns `form → creating → confirmationSent | failed`.

Both apps place `GetProfile` gates above their palette bootstrap. A present profile releases routed
children; an unset profile field renders the nickname step; a rejected read renders neutral retry
and sign-out controls. The gate never interprets transport error text. Because the routed subtree
is withheld, a profile-less session cannot mount palette or product reads.

The nickname command reuses `asyncCommandMachine` and calls `SignUp` with the trimmed nickname,
runtime IANA timezone (`UTC` fallback), negotiated locale, and any held invite token. Profile data
remains Query data; the machines contain control metadata only.

## Reset registry

Every stateful domain package owns one public reset seam for its user-scoped singletons. The app aggregator calls those
seams; it does not enumerate package internals.

`@cosimosi/universe` owns `resetUniverseUserState()` and includes every universe-owned Zustand read mirror, draft, or
cross-route action channel:

- episodic memories, neurons, synapses, universe clock, and diaries;
- same-session released groups, recall/open-diary/pending-fly/deletion targets;
- advance and launched-neuron hand-offs, diary/split/recall/deletion drafts, and time-sync consent;
- latent consumed marks and the awaken registry. Reset settles outstanding time-sync consent as `cancel`.

`@cosimosi/twinkle` owns `resetTwinkleUserState()` for the two-tier balance mirror and charge-request channel.
`@cosimosi/emotion/react` owns the palette display/confirmed mirror plus its persistence epoch reset.

Each app's `app/model/reset-user-state.ts` is therefore a parity-checked composition of the universe, Twinkle,
palette, and signup-completion reset APIs. It owns no second store inventory.

`@cosimosi/auth` owns two deliberately different signup-lifetime seams:

- the one-shot signup-completion signal belongs to the authenticated user and is registered in
  both reset inventories;
- the pending-invite holder is deliberately absent from those inventories because it must survive
  the anonymous-to-user transition and a Google OAuth round trip. Web injects `sessionStorage`;
  mobile injects process memory. The holder clears only when `SignUp` consumes it or the profile
  gate resolves an established profile.

Adding a module-global user-owned store or deferred action channel requires adding its empty/default
reset to the owning aggregate and extending the inventory/reset regression. Component-local state
needs no registry entry because the scope boundary unmounts it.

## Palette operation scope

Palette writes capture the initiating scope and operation epoch. A queued operation checks that
epoch immediately before dispatch; an epoch change prevents it from using the next user's live
transport credentials. A settling old response is ignored after the epoch changes. Serialization
and the optimistic-intent counter are local to one epoch.

The palette store separates the optimistic display id from the last canonical server-confirmed id.
Failures roll back to confirmed truth, and unknown ids canonicalize to the default id and default
palette together. Authenticated product children remain behind a neutral palette bootstrap gate
until the preference or deterministic default is applied. Login and boot surfaces are outside that
palette-dependent gate.
