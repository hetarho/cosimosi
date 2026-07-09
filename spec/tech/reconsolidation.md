# tech: reconsolidation rules

> As-built rules and persistence for recall-time reconsolidation. The architecture frame is
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4–§2.6; plan [32.reconsolidation-rules](../plan/32.reconsolidation-rules.md)
> owns the product shape and [policy/domain/reconsolidation.md](../policy/domain/reconsolidation.md) the domain rule.
> This unit is pure rules + schema + the gate contract; the recall use-case orchestrates them.

## 1. Placement

The pure numeric rules and the gate contract live in the core-domain `internal/memory` context
(`reconsolidation.go`, `effective.go`) — no proto/sqlc/pgx/SDK/clock/randomness import. The two schema additions and
their queries live in `memory/pg` (`reconsolidation.go`, `db/queries/memory/reconsolidation.sql`), the sole sqlc/pgx
seam. The client mirror is `packages/memory-logic` (`reconsolidation.ts`, `effective-values.ts`).

## 2. The prediction-error gate — an LLM port

`memory.PredictionError` is a consumer-owned interface with one call:
`Differs(ctx, currentText, rewrite string) (bool, error)` — a semantic compare answering "is the rewrite meaningfully
different in content, ignoring wording/spacing/word-order?". It is declared in `reconsolidation.go` (not `ports.go`) so
the reconsolidation contract reads as one unit. The domain depends on the interface; the concrete adapter (the AI
provider seam + keyless-mock fallback + cost metering) is bound by the recall use-case. **Boolean, not a score** — the
boundary is the model's judgment, so there is no `values` threshold. Because it is an LLM port it is **not** golden-parity;
a contract test with a deterministic fake pins both branches.

## 3. The pure numeric rules (golden-parity, TS ↔ Go)

- **`EffectiveStrength(base, recallCount)`** fills the Epic-A stub: `cap − (cap − base)·(1 − gain)^recallCount`, the
  headroom-proportional `Potentiate` shape applied `recallCount` times, with `gain = reconsolidation.recall_strength_gain`
  and `cap = synapse.strength_cap`. Identity at count 0, monotone non-decreasing, diminishing, saturating to the cap
  (never exceeding it). `base` is clamped to `[0, cap]`; `recallCount ≤ 0` returns the clamped base.
- **`Reshape(currentSeed, newSeed) → seed`** returns the caller-supplied fresh entropy, guaranteed `≠ currentSeed`
  (nudged by an additive constant on the rare collision — never a 64-bit bitwise op, so the TS `number` mirror stays
  exact within the safe-integer range). Pure; the randomness is the use-case's. Called only on reconsolidation.
- **`NeighborForgettingDelta(sharedSemanticCount) → deltaDays`**: `0` at 0; `reconsolidation.neighbor_slow_days`
  (negative) at exactly 1; `reconsolidation.neighbor_speed_days` (positive) at `≥ neighbor_speed_threshold`. The caller
  counts semantic neurons only ([I3]).

The three are pinned by the plan-18 golden-fixture harness: `EffectiveStrength` cases extend
`testdata/synapse-plasticity-golden.json`; `Reshape`/`NeighborForgettingDelta` (+ the reconsolidation constants) live in
`testdata/reconsolidation-golden.json`, asserted byte-equal by both `reconsolidation_test.go` and `reconsolidation.test.ts`.

## 4. Schema additions

- **`episodic_memories.forgetting_offset_days REAL NOT NULL DEFAULT 0`** (migration `00005`): the signed, accumulated
  neighbor nudge in universe-days, written on recall to a memory's **neighbors** only (never the recalled memory — [F5]),
  additive (`+=`). `DEFAULT 0` means no backfill; the read-time decay consumes it as
  `effectiveElapsed = max(0, (now − last_recalled_universe_time) + offset)` (the `max(0, …)` clamp lives in the decay read).
- **`memory_provenance`** (migration `00006`): the append-only 변천사 — `(id, user_id, episodic_memory_id, kind, source,
text, universe_time, created_at)`, `episodic_memory_id → episodic_memories(id) ON DELETE CASCADE`, index
  `(user_id, episodic_memory_id, universe_time, created_at)` for the time-ordered read. `kind`/`source` are closed enums
  stored as `TEXT` (matching `neuron_type`/`jobs.kind`), validated by the domain before insert. **Append-only while
  retained** ([I1]): no UPDATE or DELETE query exists; the only removal is the parent memory's cascade (the user
  full-delete sweep). The **`created`/`original` baseline is synthesized at read, never stored** — the pg adapter refuses
  a `created` write, so a memory with zero reconsolidations still yields a one-entry 변천사.

## 5. Persistence writes (`memory/pg`, user-scoped)

`AddForgettingOffset(scope, memoryIDs, delta)` is the additive `+= delta WHERE user_id AND id = ANY(memoryIDs)`
(neighbors-only by the id set the caller passes; the offset column is `REAL`, so the `float64` domain delta narrows to
`float32` at the boundary; an empty set is a no-op). `AppendMemoryProvenance(scope, entry)` validates `kind`/`source`
(and refuses `created`) then inserts one row. Both scope through `platform.UserScope`; every read/write carries `user_id`
(`lint:persistence`). No `dbgen` row escapes into `internal/memory`. The `Diary` is never mutated ([I2]): no `UPDATE
diaries`, no diary-as-mutable row in provenance.
