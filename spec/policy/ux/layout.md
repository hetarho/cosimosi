# policy/ux: layout

> UX policy for universe position meaning. Plan [19](../../plan/19.force-sim-layout.md) owns the implemented
> force-sim source.

## Rule

Layout is an emergent projection of relational structure. Position means connectivity, shared neurons, synapse strength,
and activation-weighted membership; it does not mean date, emotion, palette, diary wording, or user customization.

## Must Hold

- Positions are computed client-side and never stored as product truth.
- Emotion fields never feed position, connection, or force strength.
- Episodic memories never attract, repel, or connect directly to other episodic memories.
- The hippocampus band is centered on the world origin, so radius-from-center = connectivity reads in all three axes.
- Neocortex positions reuse the memory's live hippocampus `x,y,z` and add only a stage-monotonic z offset; the
  neocortex layer does not run force simulation and never overlaps the hippocampus band (the lowest offset clears the
  band top by construction).

## Copy Implication

When UI explains proximity, it should describe shared meaning or shared neurons, not similar feelings or chronological
order.
