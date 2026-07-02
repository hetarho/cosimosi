# policy/ux: emotion palette

> UX policy for the emotion color meaning layer. Plan [17](../../plan/17.emotion-model.md) owns the implementation
> source; plan [26](../../plan/26.nebula-color-field.md) owns later honest-framing copy for the nebula.

## Rule

Color is an emotion projection, not editable meaning. A memory's displayed color is always derived from its stored
`mood` through `moodColor(memory.mood)`.

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
