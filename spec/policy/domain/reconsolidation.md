# policy: reconsolidation

> Domain policy for recall-time reconsolidation. Owned by plan
> [32.reconsolidation-rules](../../plan/32.reconsolidation-rules.md); the as-built rules + persistence live in
> [tech/reconsolidation.md](../../tech/reconsolidation.md). Reinforces [I2][I8][I9] and PRD [R3]–[R7][V5][F5].

## The rule

**A recall reinforces; only a prediction error reconsolidates** ([R6][I8]). Every recall reinforces the memory
(brightness reset [R2], recall LTP + the `EffectiveStrength` size bump [R3], gist-timer reset [C6a]). Reconsolidation —
rewriting the representation — happens **only** when a prediction-error gate judges the rewrite semantically different in
content from the current memory text. Plain recall never restores or rewrites content ([I8]).

**The prediction-error gate is a semantic judgment, not a score.** It is a consumer-owned LLM port
(`PredictionError.Differs(currentText, rewrite) → bool`), not a tuned similarity threshold — the "content vs. wording"
boundary lives in the model, so there is no values knob for it.

**Reconsolidation rewrites the representation, never the `Diary`** ([I2][R7]). On prediction error: `current_text` ← the
rewrite; `seed` ← `Reshape` (a new visual form, [V5]); only the **not-yet-created remaining** stage texts regenerate
while already-created gist stages stay ([C7], z-axis one-way); and a `reconsolidated`/`source=user` provenance row is
appended. The objective original survives as the `Diary` and the append-only 변천사; the `Diary` is never mutated.

**`Reshape` changes the form only on reconsolidation** ([V5][R4]). A seed is a meaningless form value; it moves only when
content actually changes, so a re-worded recall leaves the shape alone.

**The neighbor ± nudges neighbors' forgetting only, never the recalled memory** ([R5][F5]). Recalling a memory adds a
signed `forgetting_offset_days` to each **neighbor** by how many **semantic** neurons they share: exactly 1 → slow
(negative, spreading activation); ≥ 2 → speed (positive, retrieval-induced forgetting). Zero shared → not a neighbor.
The recalled memory itself takes **no** self-offset and recovers wholly. Shared count is over semantic neurons only —
spatial/entity excluded, emotion never counted ([I3]).

**The neighbor ± is `Depress`/LTD, not `Downscale`/SHY** ([I9]). Retrieval-induced weakening is associative/local; the
homeostatic sleep downscale is a separate mechanism (owned by the consolidation epic) and is not implemented here.

## The shape (what is a value, what is not)

The **numeric rules are pure and golden-parity-pinned** (Go `internal/memory` ↔ TS `packages/memory-logic`): the
`EffectiveStrength` recall term, `Reshape`, and `NeighborForgettingDelta`. The **prediction-error gate is a port, not
golden-parity** — non-deterministic by nature, covered by contract tests instead.

Only **coefficients/thresholds** are values (`reconsolidation.recall_strength_gain`, `.neighbor_slow_days`,
`.neighbor_speed_days`, `.neighbor_speed_threshold`). The saturating `EffectiveStrength` shape, the `Reshape` difference
guarantee, the forgetting-elapsed clamp, and the `kind`/`source` enums are code/content, not values.

## Non-rules (owned elsewhere)

The recall/reconsolidate **orchestration** (the one transaction, the sync composition, the spend gate, the
prediction-error compare + regen enqueue, the provenance/offset call sites, and the `Recall`/`RecallDiaryStars` RPCs) is
the recall use-case, as-built in [tech/memory-recall.md](../../tech/memory-recall.md). The read-time decay that consumes
`forgetting_offset_days`, the 변천사 read + baseline synthesis + export, the `semanticized`/`system` provenance rows, and
Twinkle prices are their own later units.
