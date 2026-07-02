# tech: force sim

> As-built rules for `@cosimosi/force-sim`, the pure cross-app layout package built by
> [plan/19](../plan/19.force-sim-layout.md) / [job/23](../jobs/archive/23.force-sim-layout.md).

## Ownership

`@cosimosi/force-sim` is the only package that computes universe layout coordinates. It consumes client-side graph facts
that are derived from the domain mirror: neurons with connectivity, neuron-to-neuron synapses with strength, episodic
memories, and activation weights from episodic memories to neurons.

The package has no DOM, React, native, `three`, proto, database, or server dependency. Web and mobile consume the same
entry point.

## Coordinate Contract

The output buffer is one interleaved `Float32Array` with stride `3`: `[x, y, z, x, y, z, ...]`.

The module owns and returns a stable node-index map:

- neuron nodes first, in input order;
- episodic-memory nodes second, in input order;
- offset = `index * FORCE_SIM_COORDINATE_STRIDE`.

`tick(dt)` returns the module-owned snapshot buffer for direct reads. `tick(dt, outputBuffer)` writes the same
coordinates into a caller-owned buffer; worker hosts use this form when transferring buffers so the internal snapshot is
not detached.

## Layout Rules

Neuron nodes own forces. Connectivity scales the center pull, so more self-relevant nodes settle nearer the origin.
Synapses are undirected neuron-to-neuron springs. Barnes-Hut repulsion applies to neurons as baseline pattern separation.

Episodic-memory nodes do not have independent springs, charges, or memory-to-memory forces. Each tick places them at the
activation-weighted centroid of their neurons. A zero activation weight contributes no pull.

All z output is clamped to the hippocampus band. The neocortex band is exported only as a reserved coordinate contract:
future gist nodes copy hippocampus `x,y` and raise `z`; no force simulation runs there.

## Determinism

Every stochastic choice comes from a seeded PRNG derived from `force_sim.seed`. Seed streams are derived per node or
memory id, so adding an unrelated node does not change existing seed-hint placement.

Golden fixtures pin same-runtime byte identity for a graph, seed, and tick sequence. The implementation avoids
`Math.random`, trigonometric placement, and logarithmic connectivity formulas in the deterministic path; future
cross-engine implementations must reproduce the fixture contract before they are considered compatible.

## Values

`spec/values.yaml -> force_sim` owns:

- `charge`
- `link_distance`
- `center_strength`
- `repulsion`
- `tick_alpha_decay`
- `hippocampus_z_min`
- `hippocampus_z_max`
- `neocortex_z_min`
- `neocortex_z_max`
- `seed`

Formulas, buffer packing, and array lengths stay in code.
