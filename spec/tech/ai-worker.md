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

`internal/ai` contains concrete port adapters for those ports. It may import memory DTO types to satisfy the ports, but
it does not own split/dedup/synapse/linking/diary behavior. The port adapters (`RealExtractor`, `RealEmbedder`,
`RealSemanticizer`) own **task knowledge only** — the prompts, the output JSON schemas, and the domain-DTO mapping — and
consume the provider-agnostic `LLMClient` / `EmbeddingClient` capability interfaces declared beside them. They import no
vendor SDK type.

Each provider client lives in its own subpackage (`internal/ai/anthropic`, `internal/ai/voyage`) so a vendor SDK
dependency is confined per package. A provider client owns **vendor knowledge only** — SDK/HTTP transport, auth, the
model id, the native structured-output mechanism, and error normalization; it holds no prompt text, no domain DTO, and
no knowledge of what a call is for. The dependency points inward only: a provider subpackage imports `internal/ai` for
the capability types and the typed error set; `internal/ai` never imports a provider subpackage (a driver registry —
`RegisterLLMProvider` / `RegisterEmbeddingProvider`, called from each subpackage's `init`, populated by a blank import
in `cmd/*` — avoids the cycle).

`internal/platform/jobqueue` is generic queue mechanism. It knows job id, user id, kind, attempts, and backoff; it does
not import memory, neurons, embeddings, or semantic stages. The memory context supplies the `embed` and `semanticize`
handlers.

## 2. Provider Selection and Cost

`internal/ai.NewAdaptersFromEnv` selects a provider **per capability, independently**, from runtime env:

- LLM (drives `Extractor` + `Semanticizer`): `COSIMOSI_LLM_PROVIDER`, `COSIMOSI_LLM_API_KEY`, and optional
  `COSIMOSI_LLM_MODEL` / `COSIMOSI_LLM_BASE_URL`.
- Embedding: `COSIMOSI_EMBEDDING_PROVIDER`, `COSIMOSI_EMBEDDING_API_KEY`, and optional `COSIMOSI_EMBEDDING_MODEL` /
  `COSIMOSI_EMBEDDING_BASE_URL`.

Selection rule for each capability: **key absent → the keyless deterministic mock; key present → that provider's client,
wrapped in the metering seam; an unknown or recognized-but-unimplemented provider name → a startup error, never a silent
default.** The contract slots are `anthropic · openai · deepseek · zai · gemini` (LLM) and `voyage · openai · gemini`
(embedding); Epic A implements **Anthropic** (`claude-opus-4-8`, override with `COSIMOSI_LLM_MODEL`) and **Voyage AI**
(`voyage-3.5`, override with `COSIMOSI_EMBEDDING_MODEL`). Adding another slot is a new subpackage + one blank import in
`cmd/*`, no consumer change. There is no values key or feature flag for provider selection — provider identity, model
ids, keys, and base URLs are env/secrets only.

The mock adapters are offline and **unmetered** — they bypass the metering seam entirely. They deterministically produce
the same split/name/neurons, embedding vector length, and four semantic stage texts for the same input.

Cost metering is a **decorator at the capability-interface seam** (`internal/ai/metering.go`), so caps and caching apply
uniformly to every provider:

- `ai.per_call_token_cap = 1200` is set as the max-output guard on every LLM request at the seam.
- `ai.daily_call_cap = 200` limits billable LLM/embedding calls per user per UTC calendar day; one shared meter counts
  LLM and embedding calls together.
- Identical inputs are cached inside a bounded per-seam cache (keyed by user + the port adapter's content hash) so
  retries and re-runs do not re-bill and long-running workers do not grow memory without bound. A response the port
  adapter rejects (its `Validate` hook fails) is **not** cached, so an identical retry can re-sample rather than being
  served a poisoned entry.
- Over-limit calls return a typed `CostLimitError` whose retry time is the next UTC calendar day.

Every provider client normalizes vendor failures into the shared typed error set — the only errors that cross out of
`internal/ai`: `RateLimitedError` (retryable), `AuthFailedError` (terminal), `CostLimitError` (cost-capped), and
`MalformedStructuredOutputError` (schema violation; the retry decision belongs to the port adapter). No vendor SDK error
type escapes the package.

## 3. Jobs Queue

`apps/api/db/queries/memory/jobs.sql` owns the worker-side queue operations:

- `ClaimDueJob`: claims the oldest due `pending` job, or a `running` job whose lease has expired, and marks it
  `running` with `FOR UPDATE SKIP LOCKED`.
- `CompleteJob`: marks a claimed job `done`.
- `RetryJob`: marks a failed attempt `pending`, increments attempts to the caller-computed value, and writes
  `next_run_at`.
- `FailJob`: marks an exhausted or unhandled job `failed`.
- Current-source reads and conditional derived writes are scoped by `user_id`, target identity, and
  `representation_revision`.
- `PurgeTerminalJobs` removes a bounded batch of terminal queue metadata older than
  `ai.job_terminal_retention_days`; it preserves a failed retention job while its release group still exists.

Backoff is deterministic: `ai.job_backoff_base_ms * 2^attempts`, no jitter. A claimed `running` row uses
`next_run_at` as its lease deadline for `ai.job_lease_ms`. Ordinary jobs are marked `failed` after
`ai.job_max_attempts`; retention jobs remain retryable because they are the durable executor for a user-originated
release. A cost-limit error is scheduled for the next UTC calendar day without incrementing `attempts`. Regular AI
handlers never delete domain rows. The narrow `retention_sweep` handler is the sole worker path that hard-deletes data,
and it can act only on an existing user-created release group at or after that group's restore deadline.

`consolidate` is now an active identity/revision-fenced re-embedding path. Still-unhandled reserved kinds (`extract`,
`link`) are marked `failed` by the generic runner without panicking.

Transient queue I/O errors during claim, complete, retry, or fail are logged and the runner continues polling. Context
cancelation remains the shutdown signal.

## 4. Worker Effects

Active work rows carry an empty JSON payload. Their identities and expected revisions live in normalized `job_targets`
rows, so pending, running, and terminal queue records never retain a snapshot of a Diary body, memory text, neuron
name, or semantic-stage text.

`embed` jobs load each target neuron by user, id, liveness, and expected `representation_revision` immediately before
calling `Embedder.Embed`. The resulting embedding is written only if the same target is still live at that revision;
release, sealing, or a concurrent representation rewrite turns the work into a successful no-op.

`semanticize` jobs apply the same current-read fence to an episodic-memory target, refuse a blank generated rung as a
retryable provider failure, and finish through one completion transaction: under the per-user graph advisory lock it
re-validates the running lease + live revision, merges the generated ladder over the live kept stages, finalizes any
pending gist rise (visible stage + one non-blank stage-identified provenance row per newly materialized stage, dated
at the crossing), and marks the job done atomically — a lost fence applies no side effect and a replayed completion is
a no-op. `consolidate` jobs use identity/revision targets rather than source snapshots as well.

Every successful `Release` enqueues one deduplicated `retention_sweep` target for its release group at exactly
`deleted_at + release.soft_delete_retention_days`, in the same transaction as the soft delete. The handler locks that
specific group, treats `deadline <= now` as due, and invokes the scoped deletion sequence. Restore before the deadline
cancels the trigger; an already-restored or already-swept target is a harmless no-op. The normal worker poll loop is the
operational trigger—there is no separate cron or scheduler.

`GetUniverse` now reads nullable `semantic_stages`: before the worker fills the value it is `NULL`; after the worker
fills it, the stages appear on the next read/refetch. No polling, server-streaming, or diary mutation is introduced.

## 5. Runtimes

`cmd/worker` is the standalone process. It opens the Postgres pool, builds the `memory/pg` queue/store, selects AI
adapters, and runs the generic job loop. It (and `cmd/api`) blank-import `internal/ai/anthropic` and
`internal/ai/voyage` so those providers register with the factory before env selection runs.

`cmd/api` can run the same memory worker as a dev goroutine when `COSIMOSI_DEV_WORKER=1`; `docker-compose.yml` enables
that path for the local API container. The production image contains both `/api` and `/worker`, and
`docker-compose.prod.yml` runs them as separate services from the same immutable image tag. Backend rollout stops both
old processes before queue-contract migrations, then starts both on the migrated schema; a failed migration restores
the prior image selection and only the services that had been running. Runtime environment and secrets stay out of
`spec/values.yaml`.
