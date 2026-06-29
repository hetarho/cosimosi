# tech: state machine foundation

> As-built rules for XState v5 machines on cosimosi's frontend (web + mobile).
> The architectural frame lives in [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1–§3.3;
> this doc is the detailed rulebook the foundation (plan/07) installed.

## 1. Packages and the React seam

| Concern | Location | Depends on |
|---|---|---|
| Catalog machines (`asyncCommandMachine`, `panelMachine`) + types | `packages/state-machine` | `xstate` only — no React, no DOM, no native |
| Auth/session machine (auth-domain lifecycle reference) | `packages/auth` | `xstate`, `@supabase/supabase-js`, `@cosimosi/api-client` |
| React binding hooks (`createActorContext`, `useActorRef`, `useSelector`, `useMachine`, `shallowEqual`) | `@cosimosi/state-machine/react`; apps re-export it from `shared/model/xstate-react.ts` | `@xstate/react`, `react` |
| Per-feature machines (when they arrive) | `apps/{web,mobile}/src/<slice>/model/<name>.machine.ts` | imported from `@cosimosi/state-machine` or feature-local |

Both apps consume `@cosimosi/state-machine` directly. The package's root export
stays React-free so the same catalog works in tests, Web Workers, and R3F
frame-loops without dragging React into them. The optional `/react` export owns
the shared binding seam once, and each app's `shared/model` re-exports it so
feature call sites stay stable.

## 2. Machine placement

Machines live where the control flow belongs, never in a generic folder:

| Machine kind | Home |
|---|---|
| app-wide lifecycle (session bootstrap, app mode) | `apps/{web,mobile}/src/app/model/<name>.machine.ts` |
| feature action machine (encode, recall, select, …) | `apps/{web,mobile}/src/features/<verb>/model/<name>.machine.ts` |
| entity control machine | `apps/{web,mobile}/src/entities/<noun>/model/<name>.machine.ts` |
| generic reusable pattern (the catalog) | `packages/state-machine/src/<name>.machine.ts` |

Files are named `<name>.machine.ts` and export named factory functions and/or
the machine constant plus its types (`<Name>Event`, `<Name>Snapshot`, …). No
default exports; no wildcard barrels. Deep machine internals (private actions,
guards) are not part of the public surface — feature code consumes the machine
through its hooks/adapters.

## 3. Context rule — ids and control metadata only

A machine context is the *control state* of a flow. It is intentionally small,
serializable, and free of payload.

**Allowed in context:**

- ids (`userId`, `commandId`, `panelId`, `resultId`, …);
- the current control mode/status (already implied by the active state, but
  mirrored when convenient for selectors);
- timestamps used for control transitions or diagnostics
  (`expiresAt`, `lastOpenedAt`, …);
- small error/status strings surfaced to the UI;
- a monotonic epoch/attempt counter for staleness guards.

**Forbidden in context (enforced by review + tests):**

- server data collections (rows, lists, page state);
- `QueryClient` data or `useQuery` snapshots;
- Zustand store snapshots;
- graph buffers, `Float32Array` coordinate data, geometry;
- Supabase `Session` objects or access tokens (those live in `@cosimosi/auth`'s adapter);
- functions, callbacks, or React refs.

The data lives in Query / Zustand / refs and is **selected by id** when the
machine needs it. The catalog tests in
`packages/state-machine/src/context-rule.test.ts` hold this contract for every
catalog machine: snapshots must be JSON-serializable and must expose only the
documented control fields.

## 4. Catalog (platform-level patterns)

This package ships platform-level patterns. Product workflows (Encode, Recall,
camera mode, universe tour, …) are authored by their feature slices.

| Pattern | Source | States |
|---|---|---|
| `sessionMachine` | `@cosimosi/auth` (plan/04) | bootstrapping · signedOut · signingIn · authenticated · refreshing · expired · failed |
| `asyncCommandMachine` | `@cosimosi/state-machine` | idle · submitting · succeeded · failed · cancelled |
| `panelMachine` | `@cosimosi/state-machine` | closed · open · loading · ready · error |

`asyncCommandMachine` keeps a monotonic `attempt` counter. The `RESOLVE` and
`REJECT` events echo the `attempt` they observed when starting; a transition
guarded on `event.attempt === context.attempt` discards a late resolution from
an earlier, superseded SUBMIT (the `SUBMIT#1 → CANCEL → SUBMIT#2 → stale
RESOLVE#1` race). The counter is never reset, so a stale resolution after a
RESET also mismatches.

`panelMachine` takes `openedAt` on its `OPEN` event (caller-supplied time) so
the machine stays a pure function of `(state, event)` — no `Date.now()` inside
an action, fully replayable in tests.

## 5. React + R3F usage

### 5.1 React subscriptions

- Use `useActorRef(machine)` when a component needs a stable reference and
  wants to subscribe selectively.
- Use `useSelector(actorRef, selector)` for granular rerenders — define the
  selector outside the component so its reference is stable, and pass
  `shallowEqual` when it returns an object slice.
- Use `useMachine(machine)` for small component-owned machines where rerendering
  on every transition is fine.
- All hooks are imported from `shared/model` (the app seam), not from `@xstate/react`
  directly.

### 5.2 The R3F `useFrame` pattern — no React state per frame

This is the most important rule. The renderer reads coordinates from a
Web-Worker force-sim and the *machine* through stable refs; it never drives 60
fps through React state. The pattern, in pseudocode:

```ts
import { useFrame } from '@react-three/fiber'
import { useActorRef } from '@shared/model'        // the seam
import { useRef } from 'react'

function MemoryField({ ... }) {
  // 1. Stable actor ref. Does NOT rerender on snapshot changes.
  const mode = useActorRef(memoryFieldMachine)

  // 2. Read the snapshot imperatively inside useFrame.
  useFrame((_, dt) => {
    const snap = mode.getSnapshot()                // synchronous; no rerender
    if (snap.matches('frozen')) return             // a discrete mode gate
    // ... advance the sim using `dt` and the worker's coord buffer ...
  })

  return null
}
```

Why:

- `getSnapshot()` is synchronous and returns the current value; it does not
  schedule a React update, so calling it inside `useFrame` is free.
- Continuous values (positions, brightness, lerped colors) are never put in
  machine context or React state — they live in refs / worker buffers and are
  derived from the last-event timestamp (ARCHITECTURE §4, derived state).
- The machine gates *discrete* modes only (frozen, dragging, focused); it does
  not model per-frame animation.
- A transition may be sent from a React handler (user pressed play) or from the
  worker boundary (sim settled), but never from inside `useFrame`.

Until the renderer exists (Phase 4), this pattern is the contract every
presentation slice will reuse — recorded here so a future contributor cannot
"just" `setSnapshot` per frame.

## 6. Tests

Every catalog machine has:

- deterministic transition tests (`<name>.machine.test.ts`) — exercise every
  documented state and event, including ignored events;
- the shared `context-rule.test.ts` — asserts snapshots are JSON-serializable
  and expose only the documented control fields (the §3 contract).

Feature machines (when they arrive) follow the same pattern at their slice.

## 7. Non-goals (held by plan/07)

No product workflow machine, no renderer implementation, no force-sim, no
server data cache, no global event bus, no animation timeline. This unit is
the catalog + the rules; product content lands with its feature plan.
