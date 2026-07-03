# policy/ux: latent field

> UX policy for the gray latent-neuron backdrop and the neuron-birth "awaken". Plan
> [25](../../plan/25.latent-star-field.md) owns the implementation. Reinforces [V7]/[F2]; introduces no new invariant.

## Rule

The universe is never truly empty. From first login — before a single diary — a faint field of gray latent neurons
drifts through the hippocampus band: the visual metaphor for engram cells that exist but are not yet recruited (the
silent engram). When a diary genuinely creates a new neuron, one gray point **awakens** and hands off to the real body,
making neuron birth legible.

## Must Hold

- The latent field is **rendering-only** — no DB rows, no RPC, no domain/proto/sqlc type. Only an *activated* neuron
  is persisted, and only by Encode. The gray field is a metaphor, not deletable domain state ([I1]/[F2]).
- The awaken start point is a **presentation choice** (a gray point near a recently-active neuron, else random); the
  real neuron's final position is **emergent** from the force-sim and is never stored ([I5]). No "awaken position" is
  written anywhere.
- Exactly one gray star awakens per genuinely-new neuron; the field reads as background — real bodies always draw on top.
- The gray points carry no meaning: no emotion color, no brightness dynamics, no identity. Any drift is ambient only.

## Copy Implication

Describe the gray field as *dormant / not-yet-lit memory*, never as "empty" or "deleted". The awaken reads as a silent
cell lighting up near its neighbours — a birth, not a notification.
