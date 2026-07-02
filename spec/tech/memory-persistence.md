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

`GetUniverse` returns the visible graph: soft-deleted memories and sealed neurons are excluded, activation edges must
join visible memory + visible neuron nodes, synapses must join two visible neurons, and neuron connectivity counts only
visible-memory activations. The pg adapter reads the four result sets in one `REPEATABLE READ` read-only transaction
when it is backed by a pool; callers that construct the store over an existing transaction inherit that transaction's
snapshot.

Generated rows stay in `apps/api/db/gen`. `internal/memory` imports no sqlc, pgx, proto, or DB representation type;
`internal/memory/pg` is the only memory package that imports `dbgen`/`pgtype` and maps rows to domain structs.

## 5. Synapse Ordering

`synapses` stores an unordered neuron pair in canonical order: `neuron_a_id < neuron_b_id`.

The database enforces this with `CHECK (neuron_a_id < neuron_b_id)` plus
`UNIQUE (user_id, neuron_a_id, neuron_b_id)`. `internal/memory/pg` also normalizes every synapse write before calling
sqlc so both input orders target the same row.
