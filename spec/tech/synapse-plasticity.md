# tech: synapse plasticity

> As-built rules for pure synapse-strength math, the TypeScript mirror, and the shared golden-parity fixture. Product
> behavior is owned by [plan 18](../plan/18.synapse-plasticity.md); architecture placement is owned by
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4, §2.5, and §3.5.

## 1. Runtime homes

The Go domain implementation lives in `apps/api/internal/memory`:

- `plasticity.go`: `Potentiate`, `Depress`, `Downscale`, `SignalKind`, `InitialStrength`, and
  `EffectiveSynapseStrength`.
- `effective.go`: Epic-A memory-level stubs `EffectiveStrength` and `EffectiveBrightness`.

The TypeScript mirror lives in `packages/memory-logic`, a pure cross-app package with no DOM, Vite, Metro, native, RPC,
DB, or SDK dependency. Web and mobile consume this package when they need read-time memory math.

## 2. Purity and boundaries

These functions are deterministic scalar math. They do not read clocks, repositories, proto DTOs, sqlc rows, pgx,
transport clients, SDKs, randomness, DOM globals, or fetch.

`Depress` is associative/local LTD over one synapse; `Downscale` is homeostatic/global SHY over every slept synapse
once per sleep — two distinct pure primitives that are never conflated ([I9]). `Downscale(strength, factor)` scales a
stored base down by the per-sleep factor with a weak-edge bias (the loss fraction shrinks as strength approaches the
cap — keep signal, prune noise) and a positive residual floor: an edge dims toward silence but is never removed, and
an edge already at/below the floor is left as-is ([I1][C4]). Its only production caller is the consolidation use-case
(the advance-time batch); the recall use-case batch-LTPs through `Potentiate`.

## 3. Values and formulas

Only coefficients, caps, and initials live in `spec/values.yaml`:

- `synapse.potentiation_rate = 0.2`
- `synapse.strength_cap = 1.0`
- `synapse.initial_same_memory = 0.32`
- `synapse.initial_shared_neuron = 0.2` — reserved tier (see below)
- `synapse.initial_temporal = 0.08` — reserved tier (see below)
- `synapse.strength_decay_per_day = 0.015`
- `synapse.temporal_window_days = 3`
- `synapse.temporal_bonus = 0.1`
- `consolidation.downscale_factor = 0.05` — the per-sleep global SHY scale-down `Downscale` applies ([C4])
- `consolidation.downscale_floor = 0.05` — the positive residual floor (never removal, [I1])
- `consolidation.downscale_weak_bias = 2.0` — the weak-edge bias exponent (strong edges spared)

The formula shapes stay in code: saturating LTP, floor/cap clamps, the `Downscale` retention curve, exponential
read-time synapse decay, the `SignalKind` enum, and the Epic-A memory-level stubs.

**Reserved tiers.** Link seeds a synapse only from `initial_same_memory` today. The `shared_neuron` and `temporal`
tiers ([L10]) are marked as forward reservations in code and values.yaml: a shared neuron _is_ the link through
activation membership (no synapse to seed, [L2]), and temporal proximity is applied as a bonus on top of an existing
base (`temporal_bonus`), not as a fresh initial ([L4]). They are kept for a later cross-memory linker that mints
distinct shared/temporal edges. `Depress` (LTD) still has no server production caller — reserved for the
recall-competition/deletion dynamics — while `Downscale` is driven by consolidation and `EffectiveStrength` by the
recall/view surfaces; `EffectiveBrightness`/`EffectiveSynapseStrength` are consumed today by the FE render mirror
(golden-parity).

## 4. Golden parity

`apps/api/internal/memory/testdata/synapse-plasticity-golden.json` is the shared fixture for Go and TypeScript. It
records expected rows for the synapse functions and the memory-level stubs with a fixed `1e-9` tolerance. Go tests read
it from `testdata/`; TypeScript tests read the same file by repo-relative path.

The parity gates are:

- `pnpm test:api`
- `pnpm --filter @cosimosi/memory-logic test`
- `pnpm typecheck:memory-logic`
