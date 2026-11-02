# ONB onboarding
> r2 | the one guided-step engine the demo and the post-signup tour share, and the tour itself: a script that points at real controls and waits, run once after signup and on replay, and never able to act for the user

## decisions
- ONB-1 [o] the demo and onboarding run on one sequence engine (`@cosimosi/sequence`) and differ only in the injected script and data: the demo's fixtures (→=DEMO-4) or the user's real first diary
  - no branch, flag or host-kind field exists in the engine; the demo's exemptions travel with `pages/demo`, never with the engine →=DEMO-9
  - a `SequenceScript` names steps and carries no data; `DemoScenario` names the demo's data; onboarding supplies a script and no fixture
  - the engine performs nothing, which is what lets the same engine run over a real account with every invariant in force →!ONB-7
- ONB-2 [o] guidance happens on the real screen: the chrome highlights the control to press next and shows one line of guidance, and the user presses the shipped control doing the real thing; no video, slides, rehearsal mode or simulated tap
  - the engine points and waits; it never acts for the user →=ONB-7
  - the caption is the guaranteed channel and the highlight an enhancement →~ONB-10
  - where the line sits is a named room, not a fixed bottom-centre band →=ONB-12
- ONB-3 [o] a tour starts on every entry to the demo (→~DEMO-3) and, on a signed-in account, exactly once at the moment signup completes, plus on explicit replay →!ONB-22
  - "after the details, before the universe" means the tour's first caption is the first thing rendered over the universe on the commit after the profile gate opens (→~ACCT-32); never a blocking interstitial route, which would unmount the canvas step 1 is about
  - entering the universe in any later session starts nothing
  - the shipped first-run welcome and the single write affordance stay untouched beneath the tour →~ACCT-2
- ONB-4 [o] skip is always visible and never confirmed: every step of every run shows it, no step can opt out, and one press ends the run as `skipped` ← a replay makes a mis-skip cheap, and a confirmation on a tutorial is one more thing to dismiss
  - no `skippable` field exists, and `SKIP` is accepted in `running` unconditionally →=ONB-8
  - the onboarding tour is never re-offered or nagged; finishing and skipping leave the same after-state, with nothing recorded
  - in the demo, skip sits above the tutorial gate →~DEMO-23
  - known exception on mobile: the three dialog-hosted steps hide the chrome →~ONB-25
- ONB-5 [o] the onboarding tour can be replayed at any time from a row on `/me`'s profile tab (`features/replay-onboarding`); the tab's composition and row order are the account page's →~ACCT-9
  - the row calls `requestOnboardingReplay()` and then the page's exit callback; the universe takes the request as it comes into view and starts a fresh run from step 1
  - a replay needs no teardown and leaves no residue: it is a fresh `START` →!ONB-8
  - a replay over a populated universe runs identically: steps 3–5 wait for a genuine new diary, and the skip is there for anyone who does not want to write
  - copy: `sequence_tour_replay_action`, `sequence_tour_replay_description`
- ONB-6 [o] `@cosimosi/sequence` (`packages/sequence`) is pure and host-agnostic; its dependency list (`xstate`, `zustand`; `@xstate/react` and `react` only as peers of `/react`) is the proof that it reaches no transport, fixture or read mirror →!INV-13
  - guard: a manifest test pins that list; the closure is why the demo's import block admits the package →~DEMO-10
  - the package root is React-free (machine, selectors, anchor registry, caption placement); `@cosimosi/sequence/react` holds the binding seam (`useSequenceRun`, `useSequenceAnchorRegistration`)
  - the dwell duration is a parameter of `useSequenceRun`, read by the app from `sequence.caption_dwell_ms`, never imported by the engine
  - it defines no domain function, so it owes no golden parity
- ONB-7 [o] a step can only point and wait: `SequenceStep<Anchor, Signal>` holds exactly an id, a caption accessor, an optional anchor and one of two advance kinds →!INV-13 ← an engine that could act would make the tour an invariant bypass or leak the demo's exemptions into shared code
  | absent field | what it would allow |
  |---|---|
  | `run`, `onEnter`, `action`, `effect` | the engine performing the step for the user |
  | `skippable`, `mandatory` | a step that cannot be skipped |
  | `text`, a string caption | an unreviewed public sentence |
  | a domain number | a formula smuggled into a script |
  | a data payload | the engine knowing about fixtures or a live universe |
  | `isDemo`, `hostKind` | a sandbox branch in shared code |
  - `Anchor` and `Signal` are host-owned string-literal unions: a misspelt anchor is a compile error in the host, and the engine never enumerates anchors or validates a script against the mounted tree
  - `defineScript()` is a type-narrowing identity with no runtime validation; a script test pins the step's key set
- ONB-8 [o] the run is one XState machine, `sequenceRunMachine`: `idle → running → completed | skipped | abandoned`, with context exactly `{ runId, stepIndex, stepCount, outcome }` →=ARCH
  - events: `START { runId, stepCount }`, `ADVANCE { fromStepIndex }`, `SKIP`, `ABANDON`; the script never enters context, and a context test asserts it stays JSON-serializable
  - echo guard: `ADVANCE` applies only when `fromStepIndex` equals the current index, so a double tap, a duplicated signal or a stale dwell timer cannot advance twice; on the last step it lands in `completed`
  - `SKIP` and `ABANDON` are accepted in `running` unconditionally; `running` and every terminal state accept `START`, so a replay is a start, never a reset ritual
  - the machine never reads a clock: dwell is a timer in the React seam keyed on the step index and cleared on every change and on unmount
  - the host owns the actor and observes the outcome; `abandon()` is the host's call, because only the host knows it is going away and the hook's actor is already stopped at unmount
- ONB-9 [o] `dwell` is reading time and `signal` waits on the world: a step whose progress the user must make always advances on a signal, and a dwell step never fakes progress →!ONB-7
  - a dwell step holds `sequence.caption_dwell_ms`, then advances itself
  - a signal the current step does not wait for is not progress: the engine drops it; holding it for a later step is the host's choice (onboarding holds →=ONB-20, the demo drops →~DEMO-26)
- ONB-10 [o] the engine points at controls it does not own through an anchor registry: `anchorId → { measure(): Promise<SequenceRect | null> }`, rects in logical pixels relative to the app window
  - web measures with `getBoundingClientRect()`, native with `measureInWindow`; the promise is what lets one seam serve both
  - re-measured on step change, on registry change and on a host `remeasure()` (resize, orientation); never per frame
  - on web a control still arriving is measured only once its arrival settles: a rect read mid-transform is the position the surface is leaving
  - an unresolved anchor leaves the ring out and changes nothing else: no timeout, no retry, no error surface, and the step still advances, so the run stays completable
  - anchors register only at composition sites (a page or a widget) by wrapping an existing child in `SequenceAnchor`, passing nothing down →!ONB-11
- ONB-11 [o] no product slice learns that a guided sequence exists: a `no-restricted-imports` block over `features/**` and `entities/**` in both apps refuses `@cosimosi/sequence` and `@cosimosi/onboarding` ← a slice able to import the engine could register an anchor inside a shipped feature, giving the demo's exemptions a path into real code
  - exempt as the sequence's own surface: `features/highlight-next-control`, `features/show-sequence-caption`, `features/skip-sequence`, `features/replay-onboarding`
  - flat config replaces rule options per file, so the web block restates the `three`/`@react-three/fiber` and `@cosimosi/i18n` bans
  - guard: `scripts/probe-sequence-isolation.mjs` (in `pnpm test:guards`) proves the block bites in each app's own config
- ONB-12 [o] one caption at a time, never on what it describes: its place is a named room resolved by `resolveCaptionPosition` (`packages/sequence`), and it moves only to get out of the way, never for variety
  | room | where | gives way |
  |---|---|---|
  | `edge` | the bottom band | to the top band when the highlighted control crosses the bottom band |
  | `eyeline` | just above the middle (`CAPTION_EYELINE`) | to `edge` when the highlighted control crosses it |
  | `aboveSurface` | above a surface owning the bottom edge, one gap from that surface's own top edge | to `edge` while the surface is still off screen; clamps under the top inset when the surface is taller than the room |
  - the web guide reads the screen instead of being told: a marked panel flush with the bottom edge and full width ⇒ `aboveSurface`; otherwise `edge` from the `md` breakpoint (where `Dialog` becomes a centred modal) and `eyeline` below it
  - no page carries a band per surface, so a sheet the chrome has never heard of is cleared by the same rule; a host names a room (`captionSlot`) only for a surface that is not a marked panel
  - the mobile guide uses `edge`: native surfaces are not marked panels it can measure
  - the top inset keeps the band clear of the always-visible skip
- ONB-13 [o] the chrome is non-modal and lives in both apps: three feature slices (`highlight-next-control`, `show-sequence-caption`, `skip-sequence`) composed by `widgets/sequence-guide`, each app hand-writing its own `ui` over the shared package →=ARCH
  - nothing is blocked or disabled, focus is never trapped, and the ring is `pointer-events: none` and `aria-hidden`; controls the step does not name stay operable, and a mis-tap is not progress
  - the caption is a polite live region, resolved from its accessor at render time, so a locale switch re-renders it
  - the ring pulses at `sequence.highlight_pulse_ms`; under reduced motion it is a static ring
  - skip renders whenever a run is active, top-right, beside a quiet `current / total` readout; it is the one interactive element the chrome owns
  - the guide holds no state: the host passes a view and handlers; the guide owns only the viewport and calls `remeasure()` when it changes
  - web paints the chrome on `z.guide`, between `z.modal` and `z.toast`: over a panel it describes, under an error that still has to speak →=UI
  - a host may add its own gate beside the chrome (the demo's tutorial gate →~DEMO-23); the chrome itself never disables anything
- ONB-14 [o] every sentence a run shows is a message key reviewed as public copy, even behind auth: captions are zero-argument accessors, never strings →!INV-12
  - engine chrome keys: `sequence_skip_action`, `sequence_progress` (`{current}`, `{total}`); onboarding captions: `sequence_tour_*` (there is no `onboarding_*` prefix); demo captions: `demo_*` →=DEMO-34
  - keys name a UI role, exist in every locale and pass `lint:raw-strings`
  - voice: plain and unhurried, an instruction rather than a sales line, no exclamation, no decorative emoji, no translation-ese
  - a caption may say the universe is inspired by engram theory; never that it works like a brain or that positions are the brain's coordinates, and no therapeutic claim
- ONB-15 [o] `@cosimosi/onboarding` (`packages/onboarding`) holds the tour's script, its two unions, the start policy and the signal channel; its dependencies are exactly `@cosimosi/sequence`, `@cosimosi/i18n` and `zustand`, with no peers →!ACCT-2
  - guard: a manifest test pins the list; no transport, fixture package, domain-logic package or read mirror is resolvable, so "the tour created a memory" is unrepresentable
  - a package because the script is byte-identical on both apps (`lint:fsd:layout` R4), and not inside `@cosimosi/sequence`, whose closure stays at `xstate` and `zustand` while captions need `@cosimosi/i18n`
  - this package imports neither `@cosimosi/auth` nor `@cosimosi/account`; the app passes the signup handoff in →!ONB-22
- ONB-16 [o] the tour never acts and relaxes no rule: it issues no RPC, writes no read model, seeds no memory, moves no clock, spends no Twinkle and deletes nothing; every change during a run is the user's own press through the shipped writing flow →!INV-10
  - no onboarding step or anchor may move universe time: the only clock advance during a tour is the real one inside a launch →=TIME-2
  - recall stays paid and consented (→~TWINK-1), the `Diary` stays immutable (→~INV-2), and decoration never touches meaning (→~INV-11, →~DECOR-12)
  - the tour mounts only inside the authenticated subtree, beneath the profile gate →=AUTH
- ONB-17 [o] the tour's vocabulary is closed: `OnboardingAnchor` has exactly five members and `OnboardingSignal` exactly three, and a step naming anything else is a compile error ← a union is checked on every script edit, a review rule is not
  | anchor | composition site | the control |
  |---|---|---|
  | `universe-write-entry` | `pages/universe` | the write affordance |
  | `writing-draft` | `widgets/writing-flow` | body, date and split |
  | `writing-proposal` | `widgets/writing-flow` | the proposed-memory list |
  | `writing-confirm` | `widgets/writing-flow` | launch |
  | `universe-clock` | `widgets/universe-time` | the universe-time HUD |
  - signals: `writing-flow-opened`, `split-succeeded`, `launch-succeeded`
  - deliberately absent: a recall control, a let-go or delete control (→~INV-1), a clock or sync control or signal (→~INV-10), a palette or ornament control, which keeps the tour off the meaning layer (→~INV-11, →~DECOR-12), any control inside a `features/*` slice
  - no anchor names a rendered memory: its position comes out of the force sim and changes every frame, so there is nothing to register or measure →~INV-5
  - guards: exhaustive-`Record` tests pin both unions, and `@ts-expect-error` assertions fail the typecheck the day an absent member becomes spellable
  - the clock anchor wraps the HUD inside `widgets/universe-time`: the page composes that widget as absolutely positioned children, which a page-level wrapper would measure wrongly
- ONB-18 [o] the tour is nine steps, in this order →!ONB-17
  | # | id | anchor | advances on | the caption's meaning (`sequence_tour_<id>_caption`) |
  |---|---|---|---|---|
  | 1 | `welcome` | none | dwell | this is your universe; stars come only from what you write |
  | 2 | `entry` | `universe-write-entry` | `writing-flow-opened` | start here |
  | 3 | `draft` | `writing-draft` | `split-succeeded` | write the day, then split it into stars |
  | 4 | `proposal` | `writing-proposal` | dwell | the names and feelings are guesses; correct what is not yours |
  | 5 | `confirm` | `writing-confirm` | `launch-succeeded` | send them up |
  | 6 | `arrival` | none | dwell | the record lives here now |
  | 7 | `clock` | `universe-clock` | dwell | that date is the universe's time; looking at it does not move it |
  | 8 | `revisit` | none | dwell | a star keeps what you wrote; remembering it again is its own act and costs Twinkle |
  | 9 | `closing` | none | dwell | the tour can be walked again at any time |
  - every caption must hold both for an empty first universe and for a replay over a full one, so no caption quotes a value: no name, count, date or balance
  - a failed split or launch produces no tour-owned error: the caption holds, with no retry and no timeout
  - a past-dated first diary needs no branch: steps 6 and 7 hold whether or not a memory was created, and its notice is the writing flow's →=WRITE
  - step 1 has no anchor, so nothing must be measured before the tour begins
- ONB-19 [o] the tour names recall at step 8 and never performs it ← a recall costs Twinkle and needs sync consent, and a first minute is the wrong place to spend either →~RECALL-9
  - this is the one legitimate difference from the demo, which does walk a recall (→~DEMO-22), and it is a missing union member, never a conditional step
- ONB-20 [o] the writing flow reports what it did through `reportSequenceSignal(signal): void` into a one-slot channel (`useOnboardingSignalStore`), and only the run host turns a report into an `ADVANCE` ← one id in and nothing out, so a reporting site cannot learn whether a tour runs, read a step, or branch on either
  - the three reports come from one effect on the writing-flow machine's real phase transitions (`idle → writing`, `splitting → reviewing`, `launching → done`), never from the request's promise arms: a split resolving after the sheet closed leaves the machine in `idle` and must advance nothing
  - each report carries a strictly increasing nonce, so two identical reports are two writes
  - the host holds a report the current step is not waiting for until the step that waits for it arrives: a user ahead of the caption is not wrong, and dropping it would strand step 2 or 5 forever
  - with no run active a report is inert and cleared, so it never survives into a later run
- ONB-21 [o] the universe page owns the tour's run actor (`useSequenceRun`; web `UniverseHomePage`, mobile `UniversePage`) and mounts `widgets/sequence-guide` over the live scene without remounting the renderer
  - every outcome ends alike: the chrome goes and nothing is recorded; no re-offer and no follow-up prompt
  - leaving the universe ends the run: web by unmounting the page; mobile abandons on blur, because the native stack keeps the screen mounted under `/me` and dwell timers would walk the tour behind it
  - the start is taken as the universe comes into view: on mount on web, on focus on mobile, where a replay requested in `/me` returns to the same mounted screen
- ONB-22 [o] `takeOnboardingStart(signupCompleted)` is the whole exposure policy: a take-once read returning `signup`, `replay` or null →!ONB-3
  - `signup`: the take-once signup-completion handoff (`packages/account/src/signup-completion.ts`), passed in as `takeSignupCompletion()`; it wins when both are pending →=ACCT
  - `replay`: the `/me` row's request; a pending replay is dropped whether or not it wins, so a request whose route never arrived cannot open a tour in a later session
  - the post-signup colour screen consumes the handoff while shown and re-arms it on release, so the tour still receives its trigger; that screen is not a tour step →~ACCT-33
  - a reload during the first tour ends it, since the handoff lives in module memory; the tour stays one tap away in `/me`
- ONB-23 [o] no "already seen" record exists, on the server or the client: no `users` column, no `AccountService` field, no `localStorage` key ← a local flag is per device, turning "once, just after signup" into "once per browser", and the server shape is closed
  - "once" is a property of the trigger: the profile gate makes `SignUp` reachable only while no `users` row exists, so the handoff has no second occasion →=ACCT-32
  - the engine records nothing durable about a run: no history, no seen flag
- ONB-24 [o] tour state is per user: `resetSequenceUserState()` (the anchor registry) and `resetOnboardingUserState()` (a pending replay request and the signal channel) are entries of `@cosimosi/auth`'s user-state reset registry →=CLIENT
  - without them a pending replay would open a tour in the next account's universe, and a stale report would advance it
  - the run itself needs no entry: it lives in a host-owned actor that dies with the host
- ONB-25 [o] the tour ships on web and mobile with no parity waiver: the script, the unions and the start policy are shared verbatim from `packages/onboarding`, each app hand-writing its own `ui` with no `*.native.tsx` sibling →=ARCH
  - known gap: on mobile, React Native's `Modal` presents above the app tree, so the caption, the ring and the skip are hidden for the three dialog-hosted steps (`draft`, `proposal`, `confirm`) →~ONB-26
  - during that gap the run still advances on real signals, and the dialog's own close stays reachable
- ONB-26 [?] how the sequence chrome renders inside the topmost native modal on mobile: a `packages/ui` portal seam, or the native `Dialog` gaining an overlay slot

## flow
- signup: `SignUp` succeeds → handoff recorded → profile gate (colour step: consume, then record again) → universe in view → `takeOnboardingStart`(signup) → steps 1–9 (skip: `skipped`) → `completed` | `skipped` | `abandoned` → chrome gone, nothing recorded
- replay: `/me` row → `requestOnboardingReplay()` → exit to the universe → `takeOnboardingStart`(replay) → fresh `START` from step 1
- report: writing-flow phase transition → `reportSequenceSignal` → channel → host(no run: clear | not awaited: hold | awaited: `ADVANCE`)

## constraints
- the `sequence` values group holds `sequence.caption_dwell_ms` and `sequence.highlight_pulse_ms`, read by both hosts; there is no onboarding group and no anchor-timeout, start-delay or replay-cooldown key
- script content is code, never config: steps, ids, anchor and signal ids, caption keys and `stepCount` (a derived array length); chrome geometry is design tokens and slice-local config →=UI
- onboarding has no BE surface: no proto field, `users` column, RPC or migration →=ACCT
- the engine and the tour speak anchors and captions, never rendering vocabulary →=UL

## chg
- r2 261103 ONB-15✎ "auth → onboarding reset edge"→"imports neither auth nor account"; ONB-22✎ signup handoff `packages/auth`→`packages/account`
- r1 261102 initial
