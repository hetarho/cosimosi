# MEM memory aggregate & persistence

> r3 | the memory aggregate's persistent shape: tables, aggregate boundaries, database-enforced invariants, and the isolation, locking and retention rules of the `internal/memory` context

## decisions
- MEM-1 [o] `internal/memory` is the core context that owns the memory aggregate: its tables, its queries under `db/queries/memory/` and its only persistence adapter `internal/memory/pg` →=ARCH
  - `memory/pg` is the only memory package that imports `dbgen`, pgx or `pgtype`; no generated row type escapes it, and it maps flat rows to domain structs (e.g. the nested `Emotion`)
  - domain types carry the canonical names (`Diary`, `EpisodicMemory`, `Neuron`, `NeuronActivation`, `Synapse`, `Embedding`, `MemoryProvenance`, `Job`) and no proto, sqlc, JSON or DB tags →=UL
  - repository ports are declared by the consuming use-case in `internal/memory`, never next to the adapter; concretes bind at `cmd/api`
  - entity ids are backend-minted TEXT nanoids (`platform.NewID`); a client never mints an entity id (a client-minted `operation_id` is an idempotency key, not an id)
  - the real-clock day boundary crosses the consumer-owned `UserZone` port; a root that binds none gets `UTCUserZone` (tests, minimal roots), production binds the profile zone →=ACCT-7
- MEM-2 [o] every memory table carries `user_id TEXT NOT NULL` and every memory statement is scoped to the authenticated user →=ACCT-1
  - guard `pnpm lint:persistence` (`scripts/check-persistence-isolation.mjs`): an owned `user_id` column per product table and a conjunctive `user_id` = parameter path for every relation a statement touches; alias- and CTE-aware, fail-closed on SQL it cannot parse
  - a join across memory tables matches `user_id` on both sides (memory ↔ diary), so no other user's row can join in
  - tenant-encoding foreign keys reference the composite keys `(user_id, id)` on `diaries` and `episodic_memories`, so a referencing row always belongs to its target's user
  - cross-user statements exist only by name in the gate's allowlist: the queue claim and terminal purge (`ClaimDueJob`, `PurgeTerminalJobs`) and the admin queue and content counts →=ADMIN
  - admin reads of this context get non-content aggregates only (`ContentCounts`: diary and memory counts) →=ADMIN
- MEM-3 [o] `EpisodicMemory` is the aggregate root of one experience; `Neuron` is a separate root shared across memories and referenced by id only →!INV-4
  - a memory reaches its neurons only through `neuron_activations` (key `(episodic_memory_id, neuron_id)`, `weight` = co-membership weight →=ENC-8); the root has no neuron column
  - `Synapse` is a neuron↔neuron edge only →=INV-6; no table, column or type relates two memories →=INV-4
  - `synapses` is the one materialized edge table, kept because atomic weighted upserts and traversal need it; it holds co-activation facts, never a memory↔memory relationship
  - `Emotion` (`mood`, `valence`, `arousal`, `intensity`) is a value object stored as columns on the root, not a table →=MOOD-1
  - `SemanticMemory` has no table or row of its own: it is the gist version of an `EpisodicMemory`, stored as the gist-ladder fields of the root →=CONSOL
  - a `Diary` can exist with no memory (a past-dated save →=TIME-1); every memory references its `Diary` by `diary_id`
- MEM-4 [o] emergent state is never stored: no table, column or domain type holds a position, coordinate, constellation, latent neuron or nebula colour →=INV-5
  - stored are source facts only: neurons, synapses, activations, emotion, strengths, recall anchors, universe times, seed
  - a neuron row exists only once the neuron is activated; latent neurons are rendering only →=ENC-12
  - centrality derives at read from per-neuron connectivity; effective brightness, effective synapse strength and decay stage are read-time values →~LINK-5
  - the universe clock is stored state, not an emergent value →=TIME-7
- MEM-5 [o] each `episodic_memories` field has one owning rule: the aggregate stores it, the owner defines it
  | field | content | owner |
  | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- |
  | `diary_id` | the `Diary` the memory was encoded from | →~MEM-3 |
  | `name` | LLM-recommended, user-edited before launch | →=WRITE-7 |
  | `source_text` | the memory's own diary passage, immutable | →!MEM-6 |
  | `current_text` | last reconstructed narrative, starts as `source_text` | →=RECALL-10 |
  | `seed` | visual form seed, changed only by reconsolidation | →=VIS-5 |
  | `mood`, `valence`, `arousal`, `intensity` | the `Emotion` value object | →=MOOD |
  | `base_strength` | arousal-modulated initial strength | →=ENC-13 |
  | `recall_count`, `last_recalled_universe_time` | recall anchors | →=RECALL |
  | `created_universe_time` | the diary date at launch | →=TIME-1 |
  | `forgetting_offset_days` | `REAL NOT NULL DEFAULT 0`: signed neighbour forgetting nudge in universe-days; forgetting only reads it | →=RECALL-5 |
  | `semantic_stage` | `SMALLINT NOT NULL DEFAULT 0`: the visible gist stage | →=CONSOL-6 |
  | `semanticize_timer_reset_at` | the gist-timer anchor; NULL reads as `created_universe_time` | →=CONSOL-9 |
  | `semantic_stages` | JSONB, the four pregenerated gist texts; NULL until the worker fills them | →=CONSOL-7 |
  | `pending_semantic_stage`, `pending_semantic_rise_at` | the deferred gist rise | →=CONSOL-11 |
  | `decay_stages` | JSONB array of forgetting-stage texts (slot s−1 = stage s); NULL until filled | →=FORGET-11 |
  | `representation_revision` | external-processing fence | →!MEM-18 |
  | `deleted_at` | user soft delete | →=DEL-2 |
  - DB guards: the pending pair is both NULL or both set, and a pending stage lies in 1–4; `representation_revision > 0`
  - `semantic_stage` itself has no range CHECK: the domain keeps it in 0..4; only the pending stage and the provenance stage are range-checked →~MEM-19
  - an added column with a default reads that default on every existing row: no backfill
- MEM-6 [o] `source_text` is written once at launch and never updated; NULL marks a memory encoded before per-memory passages and is never backfilled ← an LLM re-run would rewrite the basis under decay and gist stages already generated from the whole diary
  - it stays the created/original baseline of the memory's history after `current_text` moves →!MEM-19
  - `InsertEpisodicMemory` is its only writer
  - what the passage contains →=ENC-1
- MEM-7 [o] `neuron_type` is the closed set `semantic`, `spatial`, `entity`; `NeuronType.Valid` is the single owner of the set for the domain and the adapters →=ENC-3
  - `name` is the extracted name; the column is nullable, but no persisted neuron is latent →!MEM-4
  - neuron writes are upserts by id: a changed name or type bumps `representation_revision`; another user's row is never updated
  - `sealed_at` is the neuron's only removal state, written only by user-originated release and let-go →=DEL
- MEM-8 [o] `synapses` holds one row per unordered neuron pair per user: canonical order `neuron_a_id < neuron_b_id`, enforced by `CHECK (neuron_a_id < neuron_b_id)` and `UNIQUE (user_id, neuron_a_id, neuron_b_id)` →!INV-6
  - two layers: `memory/pg` normalizes every write's endpoint order before sqlc, so both input orders hit one row; the `CHECK` refuses a reversed pair from direct SQL
  - stored history: base `strength` (0..1), `co_activation_count`, `last_activated_universe_time` →=LINK-5
  - the upsert is one atomic statement: on conflict it sets the new strength, adds the co-activation count and keeps the later activation date (`GREATEST`) →=LINK
  - no dynamics deletes a synapse row; weakening lowers `strength` only →=INV-1
- MEM-9 [o] embeddings exist per neuron only, never per memory or diary: `embeddings.vector` is `vector(N)` with N = `ai.embedding_dim`, keyed by `neuron_id`
  - the migration literal must equal the values key; `memory/pg` converts `[]float32` ↔ the pgvector literal and checks the dimension before every write
  - index `embeddings_vector_hnsw` (`hnsw`, `vector_cosine_ops`, default parameters) serves the neuron-dedup nearest-neighbour read →=ENC-10
  - a write is a per-neuron upsert: re-embedding replaces the vector; a worker write lands only for a live neuron at its expected revision →!MEM-18
- MEM-10 [o] a `Diary` row is never updated: no `UPDATE diaries` statement and no `updated_at` column →=INV-2
  - representational change (current text, stage texts, seed) lands on `episodic_memories`, never on the diary
  - columns: `id`, `user_id`, the verbatim `body`, `diary_date` (DATE), `created_at`; no `title` →=DIARY-6, and no `deleted_at`: release visibility is the ledger's anti-join →=DIARY-16
  - no `UNIQUE (user_id, diary_date)`: one day may hold several diaries
  - keys and indexes: `UNIQUE (user_id, id)` for tenant-encoding foreign keys, `diaries_user_diary_date_idx (user_id, diary_date, id)`, `diaries_body_trgm_idx` (GIN `gin_trgm_ops` over `body`, extension `pg_trgm`) →=DIARY-9, and `episodic_memories_user_diary_idx (user_id, diary_id)` for a diary's memories
  - the archive and provenance query files are SELECT-only (`diaries.sql`, `provenance.sql`) →=DIARY-4
  - its only deletes are the two user-originated hard deletes →!MEM-11
- MEM-11 [o] the system never hard-deletes a product row: forgetting, recall, reconsolidation, consolidation and visualization dim, weaken or seal, never delete →=INV-1
  - product rows are hard-deleted only by two user-originated mechanisms: the release retention sweep at its restore deadline →=DEL-2 and the account withdrawal purge after its retention window →=ACCT-10
  - queue maintenance deletes queue metadata only (the terminal-job purge, cancelling a deduplicated trigger), never a product row →=AI
  - guard: `pnpm lint:persistence` refuses a `DELETE` on a user product table unless that statement is named in its hard-delete allowlist
  - removal short of deletion is `episodic_memories.deleted_at` (soft delete) or `neurons.sealed_at` (seal), both user-originated →=DEL
  - `deletion.sql` contains no `DELETE`
- MEM-12 [o] one alive predicate governs every read and compute of the graph; a non-alive fact leaves the dynamics entirely →=DEL-3
  - memory alive ⇔ `deleted_at IS NULL`; neuron alive ⇔ `sealed_at IS NULL`
  - synapse alive ⇔ both endpoint neurons alive; activation alive ⇔ its memory and its neuron are alive (no seal column of its own)
  - applied as JOIN/WHERE clauses in `memory/pg`, including the compute reads (downscale selection, recall member synapses) and all four `GetUniverse` sets
  - a removal reaches clients only as facts disappearing from `GetUniverse`
- MEM-13 [o] the withdrawal sweep's memory leg `PurgeUser` hard-deletes the user's whole memory-context footprint in one transaction →=ACCT-10
  - the sweep that calls it (trigger, due-ness, leg order) →=ACCT-27
  - scope: receipts, the release ledger, provenance, activations, synapses, embeddings, memories, neurons, diaries, the `universe_state` and `universe_revisions` rows and the user's queue rows
  - it keeps only the in-flight `withdrawal_sweep` job, so the runner can record its completion; an empty scope or a missing keep-job id is refused
  - it takes no graph lock: it runs only for a withdrawn account past its deadline
- MEM-14 [o] every graph-mutating transaction takes the per-user graph advisory lock `LockGraphMutation` first; the global order is graph advisory lock → release-group or row locks → graph rows ← `FOR UPDATE` cannot lock an unborn row, and one lock order makes a user's graph writes compose into serial outcomes
  - `LockGraphMutation` is a transaction-scoped `pg_advisory_xact_lock` keyed by `user_id` under a constant class key: it needs no existing row and never blocks another user
  - the same statement advances the user's universe revision →=MEM-21
  - takers: launch (`PersistEncoded`), `Recall`, `RecallDiaryStars`, `ViewSemantic`, `SyncToToday`, `Release`, `Restore`, `LetGo`, the targeted and opportunistic sweeps, the semanticize completion
  - consolidation runs inside the advancing transaction, under its lock →=CONSOL-1
  - row locks taken under it: the clock row `FOR UPDATE` →=TIME-8, contribution synapses `FOR UPDATE` before `Depress`, the release group `FOR UPDATE` without `SKIP LOCKED` →=DEL
  - embedding writes take no graph lock: row locks and the expected revision fence them →!MEM-18
- MEM-15 [o] `GetUniverse` returns stored facts of the visible graph only: memories, neurons with connectivity, activation edges and synapses →!MEM-12
  - the four sets are read in one `REPEATABLE READ` read-only transaction; a store built over an existing transaction inherits its snapshot
  - visible: no soft-deleted memory, no sealed neuron; an activation edge joins a visible memory and a visible neuron; a synapse joins two visible neurons; connectivity counts visible-memory activations only
  - `semantic_stages` stays NULL until the worker fills it and appears on the next read; no polling or streaming →=AI
  - derived values are computed on read by shared pure functions, never stored →!MEM-4
- MEM-16 [o] the `jobs` queue is shared infrastructure (`platform/jobqueue`) and carries identity, never content: payload is always the empty JSON object ← a queued copy of a diary, memory text, neuron name or stage text would outlive the user's deletion
  - enforced twice: `CHECK (payload = '{}')` and the pg adapter
  - targets live in `job_targets`, cascading with the job: `episodic_memory` or `neuron` with `expected_revision > 0`; `release_group` or `user` with no revision; the target id is non-empty
  - kinds (closed, `JobKind`): `embed`, `semanticize`, `consolidate`, `retention_sweep`, `withdrawal_sweep`, `achievement_settle`; `link` and `extract` are reserved and never enqueued
  - other contexts' durable work (`withdrawal_sweep`, `achievement_settle`) rides this queue instead of a periodic cross-user scan of their own tables
  - status `pending`, `running`, `done`, `failed`, `cancelled` (CHECK); `terminal_at` is set iff the status is terminal (CHECK)
  - dedup: `UNIQUE (user_id, kind, dedup_key)` where a key is set (non-empty CHECK); a colliding enqueue returns the existing job
  - claim, lease fence (`lease_generation`), backoff, dead-letter and terminal retention →=AI
- MEM-17 [o] each producer owns its durable identity and handler; callers receive only the producer's narrow scheduling port →!MEM-16
  - account owns `WithdrawalJobScheduler` and `WithdrawalSweepJobIdentity`: `withdrawal:<user>`, due at the account deadline; enqueue and cancel derive the same identity →=ACCT-22
  - achievement owns `SettlementJobScheduler` and `SettlementJobIdentity`: `achievement_settle:<user>:<achievement>`, due now, deduped per claim even against terminal rows →=ACH-23
  - the infrastructure scheduler always writes an empty object and a single user identity target, never source content; the producer handler validates that target before dispatch
  - composition roots register other contexts' handlers and their retry policy explicitly; memory registers only `embed`, `semanticize`, `consolidate` and `retention_sweep`
  - retention, withdrawal and settlement retain indefinite retries and skip the claim ceiling. The record exposes the real persisted lease generation; registry policy controls retries, while writes remain fenced by the real generation. An unregistered kind still dead-letters →=AI
  - empty kinds, nil handlers and duplicate registrations fail at boot; generic envelopes, storage and lease transitions require no memory policy edit when another context adds a job →=ARCH-9
- MEM-18 [o] `representation_revision` (positive, starting at 1) on `episodic_memories` and `neurons` advances whenever the source a job processes changes, so work claimed for an older representation publishes nothing
  - bumps: the reconsolidated text and seed write; a neuron name or type change on upsert
  - fenced writes (embedding, gist ladder) match user, id, liveness and expected revision; a mismatch is a successful no-op →=AI
- MEM-19 [o] `memory_provenance` is the append-only history of a memory's representation: one row per event, inserted only by `AppendMemoryProvenance` and never updated; its read contract →=DIARY-13
  - columns `kind`, `source`, `text`, `universe_time` (DATE), `created_at`, `semantic_stage`; kind and source are closed TEXT sets the domain validates before insert, no PG enum
  - writers: the recall transaction appends `reconsolidated` / `user` →=RECALL; a gist rise in consolidation, or the semanticize completion finalizing a deferred rise, appends `semanticized` / `system` →=CONSOL
  - `created` / `original` is never stored and never backfilled: the baseline is synthesized at read →=DIARY-13
  - `semantic_stage` is set only on a `semanticized` row and lies in 1–4 (CHECK); a partial unique index allows one event per `(user_id, episodic_memory_id, semantic_stage)`; a forward-only `NOT VALID` CHECK refuses a new semanticized row with blank text or no stage
  - legacy rows (NULL stage, possibly blank text) stay untouched: history is never repaired by mutation, the regen path re-materializes the ladder instead →=CONSOL
  - index `memory_provenance_timeline (user_id, episodic_memory_id, universe_time, created_at)` backs the ordered read
  - deleted only with its memory (`ON DELETE CASCADE` in the retention sweep) or by the withdrawal purge →!MEM-11
- MEM-20 [o] `memory_paid_action_receipts` holds one immutable receipt per `(user_id, operation_id)`, committed in the same transaction as the paid action's debit and effects →=RECALL
  - `action_kind` is `recall`, `diary_recall` or `view_semantic`; `request_fingerprint` is the canonical input hash; `response` is the original typed response, replayed verbatim
  - exactly one retained target (CHECK): an `episodic_memory_id` (recall, gist view) or a `diary_id` (whole-diary recall)
  - the target foreign keys cascade: a receipt lives exactly as long as its target, with no retention timer of its own
- MEM-21 [o] `universe_revisions` holds one counter per user that advances in every graph-mutating transaction, so a client can tell whether its universe snapshot is current without reading it →!MEM-14
  - the `LockGraphMutation` statement upserts it (first value 1), so every taker advances it and a rollback undoes it; an advance that changes nothing (a receipt replay) costs only a refetch
  - `GetUniverse` returns the revision read in its snapshot; `GetUniverseRevision` reads it alone and answers 0 when no row exists →=MEM-15
  - a freshness counter, never shown and never a domain fact →~MEM-4

## constraints
- `persistence.graph_write_batch_size` bounds graph-write parameter arrays; each chunk joins the caller's transaction
- the only `values.yaml` key MEM owns is `ai.embedding_dim`; queue, lease and retention numbers belong to their owners →=AI
- `universe_state` is the clock's table →=TIME; its `consolidated_through` watermark →=CONSOL

## chg

- r3 261103 MEM-13✎ purge scope +`universe_revisions` ; MEM-14✎ +lock statement advances the universe revision ; MEM-21+ per-user universe revision for client freshness reads
- r2 261102 MEM-16✎ memory-owned queue→shared infrastructure; MEM-17✎ memory-owned foreign producer policy and lease-token masking→owner schedulers/handlers and explicit registry retry policy, with unchanged persisted identities and fencing
- r1 261102 initial
