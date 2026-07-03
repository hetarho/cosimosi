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

Dates cross the wire as ISO `YYYY-MM-DD` strings; the handler parses with `time.DateOnly` and the pg adapter stores
`DATE`. All four RPCs resolve `platform.UserScope` from the auth context; none is in `publicProcedures`, so they are
auth-protected by default.

## 2. Use-cases (`internal/memory`)

`memory.Service` (constructed via `NewService(ServiceDeps)`) owns all policy; the `memory/rpc` handlers only map
proto↔domain and call it (§2.9#7):

- **`Encode`** — assembles the dedup-candidate set (neurons whose name occurs in the body, longest names first,
  bounded by `encode.dedup_body_match_limit`; + embedding kNN over the body vector — **best-effort**: a failing
  embedder degrades the assist instead of failing the preview; merged and deduped by id), calls `Extractor.Split`,
  then enforces: count in
  `[encode.min_memories, encode.max_memories]`, ≥ `encode.min_semantic_neurons` semantic neuron per memory, types in
  {semantic, spatial, entity}, estimated output ≤ `encode.max_output_tokens`. Repairable violations re-prompt through
  `Extractor.ReviseSplit(prior, instruction)` up to `encode.max_revise_retries`, then `ErrEncodeRetryExhausted`
  (→ `CodeResourceExhausted`). Structural breaches (unknown mood/type, blank name) are `ErrEncodeInvalidSplit`
  immediately — an adapter contract breach is not re-prompted.
- **`ReviseSplit`** — validates the client-supplied prior result structurally, then the same enforcement loop.
- **`PersistEncoded`** — re-validates the confirmed split (a hand-crafted `LaunchStars` cannot bypass the policy)
  and **rejects a future-dated diary** (beyond UTC today + 1 day of timezone slack — a future date would advance the
  monotonic clock past real time and permanently past-date every later diary), then in **one transaction**
  (`LaunchRepo.InLaunchTx`): monotonic-guard read → Diary insert (append-only, [I2]) → if past-dated, commit the
  Diary alone and launch nothing ([I10][T1]; the wire signal is `memory_ids == []` — the response shape is
  plan-fixed, and plan 27's writing flow shows the notice before launching) → neuron resolution (exact lowercased
  (name, type) against existing neurons; in-batch dedupe; genuinely new neurons created once) → `EpisodicMemory`
  inserts (`seed` generated, `base_strength = ArousalToInitialStrength(arousal)`, `created_universe_time =
  diary_date`, `current_text` = the diary body until reconsolidation rewrites it [R8a]) → `NeuronActivation` inserts
  (`encode.activation_weight`, uniform in Epic A) → the **`Linker` seam** (nil until job 27 wires `Link`) → `embed`
  (one job, new neurons only) + `semanticize` (one per memory) enqueue.
- **`Universe`** — `UniverseReader.GetUniverse` + the snapshot-derived universe time.

Ports consumed (consumer-owned, `ports.go`): `Extractor`, `Embedder`, `NeuronCandidateRepo`, `LaunchRepo`/`LaunchTx`,
`UniverseReader`, `JobQueue` (via `LaunchTx.EnqueueJob`), `Linker`. `LaunchTx` deliberately exposes no Diary update
and no delete, so the launch path cannot express an [I1]/[I2] violation.

## 3. Persistence (`db/queries/memory/encode.sql`, `memory/pg`)

- `LatestLaunchedUniverseTime` — the monotonic guard read (also the newest-launch fact).
- `ListNeuronCandidatesInBody` — case-insensitive name-occurs-in-body match over unsealed, named neurons.
- `ListNeuronsByNames` — exact lowercased-name resolution for persist-time dedup.
- `ListNearestNeuronCandidates` — pgvector cosine kNN over `embeddings` (HNSW), bounded by
  `encode.dedup_similarity_threshold` + `encode.dedup_top_k`.

All are `user_id`-scoped (`pnpm lint:persistence`). `Store.InLaunchTx` binds one pgx transaction to a tx-scoped
`Store` implementing `memory.LaunchTx`; a store built over a plain `DBTX` (no `BeginTx`) returns
`ErrTxStarterRequired`.

## 4. Values (`spec/values.yaml` `encode.*`)

`min_memories` 2 · `max_memories` 5 · `min_semantic_neurons` 1 · `max_revise_retries` 3 · `max_output_tokens` 1000 ·
`dedup_similarity_threshold` 0.85 · `dedup_top_k` 8 · `dedup_body_match_limit` 32 · `activation_weight` 1.0.
Generated into `internal/platform/values` and `packages/config/src/values.gen.ts`; never hardcoded at call sites.

## 5. Composition root

`cmd/api` wires DB pool → `memorypg.NewStore` → `memory.NewService` (with `internal/ai`'s env-selected real/keyless
adapters) → `memoryrpc.NewServer` → `platform.WithRPCService` (the generic Connect-service mount that reuses the
platform interceptor chain). Without `DATABASE_URL` the API boots and only skips the memory service. The keyless
`MockExtractor` emits `values.EncodeMinMemories` memories, each with a semantic neuron, so the dev flow passes the
encode invariants.
