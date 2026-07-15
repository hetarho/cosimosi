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

A removal classifies each of its neurons as **orphan** (activated by no live memory outside the removal set) or
**shared** (still activated by ≥1 live memory outside it), evaluated as-of removal. Orphans are sealed (`sealed_at`);
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
