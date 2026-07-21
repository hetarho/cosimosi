# policy: semanticization

> Domain policy for the read-time gist (semanticization) axis. Owned by plan
> [40.semanticization](../../plan/40.semanticization.md); the as-built rules + parity live in
> [tech/semanticization.md](../../tech/semanticization.md). Reinforces [I1][I2][I3][I5][I10] and PRD [C5]–[C7][R8a][V9].

## The rule

**Semanticization rises, never regresses** ([C7], z-axis one-way). As universe-time passes since the gist-timer's reset
anchor, a memory's meaning compresses and its `semantic_stage` rises through the pregenerated gist ladder, clamped at the
derived ladder length (the count of pregenerated gist texts — never a tuned value). A single clock advance may cross
**multiple** stages at once; each materialized stage appends exactly one provenance row — carrying its **stage identity
and non-blank text**, both database-guarded — so 변천사 stays continuous (CC5, [R8a]). A crossing whose ladder text is
missing materializes **nothing yet**: the visible stage holds at the last readable stage and the rise stays pending
until the regenerated text finalizes it (the consolidation use-case owns that deferral).

**A reset delays the next stage but never lowers the stage.** Recall/reconsolidation resets `semanticize_timer_reset_at`
to now, so the gist-timer recomputes to 0 elapsed units — the next rise is delayed — but the already-risen
`semantic_stage` is kept ([C6a][C7][F5]). There is no operation that lowers a gist stage; the axis is monotonic like
universe time ([I10]).

**The gist axis is independent of forgetting** ([F] vs [C]). The gist-timer measures universe-days since
`semanticize_timer_reset_at`; forgetting decay measures them since `last_recalled_universe_time`. A memory may be deeply
decayed yet barely gistified, or vice versa — the two axes never derive from one anchor.

**Arousal and connection strength slow the gist-timer; nothing else modulates it** ([C6a][F6][F7][I3]). High-arousal and
well-connected memories gistify slower, **reusing the forgetting slow-factor** — one modulation knob for both axes, no
second coefficient. The modulation uses **arousal only, never valence** ([I3]).

**Semanticization deletes nothing and never lays out a coordinate authority** ([I1][I2][I5]). Rising a stage removes no
memory, neuron, or synapse and never mutates the `Diary`; the concrete hippocampal memory and its `current_text` remain.
The gist body's `x, y` are **copied verbatim** from the emergent hippocampal coordinates and only its `z` rises into the
reserved neocortex band (disjoint from the hippocampus band) — the neocortex has no force-sim and no independent
coordinate authority ([C5][C6][V9]).

**The stage is a depth signal, not a price** ([R8][G4], CC3). `semantic_stage` is exposed as the gist-depth signal the
gist-view cost curve reads; this axis defines no Twinkle price — pricing is the Twinkle economy's.

## The shape (what is a value, what is not)

The **numeric functions are pure and golden-parity-pinned** (Go `internal/memory` ↔ TS `packages/memory-logic`):
`Semanticize`, `GistUnitsElapsed` (the timer), and `GistCoordinate`. A shared golden fixture holds client render
byte/tolerance-equal to server computation.

Only **`semantic.gist_units_per_stage`** is a new value. The modulation **reuses**
`forgetting.{arousal,connection}_slow_coefficient` (no second knob) and the neocortex band reuses
`force_sim.neocortex_z_min/max`. Excluded (code/content): the unit-crossing division, the modulation shape, the stage→z
map, the clamp, and `SEMANTIC_MAX_STAGE` (the derived ladder length).

## Non-rules (owned elsewhere)

The gist-text **generation** is the launch-time semanticize / reconsolidation regen; the advance **orchestration**
(firing the rise over the clock interval, the per-crossed-stage provenance append, `Downscale`/SHY, the
`AdvanceProgression` binding) is the consolidation use-case; the neocortical **render** + ascent choreography are the
gist-star-rendering unit; the gist-view **price** is the Twinkle economy. This unit performs no IO — it is pure read-time
math consumed on those paths.
