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
- the **provenance list** is a Query read fetched only on entering `provenance`; Query, not the machine, owns its
  loading/retrying/error/success lifecycle. The adapter keeps transport error + retry distinct from successful empty
  data instead of collapsing `error` through `data ?? []`;
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
  when it appears; the **rewrite text + result** live in the shared `@cosimosi/universe`
  recall-draft store, never in context;
- `OPEN` carries `needsSync` (clock-behind-today, read from the server) as the
  guard input: it routes to `confirmingSync` only when behind, else straight to
  `rewriting` ([R1a]). `REJECT` from the consent leaves `idle` with the clock
  unmoved (the recall's sync fires only server-side on the confirmed call);
- `reconsolidating` is the loading phase over the **single synchronous `Recall`**
  (sync + compare + recall commit atomically server-side, §2.7/§2.8). `DONE` →
  `result`, `ERROR` → `rewriting` (retriable, the draft store keeps the rewrite).
  `SESSION_INVALIDATED` returns any active phase to `idle` when target/session ownership changes;
- the FE never decides the branch — `recallOutcome(reconsolidated)` reflects the
  server flag, and the result applies only the read-model-held anchors
  (`applyRecallResult`: seed + recall_count + last_recalled) so the star reshapes;
  the committed sync interval plays through the same `AdvanceAnnouncement` seam a
  launch uses.

web and mobile import the machine + the recall helpers verbatim from
`packages/universe`; only the sheet/input hosts fork (§6/§3.5). The Twinkle
paid-action controller is shared too: it synchronously suppresses duplicate submits, retains one operation id for an
ambiguous receipt recovery, and fences completions by the active target/session attempt. Both hosts invalidate it on
retarget, sign-out/target clear, and unmount, so a late completion cannot mutate a replacement flow. The Twinkle
**cost gate** ([G4]) is a widget-local pre-step, not a machine phase: the flow
shows `features/spend-cost-display` before revealing the rewrite and proceeds
only on its confirm, gated by a local "shown → proceeded" boolean — so the
shared machine stays untouched (the cost display carries its own tiny control,
plan 45). A spend refused at commit (a stale-quote shortfall) resets that gate
and refetches, so the display re-quotes into the earn guide rather than
dead-ending.

### 6.4 The stardust overlay has NO machine (and why)

The economy overlay once ran one: a charge sheet whose `paying`/`inviting` were genuinely exclusive
async phases, un-closable mid-flight so no credit could show before the backend confirmed it. Both
mutations left the product — payment is deferred to v3 (PRD §8.3) and the invite credit is settled
server-side from the signup path — and what remained was `idle ↔ open`.

**A two-state shell is data, not control state.** §3.2 reserves XState for exclusive phases; the earn
guide issues no request at all, so there is no in-flight state to be exclusive about, no race to
serialize and no failure to route. `widgets/stardust` holds the guide's open flag as local `useState`,
and the figures ride outside it exactly as they did before: the two-kind balance in the
`@cosimosi/twinkle` `useTwinkleBalanceStore` mirror (synced from `GetBalance`), the pending-spend cost
in the `QuoteSpend` Query read the cost display owns, and the history in the `GetLedger` infinite Query.

The shortfall→guide seam is a **Zustand request store** (`useEarnRequestStore`), not an event on a
shared machine: the spend flows and the overlay never import each other, and the overlay consumes the
request and clears it.

### 6.4.1 How the universe is held has NO machine either

`useUniverseViewStore` (`@cosimosi/universe`) carries `pinned | free` — which of the two camera modes
the viewer is in ([policy/ux/universe-view.md](../policy/ux/universe-view.md)). It is a **preference,
not a lifecycle**: there is no ordering between the two, nothing to enter or leave, no in-flight phase
and no failure to route, so §3.2 keeps it out of the navigation machine, which owns
`idle`/`focusing`/`flying` — states that genuinely exclude one another. One HUD control
(`features/pin-universe-view`, mirrored on both apps) writes it and the canvas reads it; a store
rather than a prop because React context does not cross the R3F reconciler (§5.2). It is a
runtime-local device preference, so the account-scope reset deliberately leaves it alone; sign-out,
route changes and account switches preserve the last choice until a reload or app restart creates a
fresh runtime. The camera work this drives is [tech/rendering.md](rendering.md).

### 6.5 `diaryReaderMachine` (the diary-reader jump)

`browsing → confirming → recalling → flying`, context empty — the "이 일기로
태어난 별 보기" jump the reader owns (plan 47). Browsing the archive is free and
data-driven (a `GetDiaries` infinite Query + the shared `useDiaryStore`), so it
is the resting state, not a phase; only the jump spends and moves the clock:

The archive query owns the ordered page segment of `useDiaryStore`; calendar/day reads contribute a
separate union segment. Owner refreshes replace only their segment, so a day response remains
available to cross-route consumers regardless of which query settles last. An enabled contributor's
next result replaces its segment — including an empty result — so stale days can leave; disabled
reads write nothing to the mirror.

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
  camera target in the shared `usePendingFlyTargetStore`, names every recalled
  memory in the shared `useSpotlightStore` (the sky holds back and those stars
  lift while the camera arrives, so the jump reads as arriving somewhere rather
  than as a page load), invalidates `GetUniverse`, and navigates home — the
  reader unmounts on the route change, so no explicit return-to-`browsing` is
  needed. The universe canvas consumes the parked fly target once the graph
  carries the node and sends its navigation actor a `FLY`; an unresolved node
  leaves the request parked for the read still in flight, since the slot holds
  one request and nothing re-sends it (§3.4 — the reader never imports `three`
  or the camera rig).

web and mobile import the machine + the diary/open-target/fly-target stores +
the `RecallDiaryStars` helper verbatim from `packages/universe`; only the
list/entry hosts fork (§6/§3.5). The cost gate is the same widget-local pre-step
as the recall flow (§6.3), and the row action disables purely on empty split
membership (a live memory is always priced above zero, so the quote is fetched
once in the modal, not per row).

### 6.6 `deletionFlowMachine` (the delete / letting-go flow)

Two branches under one machine (plan 50): full delete `idle → confirmingDelete →
deleting → done` and letting-go `idle → phrasing → suggesting → approving →
sealing → done`, meeting at a shared `done`. Context holds ids only (the target
diary or episodic memory); the typed phrase, the server-returned candidate list,
and the toggled seal subset live in the widget's `deletion-draft-store`, never in
context ([I3][I11]). **Restore is not a state** — it is a one-shot feature the
host page drives.

- `OPEN_DELETE`/`OPEN_LETGO` set the target; `CONFIRM`/`SUGGEST`/`SEAL` advance;
  `BACK` reopens `phrasing` from `approving`; `DONE`/`ERROR` resolve each async
  step. Errors are retriable and return to the prior interactive state
  (`confirmingDelete`/`phrasing`/`approving`) with nothing applied — a failed
  `LetGo` seals nothing.
- **The loading states `deleting`/`suggesting`/`sealing` carry no `CANCEL`** (only
  the interactive states do), and the sheet's close/backdrop is inert while a call
  is in flight — the same discipline the retired stardust charge sheet applied to its own async phases
  (§6.4). This closes the stale-completion race: a call can never be abandoned
  mid-flight to open another branch, so an old async `DONE`/`ERROR` cannot land on
  the wrong branch.
- **The two machines hand over rather than overlap.** A universe host sends its
  navigation actor `CLEAR_SELECTION` before it opens either branch, so the star
  detail panel is down before the flow's modal is up: never two `aria-modal`
  surfaces stacked, and never a selection pointing at a star the flow may remove.
  The consequence is deliberate — `CANCEL` returns to the bare canvas, not to the
  panel the action was reached from.
- The widget fires the RPC imperatively (the recall-flow precedent, §6.3): the
  optimistic apply runs **only on success** (`Release` removes the returned ids
  from the episodic-memory mirror + records the group for same-session restore;
  `LetGo` invalidates `GetUniverse` so the sealed neuron drops from the next read),
  and `Release`/`Restore` invalidate both the finite and infinite `GetDiaries`
  keys. The heavy-state hint is carried as draft-store data, not a state — the
  notice is advisory and gates nothing ([X7]).

web and mobile import the machine + the deletion stores + the four RPC wrappers
verbatim from `packages/universe`; only the sheet/step `ui` forks. On mobile,
both the universe and diary-reader screens host the sheet against one global
target store, so each gates consumption on `useIsFocused()` — only the focused
screen opens the flow (web routes unmount, so they need no gate). The deletion
stores are cleared on sign-out (where the universe mirrors are), so a release
never leaks across users in one process.

### 6.7 What the diary archive's conditions are NOT

The archive's keyword, mood filter, date range, order and pagination are **data**, not control state:
Query owns the pages, the URL (web) or screen state (mobile) owns the conditions, and
`useDiaryConditions` owns only the uncommitted drafts. No machine was added for them, and
`diaryReaderMachine` still holds exactly the paid-jump phases. A machine here would be a second source
of truth for a routed field and would need syncing back to the address bar (§3.2's rule, applied).

The keyword draft exists for one reason worth stating: a condition the read would refuse must never be
committed. `useDiaryConditions` debounces the keyword, withholds one below the server minimum, and —
when a condition changes behind it — adopts the new value **unless** the incoming value is merely the
trimmed form of what is already typed. That last test is what keeps a commit from eating a trailing
space mid-phrase or replacing the syllable a composing IME is still assembling. Date bounds arrive as
validated route or calendar-link data rather than editable drafts. The remaining draft rules are pure
functions in `@cosimosi/memory` (`isKeywordSearchable` · `shouldAdoptCommitted`), so both platforms
search on identical terms and the rules are unit-tested without a DOM.

### 6.8 `sequenceRunMachine` (the guided-step engine)

`idle → running → completed | skipped | abandoned`, in `packages/sequence` — its own package rather
than `packages/universe` because it must be importable from a page starved of every server-backed
mirror, and because its dependency list is load-bearing (below). Context is exactly
`{ runId, stepIndex, stepCount, outcome }` — four control fields, JSON-serializable, asserted by the
package's own context test.

The script never enters context, which is the §3 rule at its strictest applied to a machine that
obviously _could_ hold one: `stepCount` is supplied on `START` precisely so the machine can know the
last step without holding the steps. `currentStep` / `progress` / `isActive` in `select.ts` join
snapshot and script outside the machine.

**The echo guard.** `ADVANCE` carries `fromStepIndex`, the index the caller observed, and is guarded
out unless it equals `context.stepIndex` — the `asyncCommandMachine` `attempt`-echo precedent. A double
tap, a duplicated host signal and a dwell timer left over from a superseded step all arrive stale and
are rejected at the machine rather than by caller discipline. `ADVANCE` on the last step lands in
`completed`.

**`SKIP` is unconditional in `running`**, which is how "the skip is always available" becomes a
transition table instead of a UI habit — and the step model has no field with which to opt out.
`ABANDON` is the host's own teardown, distinguishable from a skip so an onboarding host can treat them
differently. **Every terminal state accepts `START` again**, which is what makes a replay a start
rather than a reset ritual: no teardown by the caller, and no residue from the previous pass.

**The machine never reads a clock.** Dwell timing lives in the `/react` seam as a `setTimeout` keyed on
the step index and cleared on every change and on unmount (the `panelMachine` `openedAt` discipline), so
the machine stays a pure `(state, event) → state` and no suite leaves a pending timer. The dwell
duration is a _parameter of the hook_, not an import: the package's dependencies are `xstate` + `zustand`
only, so the generated `sequence.caption_dwell_ms` constant is read by the app chrome and passed in.

**The step model's omissions are the contract** (`script.ts`): no `run`/`onEnter`/`action`/`effect`
field, no `skippable`, no string caption (it is an i18n accessor), no domain number, no data payload, no
`isDemo`/`hostKind`. The first of those is why the same engine can run over a real signed-in account —
"the engine performed the step for the user" is unrepresentable, so monotonic universe time, diary
immutability, the untouched meaning layer and paid recall all stay in force during a tour without the
engine knowing they exist. `Anchor` and `Signal` are host-owned string-literal unions, so a mistyped
anchor is a compile error in the host while the engine stays host-agnostic.

**The anchor registry** (`anchor-registry.ts`) is a Zustand store of `anchorId → { measure() }` —
data, not machine context (§3). `measure()` returns a **promise**, which is the only shape one seam can
have on both platforms: web reads `getBoundingClientRect()`, native's `measureInWindow` is
callback-based. Rects are in **logical (density-independent) pixels relative to the app window**, so both
platforms hand back comparable numbers. They are re-measured on step change, on registry change, and on
a host-driven `remeasure()` (resize / orientation — the engine cannot subscribe to either) — **never per
frame**. An unresolvable anchor yields `null` rather than throwing: the caption is the guaranteed
channel and the highlight is an enhancement, so there is no timeout and no error path.

**The caption placement rule** `resolveCaptionPlacement(anchorRect, viewport, bandHeight)` is pure and
returns `'bottom' | 'top'`, flipping only when the highlighted rect intersects the bottom band. Not
cosmetic: the shipped universe page puts the writing sheet bottom-center, exactly where the first
onboarding beat points.

`resetSequenceUserState()` clears the registry and is registered in `@cosimosi/auth`'s shared
user-state reset inventory. The run needs no entry — it lives in a host-owned actor that dies with the
host — but the registry is module-level, so without this an onboarding run's registered controls would
survive into the next account's subtree.

### 6.8.1 The onboarding tour's seams (`@cosimosi/onboarding`)

**Two closed unions are the whole safety argument** (`anchors.ts`). `OnboardingAnchor` has exactly five
members (`universe-write-entry`, `writing-draft`, `writing-proposal`, `writing-confirm`,
`universe-clock`) and `OnboardingSignal` exactly three (`writing-flow-opened`, `split-succeeded`,
`launch-succeeded`), pinned by exhaustive-`Record` tests. Since `SequenceStep` is generic over host-owned
unions, a step naming anything else is a compile error. What they omit is the design, and each omission
answers a plausible shortcut:

| Absent member                      | What it would allow                                        | Protected |
| ---------------------------------- | ---------------------------------------------------------- | --------- |
| a recall anchor or signal          | a step waiting on a paid reconsolidation                   | [G1]      |
| a 놓아주기 / delete anchor         | a tutorial that destroys a memory to demonstrate deletion  | [I1]      |
| a clock or sync anchor/signal      | a step that moves universe time to make dimming visible    | [I10]     |
| a palette / ornament anchor        | a step that changes a render parameter for effect          | [I11]     |
| an anchor for a rendered memory    | pointing at an emergent coordinate as if it were a control | [I5]      |
| any anchor in a `features/*` slice | a product slice learning that a tour exists                | [I13]     |

**Anchors are registered by wrapping an existing child at a composition site** and passing nothing down —
no prop, no flag, no callback. `pages/universe` wraps the 일기 쓰기 affordance; `widgets/writing-flow`
wraps its three inner panels; `widgets/universe-time` wraps the HUD. The clock anchor sits in the widget
rather than the page because the page composes that widget as a fragment of absolutely-positioned
children: on web its first element is the full-screen acceleration veil, and in RN an absolute child
escapes a page-level wrapper's box entirely, so either would have measured the wrong rect. All three are
composition sites, so no shipped product slice imports `@cosimosi/sequence` or `@cosimosi/onboarding` —
enforced by a `no-restricted-imports` block over `features/**` + `entities/**` in both apps (the three
chrome slices and `features/replay-onboarding` are exempt, being the sequence's own surface) and proved to
bite by `scripts/probe-sequence-isolation.mjs` in `test:guards`.

**`reportSequenceSignal(signal): void`** pushes `{signal, nonce}` into a one-slot Zustand channel. The
signature is the guard: one id in, nothing out, so a reporting site cannot learn whether a run is active,
cannot read a step index, and cannot branch on either. Its three call sites are **one effect on the
writing-flow machine's real phase transitions** (`idle→writing`, `splitting→reviewing`,
`launching→done`), not the promise arms that request them — a split whose RPC resolves after the sheet
closed leaves the machine in `idle`, and reporting from the arm would have advanced a run past a step the
user never completed.

**The page owns the run actor** (`useSequenceRun`, the `universeNavigationMachine` precedent) and is the
only place a report becomes an `ADVANCE`. It holds a report the current step is not waiting for rather
than dropping it — several steps are reading time, and a user who presses the highlighted control before a
dwell finishes is ahead of the caption, not wrong; dropping it would leave the next step waiting forever
for a launch that already happened. With no run active a report is inert and cleared, so it cannot survive
into a later run. The mobile leg keys its start on **focus** rather than mount (the native stack pushes
`/me` over the same mounted screen) and abandons the run on blur, which is what web gets for free by
unmounting the page.

**`takeOnboardingStart(signupCompleted): 'signup' | 'replay' | null`** is the entire exposure policy, a
take-once read run as the universe comes into view. The signup flag is a **parameter** rather than a read
because the dependency edge runs `@cosimosi/auth` → `@cosimosi/onboarding` (the reset inventory), so this
package cannot import auth's one-shot flag; the caller passes `takeSignupCompletion()`. There is no
durable "seen" fact anywhere: the `users` shape and the `AccountService` RPC inventory are closed, and a
`localStorage` flag would turn "once, just after signup" into "once per browser". The guarantee is a
property of the trigger — the profile gate makes `SignUp` reachable only while no `users` row exists.

**Dependency closure:** `@cosimosi/sequence` + `@cosimosi/i18n` + `zustand`, asserted by a manifest test.
With no transport, no fixture package, no domain-logic package and no read mirror resolvable, "the tour
created a memory" is unrepresentable rather than merely against the rules.

**Known gap (mobile).** The chrome renders above the writing dialog on web (`z-guide`, between `z-modal`
and `z-toast`), but React Native's `Modal` presents in its own window above the app tree, so on mobile the
caption, the ring and the skip are hidden for the three dialog-hosted steps. The run still advances on real
signals and the dialog's own close is always reachable. Closing it properly needs the sequence chrome to be
able to render inside the topmost native modal — a `packages/ui` portal seam, or the native `Dialog`
gaining an overlay slot — which is plan 78's chrome to change, not this unit's.

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
