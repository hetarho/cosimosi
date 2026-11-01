# RECALL recall & reconsolidation

> r2 | remembering an episodic memory (Recall, Reinforce, Reconsolidate), the read-only gist view (ViewSemantic), what the 변천사 records, and the star-detail panel and recall flow that surface them

## decisions
- RECALL-1 [o] viewing is free and recalling is the paid act: a memory's meta and its forgotten current text cost nothing, while 회고하기 rewrites the memory and spends Twinkle ← remembering is reconstruction, not replay (Roediger & Karpicke 2006)
  - free: the meta (shape, emotion, written date, strength, forgetting state) and the decay-eroded current text; reading them advances no clock, spends nothing and resets nothing →=TIME-3
  - paid: 회고하기 on an episodic memory →~TWINK-1; a `SemanticMemory` is viewed, never recalled →!RECALL-8
  - no recall shows or restores the original: the `Diary` is reached only through 원본 일기 보기 →=DIARY-5
  - target: a live episodic memory of the caller; soft-deleted ⇒ `MEMORY_RECALL_MEMORY_UNAVAILABLE`, missing or foreign ⇒ `MEMORY_RECALL_MEMORY_NOT_FOUND` →~RECALL-14
  - a recall is a rewrite: a blank rewrite (whitespace only) is refused (`MEMORY_RECALL_INPUT_REQUIRED`); the flow's confirm stays disabled until text is entered
- RECALL-2 [o] a recall restarts the memory's forgetting clock: brightness returns to full and the decay stage to 0, short only by a net positive neighbour offset the memory still carries →~FORGET-5
  - recall writes anchors, not pixels: `last_recalled_universe_time` = the post-sync clock; brightness and stage are read-time functions of it →~FORGET-1
  - at stage 0 the whole current text returns: recovery is a re-render, never a rewrite →~INV-8
  - the memory takes no offset from its own recall, and its accumulated `forgetting_offset_days` is not cleared →~FORGET-5
- RECALL-3 [o] every recall reinforces the memory: its co-activated synapses are potentiated, its strength grows slightly and its gist timer resets
  - `Reinforce` (Go `reinforce`) is the recall-effects bundle, applied once per recalled memory: on both branches of `Recall` and to each member of a whole-diary recall →~DIARY-3
  - one write (`ResetRecallAnchors`) sets `last_recalled_universe_time` and `semanticize_timer_reset_at` to the post-sync clock and adds 1 to `recall_count`
  - batch LTP: each synapse whose both endpoints are the memory's unsealed member neurons is `Potentiate`d once toward the cap, `co_activation_count` +1, `last_activated_universe_time` = the recall time →!LINK-8
  - only neuron↔neuron synapses are touched; no memory↔memory edge exists →=INV-6
  - strength: `EffectiveStrength(base, recall_count) = cap − (cap − base)·(1 − gain)^recall_count`, gain `reconsolidation.recall_strength_gain`, cap `synapse.strength_cap`
  - `EffectiveStrength` is the identity at count 0, monotone non-decreasing, saturating, never above the cap; base is clamped to `[0, cap]`
  - strength sizes the star →~VIS-3 and weights its emotion in the universe colour →~MOOD-4
  - the timer reset delays the next gist stage; an already-risen stage never falls →!CONSOL-9
  - the bundle also nudges the neighbours →!RECALL-5; it never compares, rewrites or reshapes, only `Reconsolidate` does →!RECALL-6
- RECALL-4 [o] a rewrite that says the same thing reinforces only: current text, seed and stage texts stay, and no 변천사 row is appended →!RECALL-6
  - "the same" = the prediction-error gate answers false: wording, spacing or word order changed, content did not
  - the reinforce effects still apply in full →=RECALL-2/3/5
- RECALL-5 [o] recalling a memory nudges the forgetting of its neighbours by the number of semantic neurons they share: one slows it, two or more speed it ← spreading activation vs retrieval-induced forgetting (Anderson 1994)
  | shared semantic neurons | `NeighborForgettingDelta` | effect |
  | -------------------------------------------- | ------------------------------------------------ | ----------------- |
  | 0 | 0 | not a neighbour |
  | exactly 1 | `reconsolidation.neighbor_slow_days` (negative) | forgetting slows |
  | ≥ `reconsolidation.neighbor_speed_threshold` | `reconsolidation.neighbor_speed_days` (positive) | forgetting speeds |
  - neighbour = another live episodic memory sharing an unsealed semantic neuron; spatial and entity neurons never count, emotion is never a neuron →=INV-3
  - the delta is added to the neighbour's `forgetting_offset_days` (`REAL NOT NULL DEFAULT 0`, signed universe-days), which nothing resets; the decay read adds it to elapsed days, floored at 0 →~FORGET-1
  - the recalled memory takes no offset of its own
  - applied on every recall: both branches, and each member of a whole-diary recall →~RECALL-33
  - LTD-style local weakening, never `Downscale` (consolidation's homeostatic scale-down) →!INV-9
- RECALL-6 [o] reconsolidation happens only on a prediction error: when the rewrite differs in content from the current text, the current text becomes the rewrite and the seed changes ← Nader 2000; Sinclair & Barense 2019
  - the judgement is the LLM port `PredictionError.Differs(currentText, rewrite) → bool` →!RECALL-15
  - on true: `current_text` ← the trimmed rewrite, `seed` ← `Reshape` (a new form →~VIS-5), one `reconsolidated`/`user` 변천사 row at the post-sync universe time, `representation_revision` +1
  - the gist stages not yet risen regenerate from the new text through the `semanticize` job fenced by that revision; risen stages stay →!CONSOL-7
  - stored decay-stage texts are not re-derived: filled slots keep the earlier erosion, later slots erode the new text →=FORGET-11
  - a reconsolidation is also a recall: the reinforce bundle runs first →!RECALL-11
- RECALL-7 [o] recall, reconsolidation and the gist view never change the `Diary`: only the representation moves (current text, seed, stage texts, anchors, synapses, 변천사) →!INV-2
  - structural guard: `RecallTx` and `ViewSemanticTx` expose no `Diary` write and no delete, so these paths cannot express the violation →~RECALL-19
  - the `Diary` is never a mutable 변천사 entry →~DIARY-4
- RECALL-8 [o] a `SemanticMemory` is only viewed, never recalled: `ViewSemantic` returns the pregenerated text of the memory's current gist rung, spends Twinkle, is cheaper the deeper the gist, and rewrites nothing
  - no anchor moves (gist timer, last-recalled date, recall count), no 변천사 row, no LLM call, no reconsolidation
  - it never advances the clock and takes no consent (the request has no `sync_consent` field) →~TIME-2
  - its writes are the debit, its receipt and the achievement reach counter →=ACH
  - the rung is server-derived by `viewableGistStage`: the risen `semantic_stage` bounded by the stored ladder; the request names only the memory
  - the quote's `ViewableGistStage` uses the same function, so the quoted rung is the charged rung →!TWINK-4
  - no rung (no stage texts yet, or stage 0) ⇒ `MEMORY_VIEW_SEMANTIC_STAGE_NOT_RISEN`, never a fabricated text; soft-deleted, foreign or missing ⇒ `MEMORY_VIEW_SEMANTIC_MEMORY_NOT_FOUND`
  - the load precedes the spend and the spend precedes the read: an unrisen memory never charges, and a refused spend returns no text
  - the read runs in `InViewSemanticTx`: graph lock → receipt replay → load → derive rung → spend → achievement counter → receipt
  - wire: `ViewSemantic{episodic_memory_id, operation_id} → {text, reached_stage}`, not `NO_SIDE_EFFECTS`; tag 2 is reserved in both messages (the former client stage)
- RECALL-9 [o] 회고하기 is the trigger of the sync-consent modal: when the server says the clock lags today, the recall flow asks consent before the rewrite →!TIME-18
  - the flow reads `SyncStatus.needs_sync` before it opens; never a local date →=TIME-17
  - accept ⇒ the flow continues and the later `Recall` carries `sync_consent = true`; the sync happens server-side inside the recall →=TIME-15
  - reject or any ambiguous exit ⇒ the whole recall is abandoned with the clock unmoved and nothing spent
  - a server consent refusal (`MEMORY_SYNC_CONSENT_REQUIRED`) re-opens the modal under a fresh operation id; once consent was given, other refusals never loop back to it →=TIME-16
  - the flow never calls the clock or a sync itself; the committed interval plays after the result →=TIME-19
- RECALL-10 [o] an `EpisodicMemory` keeps its current text, gist-stage texts and decay-stage texts as separate representations, all distinct from the immutable `Diary`, and the 변천사 records how that representation changed →~INV-2
  | kind | source | event | entry text |
  | ---------------- | ---------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
  | `created` | `original` | the memory was born; synthesized at read, never stored | its `SourceText` (the `Diary` body only for a memory encoded before passages existed) |
  | `semanticized` | `system` | a gist stage rose →~CONSOL-11 | that stage's gist text |
  | `reconsolidated` | `user` | a recall rewrote the current text →!RECALL-6 | the rewrite |
  - current text (`current_text`) = the narrative as last reconstructed; it starts as the memory's `SourceText`, the diary passage it was encoded from, not the whole diary →~ENC-1
  - gist-stage texts (`semantic_stages`) →~CONSOL-7; decay-stage texts (`decay_stages`) →~FORGET-11
  - the creation entry keeps reading `SourceText` after reconsolidation moved the current text, so where the memory was born stays readable
  - distortion is never announced: no flag, no warning; the diarist finds it by opening the 변천사
  - storage →=MEM; the `GetProvenance` read →!DIARY-13
- RECALL-11 [o] a recall prepares under a short graph lock, compares outside the transaction, then commits all effects atomically →!TIME-15
  - preparation: graph lock → receipt replay →!RECALL-13 → validate consent and the post-sync target without advancing → load live target → authoritative affordability check without a debit. An initially unaffordable request calls no provider.
  - release the preparation transaction before `PredictionError.Differs`; no graph lock or database connection is retained while waiting for the provider
  - commit: graph lock → receipt replay → consent-gated sync → load live target → verify the compared representation revision and text → authoritative spend → reinforce → reconsolidate if it differs → achievement counters → receipt
  - a changed source refuses with `MEMORY_RECALL_SOURCE_CHANGED` / FailedPrecondition; the client re-quotes a fresh intent. A concurrent duplicate may compare twice, but the commit-time receipt check allows only one debit and one effect.
  - balance and consent may change during the comparison, so the commit repeats both checks. Any refusal or error rolls all effects back, sync included: nothing charged, no anchor moved, no clock advanced.
  - every effect is computed at the post-sync clock; preparation never reserves money or promises a charge
  - the result carries the branch, re-render inputs (`current_text`, `seed`, `recall_count`, `effective_strength`) and sync interval; regenerated gist texts arrive on a later read
  - whole-diary recall needs no provider and remains one transaction →=DIARY-21
- RECALL-12 [o] a recall is priced from the memory's accessibility at the post-sync clock: the spend carries a depth signal, never a price, and the quote reads the same signal at the same clock →=FORGET-4
  - signal: `AccessibilityCostWeight(DecayDepth(...))` over the offset-inclusive elapsed days and `EffectiveStrength`, from the pre-recall snapshot at the clock the sync lands on →~TIME-15
  - the quote reads (`RecallAccessibility`, `DiaryRecallAccessibilities`) evaluate at `max(clock or its baseline, today)` without writing the advance, so the shown cost and the charge price one decay state →=TWINK-4
  - `LiveDiaryRecallAnchors` returns a diary's still-live memories with only the anchors their price derives from (no text, no gist) in one batch read; the whole-diary recall and its quote both read it, so every member prices from one snapshot →~DIARY-21
  - `SpendGate` declares a read-only `CheckCanSpend` preparation and an authoritative `CheckAndSpend(scope, tx, SpendIntent)` commit, shared by recall and the gist view; only the commit method debits, inside the caller's transaction
  - `SpendIntent` = kind (`recall` or `view_gist`), memory id, operation id and the kind's signal (accessibility weight or gist rung); it has no amount field
  - a short balance ⇒ `MEMORY_INSUFFICIENT_TWINKLE` and the whole action rolls back
  - `AllowAllSpendGate` charges nothing and binds only in economy-less roots (tests); `cmd/api` binds the real gate, which prices the signal and keys the debit on operation id + memory id →=TWINK
- RECALL-13 [o] every paid memory action (recall, whole-diary recall, gist view) is idempotent on a client operation id: a retry with the same id and input replays the committed response, with no second spend or effect →~MEM
  - `operation_id` is required: missing ⇒ `MEMORY_OPERATION_ID_REQUIRED`
  - receipt: one row in `memory_paid_action_receipts` per `(user_id, operation_id)`, `action_kind` `recall` | `diary_recall` | `view_semantic`, a canonical request fingerprint and the typed response as domain JSON (never proto)
  - fingerprint: recall = memory id + rewrite; whole-diary recall = diary id; gist view = memory id only, so a memory that rose a rung between a lost response and its retry still replays what was paid for
  - the fingerprint hashes length-prefixed parts, so no field boundary is ambiguous
  - same id with another kind or fingerprint ⇒ `MEMORY_OPERATION_CONFLICT`; the client mints a fresh id
  - the lookup runs first under the graph lock, before the consent gate: a committed recall's retry never re-asks consent, and a concurrent duplicate waits and replays
  - the receipt is written last in the action's transaction, so it exists iff the action committed
  - exactly one retained target (`episodic_memory_id` XOR `diary_id`, CHECK); never updated, removed only by its target's hard delete (`ON DELETE CASCADE`), with no timer of its own →=DEL-2
- RECALL-14 [o] `Recall` carries only the target, the rewrite and two control fields: shape, strength, anchors and price are server-derived →~INV-11
  | refusal (nothing commits) | reason | code |
  | ------------------------------------- | ---------------------------------- | ------------------ |
  | blank target or rewrite | `MEMORY_RECALL_INPUT_REQUIRED` | InvalidArgument |
  | no operation id | `MEMORY_OPERATION_ID_REQUIRED` | InvalidArgument |
  | operation id reused for another input | `MEMORY_OPERATION_CONFLICT` | AlreadyExists |
  | sync needed, consent absent | `MEMORY_SYNC_CONSENT_REQUIRED` | FailedPrecondition |
  | target missing or foreign | `MEMORY_RECALL_MEMORY_NOT_FOUND` | NotFound |
  | compared representation changed       | `MEMORY_RECALL_SOURCE_CHANGED`     | FailedPrecondition |
  | target soft-deleted | `MEMORY_RECALL_MEMORY_UNAVAILABLE` | FailedPrecondition |
  | balance short | `MEMORY_INSUFFICIENT_TWINKLE` | ResourceExhausted |
  | the compare hit the daily AI cap | `MEMORY_AI_CALL_CAP_REACHED` | ResourceExhausted |
  - `Recall{memory_id, rewrite_text, operation_id, sync_consent} → {reconsolidated, current_text, seed, recall_count, effective_strength, previous_universe_time, universe_time}` (`memory.v1.MemoryService`, unary)
  - no seed, strength, decay, price, time or diary field exists in the request
  - not `NO_SIDE_EFFECTS` (it spends, syncs and writes); the handler only maps proto↔domain and calls the use-case
  - no RPC reconsolidates on its own: reconsolidation is reachable only through `Recall`
  - `RecallDiaryStars` shares the receipt, consent and refusal shape →=DIARY-21; the reason registry →=ERR
- RECALL-15 [o] the prediction-error gate is a boolean LLM port, not a similarity score, and no values threshold exists ← the content-vs-wording boundary is a semantic judgement held in the prompt; a numeric cutoff would be a false knob
  - port `PredictionError.Differs(ctx, currentText, rewrite) (bool, error)`, declared in `internal/memory` (`reconsolidation.go`); the domain imports no LLM SDK
  - adapter `RealPredictionError` in `internal/ai`: one schema-forced boolean compare, metered and cached by the wrapped client →=AI
  - keyless fallback `MockPredictionError`: a normalized word-token-set compare (reorder, spacing, case ⇒ false; different words ⇒ true), deterministic
  - the daily AI cap surfaces as `MEMORY_AI_CALL_CAP_REACHED` and rolls the recall back
  - not golden-parity (server-only, non-deterministic); covered by contract tests with a deterministic fake
- RECALL-16 [o] `Reshape(currentSeed, newSeed)` returns the caller's fresh seed, guaranteed different from the current one, and runs only on reconsolidation →=VIS-5
  - pure: the recall use-case mints the entropy; a client never mints a seed
  - on a collision it adds a constant nudge, never a 64-bit bitwise op, so the TS mirror stays exact within the safe-integer range
  - a re-worded recall leaves the seed and so the shape alone →!RECALL-4
- RECALL-17 [o] the numeric reconsolidation rules are golden-parity Go↔TS; the orchestration and the gate are not →=ARCH
  - pinned: `EffectiveStrength` (cases in `synapse-plasticity-golden.json`), `Reshape` and `NeighborForgettingDelta` (`reconsolidation-golden.json`), asserted byte-equal by `internal/memory` and `packages/memory-logic`
  - not parity: `Recall`, `RecallDiaryStars`, `ViewSemantic` (server-authoritative spend, LLM, clock and writes) and `PredictionError`
  - values: only the four `reconsolidation.*` coefficients; the `EffectiveStrength` shape, the `Reshape` guarantee and the 변천사 enums are code
- RECALL-18 [o] every recall and gist-view read, spend, compare and write is scoped to the authenticated user; another user's target reads as not found →=ACCT-1
  - every query filters `user_id` (guard: `pnpm lint:persistence`)
  - receipts reference their target through `(user_id, id)` composite FKs, so a receipt cannot point at another user's memory or diary
- RECALL-19 [o] BE placement: recall, reconsolidation and the gist view are behaviour of the core `internal/memory` context, not a context of their own →=ARCH
  - use-cases, pure rules and consumer-owned ports (`SpendGate`, `PredictionError`, the receipt, 변천사 and offset stores) sit in the context package, free of proto and sqlc types
  - the schema and queries live only in `memory/pg`; no `dbgen` row reaches the domain
  - `RecallTx` embeds `ProgressionTx` (clock and job queue), the 변천사, offset and receipt stores and the recall reads; it has no `Diary` write and no delete
  - `ViewSemanticTx` is graph lock, gist read and receipt store only: a view cannot express a rewrite
  - the Twinkle economy is reached only through `SpendGate`, never by importing `internal/twinkle`; handlers stay thin
- RECALL-20 [o] selecting a node opens the star-detail panel over the running canvas without remounting the renderer, hosted by the shared `Dialog` →~DIARY-1 ← reading a star is a thing you stop to do, so the panel interrupts
  - web: a centred modal on a wide screen, a bottom sheet on a narrow one; mobile: a bottom panel
  - exits: the close control, the scrim, Escape, and on a sheet a swipe down; each clears the canvas selection
  - the selection belongs to `universeNavigationMachine`; the panel reads it and never keeps a second copy →!RECALL-25
- RECALL-21 [o] the panel shows what the selection is: an episodic memory gets its star, its readings and its forgotten current text; a neuron gets information without emotion; a gist body opens the gist view instead →!RECALL-31
  - episodic: the rendered star (the universe's body, tint, brightness and seed, wearing the universe's `STAR_SHADER`, slowly turning) above the rows 감정, 밝기, 적은 날, 강도, 지금 상태, then the eroded current text →=VIS
  - the preview drops one channel, size: strength only means something next to other stars, so the panel states it as a number
  - the eroded text and its smeared runs →=FORGET-17; the forgetting-state words →=FORGET-16
  - neuron: name (`star_meta_neuron_unnamed` when it has none), type and connectivity; no emotion, no actions →=INV-3
  - every value comes from the shared read-time functions (`packages/memory-logic`, `currentDecaySpans`); the panel re-derives nothing
  - the panel only reads: no control overrides emotion, strength or position, and none places or edits meaning →=INV-11
  - no text loaded ⇒ `star_detail_text_unavailable`, never invented content
  - title: the memory's `name`, or `star_detail_title_neuron` for a neuron
- RECALL-22 [o] every reading row carries an ⓘ saying what the reading means, where it comes from and what moves it; the written date carries none ← a bare 0.87 or 아스라함 explains nothing, and a hint on a plain date teaches the diarist to stop pressing the others
  - `star_meta_hint_emotion`: the emotion the diary was read as, the source of the colour
  - `star_meta_hint_brightness`: how vivid the memory is; falls as universe days pass since the last recall, returns with one, never reaches 0
  - `star_meta_hint_strength`: how settled the memory is; raised by every recall, larger and slower to fade the higher it is
  - `star_meta_hint_forgetting_state`: how far the text has blurred; loses words a stage at a time, reads whole again after a recall
  - web: the hint opens on press as well as hover, above its row; native: all four stay inline beneath their readings
  - a hint describes only what the read-time functions do, never a mechanism the code lacks; reading it costs, advances and changes nothing
- RECALL-23 [o] the footer holds one control, 회고하기; the four occasional acts sit behind one menu in the top-right corner of the star's preview frame ← five buttons in a row read as a control surface, not a star
  | action | place | hands off to |
  | ------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
  | 회고하기 (`star_detail_recall`) | footer | the recall flow, through `useRecallTargetStore` →~RECALL-27 |
  | 변천사 보기 (`star_detail_provenance`) | menu | the in-panel 변천사 view →~RECALL-26 |
  | 원본 일기 보기 (`star_detail_open_diary`) | menu | the reader at the memory's origin diary →=DIARY-5 |
  | 놓아주기 (`star_detail_letgo`) | menu | the letting-go flow for this memory →=DEL-6 |
  | 이 별의 일기 지우기 (`star_detail_delete_source`) | menu | the full delete of the source diary, reaching every memory born from it →=DEL-1 |
  - every action is episodic-only; the panel performs, prices and spends nothing: each emits an intent
  - the menu control is named `star_detail_actions_label`
  - it sits on a wrapper outside the preview frame: that frame is `aria-hidden` and clips, so a control inside would be unreachable or cut; `features/star-meta` reserves the corner and never fills it
  - the menu keeps Escape to itself: dismissing the list must not close the panel's `Dialog`
- RECALL-24 [o] the two deletion actions clear the canvas selection as they hand off, and backing out of the deletion returns to the bare canvas ← two modal surfaces would stack scrims and focus traps, and a kept selection points at a star the flow may remove
  - the star stays one click away; returning to a panel about a star the diarist chose not to act on reads as a failed cancel
  - 이 별의 일기 지우기 resolves the source diary from the memory's `diary_id` on the read model →=DEL-1
- RECALL-25 [o] the panel's control state is `starDetailMachine` (`packages/universe`) with empty context; the selection, the resolved star and the 변천사 list live outside it →=ARCH
  | state | meaning | exits |
  | ------------ | -------------------------------- | ----------------------------------------------------------------------------- |
  | `closed` | no episodic or neuron selection | `OPEN` → `meta` |
  | `meta` | star, readings, text and actions | `SHOW_PROVENANCE` → `provenance`; `OPEN` re-enters `meta`; `CLOSE` → `closed` |
  | `provenance` | the 변천사 list | `BACK` or `OPEN` → `meta`; `CLOSE` → `closed` |
  - `RECALL` and `OPEN_DIARY` are emitted intents, self-handled no-ops that keep the phase
  - re-selecting a star re-enters `meta`, dropping a stale 변천사 view
  - `resolveSelection(selectedNodeId, stores)` maps the id to `episodic` | `neuron` | `gist` | `none` over the read-model mirrors
  - gist ids are recognized by the injected `parseGistNodeId`, so the resolver never knows their format
- RECALL-26 [o] the 변천사 view lists exactly the entries `GetProvenance` returns, each labelled with its kind and source, and flags no distortion →!DIARY-13
  - labels: kind `star_provenance_kind_*` (생성, 요지화, 재공고화), source `star_provenance_source_*` (원본, 시스템, 사용자); what each means →!RECALL-10
  - fetched on entering the view (a cached Query read), not on every panel open
  - the read's states stay distinct: loading (`star_provenance_loading`), retrying (`star_provenance_retrying`), error with retry (`star_provenance_error`), success
  - an error never renders as an empty history; `star_provenance_empty` appears only on a successful empty payload, a fallback since the creation entry is always there
  - the view is the list and a back control; it re-renders no star shape
- RECALL-27 [o] 회고하기 opens the recall flow for one episodic memory over the running canvas, never remounting the renderer: consent if needed, then the cost quote, then the faded text and the rewrite, then one `Recall` →!RECALL-9
  - opened through the one-slot `useRecallTargetStore`: the panel records the memory id, the flow opens on it and clears it on close
  - the cost gate fronts the spend: the server quote (`QuoteSpend`) shows before the rewrite, which reveals only on proceed; the client never prices →~FORGET-4
  - the cost display itself →=TWINK
  - the prompt is the memory's decay-eroded current text (`currentDecaySpans`); the original `Diary` is never shown →!RECALL-1
  - the rewrite is session-only (the recall draft store): no draft persistence, no per-keystroke call; confirm sends it whole, once
  - the flow calls no clock or sync itself
  - copy: `recall_flow_title`, `recall_rewrite_prompt` (an invitation to write the day again as remembered, not an edit form), `recall_rewrite_label`, `recall_rewrite_placeholder`, `recall_confirm`, `recall_reconsolidating`
- RECALL-28 [o] the flow's control state is `recallFlowMachine` (`packages/universe`) with empty context; the target id, the rewrite and the result live in Zustand stores →=ARCH
  | state | meaning | exits |
  | ----------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
  | `idle` | closed | `OPEN{needsSync}` → `confirmingSync` when true, else `rewriting` |
  | `confirmingSync` | the sync-consent modal →=TIME-18 | `ACCEPT` → `rewriting`; `REJECT` or `CLOSE` → `idle`, clock unmoved |
  | `rewriting` | cost gate, then faded text and rewrite | `RECALL` → `reconsolidating`; `CLOSE` → `idle` |
  | `reconsolidating` | the one `Recall` in flight | `DONE` → `result`; `ERROR` → `rewriting`; `CONSENT_REQUIRED` → `confirmingSync` |
  | `result` | the outcome | `CLOSE` or `RESET` → `idle` |
  - `SESSION_INVALIDATED` returns any active phase to `idle` when the target or session changes
  - `reconsolidating` takes no `CLOSE`: an in-flight recall cannot be dismissed →!RECALL-29
  - the cost gate is a widget-local step inside `rewriting` (a shown → proceeded flag), not a machine phase
  - `OPEN` waits for the `SyncStatus` read, so the consent branch is decided from the server clock
  - the user-scope reset clears the target and draft stores →=CLIENT
- RECALL-29 [o] a paid flow mints one operation id per intent and reuses it only to recover an ambiguous failure →!RECALL-13
  | failure (by Connect code) | meaning | next attempt |
  | ------------------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------------- |
  | ResourceExhausted, FailedPrecondition, InvalidArgument, NotFound, AlreadyExists, Unauthenticated | known refusal, nothing committed | fresh id, fresh quote |
  | any other code or a non-Connect error | ambiguous, may have committed | same id; the server replays the receipt |
  - `createPaidActionSession` (`packages/universe`) serves the recall flow, the gist view and the whole-diary recall alike
  - `start` is synchronous, so a second tap cannot send twice; a completion applies only while its attempt is active
  - retarget, sign-out (target cleared) and unmount invalidate the session, so a late completion mutates nothing
  - while the paid call is in flight the surface is non-dismissible: Escape, backdrop, close and re-submit are inert
  - ambiguous recall failure: keep the id and the passed cost gate, back to `rewriting` with the rewrite intact, so re-confirm replays without re-quoting a now-lower balance
  - known refusal: re-arm the cost gate and re-quote; a shortfall opens the earn guide →=TWINK; a missing-consent refusal re-opens consent →!RECALL-9
- RECALL-30 [o] the client never decides the branch: the result reflects the server's `reconsolidated` flag, and the distortion is never announced →!RECALL-6
  - reconsolidated: `recall_result_reconsolidated` (the memory now stays as written) above the new current text
  - reinforced: `recall_result_reinforced`, saying plainly the memory is vivid again and unchanged
  - success: `applyRecallResult` writes `seed`, `recall_count`, `last_recalled_universe_time` and `current_text` into the read-model mirror, so the star reshapes and the panel reads the new text
  - the sync interval goes through the shared advance announcement with no reveal ids, since a recall births no star →=TIME-19
  - success invalidates every memory-service read (`GetUniverse`, the 변천사, `SyncStatus`) and the achievements; the balance is invalidated after success and failure alike
  - a failed recall applies nothing to the mirror
- RECALL-31 [o] selecting a gist body opens the gist view (`GistViewSheet`) instead of the panel: the gist quote first, `ViewSemantic` only on proceed, then the text, read-only →!RECALL-8
  - no rewrite, recall or stage control exists; the request names the memory only →~INV-11
  - in flight it is non-dismissible; ambiguous failure ⇒ retry under the same id, which reveals the paid text without a second debit; known refusal ⇒ fresh id and a fresh quote; a shortfall opens the earn guide
  - success invalidates balance and achievements; a failure invalidates the balance only
  - closing clears the canvas selection, so reselecting the body reopens it
  - copy `gist_view_title`, `gist_view_loading`, `gist_view_error`
- RECALL-32 [o] FE placement: `widgets/star-detail` (`DetailPanel`, `GistViewSheet`) composes `features/star-meta`, `features/current-memory-text` and `features/star-provenance`; `widgets/recall-flow` composes `features/recall-star` →=ARCH
  - `widgets/recall-flow` composes sync confirmation and spend actions with the passive current-text projection from `entities/episodic-memory`
  - shared substance in `packages/universe`: both machines, `resolveSelection`, the recall and gist-view request helpers, `applyRecallResult`, the target and draft stores, the paid-action session
  - web and mobile run the same widgets and features; only the `ui` hosts fork (panel host, sheet, text input)
  - non-ui public names go by role (`DetailPanel`, `MetaBlock`, `CurrentMemoryText`, `ProvenanceList`), so the rendering word "star" stays in `ui/` and slice names (guard: `pnpm lint:language`)
  - these slices import no `three` and no visual entity; the preview body comes from `@cosimosi/universe-render` →=VIS
  - all copy goes through the i18n seam (guard: `pnpm lint:raw-strings`), in a plain, restrained voice
- RECALL-33 [?] whether a whole-diary recall should nudge the forgetting of its own members →~DIARY-3
  - as built each member's reinforce counts the other members as neighbours, so siblings sharing semantic neurons nudge each other within one recall
  - the offset survives the members' own recalls →~FORGET-5, so siblings sharing two or more semantic neurons leave the recall reading older than wholly recalled

## flow
- recall flow: 회고하기 → `SyncStatus.needs_sync`(false | true: consent(reject: cancel | accept)) → cost quote(cancel | proceed) → rewrite → `Recall` → result → acceleration
- `Recall`: lock → receipt replay(match: stored response) → sync → load → spend → compare → reinforce → (differs: reconsolidate) → achievement counters → receipt
- gist view: gist body → gist quote(cancel | proceed) → `ViewSemantic`(lock → receipt replay → rung(none: refused) → spend → text) → read-only text

## constraints
- the only RECALL values keys are `reconsolidation.recall_strength_gain`, `.neighbor_slow_days`, `.neighbor_speed_days` and `.neighbor_speed_threshold`; recall and gist-view prices belong to the economy →=TWINK
- recall writes anchors, not visuals: every visible recovery is a read-time projection of stored facts →=FORGET
- the demo never mounts `RecallFlowSheet` and never calls `Recall`, `ViewSemantic` or `GetProvenance`; its recall runs locally over fixtures →=DEMO

## chg

- r2 261102 RECALL-11✎ provider inside graph transaction→read-only preparation, unlocked comparison and source-revalidated atomic commit; RECALL-12✎ spend-only port→read-only affordability plus commit; RECALL-14✎ add changed-source refusal
- r1 261102 initial
