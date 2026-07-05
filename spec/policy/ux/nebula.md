# policy/ux: nebula emotion color field

> UX policy for the ambient emotion color field. Plan [26](../../plan/26.nebula-color-field.md) owns the implementation;
> it extends [emotion-palette.md](emotion-palette.md) (which owns the `mood → color` seam) to the field's blend + the
> honest-mirror notice. Reinforces [I3], [I5], [I11], [M4], [M5], [M7].

## The honest mirror

The universe's color is **the emotions you re-read, not the average of your feelings**. The field blends **many** mood
colors at once — each memory bleeds its color into its region, and a memory you revisit grows stronger and bleeds
wider — so the overall tone reflects *what you often return to*, a deliberately different and more honest thing than an
emotional average.

- **The user must be told.** An honest-mirror notice is present near the field, stating this definition, so a warm
  universe in a hard month never reads as a lie. Its copy is `@cosimosi/i18n` message content, never a hardcoded string.

## Rules

- **Color comes solely from emotion.** Every color the field draws is `moodColor(memory.mood)` through the plan-17
  palette seam. The field defines no color of its own — no per-mood literal, no valence→hue math.
- **The global tone is emergent, never stored.** There is no "universe color" value anywhere — not stored, not modeled,
  not surfaced as a diagnostic/average-tone readout (not in product UI, not in a dev overlay). The tone is only what the
  composited local contributions render as, the way positions emerge from synapses.
- **Strength-weighting is a visualization output only.** A stronger memory bleeds its color wider; this weight (the
  memory's `EffectiveStrength`) changes rendered pixels and **never** the force-sim, clustering, synapse strength, or
  position. Disabling or altering it changes the picture, not the graph.
- **Emotion drives color only ([I3]).** The field reads `mood` (→ color) and derived strength (→ bleed) and emits
  nothing into layout, connection, or strength.

## Coexistence with the skin background

The nebula (domain **emotion** color) and the plan-14 skin **background** (non-domain ambiance) are separate layers in
the universe canvas. The skin never reads emotion; the nebula never sets ambiance or overrides emotion. Neither writes
to the domain.

## What a palette swap may / must not do

A swapped palette re-colors the whole field with no edit to this unit. It may re-map `Mood → Color`; it must not
decouple color from emotion, override a memory's stored mood, or feed position / connection / strength.
