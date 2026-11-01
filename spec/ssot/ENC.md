# ENC encoding
> r1 | turning one diary into episodic memories and typed neurons: the event-boundary split, the verified passages, conservative neuron dedup, and the atomic launch that persists the confirmed result

## decisions
- ENC-1 [o] a diary is split into episodic memories at event boundaries (a change of place, people, activity or topic), never at an emotion shift ← event segmentation (Zacks 2007; Baldassano 2017)
  - the split divides the diary's text itself: each memory is born holding its own passage (`source_text`), in the writer's own words
  - passage rules for the extractor: quote the diary; an obvious typo may be fixed and an ending left dangling by the cut repaired; no synonym, rephrasing, summary, reordering, added transition or invention
  - passages follow the diary's order, do not overlap, and together account for the whole entry →!ENC-2
  - the extractor's passages are verified, not trusted →!ENC-17
  - at launch the confirmed passage becomes both `source_text` and the initial `current_text`: an N-way split yields N distinct texts, never N copies of the diary →=RECALL-10
- ENC-2 [o] the split grain is the scene: `encode.min_memories`–`encode.max_memories` memories per diary is a target, not a threshold, and a day that held one continuous event stays one memory ← cutting it to reach the target would split on an emotion shift →!ENC-1
  - a sentence that belongs to no scene is a split defect, not an editorial choice
  - over the target: re-prompt to merge the adjacent scenes of one event; a split above the maximum is never shown
  - under the target: nudge `encode.under_count_nudges` times, then accept the count down to `encode.min_memories_accepted`; the nudge has its own counter and never spends the repair budget
  - accepting the count accepts nothing else: every other invariant still holds on the accepted split
  - launch admits the same floor, so it never refuses a split the preview returned →~ENC-19
- ENC-3 [o] each memory decomposes into neurons of exactly three types, a closed set →=MEM
  | type | content | grain |
  |---|---|---|
  | `semantic` | a general theme or concept | middle abstraction |
  | `spatial` | a place | the grain the writer used (a café, or one named branch) |
  | `entity` | a person or proper referent | fine, unique unit |
  - an unknown type in an extractor result is an adapter contract breach →!ENC-16
- ENC-4 [o] every memory carries at least `encode.min_semantic_neurons` semantic neuron, reached through the extraction guideline and never by an injected placeholder ← shared semantic neurons are the main engine of thematic discovery across time and place
  - a missing semantic neuron is a repair re-prompt (`semantic_neuron_missing`) →!ENC-16
  - no exception is admitted: a preview still missing one when the budget runs out fails, and a launch carrying such a memory is refused →!ENC-19
- ENC-5 [o] spatial and entity neurons are optional: extracted when the diary has them; only the semantic minimum is guaranteed →!ENC-4
- ENC-6 [o] time is never a neuron: no neuron type and no field of the encode output carries a time
  - the diary date reaches the extractor as a temporal guideline only and appears in no neuron
  - time enters the graph only as the memory's date, through link weights →=LINK-4
- ENC-7 [o] a new neuron's starting position is only a seed: it is never stored, and the final position emerges from synapse structure →=INV-5
  - neurons born together in one memory start clustered; a neuron that awakens a latent point starts there →~ENC-12
  - excitability is a bonus that helps the same referent be reused, never a force that merges different referents; identity is dedup's →!ENC-10
  - seeding mechanics (`seedInitialPositions`: the carried previous position, else a seed hint, else near the memory's seeded cluster centre) →=VIS
- ENC-8 [o] a memory's position is the activation-weighted centroid of its neurons; a memory has no spring, charge or force of its own →=VIS
  - the weight is `neuron_activations.weight`; a zero weight contributes no pull
  - launch writes the uniform `encode.activation_weight` (the encode output carries no weight →=WRITE-8), so today every member neuron pulls equally; per-neuron differentiation is not built
- ENC-9 [o] memories derive from neurons: no force acts directly between two memories →=INV-4
  - nearness of memories emerges from shared neurons, seeds and synapses →=LINK-7
- ENC-10 [o] neuron dedup is a conservative identity judgement: different wordings of one referent become one neuron; related but distinct concepts never merge ← over-merging collapses the constellation
  | type | merges | keeps apart |
  |---|---|---|
  | `entity` | the same person or proper referent (mom, mother) | different referents |
  | `spatial` | true aliases of one place | a chain and one named branch: grain is preserved |
  | `semantic` | strictest: a word and its plain form (sense of achievement → achievement) | achievement and success |
  - dedup decides sameness and never creates an edge; similarity linking stays forbidden →=LINK-3
  - the extractor judges against a per-user candidate set: live named neurons whose name occurs in the body (longest first, up to `encode.dedup_body_match_limit`) plus an embedding nearest-neighbour assist over the body vector (`encode.dedup_similarity_threshold` cosine, `encode.dedup_top_k`), merged by id
  - the assist is best-effort and narrow: an embedder failure degrades to the name-match set, never fails the preview; a raw similarity cutoff never decides a merge
  - persist honours the judgement by exact (lower-cased trimmed name, type) resolution against the user's live named neurons; an unresolved pair is created once and shared by every memory of the launch
  - a sealed neuron is never a candidate and never resolved: a launch naming it creates a new neuron →~DEL-4
- ENC-11 [o] pattern separation (keeping similar-but-different experiences apart) comes from conservative merging and the layout's baseline repulsion; no active separation logic exists →!ENC-10
  - merge half: dedup keeps related concepts apart and no similarity link exists →=LINK-3
  - repulsion half: neuron-neuron repulsion in the force simulation →=VIS
  - active separation stays reserved until constellations visibly over-clump; it must then be tuned against dedup's merging
- ENC-12 [o] the universe carries a background of gray latent neurons that is rendering only: no row, no RPC, no domain or proto type; a neuron row exists only once activated →=VIS-7
  - each genuinely new neuron awakens exactly one distinct latent point: the one nearest a recently active neuron (memories created or recalled within `synapse.temporal_window_days`), else a random one
  - the awaken point is a presentation start written nowhere; the final position emerges →=INV-5
  - newness is a server-only decision: `LaunchStarsResponse.new_neuron_ids` lists the neurons this launch created, never ones deduped onto existing neurons
  - gray points carry no meaning: no emotion colour, no brightness dynamics, no identity
- ENC-13 [o] arousal sets initial strength: `base_strength = ArousalToInitialStrength(arousal)`, arousal clamped to 0..1 and mapped linearly onto `emotion.arousal_strength_min`..`emotion.arousal_strength_max` ← arousal strengthens consolidation (McGaugh 2004)
  - arousal is the mood's coordinate, no extra input →=MOOD-2
  - valence never enters strength; it stays colour-only →=INV-3
- ENC-14 [o] the write contract is `memory.v1.MemoryService`: `SplitDiary` and `ReviseSplit` preview, `LaunchStars` persists; all are auth-protected Connect unary RPCs →=WRITE-8
  - `SplitDiary` and `ReviseSplit` are synchronous previews: they call the LLM (cost-metered, not `NO_SIDE_EFFECTS`) and write no memory-context row, no `Diary`, memory, neuron or job; the metering is the AI context's →=AI
  - `ReviseSplit` returns `SplitDiaryResponse`, so chained revises feed `previous` without conversion (buf's response-name rules are `ignore_only`-scoped to `memory.proto`)
  - the `Diary` is written at launch, never at split
  - dates cross the wire as ISO `YYYY-MM-DD`; an unparsable date is `MEMORY_DIARY_DATE_INVALID` (InvalidArgument)
  - handlers only map proto↔domain and call `Encode`, `ReviseSplit` or `PersistEncoded` in `internal/memory`; every policy lives in the use-case →=ARCH
- ENC-15 [o] the LLM sits behind the consumer-owned `Extractor` port in `internal/memory`, whose revise variant takes the diary body as well as the prior split ← a model shown only its own prior output can never recover a passage it got wrong
  - `Split(body, diaryDate, existingNeurons)` and `ReviseSplit(body, prior, instruction)`; domain-shaped input and output only, no proto, sqlc or SDK type
  - every repair re-prompt runs through the revise variant, so it carries the body too
  - concrete adapters, prompts and cost metering →=AI
  - the keyless mock must pass every encode invariant: its passages are consecutive verbatim word runs of the body, and its revise re-splits the diary, never the instruction →=AI
- ENC-16 [o] the preview enforces the encode invariants as a bounded repair loop: a repairable violation re-prompts through the revise variant within `encode.max_revise_retries`, never a silent clamp and never an injected value
  - repairable kinds, the closed `ViolationKind`, in check order: `count_over`, `count_under`, `semantic_neuron_missing`, `source_text_novel_token`, `source_text_reworded`, `source_text_coverage`, `output_too_large`
  - a structural breach (blank name or passage, mood outside the 13, unknown neuron type) is `ErrEncodeInvalidSplit`: an adapter contract breach, internal, never re-prompted
  - the give-up `ErrEncodeRetryExhausted` maps to `MEMORY_ENCODE_RETRY_EXHAUSTED` (Unavailable, reported) and carries only the violation kind and the observed count →=ERR
  - the re-prompt instruction quotes the writer's passage and the proposed name, so it never leaves the process: not on the wire, in a log or in telemetry
  - a sample that still needs repair is never put in the identical-input cache (`SplitNeedsRepair`), so pressing split again re-samples →=AI
  - `ReviseSplit` first validates the client-supplied prior split's structure (`MEMORY_ENCODE_INPUT_REQUIRED` when blank or malformed)
- ENC-17 [o] each extractor passage is verified against the diary by the pure structural check `internal/memory/sourcetext.go` ← `source_text` is the one free-text field a schema cannot constrain, so an injection can at most echo the writer back
  - a passage token is verbatim, or within `encode.source_text_max_repair_edit_distance` (Levenshtein over runes) of a diary token while sharing its first rune: a repair keeps the head of the word, a substitution does not
  - non-verbatim tokens per passage stay within max(1, ceil(`encode.source_text_max_repaired_ratio` × tokens))
  - the passages jointly cover at least `encode.source_text_min_coverage` of the body's tokens by occurrence count, so dropping one of three repetitions is not covered
  - tokens are eojeol: maximal letter or digit runs
  - every failure is repairable through the same loop →!ENC-16
  - the check constrains the extractor only: it never re-runs at launch, where a passage may already be the writer's own edit →=WRITE-4
- ENC-18 [o] a diary too long to be quoted back is refused before any LLM call: `ErrEncodeBodyTooLong` → `MEMORY_ENCODE_BODY_TOO_LONG` (InvalidArgument) ← the split must quote the whole entry, so no re-prompt can shrink it and only the writer can
  - the pre-flight `bodyWithinOutputBudget` prices the cheapest admissible split against `encode.max_output_tokens`: `encode.max_memories` memories, each with a name, a mood and `encode.min_semantic_neurons` neurons, the passages distributed across them
  - worst-cased where the writer has no say (the memory count, the costliest mood and neuron-type strings from their catalogues), with the smallest legal names
  - the bound is derived, never a literal; a property test proves no admitted body has an admissible split the budget then rejects
  - the in-loop output check runs last and covers only what the model can still trim: names and neurons
  - `encode.max_output_tokens` stays below `ai.per_call_token_cap`, so encode's guard trips before the generic one →=AI
- ENC-19 [o] `PersistEncoded` re-validates the confirmed split before its transaction, so a hand-crafted `LaunchStars` cannot bypass the encode policy
  - count within `encode.min_memories_accepted`..`encode.max_memories`, structure and the semantic minimum; a violation ⇒ `MEMORY_LAUNCH_INVALID_MEMORIES` (InvalidArgument), nothing saved
  - passages are re-checked structurally only: present, non-blank, no longer than the submitted body in runes →~ENC-17
  - a blank body, a missing date or a diary date after the user's today ⇒ `MEMORY_ENCODE_INPUT_REQUIRED`, nothing saved, not even the `Diary` →=TIME-13
- ENC-20 [o] a launch is one atomic transaction (`InLaunchTx`) in a fixed order and lands wholly or not at all →!INV-10
  - order: graph lock → clock read `FOR UPDATE` (unborn: the latest launched memory's date) → `Diary` insert → `CanLaunchAt` guard → Twinkle earn → neuron resolution → memory and activation inserts → `Link` → achievement counters → job enqueue → clock advance and progression hook, last →=TIME-2
  - past-dated: the transaction commits the `Diary` alone at the guard and returns the interval {clock, clock} →=TIME-1
  - the earn fires once per launched diary, never per memory, and only past the guard →=TWINK-3
  - achievement counter facts are recorded inside the transaction, from the graph the launch just made →=ACH
  - signup settlement runs only after commit and only for a launch that was not past-dated; it cannot fail the launch →=ACCT
  - the transaction surface `LaunchTx` has no `Diary` update and no delete, so a launch cannot express a violation of INV-1 or INV-2
- ENC-21 [o] each launched memory is written from the confirmed split plus server-derived values; the client supplies no derived value →=WRITE-8
  - from the split: `name` (trimmed), `mood` mapped to the `Emotion` value object →=MOOD-1, and the passage as `source_text` and `current_text`
  - server-derived: a fresh `seed` →=VIS-5, `base_strength` →!ENC-13, `created_universe_time` = the diary date
  - one activation per distinct neuron per memory, at weight `encode.activation_weight` →!ENC-8
- ENC-22 [o] a launch enqueues the slow work and answers optimistically: embeddings and gist texts fill on a later read, never inline and never by polling →=AI
  - one `embed` job targeting the genuinely new neurons (none when every neuron was reused); one `semanticize` job per launched memory
  - jobs carry identity targets at the current revision, never content →=MEM
  - `LaunchStarsResponse` carries ids and the guard outcome only: `memory_ids`, `new_neuron_ids`, `past_dated`, `previous_universe_time`, `universe_time`, `diary_id`
  - clients key the optimistic insert off `past_dated` →=TIME-1; `diary_id` lets a just-launched memory name its source before the next read →~DEL-1

## flow
- preview: `SplitDiary` → body ceiling(too long: refused) → dedup candidates → `Extractor.Split` → repair loop(valid | violation: revise re-prompt | budget spent: give-up) → proposed split → `ReviseSplit`(instruction)* → writer confirms
- launch: `LaunchStars` → re-validation(invalid: refused) → future-date bound(→=TIME-13) → transaction(past-dated: `Diary` only | launch: memories, links, jobs, clock advance) → optimistic response → worker fills embeddings and gist

## chg
- r1 261102 initial
