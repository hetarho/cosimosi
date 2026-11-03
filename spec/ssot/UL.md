# UL ubiquitous language
> r2 | the canonical vocabulary, one name per concept across code, DB, proto, specs and conversation, and the rules that keep its science, poetic and rendering registers apart

## decisions
- UL-1 [o] one concept has one name in every layer: Go types, DB tables, proto, the FE domain mirror, specs, planning and conversation all use the canonical name in this file ← a second name for one concept splits the model and slips past its guards
  - a representation's own form is the same name, not a synonym: casing, plurals, request/response and `Dto` suffixes, generated-code naming (`EpisodicMemory`, `episodic_memories`, `EpisodicMemoryDto`, `entities/episodic-memory`)
  - no layer renames a concept on its own; a rename is one change across every layer
  - where names live and how they cross the proto, sql and pixel boundaries →=ARCH
- UL-2 [o] the vocabulary has three registers, each confined to its own home
  | register | used in | examples |
  |---|---|---|
  | science (functional) term = the UL name | code, DB, proto, specs, planning, conversation | `EpisodicMemory`, `Neuron`, `Synapse`, `Hippocampus` |
  | poetic copy | user-visible copy only, loosely mapped to the UL name →!UL-6 | `기억의 별`, `우주먼지`, `기억의 바다`, `별의 영혼`, `별가루` |
  | inspiration (anatomy and theory sources) | grounding, the knowledge UX, landing and blog; translated to the UL name, never a name itself →!UL-10 | `engram`, the anatomical hippocampus |
  - the business logic follows memory science, so the science term is the name in every technical layer
  - why a term is named so, and its sources →=SCI
- UL-3 [o] the science-term rule binds only the `memory` context: every other context names things in plain product English, as a stated exception and not as drift
  - supporting contexts: `account` (`User`, `AuthProvider`, `Invite`), `store` (`Ornament`), `achievement`, `demo`; no brain term is forced onto them →=UL-19
  - still binding there: user-facing copy stays poetic →!UL-6, the meaning layer stays untouchable →=INV-11, one concept keeps one name →!UL-1
- UL-4 [o] no synonyms and no abbreviations: a concept never gets a second word, a short form or a translation as a name in any layer →!UL-1
  | wrong | canonical |
  |---|---|
  | "engram", a bare "memory" (`Memory`, `MemoryCell`, `MemoryRecord`, `MemoryEntity`, `MemoryModel`, `MemoryObject`) | `EpisodicMemory` or `SemanticMemory`, saying which; `Neuron` for a component |
  | "메모리" | `EpisodicMemory` or `SemanticMemory`, saying which |
  | "basic" / "additional" Twinkle (`BasicBalance`, `AdditionalBalance`, `basicRemaining`, `FromBasic`, `FromAdditional`, `기본 별가루`, `추가 별가루`) | `SMALL` / `GENERAL` (`Balance.Small`, `FromSmall`, `작은 별가루`, `별가루`) |
  | `equip`, an ornament or item inventory, an inventory screen, `장착`, `보관함` | `Decorate` (a save); ownership is internal bookkeeping →=DECOR-7 |
  | `놓아주기` for the whole-diary delete | `놓아주기` is `LetGo` only; the whole-diary delete is `Release` (`지우기`) |
  | "영혼 열람" or "soul view" in code | `ViewSemantic` |
  - the persisted tier spelling (`additional`, `basic_*`, `from_basic`, `from_additional`) survives only in the schema and the one row↔domain mapper →=TWINK-23
  - per-term forbidden words sit in the vocabulary tables UL-12 to UL-25
  - known drift in shipped names, due for rename: `memory.SignupSettlementPort.OnEngramsLaunched` and the AI mock's `mockEngramName` ("engram"); comments that call the release counter `놓아주기` (`CounterEpisodicMemoryReleased`)
  - guard: `pnpm lint:language` fails on the memory, tier and inventory rows; memory rules scan everything, tier rules every domain source but the two persisted homes, inventory and equip rules `apps/*/src` and `packages`
- UL-5 [o] rendering words name what is drawn and live only in the FE visual layer: they never name a domain, DB, proto or FE domain-mirror thing, and what is drawn is not called by the domain name it projects ← the visual vocabulary is the anti-corruption boundary between model and pixels
  - the rendering words are the rows of UL-25; "star table" means `episodic_memories`, a launch counter is `episodic_memory_launched` and never `star_launched`
  - allowed: the rendering packages (`packages/3d-renderer`, `packages/universe`, `packages/universe-render`), rendering-entity slices, `ui` segments, and FE surfaces named for what the user sees (`widgets/star-detail`, `features/recall-star`)
  - never: Go, SQL, proto, the domain mirror (`packages/memory`, `entities/episodic-memory` and their `api` mappers) or a domain package such as `packages/demo` (its cluster beat is `neuron_reuse`)
  - the projection is one-way: a visual word never travels back into a domain slice or mapper →=ARCH
  - an `OrnamentKind` names the decorated surface (`STAR_SHADER`), never the rendering noun that fills it →=UL-19
  - shipped exceptions embedding a rendering word in a contract name: RPCs `LaunchStars` and `RecallDiaryStars`, achievement axis `STAR_TOTAL`, catalog ids `first_star` and `star_10` to `star_500`; renaming one is its own compatibility change, and no new name follows them
- UL-6 [o] poetic copy is user-facing only: `별가루`, `우주먼지`, `기억의 별`, `별의 영혼` and the other display names never become code names; code says `Twinkle`, `Neuron`, `EpisodicMemory`, `SemanticMemory` →!UL-2
  - where UI copy or UX is the subject, the poetic name is the canonical one and is not corrected
  - the mapping to the UL name is loose; the wording itself is owned by `packages/i18n/messages/*.json` →=CLIENT
  - public claims about the brain →=INV-12
  - the English poetic alias `stardust` is copy too; shipped exceptions: admin RPC `GrantStardust` and table `admin_stardust_grants` with the Go names derived from them; the `widgets/stardust` overlay and the `/me` `stardust` tab are user-facing surfaces
  - a rendering word inside a user-facing string is the poetic register, so the catalogues get the synonym scan only →~UL-4
- UL-7 [o] emergent things get no type and no table in any layer: they are force-sim output, read-time derivations or render background ← a type for proximity would revive the retired memory↔memory edge →=INV-4
  | thing | what it is | display, rendering word |
  |---|---|---|
  | memory proximity | shared neurons plus strong synapses: the force-sim output | `별자리`, `constellation` |
  | latent neuron | a grey background dot; activation creates the `Neuron` row by competitive allocation; never in the DB | `이름 없는 먼지`, `latent-star` |
  | emotion colour of a cluster | the strength-weighted blend of `Emotion` colours, derived | `성운`, `nebula` |
  - `Hippocampus` / `Neocortex` are a coordinate convention and `SemanticMemory` is part of its `EpisodicMemory`: none of them is an entity →~UL-13
  - "make a constellation table" is corrected, never built: the domain names the fact behind the cluster (a shared `Neuron`, the demo beat `neuron_reuse`); no achievement counts a cluster →=ACH-12
  - guard: `pnpm lint:language` fails on any modeled memory-to-memory edge or relation (`EngramEdge`, `MemoryLink`, `memory_relation`, `memory_to_memory` and their kin) in any path
- UL-8 [o] a use-case and a domain pure function are different layers and may carry different names; neither is a synonym of the other
  - `Reinforce` (use-case: the recall-effects bundle, idempotent per recall) ≠ `Potentiate` (the LTP primitive it calls)
  - `Depress` (LTD: associative, synapse-local) ≠ `Downscale` (SHY: global, during sleep) →=INV-9
  - use-cases →=UL-20, reads →=UL-21, pure functions →=UL-22
- UL-9 [o] a new domain concept enters this file before it appears in code; the vocabulary governs domain concepts, not generic technical terms
  - a new row carries the code name, the storage name if any, and the Korean names
  - a rendering registry noun (a body, mote, field or sky look) enters UL-25 before code uses it
  - a name in a supporting context stays plain product English →!UL-3
  - generic technical words (handler, migration, provider, adapter, port, mock) are outside the vocabulary and never corrected; a named port is in it →=UL-23
- UL-10 [o] a neuroscience source term is translated to its UL name and never used as one →!UL-2
  | source term | UL name |
  |---|---|
  | engram | `EpisodicMemory` (`star`): one memory's physical trace, a distributed sparse neuron ensemble, not a fragment |
  | engram cell | `Neuron` (`cell-star`): one element of the ensemble, shared across memories |
  | synapse | `Synapse`: the contact between two neurons, only between neurons |
  | Hebbian plasticity, LTP, LTD | `Potentiate`, `Depress`: firing together strengthens, disuse weakens |
  | synaptic downscaling (SHY) | `Downscale`: global renormalization in sleep, not LTD, never a deletion |
  | neural allocation, co-allocation | the neuron allocation in `Encode` and the temporal signal in `Link` |
  | silent engram | the brightness floor, a dim star unlit by natural cues and revived by a cue →=FORGET-2; also a memory after letting go, a content-less trace whose star and colour remain →=DEL-4 |
  | reconsolidation | `Reconsolidate`: a recalled memory updates or distorts on a prediction error |
  | systems consolidation, CLS, semanticization | the `Hippocampus` / `Neocortex` two-store and `Semanticize`: hippocampus → neocortex, concrete → gist |
  | testing effect, spreading activation, retrieval-induced forgetting | `Recall` reinforcement and the neighbour forgetting nudge →=RECALL-5 |
  | circumplex model (valence × arousal), arousal modulation | `Emotion` (13 moods): arousal → size and forgetting, valence → colour |
  - the grounding, and what is simplified or disputed →=SCI
- UL-11 [o] a non-canonical term in a request is corrected to its UL name before the work proceeds
  - the correction is one line at the head of the reply: the term, its UL name, the owning decision (`UL-n`) and one sentence of reason
  - when the intent is clear, the work continues with the corrected term without waiting for a confirmation
  - when the canonical name is unclear or the term splits between two concepts ("메모리": `EpisodicMemory` or `SemanticMemory`), ask instead of guessing
  - corrected: a synonym or abbreviation →=UL-4, a rendering word in a domain, DB or proto context and the reverse →=UL-5, poetic copy as a code name →=UL-6, a type for an emergent thing →=UL-7, a use-case confused with a pure function →=UL-8
  - not corrected: poetic copy where UI copy or UX is the subject →=UL-6, a generic technical term →=UL-9
  - a domain concept missing from this file is not corrected but flagged: it must be registered here before code →!UL-9
- UL-12 [o] product nouns: the actors and the research strands →=PROD
  | term | Korean | meaning | notes |
  |---|---|---|---|
  | diarist | - | the signed-in human who writes diaries and lives in a universe →=PROD-5 | - |
  | visitor | - | the signed-out human of the landing, the blog and the demo; never touches a real universe →=PROD-5 | the actor of the web-only demo →=DEMO-35 |
  | invited friend | - | a human arriving through an invite link that binds itself at signup →=PROD-5 | - |
  | operator | - | the human admin of the web-only console, who never reads what a user wrote →=PROD-5 | →=ADMIN |
  | research strand | - | one of five ids shared by the landing cards and the blog `PILLARS` enum: `engram`, `spatial-representation`, `synapse-time`, `reconstructive-recall`, `forgetting-accessibility` →=MKT-22 | inspiration-register ids →~UL-2: `engram` names the theory there, never a memory |
  | tour | - | the product name for one guided run of a script: the onboarding tour, the demo tutorial →=ONB-3 | allowed in copy, message keys and hosts (`startTour`); inside `packages/sequence` it is always `SequenceRun` |
- UL-13 [o] memory-model nouns, storage name in parentheses →=MEM
  | term (storage) | Korean (concept / user-facing) | meaning | notes |
  |---|---|---|---|
  | `Diary` (`diaries`) | `일기 원본` / `일기` | the diary as written: the immutable objective record →=INV-2 | never a provenance entry; only the user's explicit delete removes it →=DEL-2 |
  | `EpisodicMemory` (`episodic_memories`) | `일화기억` / `기억의 별 (○○별)` | the memory of one experience, a sparse ensemble of neurons; the aggregate root, referencing its neurons by id; holds `name`, `Emotion` and its texts | never "engram", a bare `Memory`, `MemoryCell`, `MemoryRecord` or `star` →!UL-4 |
  | `SemanticMemory` | `의미기억` / `별의 영혼` | the gist version of an `EpisodicMemory` risen to the neocortex; part of it, not a peer entity: no type, no table, held as its gist fields | "메모리" alone is ambiguous: say which memory |
  | `gist` | `요지` | the compressed content at a semantic stage, and the qualifier for the semantic side: gist stage (`SemanticStage`), gist timer →=CONSOL-9, gist rise, gist view (`ViewSemantic`, `GIST_VIEW`) | a qualifier, never an entity: no `Gist` identity, no table (`MemoryGist` is a read shape) |
  | `EpisodicMemory.SourceText` | `부호화 원문` | the `Diary` passage the memory was encoded from, in the user's words; written once, then immutable →=ENC-1 | one scene, not the whole diary |
  | `EpisodicMemory.CurrentText` | `현재 기억 텍스트` | the narrative as reconstructed at the last recall; starts as `SourceText`, moved only by reconsolidation →=RECALL-10 | separate from the `Diary` |
  | `EpisodicMemory.SemanticStages` | `요지화 단계 텍스트` | the four pregenerated semanticization stage texts →=CONSOL-7 | - |
  | `EpisodicMemory.DecayStages` | `망각 단계 텍스트` | the stored per-stage word-loss texts, an axis independent of semanticization →=FORGET-11 | never a gist text →=FORGET-10 |
  | `EpisodicMemory.ForgettingOffsetDays` (`forgetting_offset_days`) | - | the signed universe-day offset a neighbour's recall writes and the decay read adds to elapsed days →=RECALL-5 | forgetting only reads it →=FORGET-1 |
  | pending gist rise (`pending_semantic_stage`, `pending_semantic_rise_at`) | - | a gist rise the timer has crossed whose stage text is still missing; the visible stage holds until the text lands →=CONSOL-11 | Go `PendingSemanticStage`, `PendingGistRise` |
  | redaction token | - | `xxxx`, the stored marker a lost word becomes in a decay-stage text →=FORGET-9 | Go `redactionToken`, TS `REDACTION_TOKEN`; drawn as a smear →=FORGET-17 |
  | `Neuron` (`neurons`) | `뉴런 (요소)` / `우주먼지` | a component of memories, shared across them; a row exists only once activated, and no latent neuron is ever persisted →=ENC-12 | the nullable `name` column is no latent marker →!UL-7 |
  | `NeuronType` | `뉴런 타입` | closed set: `semantic` (topic, concept), `spatial` (place), `entity` (person, specific object) →=ENC-3 | time is never a neuron →=ENC-6 |
  | `NeuronActivation` (`neuron_activations`) | `켜진 뉴런 (멤버십)` | the weighted `EpisodicMemory`↔`Neuron` membership | - |
  | `Synapse` (`synapses`) | `시냅스` / `빛나는 선` (unnamed) | a weighted undirected edge between two neurons only →=INV-6, stored once per pair as `neuron_a_id < neuron_b_id` →=MEM-8 | no memory↔memory edge exists →=INV-4 |
  | `Synapse.Strength` (0..1) | `시냅스 강도` / `선 굵기·밝기` | how tightly two neurons are bound: a stored base plus a read-time effective value →=LINK-5 | - |
  | `Embedding` (`embeddings`) | `임베딩` | a neuron's pgvector vector for semantic nearest-neighbour search | never a linking signal →=LINK-3 |
  | `EffectiveBrightness` | `활성도 / 망각 (파생)` / `밝기` | current accessibility, derived at read, floored above 0 →=FORGET-2 | never stored |
  | `EffectiveStrength` | `강도 / 크기 (파생)` / `별 크기` | accumulated recall plus the arousal initial value, derived at read →=ENC-13 | never stored; position-free →=INV-3 |
  | `MemoryProvenance` (`memory_provenance`) | `변천사` / `별 변천사` | one append-only entry of a memory's representation history | wire and FE `ProvenanceEntry`; the created baseline is synthesized at read →=DIARY-13 |
  | `ProvenanceKind` | - | closed set: `created`, `semanticized`, `reconsolidated` | `created` is never stored |
  | `ProvenanceSource` | - | closed set: `original` (the launched account), `system` (an AI gist), `user` (a recall rewrite) | - |
  | `Job` (`jobs`) | `작업 (큐)` | the memory-owned async work queue, identity only; the closed `JobKind` set enqueues `embed`, `semanticize`, `consolidate`, `retention_sweep`, `withdrawal_sweep`, `achievement_settle` →=MEM-16 | `extract` and `link` are reserved and never enqueued →=AI-32 |
  | `JobTarget` (`job_targets`) | - | a queued job's work identity with its expected revision, of `JobTargetKind` `episodic_memory`, `neuron`, `release_group` or `user` →=MEM-16 | lets a removal cancel queued work without reading a payload |
  | `UserJobService` | - | the only entry for user-scoped durable work; it takes no kind, payload or target from a caller →=MEM-17 | serves `withdrawal_sweep` and `achievement_settle` |
  | representation revision (`representation_revision`) | - | the positive counter on `episodic_memories` and `neurons` that advances when a job's source changes, fencing stale work →=MEM-18 | Go `RepresentationRevision` |
  | paid-action receipt (`memory_paid_action_receipts`) | - | the immutable record of one committed paid action per `(user_id, operation_id)`, replayed for a retry →=MEM-20 | Go `PaidActionReceipt`; kinds `recall`, `diary_recall`, `view_semantic` →=RECALL-13 |
  | `operation_id` | - | the client-minted idempotency key of one paid intent →=RECALL-13 | never an entity id |
  | `ViolationKind` | - | the closed set naming which encode invariant a split missed (`count_under`, `count_over`, `semantic_neuron_missing`, `source_text_novel_token`, `source_text_reworded`, `source_text_coverage`, `output_too_large`) →=ENC-16 | the only half of a violation that may leave the process |
  | `SignalKind` | - | why a synapse formed: `same_memory`, `shared_neuron`, `temporal` →=LINK-10 | read by `InitialStrength` |
  | `Hippocampus` / `Neocortex` | `2-저장` / `얕은바다`, `중간바다` | the two-store coordinate convention: where a memory is born, where its gist rises →=CONSOL-5 | not entities →!UL-7; code spells the upper layer `gist` (`GistZOffset`) |
- UL-14 [o] emotion and colour terms →=MOOD
  | term (storage) | Korean (concept / user-facing) | meaning | notes |
  |---|---|---|---|
  | `Emotion` | `감정` / `별빛 색` | the value object `{mood, valence, arousal, intensity}`, one primary emotion per `EpisodicMemory` →=MOOD-1 | never position or connection →=INV-3 |
  | `Mood` | - | the closed enum of 13 moods (`JOY` … `EMPTINESS`), shared by `memory` and `account` →=MOOD-2 | - |
  | `EmotionQuadrant` | - | a mood's place on the valence × arousal plane: four quadrants plus `neutral` →=MOOD-2 | - |
  | `moodColor` | - | the single mood → colour entry point (`packages/emotion`) →=MOOD-6 | the only source of an emotion colour |
  | `MoodPalette` | - | one complete, replaceable set of 13 mood colours; the authored one is `defaultMoodPalette` →=MOOD-8 | code content, not a values key |
  | `MoodColor` (`mood_colors`) | `감정 색` | a user's per-mood colour preference, free and changeable any time →=MOOD-9 | owned by `account`; never an ornament →=DECOR-10 |
  | `MoodColorStat` (`mood_color_counts`) | - | an anonymous aggregate share of the colours chosen for a mood, the source of popular presets →=MOOD-13 | carries no user id |
- UL-15 [o] diary-archive nouns →=DIARY
  | term | Korean | meaning | notes |
  |---|---|---|---|
  | diary reader (`pages/diary-reader`) | `일기장` | the separate page where the written record is kept and read back →=DIARY-2 | a supporting surface; the universe stays primary |
  | `DiaryQuery` | - | one `GetDiaries` read: a `DiaryFilter`, a `DiarySort`, a keyset cursor, a bounded page size | never a write, clock or spend input |
  | `DiaryFilter` | - | optional `Diary.body` keyword, live-memory mood set, inclusive date bounds, inclusive live-memory count bounds →=DIARY-8 | searches the `Diary` only →=DIARY-10 |
  | `DiarySort` | - | closed chronological order: `NEWEST`, `OLDEST` | never relevance |
  | `DiaryEntry` | - | one archived diary: body, diary date, launch universe time (nil when none launched), split membership | wire `DiaryDto` |
  | `DiarySplitRef` | - | one still-live memory a diary launched: id, name, mood | - |
  | `DiaryDay` | - | one written day with its `DiaryDayMood` weights →=DIARY-17 | wire `DiaryDayDto` |
  | `DiaryDayMood` | - | one mood's summed `EffectiveStrength` on a written day | a weight, never a colour or a diary id |
  | `ExportFormat` | - | closed set: `csv`, `md` →=DIARY-14 | wire `EXPORT_FORMAT_CSV`, `EXPORT_FORMAT_MD` |
- UL-16 [o] universe-clock nouns →=TIME
  | term (storage) | Korean (concept / user-facing) | meaning | notes |
  |---|---|---|---|
  | universe time (`universe_time`, row `universe_state`) | `우주 시간` / `우주의 시간` | the per-user, diary-driven clock and the single read-time "now"; one row per user, born at the first advance →=TIME-7 | Go `UniverseClock`, written only by `AdvanceUniverseClock`; wire ISO date, empty = unborn; never real time →=TIME-5 |
  | past-dated | - | a diary dated before the clock: saved, no `EpisodicMemory` launched, clock unmoved →=TIME-1 | wire `LaunchStarsResponse.past_dated`, FE predictor `isPastDated` |
  | consolidation watermark (`universe_state.consolidated_through`) | - | the day through which consolidation has run; each invocation takes only the unprocessed suffix →=CONSOL-10 | - |
- UL-17 [o] removal nouns →=DEL
  | term (storage) | Korean | meaning | notes |
  |---|---|---|---|
  | seal (`neurons.sealed_at`) | `봉인` | a neuron withdrawn from every dynamic with its data kept →=DEL-3 | a letting-go seal is permanent; a release seal is reversible by `Restore` →=DEL-10 |
  | orphan / shared neuron | `고아 뉴런` / `공유 뉴런` | in a removal: orphan = activated by no retained memory outside the removal set, so it seals; shared = activated by one, so it stays and only the removed memories' synapse share weakens →=DEL-9 | classified by `ClassifyNeurons` |
  | release group (`release_groups`) | - | the retention-scoped ledger of one full delete with its three effect tables, so `Restore` reverses it exactly →=DEL-11 | not provenance |
  | retention sweep | - | the hard delete of a released diary once its restore deadline passes, run from a durable `retention_sweep` job →=DEL-14 | Go `RetentionSweeper`, `Sweep`; never a cron |
  | `HeavyState` | - | the server-derived heavy-state hint `{detected, severity}` returned with letting-go suggestions →=DEL-17 | - |
- UL-18 [o] Twinkle-economy nouns →=TWINK
  | term (storage) | Korean (concept / user-facing) | meaning | notes |
  |---|---|---|---|
  | `Twinkle` (`twinkle_balances`, `twinkle_ledger_entries`) | `화폐` / `별가루` | the product's only currency →=TWINK-8 | `stardust` is its poetic alias, never a code name →!UL-6 |
  | `TwinkleKind` | `별가루 종류` / `작은 별가루`, `별가루` | `SMALL` (recall-only, refilled daily) and `GENERAL` (any use, permanent) →=TWINK-2 | Go values `small`, `general`; a way of reading the balance, never a stored column value |
  | `Balance` | - | `{Small, General}` in whole units; `SMALL` derived at read, `GENERAL` stored →=TWINK-9 | - |
  | `BalanceRecord` | - | the stored balance facts: the `GENERAL` counter and the `SMALL` window anchor with its in-window spend →=TWINK-9 | - |
  | `SpendKind` | `소모 용도` | what one `Spend` is for: `RECALL`, `GIST_VIEW`, `DIARY_RECALL`, `PURCHASE`; it alone decides whether `SMALL` may pay →=TWINK-13 | distinct from `EntryReason`; the wire enum has no `PURCHASE` |
  | `SpendIntent` | - | the opaque spend request a paid action hands the gate, built only by `RecallSpendIntent`, `GistViewSpendIntent`, `PurchaseSpendIntent` →=TWINK-15 | a recall or gist intent carries no price |
  | `SpendPlan` | - | the per-kind draw `PlanSpend` returns for one cost →=TWINK-14 | - |
  | `InsufficientTwinkle` | - | the whole refusal of an unaffordable spend, `{Cost, Eligible, Shortfall}` →=TWINK-17 | wraps `ErrInsufficientTwinkle` |
  | `LedgerEntry` (`twinkle_ledger_entries`) | `원장 항목` | one append-only ledger row: `EntryKind`, `EntryReason`, amount, per-kind split →=TWINK-7 | the daily `SMALL` refill has no row; wire `LedgerEntryKind`, `LedgerEntryReason` |
  | `EntryKind` | - | a ledger row's direction: `earn` or `spend`; the amount stays positive | - |
  | `EntryReason` | `원장 사유` | the closed set of ledger reasons, defined once in the `twinkle` context →=TWINK-20 | one `DIARY_RECALL` writes one `recall` row per member |
- UL-19 [o] supporting-context nouns, in plain product English →!UL-3
  | term (storage) | Korean (concept / user-facing) | meaning | notes |
  |---|---|---|---|
  | `User` (`users`) | `사용자` | the account subject and the isolation unit of all data; its row owns nickname, time zone, locale, `created_at` and the withdrawal marker →=ACCT-12 | Go `account.Profile`; credentials, email and provider membership stay in Supabase Auth, read through the auth directory |
  | `AuthProvider` (`auth_providers`) | `인증 수단` | `GOOGLE` or `PASSWORD`, several per `User` →=ACCT-5 | Go `AuthProviderKind` |
  | `Invite` (`invites`) | `초대` | the invite-link capability, bound only inside the first signup (inviter, invitee, `rewarded_at`) →=ACCT-18 | rewards follow a valid signup →=ACCT-20 |
  | `Ornament` | `장식 아이템` / `우주 꾸미기 아이템` | a catalog row: an id, its `OrnamentKind`, its `OrnamentAcquisition`; the catalog is Go code, not a table →=DECOR-13 | the id `<lower(kind)>.<registry key>` is opaque to the server; the kind sets the price →=DECOR-9 |
  | `OrnamentKind` | `장식 종류` | the closed set of five decorated surfaces: `BACKGROUND`, `STAR_SHADER`, `GIST_SHADER`, `MOTE`, `MOTE_FIELD` →=DECOR-4 | a surface, never the rendering noun that fills it →=UL-25 |
  | `OrnamentAcquisition` | - | how a row is come by: `FREE`, `PURCHASE`, `ACHIEVEMENT` →=DECOR-14 | Go values lowercase; `free` is never stored |
  | `OrnamentOwnership` (`ornament_ownerships`) | `소유` | the permanent ownership record, internal bookkeeping →=DECOR-7 | never surfaced; no `보관함`, inventory, `equip` or `장착` →!UL-4 |
  | `OrnamentSelection` (`ornament_selections`) | `적용 상태` / `지금 내 우주` | the one applied ornament per kind →=DECOR-8 | - |
  | `Achievement` | `업적` | a static catalog row: an id, an axis, one condition (a counter key and an integer target) and one reward; Go code, not a table →=ACH-8 | - |
  | `AchievementAxis` | - | the closed set of nine axes, the UI grouping key →=ACH-2 | Go `achievement.Axis` |
  | `AchievementCounter` (`achievement_counters`) | `업적 카운터` | the cumulative fact a condition reads, one row per `(user, counter_key)`, in mode `accumulate` (adds) or `reach` (keeps the high-water mark) →=ACH-10 | no event rows or times; Go `CounterKey`, `CounterMode` |
  | `AchievementProgress` (`achievement_progress`) | `업적 진행` | the facts no counter derives: the achieved time, `claimed_at`, `paid_at` →=ACH-27 | progress is computed at read, never stored →=ACH-9; Go `ProgressRecord` |
  | `RewardTier` | - | the tier a `GENERAL` reward resolves through (`achievement.reward_tier_*`); a reward is a tier or an ornament, never both →=ACH-3 | - |
  | `ClaimState` | - | a catalog row's FE state: `locked`, `claimable`, `unpaid`, `claimed` →=ACH-33 | derived, never stored |
  | `DemoScenario` | `데모 시나리오` | FE only, no DB: the ten `beats`, the `firstDiaryId` and the `recallMemoryId` →=DEMO-3 | the step list is `DEMO_SCRIPT` |
  | `DemoBeatId` | - | one of the ten fixed beat ids (`DEMO_BEAT_IDS`), an identifier union, not a noun →=DEMO-3 | - |
  | `DemoDiarySet` | `데모 일기 세트` | FE only, no DB: a tutorial triple of diaries designed to share neurons, plus the non-empty free-play pool `extraDiaries` →=DEMO-12 | - |
  | free play (`freePlay`) | - | the demo run's last phase, after the final beat or a skip: every control opens, and no transition leaves it →=DEMO-24 | - |
  | `SequenceStep` | `시퀀스 스텝` | FE only, no DB: one guide step that can only point and wait →=ONB-7 | - |
  | `SequenceScript` | `시퀀스 스크립트` | FE only, no DB: the ordered `SequenceStep` list; with `DemoScenario`, the only difference between demo and onboarding →=ONB-1 | - |
  | `SequenceRun` | `시퀀스 실행` | FE only, no DB: one pass of a script, ending `completed`, `skipped` or `abandoned` →=ONB-8 | a prefix (`sequenceRunMachine`, `useSequenceRun`); outcome type `SequenceOutcome`; its product name is tour →=UL-12 |
- UL-20 [o] use-cases that write, one row each →!UL-8
  | verb | Korean (concept / user-facing) | meaning | notes |
  |---|---|---|---|
  | `Encode` | `부호화` / `별 쪼개기` | split a diary into scenes with name, emotion and normalized neurons; a preview that persists nothing →=ENC | RPC `SplitDiary`; rerun `ReviseSplit` |
  | launch | `별 띄우기` | commit a confirmed split in one transaction, the clock advance last →=ENC | Go `PersistEncoded`, RPC `LaunchStars`; a past-dated launch saves only the `Diary` →=TIME-1 |
  | `Link` | `연결` | grow synapses from shared neurons and temporal proximity; never memory to memory, never from emotion →=LINK | Go `LinkService.LinkLaunched` |
  | `Recall` | `회상 (재공고화)` / `회고하기` | recall one episodic memory: `Reinforce`, and `Reconsolidate` on a prediction error →=RECALL | - |
  | `RestoreMemoryText` | `원문 되살리기` | paid recovery of stored current-memory text without a rewrite →=RECALL-34 | distinct from deletion undo |
  | `RecallDiaryStars` | `이 일기로 태어난 별 보기` | recall every still-live memory of one diary without a rewrite: each is reinforced, none reconsolidated →=DIARY-3 | one transaction →=DIARY-21 |
  | `Reinforce` | `강화` | the per-memory recall effects: reset anchors, `Potentiate` co-activated synapses, raise strength, nudge neighbours →=RECALL-3 | a step of `Recall` (Go `reinforce`), idempotent per recall; no `batch_id` exists |
  | `Reconsolidate` | `재공고화` | on a prediction error only: new `CurrentText`, the remaining `SemanticStages` regenerated, `Reshape` →=RECALL-6 | gated by `PredictionError` |
  | `ViewSemantic` | `의미기억 열람` / `요지 보기` | view one gist stage: paid, never rewriting, never advancing the clock →=RECALL-8 | spend kind `GIST_VIEW` |
  | `Consolidate` | `공고화 (수면)` / `우주의 잠` | the read-time progression an advance triggers: replay, `Semanticize`, `Downscale` →=CONSOL-1 | Go `Consolidator.OnAdvance`, the `AdvanceProgression` binding; never a user action |
  | `Forget` | `망각` | brightness decay and word loss held at a floor, against universe time →=FORGET-1 | no method: forgetting is the read-time `Decay` family →=UL-22 |
  | `Release` | `삭제` / `지우기` | full delete of one diary: soft-delete its live memories, seal orphan neurons, weaken shared ones →=DEL-1 | never `놓아주기` →!UL-4 |
  | `Restore` | `되돌리기` | reverse one release exactly, before its deadline →=DEL-13 | distinct from `RestoreAccount` |
  | `SuggestLetGo` | - | the AI proposes this-memory-only semantic neurons to let go; writes nothing →=DEL-15 | - |
  | `LetGo` | `놓아주기` | seal the user-approved neurons, permanently →=DEL-16 | the memory stays live, a silent engram →=DEL-4 |
  | `SyncToToday` | - | advance the clock to the user's today; idempotent within a day →=TIME-15 | no RPC, no button →=TIME-2 |
  | `Earn` | `별가루 적립` | credit `GENERAL` Twinkle on an earn path →=TWINK-3 | no generic `Earn(reason)`: one entry point per reason →=TWINK-19 |
  | `Spend` | `별가루 소모` | debit Twinkle for stored-text restoration, a gist view or an ornament purchase →=TWINK-4 | Go `CheckAndSpend` behind the `SpendGate` →=TWINK-15 |
  | `SignUp` | `가입` | create the account from a nickname, the detected time zone and locale, binding an optional invite link; credits nothing →=ACCT-19 | - |
  | `SettleSignup` | - | settle a signup after a launch that is not past-dated: judge the valid signup, pay both invite legs, credit the signup bonus; the first pays, later calls replay as no-ops →=ACCT-21 | called through `SignupSettlementPort`; valid signup →=ACCT-20 |
  | `Withdraw` | `탈퇴` | stamp the account's soft delete and schedule its sweep at the deadline →=ACCT-22 | window `account.withdrawal_retention_days` |
  | `RestoreAccount` | `계정 복구` | clear the withdrawal before the deadline and cancel the sweep →=ACCT-24 | - |
  | `SweepWithdrawnAccount` | - | the account leg of the withdrawal sweep, the hard delete after the window →=ACCT-27 | job kind `withdrawal_sweep` |
  | `AcceptInvite` | `초대 수락` | bind an `Invite` from its link token →=ACCT-8 | - |
  | `Decorate` | `꾸미기 저장` | buy the unowned selections and apply them in one transaction →=DECOR-8 | a save, never an equip →!UL-4 |
  | `RecordProgress` | - | apply one counter report on the caller's transaction →=ACH-16 | reached through `AchievementRecorder` |
  | `ClaimAchievement` | `업적 보상 수령` | commit the claim stamp, then pay the reward →=ACH-21 | never automatic →=ACH-4 |
  | `SettleClaim` | `보상 지급 확정` | pay and stamp a claimed-but-unpaid reward →=ACH-23 | Go `SettleClaims` drains one user's rows; job kind `achievement_settle` |
- UL-21 [o] read use-cases: free and side-effect-free (`NO_SIDE_EFFECTS`), advancing no clock and spending nothing →=TIME-3
  | read | Korean | meaning | notes |
  |---|---|---|---|
  | `GetUniverse` | - | the per-user universe read: stored facts only, no position or derived value →=INV-5 | - |
  | `SyncStatus` | - | `{today, needs_sync}`: whether a recall now needs sync consent →=TIME-17 | clients decide consent from it, never from a local date |
  | `QuoteSpend` | - | the spend's read-only twin: `{cost, covered, shortfall}` for a recall, gist view or whole-diary recall →=TWINK-18 | no purchase arm |
  | `GetDiaries` | - | the single archive list read, keyset-paged over a `DiaryQuery` →=DIARY-15 | - |
  | `GetDiaryCalendar` | - | the written days of a window with their mood weights →=DIARY-17 | colourless |
  | `GetProvenance` | `변천사 보기` | one memory's provenance history →=DIARY-13 | - |
  | `Export` | `일기 내보내기` | the whole account's retained diaries as one CSV or Markdown file →=DIARY-14 | takes an `ExportFormat` |
  | `ListAchievements` | - | every catalog row for the caller, in server order →=ACH-25 | - |
- UL-22 [o] domain pure functions: no IO; the Go functions are the source of truth and the TS mirrors (`packages/memory-logic`, `packages/twinkle-logic`) are pinned to them by golden fixtures →=ARCH
  | function | Korean | meaning | notes |
  |---|---|---|---|
  | `Potentiate` | `강화 (LTP)` | strengthen a co-fired pair in proportion to the headroom (1 − strength), approaching 1.0 →=LINK-8 | called by `Link` and `Reinforce` |
  | `Depress` | `약화 (LTD)` | associative, synapse-specific weakening that deletes nothing →=INV-9 | called by `Release` and `LetGo` on a shared neuron's share |
  | `Downscale` | `다운스케일링 (SHY)` | global proportional renormalization in sleep, distinct from LTD, never a deletion →=CONSOL-4 | called by `Consolidate` |
  | `InitialStrength` | `초기 시냅스 강도` | a new synapse's low, graded start (same-memory > shared-neuron > temporal), emotion excluded →=LINK-10 | keyed by `SignalKind` |
  | `ApplyTemporalBonus` | - | the temporal-proximity boost on a link →=LINK-4 | - |
  | `EffectiveSynapseStrength` | - | a synapse's read-time strength, decayed over elapsed universe-days →=LINK-5 | - |
  | `Semanticize` | `요지화` | the gist stage after crossing elapsed gist units, independent of forgetting →=CONSOL-14 | - |
  | `GistUnitsElapsed` | - | the arousal- and connection-modulated gist units since the timer anchor →=CONSOL-9 | - |
  | `ConsumeGistUnits` | - | move the timer anchor forward by exactly the crossed units →=CONSOL-9 | Go only |
  | `GistZOffset` | - | the stage-monotonic z offset of a gist above its memory →=CONSOL-6 | from `force_sim.gist_z_offset_*` |
  | `Reshape` | `형태 재조형` | a new visual-form seed, on reconsolidation only →=VIS-5 | never on plain recall |
  | `NeighborForgettingDelta` | - | the signed forgetting nudge a recall gives a neighbour by shared semantic neurons →=RECALL-5 | - |
  | `Decay` | `망각 / 감쇠` | the forgetting family: decay over elapsed universe time, modulated by arousal and connection, held at a floor →=FORGET-1 | no single symbol: the rows below |
  | `EffectiveElapsedDays` | - | whole universe-days since the last recall (or creation) plus the forgetting offset, floored at 0 →=FORGET-1 | - |
  | `DecayStage` | - | the current word-loss stage →=FORGET-1 | - |
  | `DecayDepth` | - | the continuous decay depth in [0, 1] →=FORGET-4 | - |
  | `DecayStageText` | - | the deterministic word-loss text of a stage, using the redaction token →=FORGET-9 | an algorithm, never an LLM |
  | `AccessibilityCostWeight` | - | the recall-cost weight read from `DecayDepth`, never a price →=FORGET-4 | - |
  | `EffectiveBrightness` | `유효 밝기` | current brightness from elapsed days, arousal and strength →=FORGET-1 | - |
  | `EffectiveStrength` | `유효 강도` | current size from base strength and recall count →=VIS-3 | - |
  | `PlanSpend` | - | the per-kind draw for one cost: the recall family takes `SMALL` before `GENERAL` →=TWINK-14 | returns a `SpendPlan` |
  | `ResetWindowOf` | - | the `SMALL` reset window (the local calendar day) of a moment in a zone →=TWINK-29 | - |
  | `AdvanceClock` | - | `max(current, target)` at day granularity →=TIME-8 | Go only; the demo clock is a plain date →=DEMO-19 |
  | `CanLaunchAt` | - | whether a diary date launches against the clock →=TIME-1 | Go only |
  | `ClassifyNeurons` | - | split a removal set's neurons into orphan and shared →=DEL-9 | Go only, server-authoritative |
  | `ReclassifyRetainedNeuronSeals` | - | retire release effects that conflict with a retained owner and reverse only release-owned seals →=DEL-10 | a letting-go seal stays |
  - the economy's other pure functions →=TWINK-29; the demo reuses these mirrors and never re-implements one →=DEMO-6
- UL-23 [o] named ports: consumer-owned interfaces a context declares and the composition root (`cmd/api`) binds; their names are part of the vocabulary →=ARCH
  | port | declared in | meaning | notes |
  |---|---|---|---|
  | `Linker` | `memory` | the in-transaction link seam `PersistEncoded` calls last, served by `LinkService.LinkLaunched` →=LINK-11 | - |
  | `SpendGate` | `memory`, `store` | the spend seam a paid action calls; twinkle's `CheckAndSpend` serves it inside the caller's transaction →=TWINK-15 | `AllowAllSpendGate` only for economy-less roots and tests →=TWINK-28 |
  | `EarnPort` | `memory` | the launch's write-earn seam →=TWINK-28 | `NoEarnOnWrite` only for economy-less roots and tests |
  | `EconomyTx` | `memory`, `store` | the opaque transaction carrier that lets twinkle join the caller's transaction →=TWINK-15 | - |
  | `AdvanceProgression` | `memory` | the progression hook `OnAdvance(scope, tx, from, to)`, fired inside every advance that moves the clock →=TIME-14 | production binds `Consolidator`; `NoopAdvanceProgression` is the explicit no-op |
  | `AchievementRecorder` | `memory`, `store`, `account` | the progress-report seam, `RecordProgress(scope, tx, counterKey, delta)` →=ACH-15 | `NoAchievementRecorder` only for achievement-less roots |
  | `SignupSettlementPort` | `memory` | the post-commit launch hook into the account's signup settlement →=ACCT-21 | its method name `OnEngramsLaunched` is drift →!UL-4 |
  | `UserZone`, `UserZoneReader` | `memory`, `twinkle` | the profile time-zone read behind "today" and the `SMALL` window →=ACCT-7 | - |
  | `SpendSignalReader` | `twinkle` | the quote-time read of memory's depth signals →=TWINK-18 | - |
  | `InviteResolver` | `twinkle` | the account-side resolution of a valid signup →=TWINK-6 | - |
  | `WithdrawalPurger`, `UserDataPurger` | each owning context, `account` | a context's own withdrawal purge leg, run by the account's withdrawal sweep →=ACCT-27 | deletes by `user_id` only |
- UL-24 [o] AI ports: the five consumer-owned interfaces declared in `internal/memory`, implemented by the supporting `ai` context and bound at `cmd/api` →=AI-1
  | port | Korean | meaning | notes |
  |---|---|---|---|
  | `Extractor` | `추출기` | diary → event split, name suggestion, neuron canonicalization, emotion (`Split`, `ReviseSplit`); the output schema is forced, with no position, colour, strength, time or delete field →=ENC | - |
  | `Embedder` | `임베더` | neuron text → embedding vector (`Embed`) | - |
  | `Semanticizer` | `의미화 생성기` | the semanticization stage texts (`GenerateSemanticStages`); the `Diary` is never changed | - |
  | `PredictionError` | - | a boolean LLM semantic compare: does a rewrite differ in content from `CurrentText` (`Differs`); it gates `Reconsolidate` →=RECALL-6 | a boolean, never a similarity score with a threshold |
  | `SealSuggester` | - | suggests this-memory-only semantic neurons to let go (`Suggest`), schema-forced; it cannot emit a seal or delete command →=DEL-6 | the AI suggests, the domain executes |
  - the demo uses no AI port: splits, emotions and gist stages are hard-coded fixtures, with no LLM call →=DEMO-1
- UL-25 [o] the rendering vocabulary: FE-only words for what is drawn, one row per term; a row whose first cell is a backticked term is a rendering term for `pnpm lint:language` →!UL-5
  | term | Korean | meaning | notes |
  |---|---|---|---|
  | `star` | `큰 별` | the body of an `EpisodicMemory` (display `기억의 별`): size = strength, brightness = activation, colour = `Emotion`, shape = seed | its risen gist is a `gist-star` |
  | `cell-star` | `작은 별` | the body of a `Neuron` (display `우주먼지`): a plain point with no seed | - |
  | `filament` | `선` | the glowing line of a `Synapse` (display `빛나는 선`): thickness, brightness and pulse = `Strength` | no line joins two stars →=VIS-6 |
  | `constellation` | `별자리` | a memory cluster: emergent, the force-sim output | never a domain type →!UL-7 |
  | `nebula` | `성운` | the strength-weighted `Emotion` blend: the global tint emerges from the local colours →=MOOD-4 | - |
  | `latent-star` | `회색 별` | a latent-neuron background dot that wakes into a `cell-star` on activation; render-only, no DB →=VIS-7 | - |
  | `gist-star` | `요지 별` | the body of one risen `SemanticMemory`: no seed, every gist star shares one form, told apart only by emotion tint and risen depth; size = `EffectiveStrength`, diffusion = gist stage | - |
  | `StarShape` | `별 모양` | one look of the `star` body (an entry of `STAR_SHAPES`): form, relief, noise and surface motion only, with no write access to tint, brightness, seed or size | the server knows only the opaque id `star_shader.<key>` |
  | `GistShape` | `요지 모양` | one look of the `gist-star` body (an entry of `GIST_SHAPES`): light only, moving no vertex and reading no seed, with no write access to tint, diffusion or size; one choice for the whole universe | opaque id `gist_shader.<key>` |
  | `BackdropMote` | `먼지 하나` | the identity of one decorative particle behind the universe (an entry of `BACKDROP_MOTES`): form plus tone; size is in neither the row nor the selection, every field wears the fixed `BACKDROP_MOTE_SIZE_MIX`; it knows nothing of where or how many | no domain data; opaque id `mote.<key>` |
  | `BackdropField` | `먼지 장` | the space the motes are scattered through (an entry of `BACKDROP_FIELDS`): scatter, density, twinkle (life, speed, depth) and rotation; the character of the whole field, so "dense" and "none at all" are each one entry | opaque id `mote_field.<key>` |
  | `SkyEffect` | `배경` | one sky backdrop look (an entry of `SKY_EFFECTS`, keyed by `SkyEffectKey`), the look that fills the `BACKGROUND` kind | opaque id `background.<key>` |
  | `UniverseSkin` | - | the non-domain scene default: the default sky effect, the opaque bare night, bloom and camera fov; only the `emotion` skin is authored →=VIS-41 | never for sale; reads no memory meaning |
  | `BandFog` | - | the atmosphere filling the gap between the hippocampal lens and the lowest gist reach →=VIS-9 | never a click shield |
  | `awaken-flare` | - | the entry flare of a genuinely new neuron: it wakes one latent point and hands off to the real `cell-star` →=VIS-34 | - |
  | `spotlight` | - | the light on named stars arriving from a jump: the scene dims and their drawn brightness lifts →=VIS-50 | not the sequence chrome's control highlight, which is `SequenceSpotlight` →=ONB-2 |
  | depth layers | `깊이 층` (`z축 2층`) | shallow, middle and deep sea = `Hippocampus`, `Neocortex`, schema: an origin-centred hippocampal lens (`force_sim.hippocampus_z_*`) →=VIS-15, and a gist at its memory's live x, y, z plus `GistZOffset` →=CONSOL-6 | the layer follows the gist stage, never `SemanticStages` text; render z is never stored →=INV-5; the gap is `BandFog`; the deep sea (schema) is not built →=CONSOL-3 |
  - decoration changes only this layer's render parameters: no backdrop or shader overwrites position, brightness, size, the meaning of emotion colour or the form seed, and no rendering word flows back into the domain →=DECOR-12
  - an emotion-colour change (`MoodColor`) is not decoration: it swaps only the single mood → colour entry point →=MOOD-6

## flow
- request term → UL lookup(canonical: proceed | non-canonical: one-line correction → proceed with the UL name | splits two concepts: ask | unregistered domain concept: register here → code)

## constraints
- guard: `pnpm lint:language` (`scripts/lint-ubiquitous-language.mjs`) scans `.go`, `.sql`, `.proto` and TS/JS sources under `apps/api`, `apps/web/src`, `apps/mobile/src`, `apps/blog/src`, `packages` and `proto`, plus the message catalogues for synonyms only; it enforces UL-4, UL-5 and UL-7
- the rendering-term set is read at runtime from the UL-25 rows, never from a list inside the script
- a rendering term matches as a standalone word, in its snake_case form, or as the head of a PascalCase word, so `Start` trips `star`; a term inside a compound (`LaunchStars`, `recall-star`, `STAR_SHADER`) is not matched, so a clean run does not prove UL-5
- the rendering-term scan exempts visual path segments, rendering-entity slices, app route and navigation composition, the dev pages, the `widgets/stardust` overlay and generated files; the list lives in the script
- `pnpm lint:language:probe` (part of `pnpm test:guards`) injects a violation for each rule (visual, edge, synonyms) plus negative controls for the persisted tier spelling, so no rule rots into a no-op
- this domain owns names only: a term's grounding →=SCI, its rules belong to the domain its row points to, its copy to the message catalogues

## chg
- r2 261103 UL-20✎ paid recall→free reconstruction and separate paid `RestoreMemoryText`
- r1 261102 initial
