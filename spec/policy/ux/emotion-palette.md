# policy/ux: emotion palette

> UX policy for the emotion color meaning layer. Plan [17](../../plan/17.emotion-model.md) owns the implementation
> source; plan [24](../../plan/24.star-neuron-rendering.md) applies it to the star body; plan
> [26](../../plan/26.nebula-color-field.md) owns later honest-framing copy for the nebula.

## Rule

Color is an emotion projection, not editable meaning. A memory's displayed color is always derived from its stored
`mood` through `moodColor(memory.mood)`.

## In the rendered universe

The rules above bind the presentation layer, not just the palette seam:

- **Emotion drives color only ([I3]).** The star body's color is its primary emotion and nothing else; emotion never
  reaches a `cell-star`/`filament` geometry, a coordinate, a size, or an edge. A `cell-star` (neuron) carries
  information, not emotion, so it has no emotion color at all.
- **Brightness recovers on recall; content does not ([I8]).** A star's brightness is `EffectiveBrightness` (a separate
  channel from its shape); recall resets brightness, while the `seed`/shape changes only on reconsolidation. The
  brightness channel exists in the body today even though forgetting decay resolves it to full.

## What Palette Customization May Do

A palette may change which `Color` a `Mood` displays. This is presentation customization only: the memory still has the
same `mood`, `valence`, `arousal`, and `intensity`.

## What Palette Customization Must Not Do

A palette must not:

- override a memory's stored emotion;
- decouple color from emotion;
- use memory identity, diary content, position, strength, or synapse state as color input;
- feed layout, strength, connection, or forgetting logic.

The seam shape enforces the policy: it consumes `Mood` and returns `Color`.

## Every Body Colored by Emotion Colors Through the One Seam

Every rendered body whose color carries meaning reads it from the same `mood → color` seam — the episodic star, its
nebula bleed, and the **neocortical gist star** alike. A gist keeps its memory's emotion ([M3][I3]): rising a semantic
stage changes a body's z and its diffuse look, never its color; abstraction is expressed spatially, and emotion never
reaches the gist's z or geometry. (Atmosphere-only tints — the layer-gap haze, the skin background — are neutral
space-tones, deliberately outside the emotion seam.)

## Authored fallback and per-mood choices (plan 51, as-built)

A user's current color preference is per mood:

- the authored default is the complete fallback table;
- an optional per-mood row overrides one feeling's color.

There is no palette set to pick from and nothing stores which one you picked: a feeling either has a
color you chose or it keeps the authored one. A mood without a row always uses its authored color. The authenticated app gate
overlays the per-mood rows on that table and applies the complete result through `setMoodPalette`
before palette-dependent children mount. Live choices use the same seam and never require
`GetUniverse`.

Per-mood colors are lowercase `#rrggbb` and server-snapped to the nearest existing emotion
lightness step (`0.80`, `0.72`, `0.63`). Hue and chroma remain the user's within 8-bit encoding
tolerance. A color within the configured OkLab ΔE of another chosen mood raises a visible notice
but is still accepted.

Each mood shows three recommendations. Aggregate candidates are counted by twelve configured
OkLCH hue buckets plus one near-neutral bucket. The most-chosen exact color in a bucket is its
swatch. A bucket below the configured sample floor carries no ratio at all; authored fallbacks used
to fill an incomplete recommendation list never invent a ratio.

The recommendation aggregate contains mood, bucket, swatch, and count only. It has no user id and
no individual-account read. The first-signin screen and My page editor may write only the
authenticated user's one mood row.

Skipping first-signin color choice writes no color and no durable seen/skipped marker. Absence stays
an honest preference state.

**Axis-consistency is warn-only.** `checkPaletteAxisConsistency` flags warm/cool ↔ valence
mismatches as warnings, never hard blocks ([P3]). The per-mood near-duplicate notice follows the
same warn-only principle. Palette tables and formulas remain code/content; only genuine tuning
scalars live in `values.yaml`.
