# policy: deletion rules

> Domain policy for the only two ways a memory leaves the universe. Owned by plan
> [48.deletion-rules](../../plan/48.deletion-rules.md); the as-built rules + persistence live in
> [tech/memory-persistence.md](../../tech/memory-persistence.md) §8. The flows that run these rules (Release / Restore /
> LetGo + the 30-day sweep) are plan [49.release-usecase](../../plan/49.release-usecase.md). Reinforces [I1][I2][I6][I9][I11]
> and PRD [X1]–[X4].

## The system never originates deletion

Forgetting is dimming, never deletion — a decayed memory survives at the floor as a silent engram ([I1][F3]). No decay,
consolidation, force-sim, or read path ever hard-deletes a row. The **only** removal is the user's explicit choice, and
even then nothing is destroyed outright: the single hard delete anywhere is the user-initiated 30-day sweep of an
already-soft-deleted release group, owned by the release use-case.

## Shared neurons are preserved; only contribution is withdrawn

A removal classifies each of its neurons as **orphan** (activated by no retained memory outside the removal set) or
**shared** (still activated by at least one retained memory outside it), evaluated as-of removal. Retained includes a
soft-deleted memory during its Restore window; only Sweep removes ownership by deleting the activation row. Orphans are sealed (`sealed_at`);
shared neurons are **kept**, and only the removed memories' contribution to their synapses is weakened via `Depress`
(LTD) — the edge's base strength is lowered but the synapse is **never deleted**, so a shared neuron keeps its other
bonds ([X1][I6]). Weakening uses `Depress` (associative/local), never `Downscale` (sleep-time homeostatic, a distinct
mechanism, [I9]).

## Two removals, differing only in what enters the rule

- **Full delete** ([X1][X2]) — diary-scoped: soft-delete every `EpisodicMemory` born from the `Diary` (`deleted_at`),
  classify the union of their neurons, seal orphans, keep + weaken shared. The `Diary` itself is never mutated ([I2]);
  rows persist for a 30-day restore window (the flow's sweep may hard-delete after it).
- **Letting-go** ([X4][X5]) — semantic neurons only: the memory is **not** soft-deleted and its emotion columns + seed
  are untouched, so it persists as a content-less silent engram; spatial, entity, emotion, color, and the visual body
  are out of reach ([I11]). Positions/connections recompute for free — force-sim reads only live neurons, so no position
  is ever written ([I5]).

## Sealed facts leave every dynamic

One canonical alive-predicate, applied at every read and compute: a memory is alive iff `deleted_at IS NULL`; a neuron
iff `sealed_at IS NULL`; a synapse iff **both** endpoints are alive; an activation transitively (its memory and neuron
both alive — `neuron_activations` needs no column of its own). A sealed/soft-deleted fact exerts no force, decays for
nobody, consolidates into nothing, and never renders — there is no invisible-but-still-pulling ghost ([X3]). The removal
is **server-authoritative**: the client learns of it only by facts disappearing from `GetUniverse`, and its unchanged
force-sim / effective-value math runs over the smaller live graph.

## The removals are user-orchestrated flows (plan 49)

`Release` / `Restore` / `SuggestLetGo` / `LetGo` are the use-cases that execute the rules above (owned by plan
[49.release-usecase](../../plan/49.release-usecase.md)):

- **Full delete is a diary-scoped 30-day soft-delete with restore** ([X1][X2]). `Release` soft-deletes the diary's
  memories, seals orphans, weakens shared contributions, and records a retention-scoped release-effect ledger; `Restore`
  reverses it exactly within `release.soft_delete_retention_days` (real-clock UTC) — clearing `deleted_at`, reclassifying
  every restored activation, reversing timestamp-owned release seals, and adding the recorded LTD back. A permanent
  LetGo seal is never unsealed. Restore refuses once swept or expired.
- **Letting-go is permanent** ([X4][X5][X6]) — AI-suggest → user-approve → domain-seal, over this-memory-only `semantic`
  neurons the server re-validates. It writes no `deleted_at`, keeps no ledger, and has **no restore**. The AI can only
  reference a pre-filtered candidate; it never executes a seal.
- **The system never originates deletion** ([I1]). The only hard delete is the retention sweep of user-soft-deleted
  release groups whose restore deadline has arrived; it computes last-owner exclusivity from all retained activations
  and never touches a live (`deleted_at IS NULL`) row or a retained shared neuron. `Release` atomically schedules a deduplicated queue target for exactly
  `deleted_at + release.soft_delete_retention_days`, so the normal worker loop completes the user-originated deletion
  even if that user never returns. Restore strictly before the deadline cancels the target; at or after the deadline it
  cannot resurrect the data. This uses no cron, and deletion is never priced (no stardust gate).

All graph-changing paths use one transaction-scoped per-user graph lock in the order **graph advisory lock → release
group/row locks → graph rows**. Contribution synapses are row-locked before `Depress`, and the ledger records the actual
delta stored on PostgreSQL's `REAL` grid, so concurrent recall/consolidation cannot lose an update and Restore reverses
exactly that release's contribution.
