# DEMO demo
> r1 | the signed-out `/demo` trailer: shipped fixture sets played on the real render layers as a step-gated ten-beat tutorial, then free play, walled off so its rule exemption never reaches the real code path

## decisions
- DEMO-1 [o] the demo is signed-out and frontend-only: no auth, no `apps/api` RPC, no DB write, no LLM call ← abuse, cost and privacy problems then cannot arise structurally
  - no AI port is referenced or mirrored (`Extractor`, `Semanticizer`, `Embedder`) →~AI
  - platform telemetry and the app-shell auth-session bootstrap run above every route; they are not product calls and are out of scope
  - `/demo` sits under `rootRoute` beside `/login`, outside the authenticated subtree, with no `beforeLoad` of any kind (no auth guard, no diagnostics gate) →=CLIENT
  - outside the authenticated layout, so `PaletteBootstrap`, `ProfileGate`, `DecorationBootstrap` and `AchievementNoticeHost` never run on it
  - the page imports no router: the app-layer `DemoRoute` hands it `onSignUp`
  - the guarantee is the absence of any way to obtain a transport, not review →!DEMO-10
- DEMO-2 [o] the demo is exempt from the domain rules: time is pushed forward at will, nothing costs Twinkle, any state may change →!INV-13 ← showing in seconds what the product takes days to produce (forgetting, gist rise) is the demo's reason to exist
  - not a violation: the rules never applied here; the price of the exemption is isolation →!DEMO-9
  - exempt in practice: monotone-time guards (→~INV-10), the past-dated launch rule, sync consent, every spend gate
  - "unlimited stardust" is discharged by absence, never by a large number →=DEMO-8
  - every exemption is page state in `pages/demo/model`; none is expressible in shared code →=DEMO-17
- DEMO-3 [o] the demo runs ten fixed beats in order as a step-gated tutorial on the real controls, and the visitor performs each one →!ONB-1
  | # | beat id | what the visitor does (anchor) | advances on | what it shows |
  |---|---|---|---|---|
  | 1 | `diary_appears` | reads the drawn diary (`diary-read-action`) | `diary_read` | a prepared diary, already open as the write flow's draft |
  | 2 | `split` | splits (`split-action`) | `split_revealed` | the authored split: memories, names, moods, neurons; no LLM call |
  | 3 | `launch` | launches (`launch-action`) | `launched` | the memories go up and awaken; the clock lands on the diary date |
  | 4 | `neuron_reuse` | writes (`write-action`), then splits and launches | `launched` | one more prepared diary through the same flow; its shared neurons pull the cluster together |
  | 5 | `time_accelerates` | +1 month (`time-month-action`) | `time_advanced` | the sweep: stars dim and words erode |
  | 6 | `recall` | recalls the staged target (`recall-action`) | `recalled` | the recall walk; the memory brightens, reshapes and its words return |
  | 7 | `gist_rise` | +1 month (`time-month-action`) | `gist_risen` | unrecalled memories climb gist stages; gist bodies rise into the neocortex band |
  | 8 | `color` | nothing | dwell | the caption names the sky's colour already overhead |
  | 9 | `ornament_taster` | decorates (`decorate-action`), then picks a catalog row | `decorate_closed` | the decoration round trip |
  | 10 | `signup_cta` | nothing | dwell | the caption names the signup corner over a room already open |
  - `DEMO_BEAT_IDS` (`packages/demo/src/scenario.ts`) fixes the order; a beat id is an identifier union, not a new noun (the engine's noun is `SequenceStep`)
  - beat 4 is `neuron_reuse`, never a rendering word: the domain half owns the id, the cluster is what the renderer makes of it
  - by the colour beat exactly two diaries have launched
  - the script (`pages/demo/model/script.ts`) is a `SequenceScript<DemoAnchor, DemoSignal>` over host-owned unions that name only the demo's own controls and outcomes, so a typo or a foreign control is a compile error
  - the tour starts on every entry →=ONB-3; skip is always available →=ONB-4; the tour ends in free play →=DEMO-24
- DEMO-4 [o] the diary pool is hardcoded and entry randomness is set-granular: one `DemoDiarySet` is drawn per entry →~LINK-2 ← independently drawn diaries share no neuron, so beat 4's cluster would never form
  - `pickDemoDiarySet(sets, draw01)` is pure and total over [0, 1) (out of range or NaN clamps); the page supplies `Math.random()` once per entry
  - inside a run the write control draws one prepared diary at a time from `demoDiaryPool(set)`: the tutorial triple first, then the set's free-play extras
  - `pickDemoDiary(pool, drawNumber)` is deterministic per draw number, cycles, and never repeats back-to-back; beat 1 shows draw 0 and beat 4 draws the authored second diary
  - one draft at a time: a draw while a draft is open draws nothing, so a double press cannot skip the diary beat 4 was designed around
  - a cycled re-draw of an already-launched diary launches nothing and reports nothing
  - counts are derived array lengths, never `values.yaml` keys: sets = `DEMO_DIARY_SETS.length` (a non-empty tuple), three per set = the `DemoDiaryTriple` arity, extras = `extraDiaries.length`
  - three per set is structural: two diaries cannot show reuse convincingly and four dilute the beat
- DEMO-5 [o] every split is authored and shipped: the same diary always yields the same memories, names, moods, neurons, gist texts and word-loss texts; only which set is drawn varies between runs
  - authored per memory: `name`, `Mood` + intensity, neuron activation weights, `seed`, `currentText`, the four gist-stage texts, the word-loss ladder
  - no generator, no PRNG and no clock in `@cosimosi/demo`: the set draw, the epoch and today are parameters, so determinism is structural rather than reviewed
  - word-loss ladders are byte-identical `decayStageText(currentText, stage, seed)` outputs, never hand-edited →!DEMO-14
  - a demo recall reshapes deterministically too: its entropy derives from the set id and the recall index, so the same set replayed reshapes the same way →~DEMO-22
- DEMO-6 [o] the demo re-implements no domain function: every derived value it shows comes from the shared golden-pinned mirrors ← a demo-only formula is a demo-only rule, and the TS mirrors already exist, pinned to the Go fixtures
  - reused: `@cosimosi/memory-logic` (strength, brightness, `slowFactor`, decay stage, depth and text, gist units and stages, plasticity, `reshape`, elapsed days), `@cosimosi/emotion` (`createEmotion`, `arousalToInitialStrength`, `moodColor`)
  - also reused: `@cosimosi/universe` (graph, render channels, sky slices, latent field) and `packages/force-sim`
  - every reused function carries a pin: a golden fixture (→~FORGET-13, →~CONSOL-14), or direct assertions (`slowFactor`, `elapsedUniverseDays`) →=ARCH
  - not mirrored: synapse formation (`LinkLaunched`, `computeLinkStrength`, `canonicalPair`, `temporalNear`); its rows are authored data instead, because data cannot drift and a fourth mirror can
  - not mirrored either: `AdvanceClock` and `CanLaunchAt` (the demo clock is a plain date), `ConsumeGistUnits` (gist texts are precomputed), the AI ports
  - guards: the fixture has no field for a computed value →!DEMO-13; `lint:fsd:layout` R4 fails a copy-pasted pure module
  - `@cosimosi/twinkle-logic` is not reused: no cost figure is ever surfaced →=DEMO-8
- DEMO-7 [o] nothing made in the demo carries over: leaving it, or signing up from it, starts from a genuinely empty universe →!ACCT-2
  - nothing is ever written to storage, a URL or a server, so there is nothing to persist or migrate
  - entering and leaving both run `resetUniverseUserState()` (every module-level universe store: read models, clock mirror, awaken registry, latent-consumed store); leaving also runs `resetMoodPalette()`
  - the entry reset is why every entry and every start-over plays the awaken choreography again
  - the leave reset is why a tried palette cannot bleed into the landing or a later session
  - no entry in the shared user-state reset registry: the demo mounts no server-backed mirror and cleans up at its own boundary; `PaletteBootstrap` re-applies the account palette on sign-in →=CLIENT
  - the way out the demo offers is the signup CTA, a navigation that hands nothing to the account →~DEMO-33
- DEMO-8 [o] no currency, price, cost, quote, purchase, achievement or payment surface appears on the demo; ornaments are tried on, never sold ← a free trial that smells of money is worse than none
  - "unlimited stardust" is discharged by absence: no balance, cost or spend gate is rendered or reachable; a balance on a page that never charges is noise at best and a payment smell at worst
  - the absence is structural: the fixture holds no price, Twinkle amount, ornament or achievement data (→=DEMO-13), and the import closure bans every path to a price, a balance or the achievement mirror →!DEMO-10
  - the decoration sheet takes catalog names from `@cosimosi/store/i18n` only (id→name map and group titles); the store barrel, which carries `ornamentCost`, `unownedTotal` and `Decorate`, is banned
  - the renderer key comes from a local helper (`ornamentRendererKey`), not the store's `ornamentRegistryKey`
  - the product decoration panel's preview store is not used: it is coupled to the save flow and the unowned total
  - no achievement can surface: `AchievementNoticeHost` mounts only inside the authenticated subtree `/demo` sits outside, so the demo never fetches the list →~ACH-5
- DEMO-9 [o] no demo bypass exists in real code: the sandbox lives in `apps/web/src/pages/demo` and `packages/demo`, and shared code does not know a demo exists →!INV-13 ← one demo branch in shared code would let free time and no cost hold for real accounts too
  - no `isDemo` flag, prop, parameter or branch in `packages/*`, `features/*` or `entities/*`: a standing ban, discharged by adding none
  - no `apps/demo` app root (it would duplicate the renderer host, build and deploy for a page whose value is the real renderer) and no `entities/demo`
  - no shared type widens for the sandbox: what the mirror lacks travels beside it (→=DEMO-16) or in page state (→=DEMO-17)
  - shipped widgets fused to the transport are twinned read-only inside `pages/demo`, never handed a demo prop →=DEMO-29
- DEMO-10 [o] `pages/demo` cannot obtain a transport: one `no-restricted-imports` block on `src/pages/demo/**` in `apps/web/eslint.config.js`, read as a closure, not an allowlist →!DEMO-1 ← every RPC function takes an `ApiTransport` and every hook hiding one calls `useTransport()`, so starving the page of both closes every call path
  | banned | what it closes |
  |---|---|
  | `@connectrpc/*` | the only source of `useTransport()` |
  | `@cosimosi/api-client`, `@cosimosi/client-cache` | the generated clients and the query/cache seam |
  | `@cosimosi/{universe,twinkle,memory,store,achievement}/react` | the server-backed read mirrors |
  | `writeMoodColor`, `readMoodColors`, `readMoodColorRecommendations`, `useMoodColorEditor` of `@cosimosi/emotion/react` | colour reads and writes that reach `AccountService` |
  | `@cosimosi/twinkle`, `@cosimosi/twinkle-logic`, the `@cosimosi/store` barrel | balances, cost formulas, prices, ownership, `Decorate` |
  | `widgets/*`, `features/*`, `entities/*` | the normally legal page→widget edge; the demo composes `packages/*` directly |
  - open by carve-out: `widgets/sequence-guide` and `features/highlight-next-control` (the sequence chrome; `@cosimosi/sequence` depends on `xstate` and `zustand` only), `@cosimosi/store/i18n`, `applyMoodColors`
  - flat config replaces rule options per file, so the block restates the general `three`/`@react-three/fiber` and `@cosimosi/i18n` bans
  - guard: `scripts/probe-demo-isolation.mjs` (`pnpm lint:demo:probe`, part of `pnpm test:guards`) proves every forbidden import is reported and every permitted one is not
- DEMO-11 [o] `@cosimosi/demo` (`packages/demo`) is a pure package whose dependency list is its isolation boundary: it cannot issue an RPC, read a server-backed mirror or reach a price →!INV-13
  - dependencies exactly `@cosimosi/emotion`, `@cosimosi/i18n` (type-only `Locale`), `@cosimosi/memory`, `@cosimosi/memory-logic`; `@cosimosi/config` is dev-only (the integrity suite reads `VALUES`); no peer dependencies
  - guard: the integrity suite's package-isolation test pins that list; an addition must first answer why it cannot reach a transport, a price or a read mirror
  - no React, no store, no IO, no clock, no randomness
  - `pages/demo` is its only importer; the landing's own import block bans it (the landing links to `/demo` by route path) →~MKT
  - pure, so shared by construction: the web-only mount of `/demo` is a page-side waiver, not a property of the fixtures →~DEMO-35
- DEMO-12 [o] a `DemoDiarySet` is a tutorial triple plus a non-empty free-play pool (`extraDiaries`), authored as a locale-free structure half and a per-locale text half
  | half | holds | reviewed against |
  |---|---|---|
  | structure | set id, neuron ids + `NeuronType`, per-diary day offset, memory ids, per-memory `Mood` + intensity, activation weights, `seed` (a `bigint` literal), synapse rows, `sharedNeuronIds` (non-empty tuple), `scenario` | →~INV-3/4/6 |
  | text | diary body, memory `name`, `currentText`, four gist-stage texts, the word-loss ladder, `reconsolidatedText`, neuron display names | →~INV-12 and the restrained literary voice |
  - every extra activates at least one tutorial neuron, so a free-play launch joins the cluster; its day offset lies past the triple's, so it arrives as the universe's newest diary
  - the text half is `Readonly<Record<Locale, DemoDiarySetText>>`: a set missing a supported locale fails typecheck, because a `.ts` data module is outside `lint:raw-strings`; per-locale member completeness is the integrity suite's
  - fixture text is content, never message keys; `demo_*` keys belong to the captions and controls
  - `reconsolidatedText` is optional and authored only on the scenario's recall target
  - `scenario` (`DemoScenario`) binds `beats` (= `DEMO_BEAT_IDS`), `firstDiaryId` (the pool's draw 0) and `recallMemoryId`; it carries no copy, i18n key, anchor, dwell, engine type, price or ornament id
- DEMO-13 [o] the fixture has no field for a derived or priced value: no coordinate, `EffectiveBrightness`, `EffectiveStrength`, decay depth, decay or gist stage-at-a-time, accessibility cost weight, Twinkle amount, ornament price, ornament data or achievement data ← a second implementation then has nowhere to write its output, and a price cannot render where none exists
  - no coordinate even in a sandbox exempt from the invariants: positions stay emergent from the force sim →~INV-5
  - `baseStrength` is derived at resolve time as `demoBaseStrength(mood)` = `arousalToInitialStrength(createEmotion(mood).arousal)`: the mood alone, neither valence nor intensity →~INV-3
  - `Neuron.connectivity` is derived at resolve time as the neuron's degree over the set's authored synapses
  - memories resolve unrecalled: `recallCount` 0, `lastRecalledUniverseTime` null, `semanticStage` 0, `forgettingOffsetDays` 0; the run mutates its own copy, never a second fixture variant
- DEMO-14 [o] a set ships only if the fixture-integrity suite (`packages/demo/src/integrity.test.ts`, run by `pnpm test` through `test:demo`) passes ← shipped content cannot drift, but it can be edited into a set that silently stops demonstrating
  | check | fails when |
  |---|---|
  | cross-diary reuse | no neuron is activated from two or more tutorial diaries, or a declared `sharedNeuronIds` member is not one (proven over the triple: beat 4 precedes every extra) |
  | link legality | a synapse is not canonical (`neuronAId < neuronBId`), joins neurons that never co-fire in a memory, repeats a pair, or lies outside `[synapse.initial_same_memory, synapse.strength_cap]` |
  | type coverage | a `NeuronType` is missing |
  | colour headroom | the first two diaries carry fewer than three moods, or lack the recall target, or the target's mood is their `demoBaseStrength`-weighted dominant one |
  | decay spread | the set's memories do not occupy at least two `decayStage`s at the resolved universe time |
  | split completeness | text is missing in a locale, a gist ladder is not `SEMANTIC_MAX_STAGE` long, a word-loss ladder is not as long as `forgetting.stage_word_removal_ratios`, or a rung is blank |
  | determinism | resolving twice differs, or two epochs differ in more than the calendar |
  | scenario totality | beats differ from `DEMO_BEAT_IDS`, the first diary is not draw 0, or the recall target is missing or lacks a `reconsolidatedText` in a locale |
  | free-play attachment | a set ships fewer than three extras, or an extra reuses no tutorial neuron |
  | erosion fidelity | a word-loss rung differs from `decayStageText(currentText, stage, seed)` |
  | draws | the set draw is not total, or the per-diary draw is not deterministic, does not cycle, or repeats back-to-back |
  | package isolation | the dependency list differs →=DEMO-11 |
  - colour headroom exists so that the tutorial's recall visibly moves the sky the colour beat names →~DEMO-32
  - fixture integrity, not golden parity: the math is pinned where it lives →~DEMO-6
- DEMO-15 [o] fixture dates are integer day offsets stamped from an `epoch` parameter, so the newest fixture diary lands on the visitor's today ← hardcoded dates go stale, and every reused quantity is a difference of dates, so the epoch moves only the calendar
  - `resolveDemoEpoch(today, set)` = today minus the set's span, the largest day offset over the triple and the extras
  - today is the browser's UTC date, read once per entry at the page boundary; the package reads no clock
  - dates are date-only UTC-midnight values; `shiftIsoDate` is calendar arithmetic, not domain math →~TIME-7
  - `resolveDemoDiarySet(set, locale, epoch)` stamps `diaryDate`, `createdUniverseTime` and `Synapse.lastActivatedUniverseTime` from the epoch
- DEMO-16 [o] the resolver returns exactly the shapes the real read path returns, so no demo branch exists below the page →!DEMO-9
  - a `UniverseSnapshot` (`memories`, `neurons`, `synapses`, `universeTime` = the newest diary date), the interface `universeFromResponse` produces
  - a `Diary[]` in `packages/memory`'s mirror shape (the `diariesFromDtos` output), body verbatim →~INV-2
  - a gist-text sidecar (`DemoGistTexts[]`) and a `reconsolidatedTexts` map travel beside the snapshot, never on `EpisodicMemory`: gist text is a paid `ViewSemantic` read in production, so the shared mirror has no field to widen
  - domain shapes go straight into the three read-model stores, skipping the proto/DTO mappers: no `bigint`↔`int64` handling, no api-client type
  - extras resolve exactly like the triple: below the resolver a free-play diary is indistinguishable from a tutorial one
- DEMO-17 [o] the whole sandbox is one piece of page state (`useDemoRun`, `pages/demo/model/use-demo-run.ts`) that stores facts only and dies with the route →!DEMO-9
  - facts: the drawn set and its resolution, the write draft, the draw cursor, the launched diaries, per-memory `DemoMemoryFacts`, the clock, the decoration taste
  - `DemoMemoryFacts`: recall count, last-recall time, seed, current words, word-loss ladder, gist-timer anchor, reached gist stage; the gist-timer anchor has no field on the shared mirror
  - every derived quantity (brightness, size, eroded words, gist stage and coordinate, sky blend) is computed downstream by the shared functions from those facts; free play only ever moves facts
  - the scene holds only launched memories and the neurons they activate
  - the episodic-memory store holds each memory's gist stage at its high-water mark (→~CONSOL-16): the demo's stages never fall within a run, and the entry and leave resets release that floor between runs →~DEMO-7
- DEMO-18 [o] an edge appears only once its two neurons have co-fired in a memory that has launched →~LINK-2 ← the server's formation rule on the launched subset; "both endpoints exist" would draw every authored edge after one diary and leave beat 4 nothing to add
  - memory↔memory edges cannot exist: synapses are neuron pairs, and the graph builder drops endpoints outside the neuron set →~INV-4/6
- DEMO-19 [o] the demo clock is a plain mutable ISO date in the run state, passed down as the `universeTime` the render layers already accept; it never touches the real clock →!DEMO-17
  - opens on the first diary's own date, so the first memories go up vivid and time has somewhere to travel from
  - three forward jumps: day = 1 and week = 7 universe-days (fixed calendar units in `DEMO_TIME_JUMPS`), month = `demo.time_travel_month_days`
  - those three are the only time controls: no single opaque nudge, and no batch control that adds diaries; diaries arrive one at a time through the write flow
  - free, unmetered and uncapped: no monotonicity check, no launch precondition, no sync consent, no cost
  - a launch lands the clock on the diary date and never rewinds it, mirroring the server's launch so free play reads true; it is not a guard →~TIME-2
  - a drawn diary dated before the clock still launches, and its memories arrive already aged →~TIME-1
  - never writes the real clock mirror (`useUniverseClockStore`) or the advance stores; the only universe stores the demo writes are the three read models
- DEMO-20 [o] every forward move of the demo clock (a jump, or a launch that moves it) plays the product's passing time demo-locally: the displayed date sweeps previous → current and the stars dim in front of the viewer, never a bare date swap →~TIME-19/20
  - `DemoTimePassing` drives it with the pure sweep helpers of `@cosimosi/universe` (`advanceSweepFrame`, `advanceSkyRate`, `advanceSkyRateFor`); the layers project at the sampled date
  - `UniverseTimeOverlay` is never mounted: it is wired to the advance-announcement and consent stores the demo must not reach
  - the data path commits the clock at once; only the displayed date walks
  - reduced motion skips the sweep and lands on the final date, never slows it; unmounting mid-sweep resets the sky rate
  - the HUD clock (`DemoTimeHud`) is the label `demo_time_hud_label` and the displayed date, with no control →~TIME-6
- DEMO-21 [o] gist stages rise only with time the visitor pushes: a launch's clock jump shifts every gist-timer anchor by the jump, and launched memories start their timers at the arrived clock ← a gist popping because a diary was written reads as a bug
  - each memory's stage is `semanticize` over `gistUnitsElapsed` from its own anchor on the demo clock: per memory, never a scripted id →~CONSOL-9
  - a recall re-anchors the timer and keeps the reached stage as `semanticStageFloor`: it delays the next stage and never lowers a risen one
- DEMO-22 [o] demo recall is per memory, repeatable and free (no quote, no consent, no balance, nothing that can fail) and walks the product recall flow's three steps: the faded words, the sentence sent back, what came back →~RECALL
  - effect: recall count +1, last recall = the demo clock, seed reshaped (`reshape`), `currentText` replaced by the authored `reconsolidatedText` when one exists, gist timer re-anchored
  - eroded words come back by re-render, not rewrite: the last-recall anchor resets elapsed time, so the decay stage reads 0 again →~FORGET-5
  - the word-loss ladder is recomputed on every recall (`decayStageText` over `forgetting.stage_word_removal_ratios`), since it depends on the text and the seed and the seed reshapes every time →~FORGET-9
  - a never-recalled memory keeps the authored ladder byte for byte
  - the rewrite field is read-only and prefilled with what goes back (the reconsolidated text, else the current words): a box whose contents were silently discarded would be dishonest
  - the diary body is never rewritten →~INV-2
  - the recall sheet steps down while the memory brightens and reshapes on the canvas, then returns with the result
- DEMO-23 [o] the run's phase is one XState machine, `demoRunMachine` (`pages/demo/model/run-machine.ts`): `tutorial(<beat>)` steps beat by beat into `freePlay`, which no transition leaves; `SKIP` reaches it from every beat →!DEMO-3
  - every tour control's pressability derives from this machine alone (`isDemoAnchorInteractive`): while the tutorial runs only the current beat's controls are pressable, the rest render disabled
  - skip, the signup CTA and start-over are not tour controls: they sit above the gate →~DEMO-33
  | beat | pressable while it runs |
  |---|---|
  | `diary_appears` | the diary card and its read control |
  | `split`, `launch` | that one control |
  | `neuron_reuse` | the whole write flow: write, split, launch |
  | `time_accelerates`, `gist_rise` | the month jump |
  | `recall` | recall, on the scenario's target memory only |
  | `color` | nothing |
  | `ornament_taster` | the decorate control and every catalog row |
  | `signup_cta` | the whole room |
  - `syncDemoRunMachine` is the one seam that walks the phase in step with the sequence engine (N advances → N `NEXT`, skip or abandon → `SKIP`, completion → the final `NEXT`); idempotent
  - the gate is the demo's own layer over the engine, whose chrome stays non-modal →=ONB
  - skip sits above the gate, always visible and pressable →=ONB-4
- DEMO-24 [o] completing the last beat or pressing skip moves the run to free play for good: every control opens and no tutorial chrome lingers →!DEMO-23
  - the write control keeps drawing prepared diaries, cycling through the pool, through the same entry → split → launch walk; a dismissed sheet reopens on the write control with its draft
  - the three time grains, per-memory repeatable recall, per-memory gist timers and decoration stay open in any order
  - a picked memory's panel shows its eroded current words at the demo clock, and its own diary opens verbatim from there
  - the free camera mounts →=DEMO-30
  - nobody has to finish the tour to see the point, and nobody is asked to confirm leaving
- DEMO-25 [o] the tutorial covering is one page-level mask (`DemoTutorialMask`), dimmed hard and blurred lightly, with one hole around the union of the current beat's pressable controls ← a page of individually faded widgets does not read as covered
  - purely visual (`pointer-events: none`): pressability stays the run machine's, and the mask paints below the sequence chrome (ring, caption, skip)
  - no hole, no mask: a beat that opens nothing (the colour beat), the whole-room beat and free play play unmasked
  - while the scene speaks (a launch's awaken, every time sweep, a completed recall's reshaped star) the mask lifts by fading without unmounting; the next beat's caption and ring hold back, and a surface the beat would stage waits
  - it returns `demo.reveal_hold_ms` after a launch or recall (the hold is the whole reveal) and `demo.sweep_settle_ms` after a sweep (the sweep already had the screen)
  - pressability never rides the lift, and the skip never blinks out
- DEMO-26 [o] a time jump reports `time_advanced` and `gist_risen` when its sweep lands, not when pressed; the engine advances on the one its current beat waits for and drops the other ← reported at the press, the next beat's caption arrived under the lifted mask and a dwell-only beat spent its whole dwell unread
  - a jump with nothing to walk, or under reduced motion, reports at once
  - `launched` reports from the press: a launch has a path with no sweep, and every beat it hands to waits on a press of its own
  - `recalled` reports when an applied recall walk closes (dismissing early leaves the beat open); `decorate_closed` when the decoration sheet closes
  - no step fires its own signal on arrival, which would advance the run in the commit that starts it and leave the caption unread; the colour and closing beats therefore dwell (`sequence.caption_dwell_ms`) →~ONB
- DEMO-27 [o] the ring always circles a control, never a region, and walks with the visitor through a beat whose work is a flow (a page-side override of the guide's rect)
  - neuron reuse: the write control, then split, then launch
  - recall: the panel's recall control, then confirm, then the way out; pressing recall closes the panel that held the beat's anchor
  - decorating: the decorate control, then a catalog row, then the ring stands down for the trip out, because the sheet's own close belongs to a shared primitive the page cannot anchor; the caption carries that leg
  - the opening beat uncovers the whole diary card and rings only its read control
  - the page re-measures whenever the phase, the draft or a sheet moves the layout; the engine re-measures only when an anchor mounts or unmounts
  - one DOM renders every width, so no anchor id registers twice
  - the page names no caption room: the guide reads the screen and clears whatever surface owns the bottom edge →~ONB
- DEMO-28 [o] the visitor acts, the tour points and waits: every beat advances on a press of the real control, and nothing is performed on the visitor's behalf →~ONB-2
  - the tour may stage a surface: the opening diary arrives already open, and the recall beat arrives with its target memory's panel open, because finding one star among look-alikes is a search no caption can help with
  - the staged recall panel waits for the month jump's sweep to settle, then comes up with the caption; dismissing it before the walk starts selects the target again
  - the staged recall panel never returns once the target has been recalled, which is read off the memory, not a flag
  - a sheet a beat is staged inside cannot strand it: the write sheet's dismiss is inert until the write control could reopen it, the decoration sheet's close until something was tried on
- DEMO-29 [o] the demo teaches the screen the product ships: its HUD and surfaces are read-only twins of the product's, diverging only where the sandbox cannot honestly carry the product's thing →!DEMO-9
  - HUD = the home screen's arrangement: the clock centred over the sky as bare type (from `sm`; on a phone it keeps left because the skip owns the top-right), a borderless icon column at the right edge, the write action alone at the bottom, outlined
  - divergences: no balance (→=DEMO-8), no archive (no route; a memory's diary opens from its panel), time jumps under the clock as quiet text buttons, signup and start-over top-right
  - write flow: the product dialog and `writing_flow_*` labels, split → proposal rows (name, mood chip, source passage, neuron chips) → launch, read-only with no revise and no error arm; a launch closes the dialog before the memory goes up
  - a picked memory opens a star-detail twin: the star in its own frame at the demo clock, meta rows from the shipped read-time functions, current words with the forgetting shown (`currentDecaySpans`), two labelled actions: recall and the original diary
  - `DemoEntryReader` is the read-only twin of the opened diary entry (→~DIARY-19): a dialog titled by the diary date, the body verbatim, its memories as mood chips, and no action slot; the demo has no archive route and calls no archive RPC
  - one surface at a time: each opens by closing the one it came from, so the canvas is never under two scrims
  - picking a star or its gist body on the canvas is the one way into its panel; the demo has no gist-view twin and shows no gist text →~CONSOL-20
- DEMO-30 [o] the demo mounts its own canvas host (`DemoUniverseScene`) over the real render layers and the real force sim, composed like the product universe widget →=VIS
  - the layer set is the product widget's (`UniverseCanvasWidget`), not the `/test` bench's, inside `SkinProvider` (the active skin) and one `UniverseCanvas`
  - positions come from `createUniverseSimBridge(null)` (the inline main-thread bridge, no worker) fed by `buildUniverseGraph` and pumped by `FrameTick`; nothing is persisted →~INV-5
  - it owns the three read-model stores while mounted
  - the camera belongs to free play: `CameraControls` (free fly-around) replaces `NavigationRig` and mounts only in free play, so the ring and the hole always point at the scene the caption describes
  - bloom and `camera.fov` stay the skin's
  - never mounted on `/demo`: `UniverseCanvasWidget` (its `useUniverse()` throws unauthenticated), `StardustOverlay`, `UniverseTimeOverlay`, `WritingFlowSheet` (its split is an LLM call), `RecallFlowSheet`, `DeletionFlowSheet`, `DetailPanel`'s provenance and gist reads
- DEMO-31 [o] decorating opens a twin of the product decoration panel with the money removed: same groups and headings, the full catalog by name, apply-on-select against the live universe; no price, no ownership, no save →!DEMO-8
  - every catalog kind the product panel groups by is a group (a kind the demo forgot is a type error); the feeling's colour is one more group, not an ornament kind →~DECOR-10
  - a selection holds; a default row (`demo_decorate_default`) heads each group as the way back
  - the renderer key is the part after the dot of a `<kind-prefix>.<key>` catalog id
  - the background sets `SkySphere`'s effect directly, never `setSkinKey`: a skin swap would also move bloom and `camera.fov`
  - the feeling's colour applies through `applyMoodColors` (the module-level palette, no server) and reverts through `resetMoodPalette`
  - it changes the sky, the shape a memory or gist takes and the backdrop motes, never a memory's position, size, brightness, emotion or seed →=INV-11
  - the beat is the whole round trip: open, try something on, come back out to the changed universe; nothing is decorated on the visitor's behalf →~VIS-10
- DEMO-32 [o] the sky carries the universe's colour from the first launch: `EffectiveStrength`-weighted emotion shares over the launched memories (`universeEmotionSlices`), so the tutorial's recall has moved it before the colour beat names it →=MOOD-5 ← a night sky under risen stars reads as a failed renderer, and a visitor who skips early would never see it
  - an empty universe opens on the night
  - the colour beat applies nothing: its caption states the honest definition (the colour mirrors the emotions re-read, not an average); the demo is one of the two surfaces MOOD-5 makes responsible for saying so →~MOOD-4
- DEMO-33 [o] the signup CTA and the start-over control sit outside the tour: top-right under the skip's corner, never highlighted, never gated, with no anchor id ← a highlighted signup control would read as the tour ending by leaving
  - the closing beat rings nothing: its caption names the corner over a room already open, and the visitor leaves when they choose
  - the CTA navigates to `/signup` through the route wrapper's `onSignUp` →~ACCT
  - start-over re-keys the run: a fresh draw, the tour from beat 1, stores cleared by the same unmount cleanup, so a reset cannot differ from an arrival
- DEMO-34 [o] every sentence on the demo is a message key reviewed against INV-12: `demo_*` keys name a UI role, exist in every locale and pass `lint:raw-strings`; a twin reuses the product's own key for a product control →!INV-12
  - captions are zero-argument accessors in an exhaustive `Record<DemoBeatId, …>`: a beat without a caption is a compile error
  - mood labels reuse `moodLabel`; no `mood_*` keys
  - no standing theory note on the page: honesty is the review of every sentence, and the inspired-by framing with its denial belongs to the landing →~MKT
  - no sentence may let the visitor conclude they are looking at a brain: no "works like a brain", no positions as the brain's coordinates, no therapeutic claim
  - voice: restrained and literary, no translation-ese, no decorative emoji, no sales pressure; fixture text reads as entries someone wrote
- DEMO-35 [o] `/demo` is web-only by explicit waiver: a Visitor surface reached from the landing page, and the Visitor gets web-funnel behaviour only →~MKT-3
  - stated in writing because `lint:fsd:layout` does not enforce web↔mobile page peering, so an unstated waiver is a silently broken rule →=ARCH
  - `steiger` needs no exemption for `pages/demo`: a page slice is not an insignificant slice
  - the fixture package raises no parity question: it is pure and shared by construction

## flow
- run: entry(set draw, epoch from today, stores reset) → tutorial beats 1–10 (skip: free play) → free play → exit(signup CTA: `/signup` | start-over: entry | leave: stores and palette reset)
- write: write control → draft from the pool(draft open: no draw) → split → launch(already launched: nothing | clock moves: sweep | same day: awaken hold) → `launched`
- time jump: press → clock commits → sweep(nothing to walk or reduced motion: none) → `time_advanced` + `gist_risen` → mask returns after `demo.sweep_settle_ms`
- recall: target panel(staged during the tutorial) → recall walk → confirm(memory reshapes on the uncovered canvas) → result → close → `recalled`

## constraints
- the `demo` values group holds `demo.time_travel_month_days`, `demo.reveal_hold_ms` and `demo.sweep_settle_ms`; nothing else on the demo is a tuning scalar: beats, captions, counts, day offsets and fixture numbers are content
- the demo reads physics values from their owners' groups (`forgetting.*`, `semantic.*`, `synapse.*`, `reconsolidation.*`, `rendering.*`, `force_sim.*`) and no `twinkle.*` key; caption dwell is `sequence.*` →=ONB
- no rendering word (`star`, `cell-star`, `filament`, `constellation`, `nebula`, `latent-star`) appears in `packages/demo` in a type, field, identifier or comment (`lint:language`) →=UL
- the demo runs on the shared sequence engine and chrome (`@cosimosi/sequence`, `widgets/sequence-guide`, `features/highlight-next-control`); demo and onboarding differ only in the injected script and data →=ONB-1

## chg
- r1 261102 initial
