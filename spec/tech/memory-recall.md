# tech: memory recall

> As-built recall write-path — the backend orchestration of 회고하기. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4–§2.8; plan [33.recall-usecase](../plan/33.recall-usecase.md) owns the
> product shape and [policy/domain/reconsolidation.md](../policy/domain/reconsolidation.md) the domain rule. This unit
> orchestrates the pure rules in [tech/reconsolidation.md](reconsolidation.md); it defines no new numeric rule and adds
> no `values.yaml` key.

## 1. Placement

The `Recall` / `Reinforce` / `Reconsolidate` use-cases are application behavior in the core-domain `internal/memory`
context (`recall.go`), alongside `PersistEncoded` and `SyncToToday` on the same `memory.Service`. The consumer-owned
ports they need (`recall_ports.go`) are declared here because recall is their primary consumer. The persistence
concrete (`memory/pg/recall.go` + `db/queries/memory/recall.sql`) and the thin Connect handlers
(`memory/rpc/server.go`) are the only sqlc/proto seams. The prediction-error LLM adapter lives in `internal/ai`
(`predictionerror.go`). No proto/sqlc/pgx/SDK type crosses into the use-case or pure domain.

## 2. The one transaction

`Recall(scope, memoryID, rewriteText)` runs in a single `RecallRepo.InRecallTx` so sync + spend + anchors + reinforce +
(reconsolidate) + provenance commit wholly or not at all; the `Diary` is never in that write set ([I2][R7]). Ordered:

1. **Sync to today** — composes `Service.syncToToday(scope, tx)`, the in-transaction body factored out of `SyncToToday`
   so recall advances the clock on its own transaction (the consent gate is the UI's, [R1a]). `universeTime` is the
   post-sync clock.
2. **Spend** — `SpendGate.CheckAndSpend(scope, RecallSpendIntent(memoryID))`; a denial aborts the whole transaction
   (§CC2).
3. **Load** — `EpisodicMemoryForRecall`; a soft-deleted target is `ErrRecallMemoryUnavailable`, a missing/other-user
   row is `ErrRecallMemoryNotFound` ([R1]).
4. **Prediction-error compare** — `PredictionError.Differs(currentText, rewrite)`. **This LLM call runs inside the
   transaction on purpose**: the spend must gate it (an unaffordable recall never pays for the compare) and the spend +
   reinforce must be atomic, which forces the compare between them. Safe here because the per-user universe clock
   serializes a user's writes (a user cannot launch while recalling), the compare is metered + cached +
   keyless-mock-deterministic, and any error rolls the whole recall back.
5. **Reinforce** — on either branch (§3).
6. **Branch** — no error → reinforce only ([R4]); error → `Reconsolidate` (§4).
7. **Return** — the branch taken, the re-render inputs (`current_text`/`seed`/`recall_count`/`EffectiveStrength`), and
   the `{previous, current}` sync interval for the acceleration replay.

**`RecallDiaryStars(scope, diaryID)`** ([D3]) is the no-rewrite whole-diary recall: one `InRecallTx` — sync → for each
still-live memory born from the diary, spend a per-memory recall intent + `Reinforce` — returning the affected ids + the
sync interval. It never calls `PredictionError` or `Reconsolidate`. (The recall cost is the sum of the per-memory
recalls; the economy prices each.)

## 3. `Reinforce` — the idempotent recall-effects bundle

`reinforce(scope, tx, memoryID, universeTime)` applies on **every** recall (both branches, and per memory in the
whole-diary jump):

- **Anchor reset** (`ResetRecallAnchors`, one write): `last_recalled_universe_time = universeTime`, `recall_count += 1`,
  `semanticize_timer_reset_at = universeTime`; `RETURNING recall_count, base_strength` so the caller derives the bumped
  read-time `EffectiveStrength(base, recall_count)` ([R2][R3][C6a]).
- **Batch LTP** ([R3]): each synapse whose both endpoints are the recalled memory's member neurons is `Potentiate`d
  once toward the cap and written by the existing `UpsertSynapse` (co_activation_count via the DB-side `+= 1` delta,
  last_activated moved to `universeTime`). Idempotent per recall event (one pass; a rolled-back attempt leaves no
  trace). The strength math stays in the pure `Potentiate` — never re-derived in SQL. No memory↔memory edge is ever
  touched ([I4][I6][I9]).
- **Neighbor forgetting ±** ([R5]): each neighbor's shared **semantic**-neuron count is mapped through
  `NeighborForgettingDelta`; neighbors are grouped by their (exact-constant) signed delta and each non-zero group is
  applied in one `AddForgettingOffset` write, in a stable sorted order. The recalled memory takes no self-offset
  ([F5]).

## 4. `Reconsolidate` — prediction-error only

`reconsolidate(scope, tx, memory, rewriteText, universeTime)` ([R6][C7]): `current_text ← rewriteText`; `seed ←
Reshape(seed, freshEntropy)` (the use-case mints the randomness so the domain stays pure); enqueue the remaining-stage
regeneration; append one `reconsolidated`/`source=user` `memory_provenance` row. The anchors, LTP, strength bump, and
neighbor ± already ran in `Reinforce`. The `Diary` is untouched ([I2]).

**Remaining-stage regeneration reuses the `semanticize` job**, not a new kind: `SemanticizeJobPayload` carries
`KeepStages` (= the memory's current `semantic_stage`) and `KeptStages` (the existing `semantic_stages`). The worker
regenerates all four stage texts from the new `current_text`, then keeps the first `KeepStages` already-risen texts
(z-axis one-way, [C7]) and takes the regenerated rest. A launch semanticize sets neither field (`omitempty`), so it
keeps nothing and writes all four — unchanged behavior. Async LLM pass; texts fill on the next read (optimistic write
§2.8). (In v1 `semantic_stage` never advances until the consolidation epic, so the boundary is 0 and all four
regenerate; the merge is stage-aware from day one so it stays correct once rising ships.)

## 5. The consumer-owned ports (`internal/memory`, §2.4)

- **`SpendGate.CheckAndSpend(scope, SpendIntent) → error`** — check-and-spend for a recall/gist-view action. The
  `SpendIntent` names the action kind + target memory (+ stage for gist-view) — a depth signal, **never a price** (§CC2).
  Declared once, shared with the gist-view use-case. Shipped default `AllowAllSpendGate` charges nothing (the loop
  works with no economy); the real balance-check + deduct rebinds at `cmd/api`. A denial returns the canonical
  `ErrInsufficientTwinkle`. _(Deferred to the economy epic: the port takes no transaction handle, so making the real
  deduct atomic with the recall transaction — vs. compensating a committed charge — is the binding epic's decision;
  today the no-op makes it moot.)_
- **`PredictionError.Differs(currentText, rewrite) → (bool, error)`** — declared by the reconsolidation rules; this unit
  wires the concrete AI adapter (schema-forced bool, keyless-mock deterministic via a normalized-token-set compare,
  metered by the per-call/day AI caps) and calls it.
- **`MemoryProvenanceStore.AppendMemoryProvenance`** / **`ForgettingOffsetStore.AddForgettingOffset`** — embedded in
  `RecallTx` so the append and the neighbor ± join the recall transaction; the concretes are the reconsolidation-rules
  pg writes.
- **`RecallRepo.InRecallTx` / `RecallTx`** — the recall transaction surface. `RecallTx` embeds `ProgressionTx` (clock +
  job queue, for the sync advance and the regen enqueue) and exposes no Diary write and no delete, so the recall path
  cannot express an [I1]/[I2] violation. The pg `Store` implements it (method names match).

## 6. RPC contract (`memory.v1.MemoryService`, Connect unary)

`Recall(RecallRequest{memory_id, rewrite_text}) → RecallResponse{reconsolidated, current_text, seed, recall_count,
effective_strength, previous_universe_time, universe_time}` and `RecallDiaryStars(RecallDiaryStarsRequest{diary_id}) →
RecallDiaryStarsResponse{diary_id, episodic_memory_ids, previous_universe_time, universe_time}`. Both are **not**
`NO_SIDE_EFFECTS` (they spend, sync, and may write). `rewrite_text` (and `diary_id`) is the only content the client
sends — no seed/strength/decay/price field exists, so reshape/bump/anchors/price/affected-ids are all server-derived
(§2.9#8). Handlers are thin: map proto↔domain, call the use-case, map the result back; `ErrRecallInputRequired` →
`InvalidArgument`, `ErrRecallMemoryNotFound` → `NotFound`, `ErrRecallMemoryUnavailable` → `FailedPrecondition`,
`ErrInsufficientTwinkle` → `ResourceExhausted`.

## 7. Per-user isolation

Every read, spend, compare, write, and provenance append is scoped to `platform.UserScope`; every query filters
`user_id` (`lint:persistence`). The recall reads (`EpisodicMemoryForRecall`, member neurons/synapses, neighbor
shared-semantic counts, live diary memories) and writes (anchors, `current_text`/`seed`, `AddForgettingOffset`,
`AppendMemoryProvenance`, `UpsertSynapse`) carry the user id, so a cross-user recall resolves to
`ErrRecallMemoryNotFound`.
