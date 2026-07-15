# tech: memory persistence

> As-built rules for the memory aggregate schema and `internal/memory` persistence adapter. The architecture frame lives
> in [ARCHITECTURE.md](../ARCHITECTURE.md) §2.3-§2.6 and §4; plan [16](../plan/16.memory-aggregate-schema.md) owns the
> product shape this tech doc records.

## 1. Schema ownership

`apps/api/db/migrations/00002_memory_aggregate_schema.sql` owns the first product tables:

- `diaries`
- `episodic_memories`
- `neurons`
- `neuron_activations`
- `synapses`
- `embeddings`
- `jobs`

Every product table carries `user_id TEXT NOT NULL`. Every product query under `apps/api/db/queries/memory/` includes
`user_id`, and `pnpm lint:persistence` is the guard that keeps future memory queries scoped.

## 2. Aggregate boundaries

`Diary` is append-only: no `updated_at`, no `UPDATE diaries` query, and representational change targets
`EpisodicMemory`, never the original diary row.

`EpisodicMemory` is the aggregate root for an experience. It references `Neuron` only through
`neuron_activations`; it does not store neuron columns directly.

`Emotion` is a value object on `EpisodicMemory`, not its own table or aggregate. The schema stores it as
`mood`/`valence`/`arousal`/`intensity` columns on `episodic_memories`; the Go domain represents it as the nested
`memory.Emotion` field, and `internal/memory/pg` is the adapter that maps between the flat sqlc row and the nested
domain value.

`Neuron` is its own shared root. `Synapse` is only a neuron-to-neuron edge. The schema has no memory-to-memory edge
table and no stored position, coordinate, constellation, latent-neuron, or nebula-color state.

Soft-delete/seal columns are reserved, not active flows: `episodic_memories.deleted_at` and `neurons.sealed_at` default
to NULL, and Epic A queries do not hard-delete memories, neurons, synapses, activations, embeddings, or diaries.

## 3. Embeddings

`spec/values.yaml` owns `ai.embedding_dim = 1024`. `pnpm gen:values` mirrors it to
`apps/api/internal/platform/values.AiEmbeddingDim` and `packages/config/src/values.gen.ts`.

The migration stores embedding vectors as `vector(1024)` and creates `embeddings_vector_hnsw` with
`vector_cosine_ops`. sqlc maps `vector` to a string at the generated boundary; `internal/memory/pg` converts between
domain `[]float32` and the pgvector literal and validates the generated dimension before writes.

Embedding writes are per-neuron upserts for the owning user: re-embedding the same neuron replaces the vector instead
of failing on the `embeddings(neuron_id)` primary key.

## 4. sqlc Boundary

`apps/api/db/queries/memory/launch.sql` contains baseline launch-path inserts/upserts:

- insert `Diary`
- insert `EpisodicMemory`
- insert/upsert `Neuron`
- insert `NeuronActivation`
- upsert `Synapse`
- insert `Embedding`
- enqueue `Job`

`apps/api/db/queries/memory/universe.sql` contains the baseline `GetUniverse` read shape: memories, neurons with
connectivity, activation edges, and synapses. It returns stored facts only; read-time brightness, decay, layout, and
visual state stay outside persistence.

`GetUniverse` also returns nullable `episodic_memories.semantic_stages`. It remains `NULL` until the AI worker fills the
four pre-generated stage texts; after that, the value appears on the next read/refetch.

`GetUniverse` returns the visible graph: soft-deleted memories and sealed neurons are excluded, activation edges must
join visible memory + visible neuron nodes, synapses must join two visible neurons, and neuron connectivity counts only
visible-memory activations. The pg adapter reads the four result sets in one `REPEATABLE READ` read-only transaction
when it is backed by a pool; callers that construct the store over an existing transaction inherit that transaction's
snapshot.

`apps/api/db/queries/memory/jobs.sql` contains the worker-side queue shape: claim due work with
`FOR UPDATE SKIP LOCKED`, complete, retry, fail, and write semantic stages. The query file is memory-owned because the
`jobs` table belongs to the memory context, while the generic retry loop lives in `internal/platform/jobqueue`.

The claim is **leased and fenced**. `jobs.lease_generation` is a monotonic token the claim bumps on every claim; a
claim sets `status='running'` and pushes `next_run_at` out by `ai.job_lease_ms` (the lease window). The terminal
transitions (`complete`/`retry`/`fail`) match only `status='running' AND lease_generation = <the claimed generation>`,
so a worker whose lease expired — its job re-claimed by another — can no longer finalize the row; its transition is a
silent no-op. This prevents the lost-update and duplicate-processing races when a handler overruns its lease. The lease
window is its own tuning knob (`ai.job_lease_ms`), sized to outlast one handler run — deliberately **not** derived from
the exponential retry backoff (`ai.job_backoff_base_ms`). Because `lease_generation` also counts claims, the runner
dead-letters a job re-claimed past `ai.job_max_claims` without ever completing — the signature of a handler that keeps
killing its worker (a panic that escapes recovery, OOM, SIGKILL) — so a poison job cannot loop forever. Ordinary
handler panics are recovered in `internal/platform/jobqueue` and flow through the normal attempt/backoff path instead
of crashing the worker.

Generated rows stay in `apps/api/db/gen`. `internal/memory` imports no sqlc, pgx, proto, or DB representation type;
`internal/memory/pg` is the only memory package that imports `dbgen`/`pgtype` and maps rows to domain structs.

## 5. Synapse Ordering

`synapses` stores an unordered neuron pair in canonical order: `neuron_a_id < neuron_b_id`.

The database enforces this with `CHECK (neuron_a_id < neuron_b_id)` plus
`UNIQUE (user_id, neuron_a_id, neuron_b_id)`. `internal/memory/pg` also normalizes every synapse write before calling
sqlc so both input orders target the same row.

## 6. Universe Clock

`apps/api/db/migrations/00004_universe_state.sql` owns `universe_state` — the single per-user authoritative universe
clock ([T5]): `user_id TEXT PRIMARY KEY`, `current_universe_time DATE NOT NULL`, `updated_at`. It is **stored state,
not an emergent value** ([I5] governs positions/constellations/nebula color, not the clock).

The clock is **monotonic at two layers** ([I10]): the pure domain `memory.AdvanceClock(current, target)` returns the
later day, and the only write path — `AdvanceUniverseClock` in `apps/api/db/queries/memory/clock.sql` — is a
single-row upsert whose `GREATEST(universe_state.current_universe_time, EXCLUDED.current_universe_time)` mirrors it as
defense-in-depth (the same two-layer discipline as the synapse `CHECK`). There is no `UPDATE` that can lower the value
and no `DELETE` on `universe_state`; the `user_id` primary key serializes concurrent launches onto one row.
`updated_at` stamps every advance **attempt** (the upsert always touches it, even when `GREATEST` holds the clock) —
it is row maintenance, not "when the clock last moved"; derive movement from `current_universe_time` itself.

**Birth is lazy.** A user with no launches has no row; `pg.UniverseClock` maps the absent row to a nil `*time.Time`,
keeping Epic A's empty-universe read. The first advance creates the row via the upsert — no backfill migration.

**The birth window is serialized by an advisory lock.** Once the row exists, `GetUniverseClockForUpdate`'s
`FOR UPDATE` holds it for the transaction, so concurrent launches serialize on the guard. But `FOR UPDATE` can lock no
row that does not exist yet, so during lazy birth two concurrent first-launches would otherwise both read a nil clock
and one could launch a memory that a serial run would have past-dated ([T1]). Every launch/sync transaction therefore
takes `LockUniverseClock` — a per-user `pg_advisory_xact_lock`, namespaced by a constant class key — as its **first**
step, before the guard read. It needs no existing row, so it closes the birth window the `user_id` primary key (which
serializes only the clock _write_) leaves open.

Universe time is a **DATE** (day granularity) and is the model's single read-time "now": every elapsed-universe-day
derivation (forgetting decay, the semanticize timer, synapse strength decay) reads it as a scalar; it never enters
layout ([I7]). The diary-date monotonic constraint is the pure predicate `memory.CanLaunchAt(diaryDate, clock)` —
`diaryDate ≥ clock` launches, an earlier diary saves without a star, a nil clock always launches ([T1]).

The clock repository port is **consumer-owned by plan 30** (the time-advance use-case); `memory/pg` exposes the
concrete `LockUniverseClock`/`UniverseClock`/`UniverseClockForUpdate`/`LatestLaunchedUniverseTime`/`AdvanceUniverseClock`
store methods it binds to. Plan 30 has wired the stored `universe_state` clock as the **primary** source for both the
launch guard (`UniverseClockForUpdate`) and `GetUniverse.universe_time`; Epic A's `max(created_universe_time)` survives
only as the **one-release fallback** for a pre-clock universe whose row has not been born yet (`LatestLaunchedUniverseTime`
for the guard, the `EpisodicMemories` scan for the read), so no universe visibly resets during the migration window.

## 7. Provenance read + Export

Plan [46](../plan/46.provenance-export.md) owns two read-only use-cases in `internal/memory` (`GetProvenance`,
`Export`) over `db/queries/memory/provenance.sql`. Both are per-user scoped, GET-eligible / `NO_SIDE_EFFECTS`, and
free (metadata/archive tier): they advance no clock ([T3]), append no `memory_provenance` row, spend no Twinkle, and
issue no `UPDATE`/`DELETE` of any kind. `provenance.sql` is **SELECT-only** — the sole writer of `memory_provenance`
is the reconsolidation/semanticization append path in `reconsolidation.sql`.

**변천사 (`GetProvenance`).** A memory's variant history is a time-ordered list of `{kind, source, text,
universe_time}` (kind ∈ created|semanticized|reconsolidated, source ∈ original|system|user) with **no separate
distortion flag** — distortion is found by reading it. The **created/original baseline is synthesized at read** from
the memory's creation facts: `created_universe_time` plus the **immutable `Diary` body** reached via `diary_id` (the
objective record) — never `current_text`, never a stored or backfilled `memory_provenance` row ([CC5][I2]). So a
memory that has never been reconsolidated/semanticized still returns a one-entry history. The baseline is the earliest
event and is emitted first; the appended rows follow in `universe_time` order (`created_at` tiebreak), backed by the
`memory_provenance_timeline` index. The `Diary` is **never a mutable entry** in the history — it records only the
representation's evolution; the objective record is reached solely through `Export` (and the diary reader).

**Export.** The whole-account export ([W6][D4]) reads the user's retained `diaries` (append-only, never soft-deleted)
plus each diary's **still-live** `episodic_memories` (`deleted_at IS NULL` — the letting-go exclusion honored in what
is handed out, [I1][X3]) and serializes CSV or MD. Only the objective record leaves: the diary body is **byte-verbatim**
(CSV quoting round-trips commas/quotes/newlines; the body is not sanitized, since [A4] forbids mutating it) and each
memory contributes only its stable identity (name, mood, `created_universe_time`) — never `current_text` or stage
texts. A saved-but-past-dated diary whose memory was never launched is still exported. The export is the whole account
in one call (no range/selection params), delivered as the RPC response payload (`{content, content_type, filename}`).

The `ProvenanceReader`/`ExportReader` ports are **consumer-owned** in `internal/memory`; `memory/pg` is the only sqlc
seam and binds the concretes at the composition root. No proto/sqlc type crosses into the use-case or pure domain.

## 8. Deletion rules (soft-delete, sealing, the alive-predicate)

Plan [48](../plan/48.deletion-rules.md) activates the reserved `episodic_memories.deleted_at` / `neurons.sealed_at`
columns (schema unchanged — no migration, no `neuron_activations` column). The rules are the pure `ClassifyNeurons`
predicate in `internal/memory/deletion.go` + the sealing/weakening writes in `internal/memory/pg/deletion.go`
(`db/queries/memory/deletion.sql`). No orchestration or ports here — the Release/LetGo use-cases (plan 49) own the
transaction and declare the consumer-owned interfaces the store methods satisfy.

**The canonical alive-predicate.** One "is this alive?" test, reused at every read and compute: a memory is alive iff
`deleted_at IS NULL`; a neuron iff `sealed_at IS NULL`; a synapse iff **both** endpoint neurons are alive; an activation
**transitively** (its memory and neuron both alive — so `neuron_activations` needs no `sealed_at` of its own). The
predicate lives as `deleted_at IS NULL` / `sealed_at IS NULL` JOIN/WHERE clauses across `memory/pg`'s queries. This unit
extends it to the two compute reads that lacked it: `consolidate.sql`'s `ListSynapseStrengthsForDownscale` (both
endpoints unsealed, so a sealed-endpoint edge leaves the SHY/`Downscale` selection) and `recall.sql`'s
`LoadRecallMemberSynapses` (member-neuron subqueries filtered to unsealed, so a let-go neuron's edges are never
batch-LTP'd) — `GetUniverse`'s four sub-queries already excluded both.

**Classification (pure, server-authoritative).** `ClassifyNeurons(removalMemoryIDs, neuronIDs, facts)` partitions a
removal set's neurons into **orphan** (no live memory outside the set still activates it → seal) and **shared** (≥1 live
outside memory → keep + weaken), evaluated as-of removal. The activation facts (each neuron's activations tagged with the
activating memory's `deleted_at` state) come from `pg`; the outside-set + liveness decision stays in code, so the truth
table is unit-tested without a DB. It is **not** FE↔BE golden-parity — a removal reaches the client only by facts
disappearing from `GetUniverse`.

**The write side.** `SoftDeleteDiaryMemories` sets `deleted_at` on a diary's live memories (returning the removal set;
the `Diary` row is never touched, [I2]); `SealNeurons` sets `sealed_at` on an explicit orphan set (idempotent, no
unseal); `WeakenSharedContributions` reads the affected edges (both endpoints in the removal set, ≥1 shared), applies the
pure `Depress` (LTD, never `Downscale`/SHY — [I9]) by `deletion.contribution_weaken_amount`, and writes them back — the
edge's base strength drops but it is **never** deleted. `deletion.sql` contains **no** `DELETE` statement and never
mutates `diaries`. Letting-go feeds only a memory's `semantic` neurons and does not soft-delete the memory (emotion
columns + seed intact — the star lives as a content-less silent engram); positions recompute for free since force-sim
reads only live neurons (no position write, [I5]).
