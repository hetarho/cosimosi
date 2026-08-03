# tech: demo fixtures

> As-built rules for `@cosimosi/demo` — the shipped content the signed-out demo runs on, its resolver contract, and the
> reuse ledger that keeps the demo free of a second implementation of the domain math. Product behavior is owned by
> [plan 77](../plan/77.demo-fixtures-and-mirror.md); the visitor-facing rules are
> [policy/ux/demo.md](../policy/ux/demo.md); architecture placement is owned by
> [ARCHITECTURE.md](../ARCHITECTURE.md) §3.5.

## 1. Runtime home and the dependency guard

```
packages/demo/
├── package.json          @cosimosi/demo — dependencies: @cosimosi/memory, @cosimosi/emotion,
│                         @cosimosi/memory-logic, @cosimosi/config. Nothing else, ever.
│                         @cosimosi/i18n is a devDependency, imported type-only (Locale).
└── src/
    ├── index.ts              the public API — named exports, no wildcard barrel
    ├── diary-set.ts          the DemoDiarySet type: structure half + text half
    ├── diary-sets/*.ts       the three authored sets, one module per set (content)
    ├── diary-sets/index.ts   DEMO_DIARY_SETS — a non-empty tuple
    ├── scenario.ts           DEMO_BEAT_IDS + DemoScenario (the per-set bindings)
    ├── resolve.ts            resolveDemoDiarySet / resolveDemoEpoch / demoBaseStrength
    ├── pick.ts               pickDemoDiarySet(sets, draw01) · demoDiaryPool(set) · pickDemoDiary(pool, n)
    └── integrity.test.ts     the fixture-integrity suite
```

The **dependency list is the isolation boundary** ([I13]), not a review habit: with no
`@cosimosi/api-client`, no `@cosimosi/universe`, no `@cosimosi/twinkle` and no `@cosimosi/store`, the package cannot
issue an RPC, cannot read a server-backed mirror and cannot reach a price. There is no `apps/demo` app root and no
`apps/web/src/entities/demo`: the package is pure, so it is shared by construction, and the web-only mount of `/demo` is
a page-side waiver rather than a property of the fixtures. No other package or app depends on `@cosimosi/demo` —
`pages/demo` is its only importer.

## 2. The structure / text split

| Half          | Holds                                                                                                                                                                               | Reviewed against       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **structure** | set id · neuron ids + `NeuronType` · per-diary day offset · per-diary memory ids · per-memory `Mood` + `intensity` · activation weights · `seed` · synapse rows · `sharedNeuronIds` | [I3] · [I4] · [I6]     |
| **text**      | diary body · memory `name` · `currentText` · four gist-stage texts · N word-loss texts · the recall target's `reconsolidatedText` · neuron display names                            | [I12] + literary voice |

The text half is `Readonly<Record<Locale, DemoDiarySetText>>` over `@cosimosi/i18n`'s `Locale`, and that type **is** the
locale-completeness guard: a `.ts` data module is outside `lint:raw-strings`' reach (it inspects JSX text and a fixed
prop list), so nothing else would catch a set that exists in Korean only. Per-locale _member_ completeness is not
expressible in the type (the text half is keyed by id), so the integrity suite asserts it per locale instead.

A set carries a **tutorial triple plus a non-empty `extraDiaries` free-play pool** (change 10): the extras are
authored against the same neuron roster — each reuses at least one tutorial neuron so a free-play launch joins the
cluster ([I4][L2]) — carry the full text half in both locales, and date past the triple so a free-play launch arrives
as the universe's newest diary. Per-diary draws inside a run come from `demoDiaryPool(set)` (one canonical order:
triple, then extras) via `pickDemoDiary(pool, drawNumber)` — deterministic per draw number, cycling, never
back-to-back repeating ([Z4] as amended by change 10).

Counts are content, never configuration: the pool size is `DEMO_DIARY_SETS.length`, three-per-set is the
`DemoDiaryTriple` tuple's arity, and the extras' depth is `extraDiaries.length` (floored at three by the integrity
suite). This **amends PRD [Z4]**'s parenthetical "(풀 크기·세트 수 = `values.yaml`)" — the `demo:` group holds
exactly one key (`time_travel_month_days`, owned by plan 79), because a count that is the length of a content array
is not a tuning number.

## 3. Fields the fixture may not have

There is no field for a coordinate ([I5]), `EffectiveBrightness`, `EffectiveStrength`, decay depth, a decay
stage-at-a-time, a gist stage-at-a-time, an accessibility cost weight, a `Twinkle` amount or an ornament price. Two
consequences, both structural:

- a second TypeScript implementation of the domain math would have **nowhere to write its output** — the answer to
  [Z6]'s double-implementation licence, which is spent;
- [Z8] holds by absence — no price can render on the demo because no price exists in the data the page reads.

Two values that _look_ like fixture numbers are derived at resolve time instead:

- **`baseStrength`** = `demoBaseStrength(mood)` = `arousalToInitialStrength(createEmotion(mood).arousal)`. The fixture
  authors a mood, and the real relationship produces the number, so the demo shows [I3] rather than a hand-tuned
  strength. It takes the mood alone because that is all the relationship reads — neither valence nor intensity enters.
- **`Neuron.connectivity`** = the neuron's degree over the set's authored synapses (§2.9 #3, [V1]).

`recallCount` opens at 0, `lastRecalledUniverseTime` at `null`, `semanticStage` at 0 and `forgettingOffsetDays` at 0;
the recall beat mutates the page's demo-local copy, never a second fixture variant.

**The word-loss ladder is authored, but it is not permanent.** A recall replaces the memory's reading with the authored
`reconsolidatedText`, and the fixture's ladder is the erosion of the text the memory had _before_ that. So the page's
demo-local copy (`pages/demo/model/use-demo-run.ts`) recomputes the ladder on **every** recall — `decayStageText(text,
stage, seed)` over `forgetting.stage_word_removal_ratios`, the same call the fixtures were authored with — and carries it
beside `currentText` in `DemoMemoryFacts`.

**Every** recall, not only the ones that change the words: the ladder is a function of the text **and** the seed, and a
recall reshapes the seed every time ([V5]). A repeat recall, or the first recall of any memory the fixture wrote no
`reconsolidatedText` for — in free play, most of them — moves the form without moving the words, and the erosion pattern
has to move with it. A memory that has not been recalled keeps the authored strings byte for byte.

Production has the same write shape and needs no such rule: the server regenerates the ladder and the next `GetUniverse`
replaces the mirror. The sandbox has no server and no refetch, which is the entire reason the recompute lives here — a
fixture author should not read this as a licence to hand-edit a rung (§7 #9 still forbids it).

## 4. Time

Diary dates are authored as **integer day offsets** from the set's own start. `resolveDemoDiarySet(set, locale, epoch)`
stamps `diaryDate` / `createdUniverseTime` / `Synapse.lastActivatedUniverseTime` from the `epoch` parameter, and
`resolveDemoEpoch(today, set)` returns `today − span(set)` so the newest fixture diary lands on the visitor's own today.
Two reasons: a fixture with hardcoded 2026 dates would show a visitor in 2029 a stale universe, and every quantity the
reused mirrors compute is a **difference** of dates, so shifting the epoch changes the displayed calendar and nothing
else. The package reads no clock — `today` is a parameter — so a demo time bypass cannot be written here ([I10]; the
demo's mutable clock is plan 79's demo-local state).

`shiftIsoDate` is the one date function this package owns: `Date.parse` + a whole-day offset, sliced back to
`YYYY-MM-DD`. Date-only parsing is UTC midnight, so no timezone can move a diary a day. It is calendar arithmetic, not
domain math — the inverse of `elapsedUniverseDays`' difference, which has no mirror to reuse.

## 5. The resolver contract

`resolveDemoDiarySet` returns exactly what the real read path returns:

- a **`UniverseSnapshot`** (`memories` / `neurons` / `synapses` / `universeTime`) — the same interface
  `universeFromResponse` produces, so `buildUniverseGraph`, the three read-model stores, `starChannels` /
  `cellStarChannels` / `filamentChannels`, `currentDecayStage` / `currentDecayText` and `generateLatentField` all
  receive production input and no demo branch exists below the page;
- a **`Diary[]`** in `packages/memory`'s mirror shape, body verbatim ([I2][D4]);
- a **gist-text sidecar** (`DemoGistTexts[]`) carrying the four gist strings per memory. These are **not** added to
  `EpisodicMemory`: gist text is a paid `ViewSemantic` read, so the production mirror has no field for it, and widening
  the shared type for the sandbox would be an `isDemo` leak into `packages/memory`;
- a **`reconsolidatedTexts`** map, likewise beside the snapshot rather than on the mirror. `reconsolidatedText` is
  optional and authored only on a set's recall target — the one memory the tutorial teaches recall on — because in
  production the equivalent text is whatever the diarist re-narrates through the recall use-case, so there is no second
  text field on the shared type to widen. The integrity suite proves the target carries one in every locale, since a
  recall that changed only the star's form would show reconsolidation as a cosmetic event. Free play (change 10)
  recalls any star; one without the text still re-brightens, re-anchors and reshapes — only the reworded reading is
  the target's own.

`universeTime` resolves to the newest diary's date — the universe's time right after its last launch. Domain shapes are
written straight into the stores, skipping the proto/DTO mappers, so no `bigint`↔`int64` handling and no api-client type
enters the sandbox; `seed` is a literal `bigint`.

## 6. Reuse ledger — nothing here is re-implemented

| Reused from                                | Functions                                                                                                      | Pinned by                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `@cosimosi/memory-logic`                   | `effectiveStrength` · `effectiveBrightness`                                                                    | `synapse-plasticity-golden.json` · `forgetting-decay-golden.json`    |
| `@cosimosi/memory-logic`                   | `slowFactor`                                                                                                   | direct assertions in `effective-values.test.ts` (added by this unit) |
| `@cosimosi/memory-logic`                   | `effectiveElapsedDays` · `decayStage` · `decayDepth` · `decayStageText` · `accessibilityCostWeight`            | `forgetting-decay-golden.json`                                       |
| `@cosimosi/memory-logic`                   | `semanticize` · `gistUnitsElapsed` · `gistCoordinate` · `SEMANTIC_MAX_STAGE`                                   | `semanticization-golden.json`                                        |
| `@cosimosi/memory-logic`                   | `potentiate` · `depress` · `downscale` · `initialStrength` · `applyTemporalBonus` · `effectiveSynapseStrength` | `synapse-plasticity-golden.json`                                     |
| `@cosimosi/memory-logic`                   | `reshape` · `neighborForgettingDelta`                                                                          | `reconsolidation-golden.json`                                        |
| `@cosimosi/memory-logic`                   | `elapsedUniverseDays`                                                                                          | hand-written assertions (`universe-time.test.ts`) — no Go fixture    |
| `@cosimosi/emotion`                        | `arousalToInitialStrength`                                                                                     | `arousal-strength.golden.json`                                       |
| `@cosimosi/emotion`                        | `createEmotion` · `moodCoordinate` · `moodColor`                                                               | their own unit suites                                                |
| `packages/force-sim`, `@cosimosi/universe` | `createForceSimulation().tick` · `buildUniverseGraph` · the render channels · `generateLatentField`            | their own determinism/purity suites                                  |

**The `slowFactor` pin is this unit's pre-work.** The demo's honesty argument ("everything shown is the pinned real
math") only holds if every reused function actually has a pin, so the one member of the read-time family with no golden
case of its own got direct assertions — identity at (0, 0), the negative-input clamp, monotonicity in both arguments and
the `>= 1` guarantee that makes dividing by it always _slow_ a fade — before this package consumed it.
`effectiveBrightness`, `decayStage`, `decayDepth` and the gist timer all inherit that guarantee.

**Genuinely new, and it is data rather than math.** Synapse formation (`memory/link.go`'s `LinkLaunched`,
`computeLinkStrength`, `canonicalPair`, `temporalNear`) has no TS mirror, and the neuron-reuse beat needs synapses, so
**the synapse rows are authored in the fixture.** A fixture cannot drift; a fourth mirrored function can. The guard is
the integrity suite (§7).

**Deliberately not mirrored:** `LinkLaunched` / `computeLinkStrength` / `canonicalPair` / `temporalNear` (authored as
data); `AdvanceClock` / `CanLaunchAt` ([Z2] exempts [I10]; the demo clock is plan 79's plain mutable ISO date);
`ConsumeGistUnits` ([Z5] precomputes all four gist stages, so nothing consumes units);
`Extractor` / `Semanticizer` / `Embedder` ([Z1], UL §5).

The word-loss texts are stored strings in the fixture — as they are stored columns in production — and were produced by
running the real `decayStageText` over each authored `currentText` and `seed`. Authoring them by hand would have shipped
redactions the algorithm does not produce; since change 10 the integrity suite asserts that byte equality across the
whole corpus, so a hand-edited rung cannot ship.

## 7. The fixture-integrity suite

Shipped data cannot drift, but it can be edited into a state where the demo silently stops demonstrating what it
promises. `integrity.test.ts` runs in CI as part of `pnpm test` and fails on:

1. **Cross-diary reuse** — at least one neuron activated from two or more different tutorial diaries, and every
   declared `sharedNeuronIds` member proven to be one (the neuron-reuse beat's precondition; proven over the triple,
   because the beat happens before any extra can have launched).
2. **Link legality** — every authored synapse canonically ordered (`neuronAId < neuronBId`, [I6]), connecting two
   neurons that co-fire in some memory ([I4]), unique per pair, with `strength` inside
   `[synapse.initial_same_memory, synapse.strength_cap]` so the link layer reads at the production scale.
3. **Type coverage** — all three `NeuronType`s present.
4. **Colour headroom, over what is on screen** — the first two diaries (the two launched when the colour beat
   arrives) carry at least three distinct moods and contain the recall target, whose mood is not their
   strength-weighted dominant one ([M4][M5]).
5. **Decay spread** — at the resolved horizon the set's memories occupy at least two distinct `decayStage`s, so word
   loss reads as a gradient rather than one switch.
6. **Split completeness, per locale** — every diary and memory (extras included) has text, every gist ladder is
   `SEMANTIC_MAX_STAGE` long and every word-loss ladder is `forgetting.stage_word_removal_ratios`' length, with no
   blank rung.
7. **Determinism and epoch-only variance** — resolving twice is deep-equal, and resolving at two epochs changes only the
   calendar.
8. **Scenario totality** — the ten beat ids in order, the first diary equal to the pool's own first draw, the recall
   target a member that exists, and every ornament taste carrying exactly `kind` + `ornamentId` whose prefix matches
   its kind (no price field can appear).
9. **Free-play attachment and erosion fidelity** (change 10) — each set ships ≥3 extras, every extra reuses at least
   one tutorial neuron, and every word-loss rung in the corpus is byte-identical to
   `decayStageText(currentText, stage, seed)`; the per-diary draw is deterministic, cycling, and never repeats
   back-to-back.

This is a **fixture-integrity** suite, not a golden-parity one: the math is pinned elsewhere, and what this catches is a
content edit that breaks a set's topology.

## 8. Vocabulary

No rendering word (`star`, `cell-star`, `filament`, `constellation`, `nebula`, `latent-star`) appears in this package —
in a type, a field, an identifier or a comment — and `lint:language` enforces it, since a fixture package is a
domain-mirror surface (§3.4). One consequence worth recording: the fourth [Z3] beat, _뉴런 재사용 → 별자리 창발_, is
identified as **`neuron_reuse`**. The domain half owns the id; the emergent cluster is what the renderer makes of it.

The beat-9 ornament kind travels as a plain `string` on `DemoOrnamentTaste` rather than `@cosimosi/store`'s
`OrnamentKind`, because the dependency list (§1) closes at four domain packages. The page pins the pairing against the
real union where it applies the taste.
