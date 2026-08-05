# policy/ux: design review

> How a visual change gets approved. Design work is not finished by a passing build — it is finished
> when a design reviewer signs it off against a rubric. This doc defines the rubric sets, the
> scoring scale, the feedback ledger, and the gate.
>
> It governs both design jobs: the 2D language ([plan 56](../../plan/56.2d-ui-design-language.md))
> and the 3D assets and background ([plan 57](../../plan/57.3d-assets-and-background-design.md)).
> The decisions a review approves are recorded in [tech/design-language.md](../../tech/design-language.md).

## 1. When a review is required

A review round is required for any change that alters what the product **looks like**:

- a token value, a colour role, a theme;
- a primitive's visual style, or a new primitive;
- the visual design of a composed screen or of the 3D scene;
- a state treatment (hover / focus / pressed / disabled / loading / empty / error).

It is **not** required for behaviour, copy, layout that follows an approved pattern, or a refactor
that provably changes no pixels. When in doubt, the reviewer decides, not the implementer.

## 2. The review surface

A review reads a running surface, never a screenshot deck or a description:

| Rubric set | Surface                                                       |
| ---------- | ------------------------------------------------------------- |
| 2D         | `/design` — the design showcase (`apps/web/src/pages/design`) |
| 3D         | the reference universe showcase scene                         |

Anything the rubric scores must be reachable on that surface. A dimension that cannot be seen cannot
be scored, and the round does not proceed until it can — adding the missing specimen is part of the
work, not a follow-up.

## 3. The rubrics

Each dimension is scored independently. Both sets are scored on the scale in §4. The rubric asks the
questions; what a good answer looks like is owned by [ui-principles.md](ui-principles.md), which maps
each 2D dimension to the established criteria it is judged against.

### 3.1 The 2D rubric

| #   | Dimension                     | The question it asks                                                                              |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Hierarchy & focus             | On each screen, does the eye reach the most important thing first, and the way out last?          |
| 2   | Typographic rhythm            | Do the type roles stay distinct, is measure respected, does line height match the amount of text? |
| 3   | Spacing & density             | Is spacing on the scale, and is the density consistent at each altitude (control, panel, page)?   |
| 4   | Colour application & contrast | Is every hue a role or an emotion, is nothing decorative, does every text pair clear AA?          |
| 5   | Component consistency         | Does one primitive look the same everywhere, and does each state read as that state?              |
| 6   | Motion coherence              | Do durations and easings match the size of the change, and is nothing lost under reduced motion?  |
| 7   | Emotional & brand fit         | Does it feel like this universe — quiet, lit, unhurried — rather than a generic dark dashboard?   |
| 8   | Web ↔ mobile parity           | Does the same screen read the same way on both, allowing for platform convention?                 |

### 3.2 The 3D rubric

| #   | Dimension            | The question it asks                                                                     |
| --- | -------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Body form & material | Is each body type identifiable at a glance, at every distance it is seen from?           |
| 2   | Emotion legibility   | Does the emotion palette read on a body and in the field, without collapsing into mush?  |
| 3   | Background & depth   | Do the sky, the layers, and the atmosphere give depth without hiding what sits in front? |
| 4   | State legibility     | Are dimming, word-loss, gist-rising, and awakening readable as what they are?            |
| 5   | Choreography         | Do the time-acceleration and consolidation sequences read as one motion, not a jump cut? |
| 6   | 2D ↔ 3D coherence    | Do chrome and scene look like one product — is glass lit by the sky it floats on?        |
| 7   | Performance floor    | Does it hold the frame budget on the reference device, at the reference pixel ratio?     |

## 4. Scoring

| Score          | Meaning                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| **Meets**      | Ships as-is. No note, or notes that are preference rather than defect.               |
| **Needs-work** | A real defect, but the work can ship once it is fixed. Must be resolved or deferred. |
| **Blocking**   | The work cannot ship. Must be resolved — a Blocking item is never deferred.          |

A round scores **every** dimension, including the ones the change did not touch: a change that
degrades an untouched dimension is the failure mode a per-change review misses.

## 5. The feedback ledger

Every note from every round is recorded in the job document, under a `## Design review` section, one
row per note:

| Round | Dim | Score      | Note                                   | Status             |
| ----- | --- | ---------- | -------------------------------------- | ------------------ |
| 1     | 4   | Needs-work | Warning chip loses contrast on the sky | resolved (round 2) |
| 1     | 6   | Meets      | —                                      | —                  |

Rules:

- A note is closed as `resolved` or `deferred`, never silently dropped.
- `deferred` requires a reason and a home — the plan, a change proposal, or a named follow-up job.
  A deferred note is listed explicitly in the sign-off.
- A note is not resolved by argument. It is resolved by a change the reviewer sees on the surface,
  or by the reviewer withdrawing it in the next round's ledger.

## 6. The loop

```
build / fix  →  round: score every dimension, log every note  →  any Needs-work or Blocking?
                          ↑                                                 │ yes
                          └─────────────────────────────────────────────────┘
                                                                            │ no
                                                                       sign-off
```

There is no fixed number of rounds and no single sequential pass. The loop runs until the gate in §7
is met.

## 7. The gate

Sign-off requires all of:

- every rubric dimension scored **Meets**;
- **zero open Blocking** items;
- every ledger note closed as `resolved` or `deferred`, with deferred items listed;
- the objective deliverables of the job true (the guideline documents the decisions, the showcase
  renders them, the contrast and style-escape gates pass).

The sign-off is recorded with its date in the sign-off section of
[tech/design-language.md](../../tech/design-language.md), naming the reviewer and listing the
deferred items. Only then does the job move to `done`.

## 8. Re-review

A signed-off language is not frozen. A later change that touches a scored dimension re-opens that
dimension: one round, that dimension plus anything downstream of it, appended to the ledger of the
change's own job. The full rubric is re-run only when the language itself is revised.

**Both languages are signed off** — 2D on 2026-07-27 (job 38), 3D on 2026-07-29 (job 39), each recorded
in its own sign-off section of [tech/design-language.md](../../tech/design-language.md) §11 · §21 with its
reviewer and its deferred list. From here the protocol runs in re-review mode: a change to a body, a sky,
a state treatment or a token re-opens the dimension it touches, in the ledger of that change's own job.

## 9. What a round is worth

Recorded because it is the argument for paying for rounds at all. Both languages' first full round caught
something no automated gate in this repo could have: the 2D round found chrome that passed contrast and
still read as flat, and the 3D round found a default sky that filled the entire frame — the shader
compiled, the arithmetic was right, every test passed, and the sky was still wrong.

The corollary is the honest limit of these two sign-offs. The rounds were driven by an implementing agent
and the calls were made by the project's owner reading its output, so a genuinely independent designer has
not yet run either surface. The protocol is written for one who does; §7's gate does not become weaker
because the reviewer was close to the work, but the finding rate does.
