# tech: memory encode & MemoryService

> As-built rules for the encode use-cases (`Encode`/`ReviseSplit`/`PersistEncoded`) and the `memory.v1.MemoryService`
> contract. Plan [20](../plan/20.encode-usecase.md) owns the product behavior; the schema-forced-boundary and dedup
> policy live in [policy/encode-boundary.md](../policy/encode-boundary.md).

## 1. Contract (`proto/cosimosi/memory/v1/memory.proto`)

`memory.v1.MemoryService`, Connect unary:

- `SplitDiary` / `ReviseSplit` — synchronous previews; they invoke the LLM (cost-metered, **not** `NO_SIDE_EFFECTS`)
  and persist nothing. `ReviseSplit` intentionally returns `SplitDiaryResponse` (a revise re-enters the same preview
  loop, so chained revises feed `previous` without conversion); buf lint's `RPC_RESPONSE_STANDARD_NAME` /
  `RPC_REQUEST_RESPONSE_UNIQUE` are `ignore_only`-scoped to this file in `buf.yaml`.
- `LaunchStars` — persist-and-launch; handler calls `PersistEncoded`. Optimistic response: `memory_ids` +
  `new_neuron_ids` only (§2.8) — `new_neuron_ids` are the genuinely created neurons (newness is a server-only
  decision, consumed by plan 25's awaken animation).
- `GetUniverse` — the per-user read (shape owned by plan 23): stored facts only, `NO_SIDE_EFFECTS` (HTTP
  GET-eligible), never shared-CDN-cached. `universe_time` is derived as the max `created_universe_time` over the
  memories in the same `REPEATABLE READ` snapshot (Epic A derivation; the `universe_state` clock is Epic B); empty
  until the first launch.

`ProposedMemory`/`ConfirmedMemory` carry `{name, mood, source_text, neurons}`. `source_text` is the diary passage the
memory was encoded from, in the writer's own words; it is the only prose the encode contract carries and the [W4a]
boundary is otherwise unchanged — still no position, color, strength, seed, universe-time, or delete field.

Dates cross the wire as ISO `YYYY-MM-DD` strings; the handler parses with `time.DateOnly` and the pg adapter stores
`DATE`. All four RPCs resolve `platform.UserScope` from the auth context; none is in `publicProcedures`, so they are
auth-protected by default.

## 2. Use-cases (`internal/memory`)

`memory.Service` (constructed via `NewService(ServiceDeps)`) owns all policy; the `memory/rpc` handlers only map
proto↔domain and call it (§2.9#7):

- **`Encode`** — assembles the dedup-candidate set (neurons whose name occurs in the body, longest names first,
  bounded by `encode.dedup_body_match_limit`; + embedding kNN over the body vector — **best-effort**: a failing
  embedder degrades the assist instead of failing the preview; merged and deduped by id), calls `Extractor.Split`,
  then enforces: count within
  `[encode.min_memories_accepted, encode.max_memories]`, ≥ `encode.min_semantic_neurons` semantic neuron per memory,
  types in {semantic, spatial, entity}, **source-text fidelity + coverage** (below), estimated output ≤
  `encode.max_output_tokens`. Repairable violations re-prompt through
  `Extractor.ReviseSplit(body, prior, instruction)` up to `encode.max_revise_retries`, then `ErrEncodeRetryExhausted`
  (→ `CodeUnavailable`, reported).

  The count is the one **soft** rule: `encode.min_memories`…`encode.max_memories` (2–5) is the target the prompt
  asks for, and a below-target count is nudged `encode.under_count_nudges` times and then accepted down to
  `encode.min_memories_accepted` — a day that held one continuous event is one scene, and the prompt's own
  event-boundary rule forbids inventing a second. Acceptance covers the count alone; the other invariants still hold
  on the accepted split with the remaining repair budget. An over-count stays hard (merge adjacent scenes).

  Every violation carries a closed `ViolationKind` beside its instruction, and the give-up (`EncodeRetryExhausted`,
  wrapping the sentinel) carries the kind + the observed count and nothing else — the instruction quotes the
  writer's passage and the proposed name, so it never leaves the process (`policy/platform/errors.md` §1). A sample
  that still misses an invariant is returned to the loop and kept out of the identical-input cache
  (`memory.SplitNeedsRepair` via the seam's `Cacheable` hook), so pressing 별 쪼개기 again re-samples instead of
  replaying the split that already failed. Structural breaches (unknown mood/type, blank name, blank source text) are
  `ErrEncodeInvalidSplit` immediately — an adapter contract breach is not re-prompted. The revise variant takes the
  **body** as well as the prior split: a repair must be able to re-quote the diary, and a model shown only its own
  prior output can never recover a passage it got wrong.

- **`ReviseSplit`** — validates the client-supplied prior result structurally, then the same enforcement loop.
- **Source-text fidelity + coverage (`sourcetext.go`, pure)** — each proposed memory carries `SourceText`, the passage
  of the diary that scene occupies, and the domain verifies it against the body rather than trusting the prompt: every
  passage token must be traceable to a diary token — verbatim, or within
  `encode.source_text_max_repair_edit_distance` of one **while sharing its first rune** (a typo fix and an ending
  change keep the head of the word, a synonym does not; without that rule edit distance alone would admit short
  substitutions) — with non-verbatim tokens budgeted at `max(1, ceil(encode.source_text_max_repaired_ratio × tokens))`
  per passage, and the passages jointly covering `encode.source_text_min_coverage` of the body's tokens by
  **occurrence count**, so dropping one of three repetitions of a scene cannot read as covered. Tokens are eojeol
  (maximal letter/digit runs), distance is Levenshtein over **runes** — one mistyped Korean syllable is one edit, not
  three. Every failure is repairable: the violation text _is_ the re-prompt. This is the [W4a] structural defense
  applied to the one encode field that carries prose — free text cannot violate [I3]/[I5]/[I10], but it could
  silently overwrite the writer's own account, so a prompt injection can at most echo the writer back at themselves.
- **`PersistEncoded`** — re-validates the confirmed split (a hand-crafted `LaunchStars` cannot bypass the policy;
  the passage is re-checked **structurally only** — present, non-blank, no longer than the submitted body — and the
  fidelity rule above is deliberately _not_ re-applied, because by launch time a passage may be the writer's own
  edit and the writer cannot be wrong about their own account [W4])
  and **rejects a future-dated diary** (beyond UTC today + 1 day of timezone slack — a future date would advance the
  monotonic clock past real time and permanently past-date every later diary), then in **one transaction**
  (`LaunchRepo.InLaunchTx`): `universe_state` clock read (in-tx, plan 30) → Diary insert (append-only, [I2]) → the
  `CanLaunchAt(diary_date, clock)` guard — if past-dated, commit the Diary alone, launch nothing, leave the clock
  unmoved, and return the interval `{clock, clock}` ([I10][T1]; the wire signal is `past_dated` + `memory_ids == []`,
  and plan 27's writing flow shows the notice before launching) → neuron resolution (exact lowercased (name, type)
  against existing neurons; in-batch dedupe; genuinely new neurons created once) → `EpisodicMemory` inserts (`seed`
  generated, `base_strength = ArousalToInitialStrength(arousal)`, `created_universe_time = diary_date`,
  `source_text` = `current_text` = **this memory's own passage** of the diary, the confirmed `SourceText`; the two
  diverge from the first reconsolidation onward — `current_text` moves, `source_text` is the birth record [R8a]) →
  `NeuronActivation` inserts
  (`encode.activation_weight`, uniform in Epic A) → the **`Linker` seam** → `embed` (one job, new neurons only) +
  `semanticize` (one per memory) enqueue → **`AdvanceUniverseClock(diary_date)`** (the `GREATEST` upsert) →
  **`AdvanceProgression.OnAdvance(scope, tx, from, to)`** — the whole launch, clock advance, and hook land wholly or
  not at all ([T2] case 1). `LaunchResult` carries the interval (`PreviousUniverseTime` nil on the first-ever launch);
  the wire fields are `previous_universe_time`/`universe_time` (empty-string = unset).
- **`SyncToToday`** — the recall-composed capability ([T2] case 2 / [R1a]), no RPC and no button: in one
  `InLaunchTx`, read the clock, advance to `utcDate(now)`, fire the progression hook over `{previous, today}`, return
  the interval. Idempotent within a day (the `GREATEST` upsert holds today); mutates no Diary ([I2]). Epic C's
  `Recall` composes it behind the sync-consent gate.
- **`Universe`** — `UniverseReader.GetUniverse`; universe time is the stored `universe_state` clock, read **in the
  same `REPEATABLE READ` snapshot** as the facts (`UniverseFacts.UniverseClock`), with a one-release fallback to the
  snapshot's `max(created_universe_time)` while a pre-Epic-B user's clock row is unborn, and nil for an empty
  universe. Reading never advances the clock ([T3]).

The **`AdvanceProgression` hook** ([T4]) fires on every clock advance (launch and sync) inside the advance
transaction with `(scope, tx, from, to)` — the tx surface is passed so a binding's writes join the advance
atomically. The production binding is `memory.Consolidator` (`consolidate.go`, the Epic-E 우주의 잠);
`NoopAdvanceProgression` remains the documented default for compositions without the sleep. No cron exists.

**The advance write path (`Consolidator`, plan 41).** The handler upgrades the hook's `ProgressionTx` to its
consumer-owned `ConsolidateTx` surface via a type assertion — the pg transaction store implements both
(compile-proven in `memory/pg`), plan 30's port signature stays untouched, and like `LaunchTx`/`RecallTx` the surface
exposes no Diary write and no delete. A nil `from` (the first-ever advance) and a held/rewound target are total
no-ops. Over a crossed interval it, per non-deleted memory: (1) rises `semantic_stage` by the whole gist-units the
timer crossed (`GistUnitsElapsed` → `Semanticize`; anchor = `semanticize_timer_reset_at`, else
`created_universe_time`), appending one `semanticized/system` provenance row per crossed stage and **consuming the
crossed units from the timer anchor** (`ConsumeGistUnits`, the model-owned inverse — residual sub-unit days carry, so
re-running an already-consolidated interval is convergent); (2) re-enqueues `semanticize` for any risen memory whose
ladder text is genuinely missing — the repair runs on every advance, not only on a fresh crossing, so a dead
generation job never strands a gist; (3) persists newly crossed decay-stage texts (the plan-37 deterministic
algorithm; every missing slot up to the target fills, existing entries never overwritten). Then, batched: the risen
stages + consumed anchors (both GREATEST-guarded in SQL), the `Downscale` renormalization over the synapses **last
activated before `to`** (an edge linked inside the advancing transaction never slept; no-change rows skipped on the
float32 grid), the replay marker (`last_activated_universe_time` refreshed for every synapse with both endpoints in
the touched constellation — stage-advanced memories + `consolidation.replay_neighbor_hops` shared-neuron neighbors),
and one id-only `consolidate` job (the worker re-reads the authoritative neuron texts at execution and re-embeds).
Downscale runs before the replay touch so the slept-edge filter sees pre-replay recency. Queries live in
`db/queries/memory/consolidate.sql`; the interval read reuses `ListUniverseEpisodicMemories`, so consolidation and
the universe read share one non-deleted per-user memory shape.

Ports consumed (consumer-owned, `ports.go`): `Extractor`, `Embedder`, `NeuronCandidateRepo`, `LaunchRepo`/`LaunchTx`,
`UniverseReader`, `JobQueue` (via `LaunchTx.EnqueueJob`), `Linker`, `UniverseClockStore` (embedded in `LaunchTx`; the
plan-29 `memory/pg` concrete), `AdvanceProgression`. `LaunchTx` deliberately exposes no Diary update and no delete,
so the launch path cannot express an [I1]/[I2] violation.

## 3. Persistence (`db/queries/memory/encode.sql`, `memory/pg`)

- `LatestLaunchedUniverseTime` — the monotonic guard read (also the newest-launch fact).
- `ListNeuronCandidatesInBody` — case-insensitive name-occurs-in-body match over unsealed, named neurons.
- `ListNeuronsByNames` — exact lowercased-name resolution for persist-time dedup.
- `ListNearestNeuronCandidates` — pgvector cosine kNN over `embeddings` (HNSW), bounded by
  `encode.dedup_similarity_threshold` + `encode.dedup_top_k`.

All are `user_id`-scoped (`pnpm lint:persistence`). `Store.InLaunchTx` binds one pgx transaction to a tx-scoped
`Store` implementing `memory.LaunchTx`; a store built over a plain `DBTX` (no `BeginTx`) returns
`ErrTxStarterRequired`.

`episodic_memories.source_text` (nullable, `00018`) holds the encode-time passage. It is written once at launch and
never updated — the birth record `current_text` drifts away from, which is why the provenance baseline reads it
rather than reconstructing one. **NULL means "launched before per-memory passages existed"**, and
`MemoryOrigin.BaselineText()` falls back to the Diary body for those rows: that whole-diary text is what they were
actually created with, and there is no backfill because an LLM re-run would rewrite the basis under decay and gist
stages already generated from it ([C7]).

## 4. Values (`spec/values.yaml` `encode.*`)

`min_memories` 2 · `max_memories` 5 (the target) · `min_memories_accepted` 1 · `under_count_nudges` 1 (the floor and
how it is reached) · `min_semantic_neurons` 1 · `max_revise_retries` 3 · `max_output_tokens` 6000 ·
`source_text_min_coverage` 0.9 · `source_text_max_repaired_ratio` 0.1 · `source_text_max_repair_edit_distance` 3 ·
`dedup_similarity_threshold` 0.85 · `dedup_top_k` 8 · `dedup_body_match_limit` 32 · `activation_weight` 1.0.
Generated into `internal/platform/values` and `packages/config/src/values.gen.ts`; never hardcoded at call sites.
The output budget is sized for a **diary**, not a list of names — the passages quote the whole entry between them, so
they dominate `estimateOutputTokens`; `ai.per_call_token_cap` (7000) was raised with it so encode's own guard still
trips before the generic one. Because the body largely decides whether the response fits, `Encode`/`ReviseSplit` check it
**on the way in** (`bodyWithinOutputBudget`, estimated with the same token model so the two cannot drift): a diary too
long to be quoted back returns `ErrEncodeBodyTooLong` (→ `CodeInvalidArgument`, `MEMORY_ENCODE_BODY_TOO_LONG`) before
a single LLM call.

The in-guard prices the **structure a split cannot avoid**, not the passages alone (`minimumAdmissibleSplit`). Every
memory carries a name, a mood and at least `min_semantic_neurons` neurons, so measuring only the body admits entries
for which no legal split fits — those spend the whole repair budget on `output_too_large` and return the give-up error
instead of this one. The reservation is worst-cased exactly where the writer has no say: the memory count is
`max_memories` (a five-scene day is admissible and nobody chooses otherwise), and the mood and neuron-type strings are
the costliest members of their closed enums, derived from the catalogues so adding a member re-prices the guard. Names
are taken at their smallest legal size instead, because name and neuron verbosity is what the `output_too_large`
re-prompt can still take back — pricing it here would refuse diaries a terser split fits. The passages are
distributed across the reserved memories rather than duplicated, since they jointly quote the diary ([E1]) and every
memory's passage must be non-empty. At the as-built tuning this admits a Korean entry of ~5871 runes (from ~5983 when
only the passages were priced), and that entry's cheapest legal split lands exactly on the 6000-token budget. It is deliberately not a repair condition — a shorter split would break the coverage rule, so the
repair budget would burn down ping-ponging between "too large" and "you dropped a scene", and only the writer can
shorten the entry. The over-budget check that remains in the repair loop runs **last** and now covers only what the
model can still trim: the names and neurons around the pinned passages.

## 5. Composition root

`cmd/api` wires DB pool → `memorypg.NewStore` → `memory.NewService` (with `internal/ai`'s env-selected real/keyless
adapters and `Progression: memory.NewConsolidator(nil)`, the advance-time sleep) → `memoryrpc.NewServer` →
`platform.WithRPCService` (the generic Connect-service mount that reuses the platform interceptor chain). Without
`DATABASE_URL` the API boots and only skips the memory service. The keyless `MockExtractor` emits
`values.EncodeMinMemories` memories, each with a semantic neuron, so the dev flow passes the encode invariants — its
passages are **consecutive word runs of the body**, verbatim and covering by construction, so the fidelity and
coverage rules hold in the keyless flow too. (Consecutive, not the round-robin deal it uses for neuron names: that
deal dedupes, so it would under-cover a diary that repeats a word.) Its revise variant re-splits the **diary**, never
the instruction — a passage may only ever be drawn from the writer's text.
