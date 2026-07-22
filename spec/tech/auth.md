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

## Reset registry

`@cosimosi/universe` owns `resetUniverseUserState()`. It is the only public package reset seam and
must include every package-owned Zustand read mirror or cross-route action channel:

- episodic memories, neurons, synapses, universe clock, and diaries;
- Twinkle balance and same-session released groups;
- recall, open-diary, pending-fly, charge, and deletion targets;
- latent consumed marks and the awaken registry.

Each app owns an `app/model/reset-user-state.ts` aggregator for the still-duplicated platform
stores. The web and mobile inventories must stay equal until their promotion to a shared package:

- advance announcement and launched-neuron hand-offs;
- diary, split proposal, recall, and deletion drafts;
- the time-sync consent channel; a reset settles an outstanding promise as `cancel`;
- palette display/confirmed mirrors and the palette persistence epoch.

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
