# tech: state machine foundation

> As-built rules for XState v5 machines on cosimosi's frontend (web + mobile).
> The architectural frame lives in [ARCHITECTURE.md](../ARCHITECTURE.md) §3.1–§3.3;
> this doc is the detailed rulebook the foundation (plan/07) installed.

## 1. Packages and the React seam

| Concern                                                                                                | Location                                                                               | Depends on                                                |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Catalog machines (`asyncCommandMachine`, `panelMachine`) + types                                       | `packages/state-machine`                                                               | `xstate` only — no React, no DOM, no native               |
| Auth/session machine (auth-domain lifecycle reference)                                                 | `packages/auth`                                                                        | `xstate`, `@supabase/supabase-js`, `@cosimosi/api-client` |
| React binding hooks (`createActorContext`, `useActorRef`, `useSelector`, `useMachine`, `shallowEqual`) | `@cosimosi/state-machine/react`; apps re-export it from `shared/model/xstate-react.ts` | `@xstate/react`, `react`                                  |
| Per-feature machines (when they arrive)                                                                | `apps/{web,mobile}/src/<slice>/model/<name>.machine.ts`                                | imported from `@cosimosi/state-machine` or feature-local  |

Both apps consume `@cosimosi/state-machine` directly. The package's root export
stays React-free so the same catalog works in tests, Web Workers, and R3F
frame-loops without dragging React into them. The optional `/react` export owns
the shared binding seam once, and each app's `shared/model` re-exports it so
feature call sites stay stable.

## 2. Machine placement

Machines live where the control flow belongs, never in a generic folder:

| Machine kind                                       | Home                                                            |
| -------------------------------------------------- | --------------------------------------------------------------- |
| app-wide lifecycle (session bootstrap, app mode)   | `apps/{web,mobile}/src/app/model/<name>.machine.ts`             |
| feature action machine (encode, recall, select, …) | `apps/{web,mobile}/src/features/<verb>/model/<name>.machine.ts` |
| entity control machine                             | `apps/{web,mobile}/src/entities/<noun>/model/<name>.machine.ts` |
| shared product machine (web+mobile parity, §6)     | `packages/universe/src/<name>.machine.ts`                       |
| generic reusable pattern (the catalog)             | `packages/state-machine/src/<name>.machine.ts`                  |

Files are named `<name>.machine.ts` and export named factory functions and/or
the machine constant plus its types (`<Name>Event`, `<Name>Snapshot`, …). No
default exports; no wildcard barrels. Deep machine internals (private actions,
guards) are not part of the public surface — feature code consumes the machine
through its hooks/adapters.

## 3. Context rule — ids and control metadata only

A machine context is the _control state_ of a flow. It is intentionally small,
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

| Pattern               | Source                     | States                                                                                |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `sessionMachine`      | `@cosimosi/auth` (plan/04) | bootstrapping · signedOut · signingIn · authenticated · refreshing · expired · failed |
| `asyncCommandMachine` | `@cosimosi/state-machine`  | idle · submitting · succeeded · failed · cancelled                                    |
| `panelMachine`        | `@cosimosi/state-machine`  | closed · open · loading · ready · error                                               |

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
Web-Worker force-sim and the _machine_ through stable refs; it never drives 60
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
- The machine gates _discrete_ modes only (frozen, dragging, focused); it does
  not model per-frame animation.
- A transition may be sent from a React handler (user pressed play) or from the
  worker boundary (sim settled), but never from inside `useFrame`.

Until the renderer exists (Phase 4), this pattern is the contract every
presentation slice will reuse — recorded here so a future contributor cannot
"just" `setSnapshot` per frame.

## 6. Shared product machines (the parity home)

Product machines that both apps consume verbatim live in the product's pure
package — `packages/universe` — not in an app slice (`writingFlowMachine`,
`universeNavigationMachine`, `universeTimeMachine`). The §2 slice homes apply
to machines only one app owns; a web+mobile widget pair imports its machine
from the package and forks only its `ui` hosts (ARCHITECTURE §3.5).

### 6.1 `universeTimeMachine` (the time overlay)

`idle → confirming → accelerating → idle`, context empty — the strictest form
of the §3 rule. All payload rides outside the machine:

- the **clock value** lives in the `useUniverseClockStore` mirror (synced from
  every `GetUniverse` read; nil = unborn clock);
- the **advance interval + deferred reveal ids** ride a module-level announce
  seam (`features/accelerate-time`'s announcement store, take-to-consume) —
  `ADVANCED` carries only an emptiness flag for the guard, and an empty
  interval (no time passed) never enters `accelerating`;
- `confirming` is the sync-consent modal; **ACCEPT parks back in `idle`** on
  purpose — the acceleration presents the _committed_ sync interval, which the
  recall use-case announces through the same `ADVANCED` seam a launch uses, so
  the wait needs no fourth state.

The acceleration is presentation over an already-committed data path: on a
clock-advancing launch the optimistic insert and the `GetUniverse` invalidate
stay immediate, and only the _reveal_ (the awaken entry announce) is deferred
to the transition's `DONE` — accelerate, then the star appears. The transition
component owns a reserved choreography slot the forgetting/consolidation
visuals later fill off the same interval seam. Per-frame veil intensity goes
through a DOM ref / `Animated.Value`, never React state (§5.2); the date tick
re-renders at most once per sampled date.

### 6.2 `starDetailMachine` (the star-detail panel)

`closed → meta → provenance`, context empty — the same context-free form as the
time overlay. The machine owns only the panel's **view phase**; every payload
rides outside it:

- the **selected id** stays in `universeNavigationMachine` (the single selection
  owner); the composing page/screen lifts that actor and passes it to both the
  canvas widget and the panel, which subscribes via `useSelector`. The panel
  derives open/closed by sending `OPEN`/`CLOSE` from the resolved selection —
  it never owns a second copy of "which star is selected";
- the resolved star comes from the pure `resolveSelection(selectedNodeId, stores)`
  selector over the `episodic-memory`/`neuron` read-model mirrors, yielding
  `episodic | neuron | gist | none` (a gist body is recognized by an injectable
  recognizer and routes away to the paid view, so no gist state lives here);
- the **provenance list** is a Query read fetched only on entering `provenance`;
- `RECALL` / `OPEN_DIARY` are **emitted intents** the composing page consumes
  (recall flow / router) — they are self-handled no-ops that leave the phase
  intact, so the panel hands off without owning downstream behavior. `OPEN`
  re-enters `meta` so re-selecting a star drops a stale provenance view.

web and mobile import this machine + the resolver verbatim from `packages/universe`
and fork only the panel host (a web side-sheet, a mobile bottom sheet, §6/§3.5).

### 6.3 `recallFlowMachine` (the recall flow)

`idle → confirmingSync → rewriting → reconsolidating → result`, context empty —
the summon-and-rewrite flow the star-detail panel opens. Every payload rides
outside the machine (A10):

- the **recalled memory id** lives in the shared `useRecallTargetStore` — the
  panel's 회고하기 records it there, the flow widget subscribes and sends `OPEN`
  when it appears; the **rewrite text + result** live in the per-app recall-draft
  store, never in context;
- `OPEN` carries `needsSync` (clock-behind-today, computed by the widget) as the
  guard input: it routes to `confirmingSync` only when behind, else straight to
  `rewriting` ([R1a]). `REJECT` from the consent leaves `idle` with the clock
  unmoved (the recall's sync fires only server-side on the confirmed call);
- `reconsolidating` is the loading phase over the **single synchronous `Recall`**
  (sync + compare + recall commit atomically server-side, §2.7/§2.8). `DONE` →
  `result`, `ERROR` → `rewriting` (retriable, the draft store keeps the rewrite);
- the FE never decides the branch — `recallOutcome(reconsolidated)` reflects the
  server flag, and the result applies only the read-model-held anchors
  (`applyRecallResult`: seed + recall_count + last_recalled) so the star reshapes;
  the committed sync interval plays through the same `AdvanceAnnouncement` seam a
  launch uses.

web and mobile import the machine + the recall helpers verbatim from
`packages/universe`; only the sheet/input hosts fork (§6/§3.5). The Twinkle
**cost gate** ([G4]) is a widget-local pre-step, not a machine phase: the flow
shows `features/spend-cost-display` before revealing the rewrite and proceeds
only on its confirm, gated by a local "shown → proceeded" boolean — so the
shared machine stays untouched (the cost display carries its own tiny control,
plan 45). A spend refused at commit (a stale-quote shortfall) resets that gate
and refetches, so the display re-quotes into the charge path rather than
dead-ending.

### 6.4 `stardustMachine` (the charge sheet)

`idle → charging → (paying | inviting) → idle`, context empty — the economy
overlay's charge-sheet phase (plan 45). Every figure rides outside the machine
(A10):

- the **two-tier balance** lives in the shared `useTwinkleBalanceStore` mirror
  (synced from `GetBalance`; `total` is derived `basic + additional`, never
  stored); the **pending-spend cost** is the `QuoteSpend` Query read the cost
  display owns; the **charge result** is the earn mutation's returned total —
  none of them in context;
- `charging` is the sheet open (the payment + invite paths); `PAY`/`INVITE`
  drive the async earn (a store round trip + verified `Charge`, or `ClaimInvite`)
  through `paying`/`inviting`. `DONE` → `idle` with the balance refetched;
  `ERROR` → `charging`, retriable — a failed earn credits nothing and never
  dead-ends;
- `paying`/`inviting` **cannot be closed mid-flight** (no `CLOSE` there): a
  store round trip + backend verification must resolve before the sheet
  releases, so no credit shows before the backend confirms it;
- the sheet opens both from a **shortfall** in the cost display (through the
  decoupled `useChargeRequestStore` signal, so the spend flows never import the
  overlay) and from a restrained **proactive** affordance beside the balance.

web and mobile import the machine + the balance/charge-request stores verbatim
from `packages/universe`; only the HUD/sheet hosts fork (§6/§3.5). There is no
login-bonus path anywhere ([G3]); the daily basic grant plays that role.

### 6.5 `diaryReaderMachine` (the diary-reader jump)

`browsing → confirming → recalling → flying`, context empty — the "이 일기로
태어난 별 보기" jump the reader owns (plan 47). Browsing the archive is free and
data-driven (a `GetDiaries` infinite Query + the shared `useDiaryStore`), so it
is the resting state, not a phase; only the jump spends and moves the clock:

- the **selected/target diary id, the server quote, and the deep-link target**
  all ride outside the machine — the widget's local `jumpDiaryId`, the
  `features/spend-cost-display` `QuoteSpend` Query, and the shared
  `useOpenDiaryTargetStore` (a one-slot memory id parked by star-detail's
  원본 일기 보기; the reader opens the owning diary once its page loads,
  auto-paging until found or the archive is exhausted);
- `JUMP` carries `needsSync` (clock-behind-today **or unknown**) as the guard:
  behind/unknown → `confirming` (the reusable sync-consent modal), else straight
  to `recalling`. `REJECT` → `browsing` with the clock unmoved and nothing spent
  ([R1a]); a cold deep-link with a null clock is treated as needing consent, so a
  jump can never sync+spend without the user's yes;
- `recalling` is the loading phase over the **single synchronous
  `RecallDiaryStars`** (server-side sync + reinforce of every still-live memory,
  atomic, §2.7/§2.8) — never a reconsolidation (no `current_text`/`seed`, [R6]).
  `DONE` → `flying`, `ERROR` → `browsing`. The error path reopens the retriable
  cost gate only for known **pre-spend** Connect codes (ResourceExhausted /
  InvalidArgument / FailedPrecondition / NotFound / Unauthenticated); any other
  (ambiguous) failure closes the jump and refetches, so a possibly-committed
  recall is never one-click retried into a double-spend;
- `flying` is terminal: the widget announces the acceleration over the returned
  interval (the same `AdvanceAnnouncement` seam a launch/recall uses), parks the
  camera target in the shared `usePendingFlyTargetStore`, invalidates
  `GetUniverse`, and navigates home — the reader unmounts on the route change, so
  no explicit return-to-`browsing` is needed. The universe canvas consumes the
  parked fly target on mount and sends its navigation actor a `FLY` (§3.4 —
  the reader never imports `three` or the camera rig).

web and mobile import the machine + the diary/open-target/fly-target stores +
the `RecallDiaryStars` helper verbatim from `packages/universe`; only the
list/entry hosts fork (§6/§3.5). The cost gate is the same widget-local pre-step
as the recall flow (§6.3), and the row action disables purely on empty split
membership (a live memory is always priced above zero, so the quote is fetched
once in the modal, not per row).

## 7. Tests

Every catalog machine has:

- deterministic transition tests (`<name>.machine.test.ts`) — exercise every
  documented state and event, including ignored events;
- the shared `context-rule.test.ts` — asserts snapshots are JSON-serializable
  and expose only the documented control fields (the §3 contract).

Feature machines follow the same pattern at their home (`universeTimeMachine`
keeps its transition + serializability tests beside it in `packages/universe`).

## 8. Non-goals (held by plan/07)

No renderer implementation, no force-sim, no server data cache, no global
event bus, no animation timeline. The foundation unit is the catalog + the
rules; product machines land with their feature plans (§6).
