# policy: forgetting

> Domain policy for read-time forgetting decay. Owned by plan
> [37.forgetting-decay](../../plan/37.forgetting-decay.md); the as-built rules + parity live in
> [tech/forgetting-decay.md](../../tech/forgetting-decay.md). Reinforces [I1][I3][I5][I8] and PRD [F1]–[F3][F6][F7][F9][V2].

## The rule

**Forgetting is access loss, not erasure** ([F2][I1]). A memory that has not been recalled in a long while **dims** and
its current text **loses words at random**, but the trace is **never deleted**: brightness and text decay to a **floor**
and wait there to be revived by recall (the silent engram). The system deletes no neuron, memory, or connection — a
faded star still lives in the DB, it is only harder to see. Brightness never reaches `0`; the deepest decay text is
still a legible fragment, never blank.

**Decay is derived at read time, never stored per tick** ([I5][T4]). Effective brightness and decay stage are **pure
functions of universe time** — the client recomputes them every frame from stored facts, and no cron writes them. The
read returns stored facts only (the anchor dates, arousal, strength inputs, the stored per-stage decay texts, and the
neighbor offset); it never pre-renders a "current decay text" into transport, which would freeze a read-time value and
desync from the client clock.

**Brightness and decay stage move together** ([F1]). Both are driven by the **same** effective-elapsed-days clock and the
**same** slow factor, so a dimmer star is always at an equal-or-deeper decay stage. Effective elapsed days count forward
from the last recall (or from creation when never recalled — a never-recalled star still forgets), plus the signed
neighbor `forgetting_offset_days`, floored at `0`.

**Arousal and connection strength slow forgetting; nothing else modulates it** ([F6][F7][I3]). High-arousal memories and
well-connected (high `EffectiveStrength`) memories dim and cross decay stages **slower** — both stretch the decay
time-axis. **Valence/mood never enter** — valence is color-only, and emotion never places or connects a star.

**Decay texts are algorithmic random word-removal, not an LLM** ([F1][F9], [C] independence). A memory's current text
loses a per-stage fraction of its words to a redaction token, chosen by a **seeded** deterministic PRNG (so client and
server redact identically). Removal **preserves structure**: it never removes the first or last word of a sentence and
prefers content words over function words. Removal is **nested** — a deeper stage removes a superset of a shallower
stage's words, so the progression reads as continuous erosion. This is a **separate axis** from the semantic
(`semantic_stages`) gist: forgetting removes words at random; semanticization compresses meaning.

**Reading resets accessibility but does not restore content here** ([I8]). This unit only **dims/erases** — the recall
writes that reset brightness (`last_recalled_universe_time` moving to now) and recover a memory belong to recall /
reconsolidation, and the neighbor `forgetting_offset_days` **write** belongs to reconsolidation. This unit only **reads**
those anchors.

## The shape (what is a value, what is not)

The **numeric functions are pure and golden-parity-pinned** (Go `internal/memory` ↔ TS `packages/memory-logic`):
`EffectiveElapsedDays`, `EffectiveBrightness` (the filled read-time brightness), `DecayStage`, and `DecayStageText`. A
shared golden fixture holds client render byte/tolerance-equal to server gating.

Only **coefficients, the floor, and the per-stage ratios** are values (`forgetting.brightness_decay_per_day`,
`.brightness_floor`, `.stage_interval_days`, `.stage_word_removal_ratios`, `.arousal_slow_coefficient`,
`.connection_slow_coefficient`). The exponential brightness curve, the stage step function, the seeded word-removal +
POS/first-last heuristic, the redaction token, and the **derived** stage count (the ratios array length) are
code/content, not values.

## Non-rules (owned elsewhere)

The **cost** of a deep-decayed star's recall ([F4]) is the forgetting-cost unit; the **visuals** (star dimming + the
word-loss text on stars and in the detail panel, [V2]) are the forgetting-visuals unit — this unit returns numbers and
strings, not pixels, and its read-time brightness is not yet bound to the render inputs. **Persisting** a newly-reached
stage's decay text over a clock advance is the consolidation use-case's `AdvanceProgression` hook (Epic E, [T4] — no
cron); this unit ships the **algorithm** that produces a stage text, and the read-time stage/brightness that need no
stored text at all. The neighbor `forgetting_offset_days` **write** and the `EffectiveStrength` recall term are
reconsolidation's.
