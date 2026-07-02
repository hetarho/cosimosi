# tech: AI worker

> As-built rules for the memory-owned AI ports, `internal/ai` adapters, and the Postgres-backed jobs worker. The
> architecture frame lives in [ARCHITECTURE.md](../ARCHITECTURE.md) §2.1, §2.2, §2.4, §2.8, and §2.9; plan
> [22](../plan/22.ai-worker-pipeline.md) owns the product shape this tech doc records.

## 1. Boundaries

`internal/memory` declares the consumer-owned AI ports:

- `Extractor`
- `Embedder`
- `Semanticizer`

The port DTOs are memory-owned and schema-forced. `ExtractResult` can only carry
`{memories:[{name, mood, neurons:[{name, type}]}]}`; there is no position, color, strength, time, delete, proto, sqlc,
or SDK type in the shape.

`internal/ai` contains concrete adapters for those ports. It may import memory DTO types to satisfy the ports, but it
does not own split/dedup/synapse/linking/diary behavior. Provider SDKs and provider-specific client construction are
owned by the later provider abstraction job; this unit exposes only provider-agnostic `LLMClient` and `EmbeddingClient`
capability seams.

`internal/platform/jobqueue` is generic queue mechanism. It knows job id, user id, kind, attempts, and backoff; it does
not import memory, neurons, embeddings, or semantic stages. The memory context supplies the `embed` and `semanticize`
handlers.

## 2. Adapter Selection and Cost

`internal/ai.NewAdaptersFromEnv` selects adapters by runtime secret presence:

- `COSIMOSI_AI_API_KEY` absent: keyless deterministic mock adapters.
- `COSIMOSI_AI_API_KEY` present: real adapters, requiring provider clients supplied by the composition root.

There is no values key or feature flag for real-vs-mock selection.
This job intentionally does not construct vendor clients; until the provider abstraction job supplies them, setting
`COSIMOSI_AI_API_KEY` without injected clients returns `ErrRealClientsRequired`.

The mock adapters are offline and unmetered. They deterministically produce the same split/name/neurons, embedding
vector length, and four semantic stage texts for the same input.

Real adapters are metered:

- `ai.per_call_token_cap = 1200` is sent as the max-output guard on every LLM request.
- `ai.daily_call_cap = 200` limits billable LLM/embedding calls per user per UTC calendar day.
- Identical split/revise/semanticize/embed inputs are cached inside a bounded adapter cache so retries and re-runs do
  not re-bill and long-running workers do not grow memory without bound.
- Over-limit calls return a typed `CostLimitError` whose retry time is the next UTC calendar day.

## 3. Jobs Queue

`apps/api/db/queries/memory/jobs.sql` owns the worker-side queue operations:

- `ClaimDueJob`: claims the oldest due `pending` job, or a `running` job whose lease has expired, and marks it
  `running` with `FOR UPDATE SKIP LOCKED`.
- `CompleteJob`: marks a claimed job `done`.
- `RetryJob`: marks a failed attempt `pending`, increments attempts to the caller-computed value, and writes
  `next_run_at`.
- `FailJob`: marks an exhausted or unhandled job `failed`.
- `SetSemanticStages`: writes only `episodic_memories.semantic_stages` scoped by `user_id`.

Backoff is deterministic: `ai.job_backoff_base_ms * 2^attempts`, no jitter. A claimed `running` row uses
`next_run_at` as its lease deadline; the lease duration is `ai.job_backoff_base_ms * ai.job_max_attempts` (5 minutes
with the shipped values). `ai.job_max_attempts = 5`; once the next attempt count reaches that cap, the job is marked
`failed` and kept for inspection. A cost-limit error is scheduled for the next UTC calendar day without incrementing
`attempts`. The worker never deletes neurons, memories, synapses, embeddings, or diaries.

Unhandled reserved kinds (`extract`, `link`, `consolidate`) have no Epic A dispatch branch. The generic runner marks
them `failed` without panicking.

Transient queue I/O errors during claim, complete, retry, or fail are logged and the runner continues polling. Context
cancelation remains the shutdown signal.

## 4. Worker Effects

`embed` jobs decode a payload of neuron ids/texts, call `Embedder.Embed`, and batch-upsert `embeddings` rows for the
claimed job's user when the backing pgx connection supports batching.

`semanticize` jobs decode a memory payload, call `Semanticizer.GenerateSemanticStages`, and write the four JSON stage
texts to `episodic_memories.semantic_stages`.

`GetUniverse` now reads nullable `semantic_stages`: before the worker fills the value it is `NULL`; after the worker
fills it, the stages appear on the next read/refetch. No polling, server-streaming, or diary mutation is introduced.

## 5. Runtimes

`cmd/worker` is the standalone process. It opens the Postgres pool, builds the `memory/pg` queue/store, selects AI
adapters, and runs the generic job loop.

`cmd/api` can run the same memory worker as a dev goroutine when `COSIMOSI_DEV_WORKER=1`; `docker-compose.yml` enables
that path for the local API container. Runtime environment and secrets stay out of `spec/values.yaml`.
