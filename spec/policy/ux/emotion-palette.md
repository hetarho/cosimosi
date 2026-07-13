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
