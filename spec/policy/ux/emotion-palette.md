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

### The preset row: three kinds of offer

A mood's editor opens on a closed set of preset kinds, each answering a different question, never
several swatches of the same kind wearing different labels:

- **authored** — the color the product gives this feeling. Always present, always first. It carries
  the share of its own hue bucket when the aggregate holds that color, and no share line at all when
  nobody has saved it.
- **popular** — `palette.popular_preset_count` aggregate-backed colors, ranked and spoken by rank
  ("most chosen", then "#2", "#3"), each carrying the share of choices behind it. There is no sample
  floor: one lone choice makes its bucket 100%, and saying so is the honest report of what the
  aggregate holds. The copy scopes the ratio to the choices made **so far** rather than implying a
  crowd.
- **random** — a color drawn on the spot, shown as the hue wheel because it has no color until it is
  pressed. Its throws stay on the lightness steps and are re-drawn while they land in a risk band.

Aggregate candidates are counted by twelve configured OkLCH hue buckets plus one near-neutral
bucket — a perceptual quantization, so a share is honestly a share of _colors like this one_ and the
copy says so rather than claiming an exact-color count. The most-chosen exact color in a bucket is
its swatch. A share is never invented or attached to a non-aggregate preset: only a bucket that
exists has one, and a bucket exists only because somebody chose a color in it. The authored color's
bucket fills the authored preset's share and is then skipped in the ranked slots, so no color appears
twice — which is why `palette.recommendation_count` runs ahead of the number of popular slots. A mood
nobody has colored yet simply shows fewer buttons.

**A save invalidates what the row was drawn from.** Writing a color changes the aggregate the shares
and the ranking come from, so both surfaces that offer presets drop the cached read for that mood as
soon as the write lands. A ratio that survived its own contribution would be a stale number stated
with confidence.

**Ranking, and what breaks a tie.** Buckets are ordered by count, and two buckets holding the same
count are ordered by which the aggregate saw **first** — `mood_color_counts.first_counted_at`, the
stamp a color's first appearance leaves. Hue-bucket number remains only as the last resort under
that, because ordering equally-chosen colors by their position on the hue circle ranks them by an
implementation detail nobody chose. The same rule breaks a tie between two colors inside one bucket
competing to be its swatch. Ordering is entirely the server's: the client consumes the list in sequence and never
re-sorts it, because it is the one side that cannot know when a bucket arrived.

The stamp carries no user id and no account link, like every other column on that table, and a row
deleted when its count reaches zero starts its clock again if the color returns — the order is over
the buckets that currently stand, not over history.

The recommendation aggregate contains mood, bucket, swatch, and count only. It has no user id and
no individual-account read. The first-signin screen and My page editor may write only the
authenticated user's one mood row.

### Choosing any color, in the axes the color actually keeps

Beside the presets the editor offers a free picker, expressed in OkLCH rather than RGB: hue and
chroma travel freely, and lightness is the bounded choice among the three authored steps that it
really is. Chroma is offered as a fraction of what _that_ hue and step can hold in sRGB, so the
control's far end is always the most color that exists there instead of a stretch of positions that
all clip onto the same hue. This is what keeps the picker from offering colors the server would then
snap or reject.

### Risk is warned live, and asked once more before it is kept

`moodColorRisks` reads three warn-only risks off a color, as sRGB relative luminance and OkLCH
chroma — emitted light, not perceptual lightness, because what washes out a neighbour or sinks into
the void against an additive bloom pass is the light itself:

- **glare** — brighter than the sky around it; can wash out the stars beside it.
- **dim** — nearly indistinguishable from the night sky.
- **faint** — below the near-neutral chroma, so it no longer reads as a hue and may not stand apart
  from the other twelve feelings.

Lightness snapping already does most of this protection, so the bands are deliberately narrow: each
is reachable only at one end of one lightness step. A mood's own authored color never carries a
risk, and the faint warning is withheld for a mood whose authored color is itself near-neutral —
the product does not argue with its own defaults.

Risks are on standing display while a color is being chosen, not revealed at the save. A color
carrying no risk saves on one press; a color carrying one asks a second, explicit confirmation
before it is kept — and that confirmation still keeps it if the person says so. Like the axis and
near-duplicate notices, none of this blocks ([P3]).

Skipping first-signin color choice writes no color and no durable seen/skipped marker. Absence stays
an honest preference state.

**Axis-consistency is warn-only.** `checkPaletteAxisConsistency` flags warm/cool ↔ valence
mismatches as warnings, never hard blocks ([P3]). The per-mood near-duplicate notice follows the
same warn-only principle. Palette tables and formulas remain code/content; only genuine tuning
scalars live in `values.yaml`.
