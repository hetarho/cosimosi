# tech: memory recall

> As-built recall write-path — the backend orchestration of 회고하기 — plus its read-only counterpart, the gist view
> (§8). The architecture frame is [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4–§2.8; plans
> [33.recall-usecase](../plan/33.recall-usecase.md) / [34.view-semantic-usecase](../plan/34.view-semantic-usecase.md)
> own the product shape and [policy/domain/reconsolidation.md](../policy/domain/reconsolidation.md) the domain rule.
> This unit orchestrates the pure rules in [tech/reconsolidation.md](reconsolidation.md); it defines no new numeric
> rule and adds no `values.yaml` key.

## 1. Placement

The `Recall` / `Reinforce` / `Reconsolidate` use-cases are application behavior in the core-domain `internal/memory`
context (`recall.go`), alongside `PersistEncoded` and `SyncToToday` on the same `memory.Service`. The consumer-owned
ports they need (`recall_ports.go`) are declared here because recall is their primary consumer. The persistence
concrete (`memory/pg/recall.go` + `db/queries/memory/recall.sql`) and the thin Connect handlers
(`memory/rpc/server.go`) are the only sqlc/proto seams. The prediction-error LLM adapter lives in `internal/ai`
(`predictionerror.go`). No proto/sqlc/pgx/SDK type crosses into the use-case or pure domain.

## 2. The one transaction

`Recall(scope, operationID, memoryID, rewriteText, syncConsent)` runs in a single `RecallRepo.InRecallTx` so the
receipt lookup + sync + spend + anchors + reinforce + (reconsolidate) + provenance + receipt commit wholly or not at
all; the `Diary` is never in that write set ([I2][R7]). `operationID` is a required client-minted idempotency key
(A2); an empty one is `ErrOperationIDRequired`. Ordered:

0. **Lock + receipt replay** — `LockGraphMutation` (so a user's paid actions serialize), then
   `GetPaidActionReceipt(operationID)`. If a receipt exists whose `action_kind` + canonical
   `request_fingerprint` (hash of memory id + rewrite) match, the stored typed response is decoded and returned with
   **no further work** — a response-loss retry replays the committed result, concurrent duplicates queue on the lock
   and the loser replays (A2/A3). A same-id/**different**-input receipt is `ErrOperationConflict` (A2). This is first,
   before the consent gate, so a committed recall's retry never spuriously re-demands consent.
1. **Sync to today** — `Service.syncToToday(scope, tx, syncConsent)`, the in-transaction body factored out of
   `SyncToToday`. Consent is **server-enforced** ([R1a], A1): if advancing to today would move the clock forward and
   `syncConsent` is false, it returns `ErrSyncConsentRequired` **before any spend/effect** (§6). `universeTime` is the
   post-sync clock.
2. **Load** — `EpisodicMemoryForRecall`; a soft-deleted target is `ErrRecallMemoryUnavailable`, a missing/other-user
   row is `ErrRecallMemoryNotFound` ([R1]). The load precedes the spend so a not-found target never charges.
3. **Spend** — `SpendGate.CheckAndSpend(scope, tx, RecallSpendIntent(operationID, memoryID, accessibilitySignal))`; the
   spend joins this transaction and its intent carries the operation id (the economy seam derives its dedup key). A
   denial aborts the whole transaction (§CC2).
4. **Prediction-error compare** — `PredictionError.Differs(currentText, rewrite)`. **This LLM call runs inside the
   transaction on purpose**: the spend must gate it (an unaffordable recall never pays for the compare) and the spend +
   reinforce must be atomic, which forces the compare between them. Safe here because the per-user graph lock
   serializes a user's writes, the compare is metered + cached + keyless-mock-deterministic, and any error rolls the
   whole recall back.
5. **Reinforce** — on either branch (§3).
6. **Branch** — no error → reinforce only ([R4]); error → `Reconsolidate` (§4).
7. **Receipt commit** — `InsertPaidActionReceipt` writes the receipt (operation id, kind, fingerprint, target memory
   for cascade, the JSON-encoded result) in this same transaction (A3), so a receipt exists iff the whole action
   committed.
8. **Return** — the branch taken, the re-render inputs (`current_text`/`seed`/`recall_count`/`EffectiveStrength`), and
   the `{previous, current}` sync interval for the acceleration replay.

**`RecallDiaryStars(scope, operationID, diaryID, syncConsent)`** ([D3]) is the no-rewrite whole-diary recall: one
`InRecallTx` — lock + receipt replay → consent-gated sync → for each still-live memory born from the diary, spend a
per-memory recall intent (each under an operation-derived **per-member** dedup key, so a replay re-charges no member,
A3) + `Reinforce` → receipt commit — returning the affected ids + the sync interval. It never calls `PredictionError`
or `Reconsolidate`. (The recall cost is the sum of the per-memory recalls; the economy prices each.)

**Paid-action receipts** ([tech/persistence] `memory_paid_action_receipts`, keyed `(user_id, operation_id)`) record
the `action_kind` (`recall|diary_recall|view_semantic`), the canonical `request_fingerprint`, the retained target
(`episodic_memory_id` XOR `diary_id`, `ON DELETE CASCADE`), and the original typed response as JSONB. A receipt is
meaningful only while its target exists, so it needs no independent retention timer — the Epic-H 30-day sweep's cascade
is its only deletion. The receipt ports (`PaidActionReceiptStore`) are consumer-owned by recall and embedded in
`RecallTx` / `ViewSemanticTx`.

**`SyncStatus(scope) → {today, needs_sync}`** is the free `NO_SIDE_EFFECTS` read that drives the client's sync-consent
decision from the SERVER clock ([R1a], A1): `today = utcDate(now)`; `needs_sync` is true iff advancing the clock to
today would move it forward (the same `syncNeedsConsent` guard the recall sync enforces, over the clock-or-latest-launch
baseline). The client never computes "today" from a local `Date` — a UTC-boundary or skewed client can neither bypass
nor spuriously require consent.

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

**Remaining-stage regeneration reuses the `semanticize` job**, not a new kind: the job carries identity + the
post-rewrite `representation_revision` only (an empty payload — the deletion-safe queue contract). The worker re-reads
the live memory/neurons immediately before the LLM call, regenerates all four stage texts from the current
`current_text`, and hands them to the **completion transaction**, which — under the per-user graph lock and the
lease/revision fence — keeps the LIVE already-risen non-blank texts (z-axis one-way, [C7]), takes the regenerated
rest, finalizes any pending gist rise with its stage-identified provenance rows, and completes the job atomically. A
launch semanticize has nothing risen, so it writes all four. Async LLM pass; texts fill on the next read (optimistic
write §2.8).

## 5. The consumer-owned ports (`internal/memory`, §2.4)

- **`SpendGate.CheckAndSpend(scope, tx EconomyTx, SpendIntent) → error`** — check-and-spend for a recall/gist-view
  action. The `SpendIntent` names the action kind + target memory + client operation id (+ stage for gist-view) — depth
  signals + the identity the economy seam derives the spend's dedup key from, **never a price** (§CC2). The `tx`
  handle joins the spend to the caller's transaction, so the debit commits or rolls back with the recall/view. Declared
  once, shared with the gist-view use-case. Shipped default `AllowAllSpendGate` charges nothing (the loop works with no
  economy); the real balance-check + deduct rebinds at `cmd/api`, where the spend row is written with the
  operation-derived dedup key so a duplicate append applies no second balance delta (A3). A denial returns the
  canonical `ErrInsufficientTwinkle`.
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

`Recall(RecallRequest{memory_id, rewrite_text, operation_id, sync_consent}) → RecallResponse{reconsolidated,
current_text, seed, recall_count, effective_strength, previous_universe_time, universe_time}` and
`RecallDiaryStars(RecallDiaryStarsRequest{diary_id, operation_id, sync_consent}) →
RecallDiaryStarsResponse{diary_id, episodic_memory_ids, previous_universe_time, universe_time}`. Both are **not**
`NO_SIDE_EFFECTS` (they spend, sync, and may write). `rewrite_text` (and `diary_id`) is the only content the client
sends — no seed/strength/decay/price field exists, so reshape/bump/anchors/price/affected-ids are all server-derived
(§2.9#8); `operation_id` is the required idempotency key and `sync_consent` the explicit clock-advance consent.
`SyncStatus(SyncStatusRequest{}) → SyncStatusResponse{today, needs_sync}` is the free `NO_SIDE_EFFECTS` read that
drives the client's consent decision (§2). Handlers are thin: map proto↔domain, call the use-case, map the result
back; `ErrRecallInputRequired`/`ErrOperationIDRequired` → `InvalidArgument`, `ErrOperationConflict` → `AlreadyExists`,
`ErrRecallMemoryNotFound` → `NotFound`, `ErrRecallMemoryUnavailable`/`ErrSyncConsentRequired` → `FailedPrecondition`,
`ErrInsufficientTwinkle` → `ResourceExhausted`.

## 7. Per-user isolation

Every read, spend, compare, write, and provenance append is scoped to `platform.UserScope`; every query filters
`user_id` (`lint:persistence`). The recall reads (`EpisodicMemoryForRecall`, member neurons/synapses, neighbor
shared-semantic counts, live diary memories) and writes (anchors, `current_text`/`seed`, `AddForgettingOffset`,
`AppendMemoryProvenance`, `UpsertSynapse`) carry the user id, so a cross-user recall resolves to
`ErrRecallMemoryNotFound`.

## 8. The gist view (`ViewSemantic`) — the read-only counterpart ([R8])

`ViewSemantic(scope, operationID, memoryID, stage)` (`view_semantic.go`) is the semantic half of the recall/view
asymmetry: it returns the pregenerated `semantic_stages` text for one gist stage and **writes nothing but its debit +
receipt** — no anchors, no provenance, no LLM, no clock advance ([I2][I8][I10]). It runs in a memory-owned transaction
(`ViewSemanticRepo.InViewSemanticTx` → the narrow `ViewSemanticTx` = graph lock + gist read + receipt store) so the
target read, the receipt lookup/insert, and the Twinkle spend commit together (A3): a response-loss retry with the same
`operation_id` replays the committed gist text with no second debit, and a same-id/different-stage reuse is
`ErrOperationConflict`. Stages are the 1-based ladder ([C6a]: `semantic_stage` 0 = concrete, nothing viewable; 1..4 =
the pregenerated texts, stage _k_'s text at array index _k−1_); the valid upper bound is the **derived** stage-array
length, never a declared count.

|                      | trigger                | acts on                       | mutation                                                                      | cost direction                             | owner        |
| -------------------- | ---------------------- | ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------------ |
| **회고 (recall)**    | 회고하기 button ([R1]) | _episodic_ memory (해마)      | brightness reset, decay recovery, timer reset, LTP, maybe rewrite ([R2]–[R7]) | **costlier the deeper the decay** ([F4])   | §2–§4        |
| **요지 열람 (view)** | gist-star view ([R8])  | _semantic_ gist text (신피질) | **none** (read-only)                                                          | **cheaper the deeper the gist** ([R8][G4]) | this section |

Ordered flow (inside `InViewSemanticTx`) — lock + receipt replay first, then every refusal precedes the spend, and
after a successful spend no error path remains before the text:

0. **Lock + receipt replay** — `LockGraphMutation` then `GetPaidActionReceipt(operationID)`; a matching
   `view_semantic` receipt (fingerprint = memory id + stage) replays the stored text with no debit, a same-id/different
   input is `ErrOperationConflict` (A2/A3). An empty operation id is `ErrOperationIDRequired`.
1. **Validate input** — empty id / `stage < 1` → `ErrViewSemanticInputRequired` (`InvalidArgument`).
2. **Load** — `tx.EpisodicMemoryGist(scope, memoryID) → MemoryGist{SemanticStage, SemanticStages}` on the transaction.
   The pg concrete (`memory/pg/view_semantic.go` + `db/queries/memory/view_semantic.sql`) is a pure user-scoped
   SELECT excluding soft-deleted rows; missing/other-user/soft-deleted → `ErrViewSemanticMemoryNotFound` (`NotFound`).
   (Full-delete hides the whole row from the universe; release semantics beyond that are the deletion epic's.) The
   quote path (`ViewableGistStage`) reads the same columns standalone via the `GistReader` port bound to the pool.
   `QuoteSpend(kind=GIST_VIEW, semantic_stage=stage)` uses that reached stage as the upper-bound check and prices the
   exact selected stage, so the displayed quote and this spend share one depth signal.
3. **Server-authoritative stage check** (§2.9#8) — `semantic_stages` non-NULL **and** `stage ≤ len(stages)` **and**
   `stage ≤ semantic_stage`, else the canonical `ErrViewSemanticStageNotRisen` (`FailedPrecondition`): the unit never
   fabricates a text for an unreached stage.
4. **Spend** — `SpendGate.CheckAndSpend(scope, tx, GistViewSpendIntent(operationID, memoryID, stage))`, the **same port
   and the same bound instance** as recall (§5); the spend joins this transaction. Kind `view_gist`, carrying the
   requested `stage` as the gist-depth signal (a monotone "how abstracted" measure) — never a price; the economy's
   curve maps a deeper signal to a **cheaper** price, the inverse of recall's decay-cost direction ([G4]). The spend is
   a **precondition of the read**: `ErrInsufficientTwinkle` (`ResourceExhausted`) returns no text. The allow-all no-op
   default charges nothing.
5. **Receipt commit + return** — `InsertPaidActionReceipt` in the same transaction, then `{memoryID, text, stage,
reachedStage}`; the RPC `ViewSemantic(ViewSemanticRequest{episodic_memory_id, stage, operation_id}) →
ViewSemanticResponse{text, stage, reached_stage}` is unary and **not** `NO_SIDE_EFFECTS` (it spends), with a thin
   handler mapping proto↔domain only.

Not golden-parity: a server-only read+spend — the client renders the returned text and never recomputes the signal or
the reached stage.
