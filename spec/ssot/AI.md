# AI AI providers & worker
> r2 | the AI seam behind the memory-owned ports (provider clients, runtime config, metering, keyless mock) and the Postgres job queue and worker that run slow AI work

## decisions
- AI-1 [o] AI is consumed only through five memory-owned ports; `internal/ai` holds their concrete adapters and no domain behavior (no split, dedup, linking, synapse, gist or diary rule) →=ARCH
  | port | call | consumer | runs |
  |---|---|---|---|
  | `Extractor` | `Split`, `ReviseSplit` | split preview and revise →=ENC | sync, inside the RPC |
  | `Embedder` | `Embed` | neuron embeddings; the split's dedup kNN assist →=ENC-10 | worker (`embed`, `consolidate`); best-effort sync on the split |
  | `Semanticizer` | `GenerateSemanticStages` | the four gist stage texts →=CONSOL-7 | worker (`semanticize`) |
  | `PredictionError` | `Differs` | the reconsolidation gate →=RECALL-6 | sync, inside the recall transaction |
  | `SealSuggester` | `Suggest` | letting-go seal candidates →=DEL-6 | sync |
  - ports and their DTOs are declared in `internal/memory`; `internal/ai` may import those DTOs, `internal/memory` never imports `internal/ai`
  - no proto, sqlc or vendor SDK type crosses a port
  - AI ports have no golden-parity TS mirror; contract tests pin them with deterministic fakes
  - forgetting texts never come from an AI port →=FORGET-9
  - the demo calls no AI port →=DEMO
- AI-2 [o] an AI provider is a pure request/response dependency: no AI port or provider writes, reshapes or deletes product state, and a `Diary` is never an AI output →!INV-2
  - the AI only proposes (a split, stage texts, a bool, seal candidates); the owning use-case validates and writes
  - a failed or retry-exhausted AI job deletes nothing →!INV-1
- AI-3 [o] every LLM port output is schema-forced: the requested JSON Schema has no field through which a reply could violate an invariant, so a prompt-injected answer cannot produce one structurally →=WRITE-8
  | port | output shape | structural limit |
  |---|---|---|
  | `Extractor` | `{memories:[{name, mood, source_text, neurons:[{name, type}]}]}` | no position, colour, strength, time or delete field; `mood` and neuron `type` are enums over the closed domain sets |
  | `Semanticizer` | `{stages:[string]}` | exactly four (`minItems` = `maxItems` = 4); a blank rung is refused |
  | `PredictionError` | `{differs: boolean}` | a bool: the boundary is the model's judgement, so no threshold exists to tune |
  | `SealSuggester` | `{candidates:[{neuron_id, reason}]}` | `neuron_id` is an enum over the offered this-memory-only candidates; no command field |
  - every object is closed (`additionalProperties: false`); the port adapter parses and rejects what the domain cannot use
  - the prompt is the other half: existing-neuron lists and the revise instruction are framed as data, never instructions; neither half replaces the other
  - `source_text` is the one prose field: the prompt mandates quoting, and whether a passage is the writer's words is judged in `internal/memory` (`sourcetext.go`), never by the adapter →=ENC-1
  - `ReviseSplit` receives the diary body beside the prior result, so a repair re-quotes the diary instead of copying the output it corrects
  - the `Semanticizer` prompt sends the memory's `SemanticizeMemory` (name, current text, mood, neurons), never the `Diary` body, and asks only for four stage texts; what each stage means →=CONSOL-7
- AI-4 [?] the output language of user-visible model prose is unpinned: the `Semanticizer` and `SealSuggester` prompts are English and name no output language, both mocks answer in English, and gist texts and seal reasons reach users verbatim →~CONSOL-7 →~DEL-15
  - only the `Extractor` pins a language: `name` is written in the diary's language
  - open: whether these prompts must fix the output to the diary's or the user's language, or the language stays model-chosen
- AI-5 [o] `internal/ai` has two insulation levels: port adapters own task knowledge, provider clients own vendor knowledge ← a vendor swap then rewrites a thin client, never the prompts, schemas or domain mapping
  | level | owns | never holds |
  |---|---|---|
  | port adapter (the five `Real*` types) | prompts, output schemas, DTO mapping, cache keys and hooks | a vendor SDK type, an HTTP header, a model id |
  | provider client (one subpackage per vendor) | transport, auth, model id, native structured output, error normalization, model listing | prompt text, a domain DTO, what a call is for |
  - no per-provider prompt forks: a provider that cannot honour the structured-output contract is not a valid provider
- AI-6 [o] the capability interfaces are `LLMClient.CompleteJSON` (prompt + output JSON Schema + max output tokens → conforming JSON) and `EmbeddingClient.Embed` (texts + dimension → vectors), declared in `internal/ai` beside the port adapters →!AI-5
  - minimal by design: no streaming, no tool calling, no chat-session state; a capability is added when a consumer earns it
  - dependency points inward: provider subpackages import `internal/ai`, never the reverse; the driver registry (`RegisterLLMProvider`, `RegisterEmbeddingProvider`, the model-lister twins, called from each `init`) is filled by blank imports in `cmd/*`
  - adding a provider is a new subpackage plus one blank import per root, with no consumer change
- AI-7 [o] `LLMClient` guarantees full requested-schema conformance: a completion is returned only when it finished and validates locally against the whole requested schema, else `MalformedStructuredOutputError` ← a truncated or filtered body can still be valid JSON →~AI-29
  - native structured output is defense in depth, never the trust boundary; the validator (`santhosh-tekuri/jsonschema`) stays inside the provider package
  - finished = exactly one choice with finish reason `stop`; length, content filter, tool calls, error, empty or unknown states are malformed even with a valid JSON body
  - the client never retries malformed output: the port adapter's caller decides (a job retries with backoff →~AI-35, a sync RPC fails)
- AI-8 [o] `EmbeddingClient` returns exactly one `ai.embedding_dim`-length vector per input, in input order; a model that cannot produce that dimension fails at adapter construction, never at row insert
  - the client checks count, contiguous indices and dimension; `RealEmbedder` re-checks count and dimension before anything is cached
- AI-9 [o] provider failures cross `internal/ai` only as the typed error set; no vendor SDK error or response type escapes
  | error | meaning | handling |
  |---|---|---|
  | `RateLimitedError` | throttling, overload, upstream 5xx, a transport fault while the caller's context is live | retryable; a provider `Retry-After` becomes the retry time →~AI-35 |
  | `AuthFailedError` | bad or missing key, forbidden model, any request the provider will keep rejecting | terminal: an operator must act |
  | `CostLimitError` | the local per-user daily cap tripped | retry at the next UTC day →=AI-27 |
  | `MalformedStructuredOutputError` | output incomplete or not schema-conforming | the port adapter's caller decides →=AI-7 |
  - caller cancellation and deadline return `ctx.Err()` unchanged: control flow, not a provider failure
  - causes carry status and category only, never vendor messages, response bodies, prompts or keys; a genuine transport cause stays reachable through the chain
  - an LLM response body is read under a structural byte bound (code constant) and an oversized one is malformed output; error bodies are drained under a bound to keep connection reuse
- AI-10 [o] the daily cap is the one provider-side failure answered with a product refusal: crossing a memory port, `CostLimitError` is wrapped as `memory.ErrAiCallCapReached` (multi-`%w`, `RetryAt` still reachable) →=ERR
  - RPC: `ResourceExhausted` with `MEMORY_AI_CALL_CAP_REACHED`, copy `error_memory_ai_call_cap_reached`; the window is UTC, so copy never promises a local reset time
  - every other provider failure on a sync RPC surfaces as an internal error →=ERR
- AI-11 [o] OpenRouter (`openrouter`) is the only production LLM provider and Voyage AI (`voyage`) the separate direct embedding provider; the two capabilities stay separate contracts ← one gateway key and a reviewed catalog replace per-vendor adapters and credentials, while OpenRouter becomes the LLM availability and billing dependency and may add latency
  | capability | registry slots | implemented |
  |---|---|---|
  | LLM | `openrouter` | `internal/ai/openrouter` |
  | embedding | `voyage`, `openai`, `gemini` | `internal/ai/voyage` |
  - consolidation sits strictly below `LLMClient`; no dormant direct-vendor LLM slot is kept, and leaving OpenRouter is a new change behind the same `LLMClient`
  - no OpenRouter BYOK fan-out to direct vendor keys
  - no embedding request goes through OpenRouter, and the LLM provider never causes re-embedding →=AI-13
  - no cost, latency or availability improvement is claimed without the evaluation evidence →~AI-19
- AI-12 [x] direct LLM adapters: Anthropic (`internal/ai/anthropic`, `claude-opus-4-8`, official SDK, native json_schema output) and DeepSeek (`internal/ai/deepseek`, `deepseek-v4-flash`, JSON Output + local schema validation) ← removed in r2: OpenRouter serves the curated models through one adapter, and the Anthropic SDK leaves `go.mod` with them
- AI-13 [o] the Voyage embedding catalog is exactly one embedding generation wide, the `voyage-4` family (`voyage-4` default, `voyage-4-large`, `voyage-4-lite`) sharing one space ← `embeddings` keeps one vector per neuron with no model column, so a second generation would silently degrade the dedup kNN →=ENC-10
  - an unlisted model is rejected at construction, never guessed
  - widening to another generation is not a catalog edit: it requires re-embedding every stored row and re-tuning `encode.dedup_similarity_threshold`
  - requests send `input_type = document` and `output_dimension = ai.embedding_dim`
  - no Voyage listing endpoint exists: the lister answers from the catalog, filtered to models that can produce `ai.embedding_dim`
  - guard: `TestCatalogIsOneEmbeddingGenerationWide` (`internal/ai/voyage`)
- AI-14 [o] each capability resolves its config independently, in order DB selection → env → keyless mock; the LLM provider identity is fixed to `openrouter`, never an operator choice
  | capability | env fallback |
  |---|---|
  | LLM | `COSIMOSI_LLM_API_KEY` (an OpenRouter key), `COSIMOSI_LLM_MODEL` (an allowlisted `vendor/model`) |
  | embedding | `COSIMOSI_EMBEDDING_PROVIDER`, `COSIMOSI_EMBEDDING_API_KEY`, optional `COSIMOSI_EMBEDDING_MODEL` |
  - `COSIMOSI_LLM_PROVIDER` is not read; a still-set value fails preflight →=AI-23
  - no key and no selection ⇒ that capability's keyless mock →=AI-30
  - an embedding provider named without a key, or an unknown or unimplemented provider, fails the adapter build: never a silent default
  - DB: a per-capability selection (`ai_provider_config`: provider + model) and a per-provider encrypted key (`ai_provider_keys`), both written through the admin console →=ADMIN
  - a DB selection whose key row is absent (cleared or never set) falls through to env → mock, so a clear-then-reselect order degrades the pipeline instead of failing every AI call
  - a key row that exists but is unusable (empty ciphertext, no decrypter, decrypt failure, empty plaintext) is a hard error, never mock
  - production roots build lazily: a bad config fails the first AI call, not process start; the env-only dev worker fails at start →~AI-39
- AI-15 [o] a config change applies without a redeploy: every port call re-resolves the config and rebuilds the adapters only when its fingerprint (sha256 of source, provider, model, key) changes →!AI-14
  - `cmd/api` and `cmd/worker` both resolve through `ResolvingAdapters` over the same tables, so a console change reaches both processes
  - each rebuild logs its resolved mode, the one signal that a change or a degradation to env or mock took effect
  - in-flight calls finish on the replaced adapters; a rebuild starts with empty caches while the meter carries over
  - stored keys are AES-GCM ciphertext (`platform/secretbox`, `LLM_KEY_ENCRYPTION_KEY`), decrypted only by the runtime config source and the composition root's model listing, never inside the admin context and never returned over RPC
  - every process that resolves runtime config needs the same `LLM_KEY_ENCRYPTION_KEY`; a missing or different value makes every keyed DB selection error, never fall back to mock →=ADMIN
  - `internal/ai` declares the `ConfigReader` port and imports no admin code; `admin/pg` implements it
- AI-16 [o] provider config is runtime identity, never product tuning: provider, model ids, keys, endpoints, catalog rows, routing privacy flags and external prices have no `values.yaml` key and no feature flag →=ARCH
  - the endpoint is adapter-owned code, never env, DB or admin config; a proxy override, if ever needed, is that adapter's own deliberate env seam
- AI-17 [o] every real LLM call names one explicit allowlisted `vendor/model`: no default LLM model exists, and an empty or non-allowlisted model fails the adapter build →!AI-18
  - embedding keeps a recorded default (`voyage-4`), overridable by the env or DB model within the catalog →~AI-13
- AI-18 [o] the OpenRouter adapter owns a curated allowlist; the selectable LLM models are that allowlist intersected with live OpenRouter catalog entries advertising both `structured_outputs` and `response_format` in `supported_parameters` →!AI-19
  - the lister (`ListProviderModels(openrouter, llm)`) fails closed: a listing or auth failure, missing or ambiguous capability metadata, or an empty intersection yields no selectable model
  - a model is never admitted because OpenRouter lists it or labels it structured-output capable
  - the allowlist is adapter code: no FE, i18n or values copy of the catalog exists
  - an LLM selection is saved only inside the current intersection: an empty or non-curated model is rejected server-side, and a listing outage keeps the current selection visible but blocks saving a new one →=ADMIN
  - embedding listing stays advisory input help over Voyage's catalog →~AI-13
- AI-19 [o] a model enters the allowlist only after an evidence gate: it passes a fixed, reviewable Korean diary corpus through the production adapter, a named reviewer approves the record, and a real key + model smoke call passes
  - a failed or unevaluated candidate is excluded, not waived
  - scenarios `Split`, `ReviseSplit`, `GenerateSemanticStages`, `Differs`, `Suggest`, through the production prompts, schemas, parsers and domain validators
  - the record states schema and domain-validator pass/fail, reviewer-scored task and source fidelity, provider-reported tokens and inference cost per scenario, and end-to-end p50/p95 latency beside the direct baseline
  - OpenRouter's platform or credit fee is a line apart from inference cost; prices, fees and routing behaviour are rechecked at every evaluation, never kept as constants
  - the corpus is synthetic and checked in (`internal/ai/testdata/llm-evaluation-corpus.json`); the live harness runs only with `COSIMOSI_LIVE_LLM_EVAL=1`, never in the hermetic suite
  - never committed: a real diary, a credential, a raw provider payload or a prompt; keys are never printed
  - warm-up samples are excluded; each measured call runs under a fresh synthetic user scope so the identical-input cache cannot serve it
- AI-20 [o] every OpenRouter completion sends exactly one explicit model and the caller's whole JSON Schema, with request-level zero data retention, data-collecting endpoints denied and every supplied parameter required of the serving endpoint
  - request controls: `response_format` `json_schema` with `strict: true`; `provider.zdr = true`, `provider.data_collection = "deny"`, `provider.require_parameters = true`
  - never sent: a second model or `models` list, an auto-router, a route, preset or plugin, a vendor BYOK key
  - the production OpenRouter account keeps prompt-logging opt-in disabled
  - plain `net/http`, no OpenRouter or OpenAI SDK →~AI-16
- AI-21 [o] fallback is allowed only among eligible endpoints serving the selected model (`provider.allow_fallbacks = true`): no fallback to another model, no auto-router, no silent substitution ← model choice determines quality, behaviour and price
  - the returned model identity is checked against the selected one under OpenRouter's id normalization; a substituted model's answer never crosses `LLMClient`
  - an endpoint fallback can make a request slower →~AI-11
- AI-22 [o] OpenRouter and upstream failures map onto the typed error set as follows →!AI-9
  | condition | error |
  |---|---|
  | 401, 403, or insufficient OpenRouter credits (402) | `AuthFailedError`: terminal, never `CostLimitError` |
  | 429, overload or unavailable, request timeout, upstream 5xx, a transport fault | `RateLimitedError`; `Retry-After` accepted only as non-negative delta-seconds |
  | missing or multiple choices, non-`stop` finish, empty content, malformed JSON, schema violation | `MalformedStructuredOutputError` |
  | caller cancellation or deadline | `ctx.Err()` unchanged |
  - credit exhaustion is a provider-operations failure: it never masquerades as the per-call or daily cap →~AI-10
  - the error envelope's message, metadata and body never cross the adapter
- AI-23 [o] a legacy direct-provider LLM selection fails closed: a stored non-`openrouter` LLM selection or a still-set `COSIMOSI_LLM_PROVIDER` stops the API and the worker before they serve work, with an actionable migration error
  - checked before key lookup and env fallback, so such a selection never becomes OpenRouter, env or mock, and is never reinterpreted with its old key
- AI-24 [o] dormant encrypted legacy provider-key rows are never deleted automatically; removing them is an explicit operator action after the rollback window ← a rollback stays possible and no secret vanishes as a migration side effect
  - the LLM cutover carries no schema change or migration: the existing rows hold `openrouter` + `vendor/model`
- AI-25 [o] cost metering is a decorator at the capability-interface seam, so its caps and cache apply to every provider alike; the keyless mock bypasses it, unmetered and uncached
  - a real call needs an authenticated user scope in its context (`ErrUserScopeRequired`); the worker runs each handler under its job's user
  - order: cache lookup (hit: no charge, no call) → daily-cap charge → provider call → `Validate` → `Cacheable` → cache
  - a charged call counts whether or not the provider then succeeds
- AI-26 [o] the seam sets every real LLM request's max output tokens to `ai.per_call_token_cap`, which stays above `encode.max_output_tokens` so the split trips its own use-case guard first →=ENC
- AI-27 [o] at most `ai.daily_call_cap` billable calls per user per UTC calendar day, LLM and embedding counted together; over it, `CostLimitError` retries at the next UTC day start →~TIME-5
  - a real-clock billing window, independent of universe time
  - the meter is in memory and per process: `cmd/api` and `cmd/worker` each count their own calls and a restart resets the count, so the cap bounds each process, not the user across processes
  - the admin usage view reads the API process's per-capability counts of real calls; cache hits and mock calls never count →=ADMIN
- AI-28 [o] no monthly ceiling, per-provider budget or budget model: the per-call and daily caps are the only spend guards
- AI-29 [o] identical inputs are served from a bounded, process-local cache keyed by user + the port adapter's content hash, so retries and re-runs never re-bill
  - bound `ai.adapter_cache_max_entries` per metered client; the oldest entry is evicted first
  - two hooks, two decisions: `Validate` rejects (error, nothing returned, nothing cached); `Cacheable` returns the response but keeps it out of the cache, because a repair loop re-prompts from a sample it cannot accept and an identical retry must re-draw
  - the `Extractor`'s `Cacheable` is the domain's own judgement (`memory.SplitNeedsRepair`) →=ENC
  - embedding responses are validated (count, dimension) before caching
- AI-30 [o] each port has a keyless deterministic mock: offline, no key, no network, same input → same output, with the same schema-forced shapes and invariants ← tests pass offline, and an adapter swap changes cost and quality, never contract
  | port | mock |
  |---|---|
  | `Extractor` | `encode.min_memories` memories whose `source_text` values are consecutive verbatim word runs partitioning the diary, each with `encode.min_semantic_neurons` semantic neurons plus one spatial and one entity; revise re-splits the diary |
  | `Embedder` | a sha256-derived `ai.embedding_dim` vector per text |
  | `Semanticizer` | four stage texts derived from the name and current text |
  | `PredictionError` | a normalized word-token-set compare: order, spacing and case never differ |
  | `SealSuggester` | exactly the offered candidates with a fixed neutral reason |
  - a capability with no key and no selection runs its mock in any environment; the process log names the mode (`ai_mode=…`)
- AI-31 [o] slow AI work runs asynchronously: the write returns ids, the triggering use-case enqueues the job in its own transaction, and worker results surface on the next read with no polling and no server-streaming →=ARCH
  - a committed write always has its follow-up queued
  - an unfilled `episodic_memories.semantic_stages` reads `NULL` until a later `GetUniverse` finds it filled
  - the Postgres `jobs` table is the queue: no external broker, no cron, no scheduler; the worker's poll loop (`jobqueue.DefaultPollInterval`) is the only trigger
- AI-32 [o] job kinds are a closed, memory-owned set (`memory.JobKind`); each live kind has one handler, and each kind's effect is ruled by its owning domain
  | kind | effect | trigger owner |
  |---|---|---|
  | `embed` | embed target neurons into `embeddings` | launch →=ENC; restore →=DEL-10 |
  | `semanticize` | the four gist stage texts into `episodic_memories.semantic_stages` | launch, reconsolidation, consolidation repair →=CONSOL-7 |
  | `consolidate` | the replay set's re-embed, same target contract as `embed` | →=CONSOL-12 |
  | `retention_sweep` | hard-delete a release group at its restore deadline | →=DEL-14 |
  | `withdrawal_sweep` | purge a withdrawn account | →=ACCT-27 |
  | `achievement_settle` | credit a claimed but unpaid reward | →=ACH-23 |
  | `extract`, `link` | reserved, no handler: extraction runs in `SplitDiary`, linking at launch | →=ENC →=LINK |
  - `internal/platform/jobqueue` is generic mechanism (id, user, kind, attempts, lease, backoff) and imports no memory concept
  - a handler entry with an empty kind, a nil handler or a duplicate kind fails runner construction
- AI-33 [o] queue rows carry no source content: `payload` is always `{}` (CHECK `jobs_payload_empty`) and work identities live in `job_targets` with their expected revisions ← deletion, sealing and privacy then hold for queued work
  | `target_kind` | `expected_revision` |
  |---|---|
  | `episodic_memory`, `neuron` | required, > 0 |
  | `release_group`, `user` | none |
  - no queue row, pending or terminal, holds diary body, memory text, neuron name or stage text
  - a job with no target row is never claimed
  - other contexts schedule through an identity-only seam (`UserJobService`): `withdrawal_sweep` keyed per user, `achievement_settle` keyed per claim; no caller supplies a kind, payload or target shape
  - `(user_id, kind, dedup_key)` is unique when a dedup key is set; enqueue dedups against terminal rows too
- AI-34 [o] a claim takes the oldest due job (`pending`, or `running` past its lease) with `FOR UPDATE SKIP LOCKED`, sets it `running`, leases it for `ai.job_lease_ms` through `next_run_at` and bumps `lease_generation`; concurrent workers claim disjoint rows
  - statuses `pending`, `running`, `done`, `failed`, `cancelled` (CHECK `jobs_status_valid`); a terminal status always carries `terminal_at`
  - complete, retry and fail match only `running` at the claimed `lease_generation`: a worker whose lease expired cannot finalize the row (silent no-op)
  - the lease is its own knob, sized to outlast one handler run, never derived from the backoff
  - `cancelled` comes only from `Release` (memory-targeted jobs, lease bumped) →=DEL-12; a pre-deadline restore requeues exactly the jobs that release cancelled →=DEL-13
  - `ClaimDueJob` and `PurgeTerminalJobs` are the only cross-user queue scans (allowlisted by `pnpm lint:persistence`) →=MEM
- AI-35 [o] a failed attempt increments `attempts` and returns to `pending` at `now + ai.job_backoff_base_ms × 2^attempts` (deterministic, no jitter); at `ai.job_max_attempts` the job ends `failed` and is kept
  - an error carrying its own retry time reschedules to it without consuming an attempt: the daily cap (next UTC day) and a provider `Retry-After`
  - a handler panic is recovered into an ordinary failure
  - queue I/O errors on claim, complete, retry or fail are logged and polling continues; context cancellation is the shutdown signal, and a row left `running` is reclaimed after its lease
- AI-36 [o] two terminal transitions, only one of them policy: `Fail` (retry budget spent) may be overridden per kind, `DeadLetter` (a safety stop) never
  - dead-letter causes: re-claimed past `ai.job_max_claims` without finishing (a handler that kills its worker before any failure is recorded), and an unregistered kind, reserved ones included; never a panic
  - the durable kinds (`retriedIndefinitely`: `retention_sweep` →=DEL-14, `withdrawal_sweep` →=ACCT-27, `achievement_settle` →=ACH-23) override `Fail`: a spent budget resets `attempts` and retries after the base backoff, since each is the only durable trigger for something the user cannot re-request
  - the durable kinds also pass the claim ceiling: the runner reads their claim count as 0 (`Job.JobLeaseGeneration`) while the stored `lease_generation` still fences their writes, so one whose handler kills its worker is re-claimed after every lease, without bound; an unregistered kind still dead-letters them
  - both transitions write the same terminal `failed` row (the dead-letter cause is logged, not stored): nothing is deleted →!INV-1, and an operator may requeue it by hand
- AI-37 [o] worker effects are fenced to the live source: a handler re-reads its targets (user, id, liveness, expected `representation_revision`) right before the provider call and writes only if they still match, so release, sealing or a concurrent rewrite makes the work a successful no-op
  - `embed` and `consolidate` upsert an embedding only for a target still live at its revision
  - the `semanticize` completion (one transaction under the per-user graph lock: lease and revision re-validated, ladder merged, pending rise finalized, blank rung retried) →=CONSOL-12
  - a lost fence applies nothing; a replayed completion is a no-op
  - the worker deletes domain rows only through user-originated sweeps (`retention_sweep` →=DEL-14, `withdrawal_sweep` →=ACCT-27); no AI handler deletes →!INV-1
- AI-38 [o] terminal queue metadata (`done`, `failed`, `cancelled`) is kept `ai.job_terminal_retention_days` real-clock days, then purged in bounded batches by the worker loop
  - cadence `worker.cleanup_interval_s`, batch `worker.cleanup_batch_size`; a full batch reopens the window, so the next claim takes one more batch
  - cleanup fails open: an error is logged and claims continue
  - a terminal `retention_sweep` is kept while its release group exists, so a promised deletion is never dropped →=DEL-14
  - queue maintenance deletes only queue metadata (this purge, an account restore's withdrawal trigger →=ACCT-24, a restored release's retention job →=DEL-13), never a product row →!INV-1
  - it governs identity-only metadata, never `Diary` or memory retention
- AI-39 [o] `cmd/worker` is the production queue process; `cmd/api` runs the same worker as an in-process goroutine only with `COSIMOSI_DEV_WORKER=1` (local `docker-compose.yml`)
  - the production image ships `/api` and `/worker`; `docker-compose.prod.yml` runs them as two services from one image tag
  - both roots blank-import the same provider subpackages and register the same handlers: a seam bound in one root and forgotten in the other is invisible to a build
  - the dev goroutine builds its adapters from env only (`NewAdaptersFromEnv`): DB overrides reach the API's own calls and `cmd/worker`, not the dev worker
  - per-provider `http.Client` timeouts are deployment budgets owned by each composition root (code constants); adapters own endpoints and request shape
  - a queue-contract migration runs only after both old processes stop; a failed migration restores the prior image and only the services that were running →=ARCH

## flow
- port call: use-case → resolving adapter(fingerprint same: reuse | changed: rebuild) → port adapter(prompt, schema, cache key) → meter(cache hit: return | cap reached: `CostLimitError` | charge) → provider client(finished + schema-valid | typed error) → `Validate`(reject | pass) → `Cacheable`(cache | return only) → port error translation
- job: use-case tx(write + enqueue) → claim(`SKIP LOCKED`, lease) → (claim ceiling of a non-durable kind | unregistered kind: `DeadLetter`) → handler(fenced read → port → fenced write) → complete | retry(own retry time: no attempt | backoff) | `Fail`(durable kind: retry)
- model admission: candidate → corpus evaluation through the adapter → reviewed record + smoke call → allowlist → listed while advertising the structured-output parameters → selectable

## constraints
- tuning keys owned here: `ai.per_call_token_cap`, `ai.daily_call_cap`, `ai.adapter_cache_max_entries`, `ai.job_max_attempts`, `ai.job_backoff_base_ms`, `ai.job_lease_ms`, `ai.job_max_claims`, `ai.job_terminal_retention_days`, `worker.cleanup_interval_s`, `worker.cleanup_batch_size`; `ai.embedding_dim` is the width of the `embeddings` vector column →=MEM
- runtime env and secrets stay out of `spec/values.yaml` →=AI-16

## chg
- r2 261102 AI-7✎ partial-native local check→every completion · AI-11✎ 6 LLM slots→openrouter · AI-12- direct LLM adapters · AI-14✎ LLM provider choice→fixed · AI-16✎ id/model/key/endpoint→+catalog/privacy/prices · AI-17✎ LLM default model→explicit allowlisted · AI-18✎ advisory list→enforced allowlist · AI-19+ gate · AI-20+ ZDR · AI-21+ same-model · AI-22+ errors · AI-23+ preflight · AI-24+ keys
- r1 261102 initial
