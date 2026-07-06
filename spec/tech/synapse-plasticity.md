# tech: synapse plasticity

> As-built rules for pure synapse-strength math, the TypeScript mirror, and the shared golden-parity fixture. Product
> behavior is owned by [plan 18](../plan/18.synapse-plasticity.md); architecture placement is owned by
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4, §2.5, and §3.5.

## 1. Runtime homes

The Go domain implementation lives in `apps/api/internal/memory`:

- `plasticity.go`: `Potentiate`, `Depress`, `SignalKind`, `InitialStrength`, and `EffectiveSynapseStrength`.
- `effective.go`: Epic-A memory-level stubs `EffectiveStrength` and `EffectiveBrightness`.

The TypeScript mirror lives in `packages/memory-logic`, a pure cross-app package with no DOM, Vite, Metro, native, RPC,
DB, or SDK dependency. Web and mobile consume this package when they need read-time memory math.

## 2. Purity and boundaries

These functions are deterministic scalar math. They do not read clocks, repositories, proto DTOs, sqlc rows, pgx,
transport clients, SDKs, randomness, DOM globals, or fetch.

`Depress` is associative/local LTD over one synapse. It is not `Downscale`; SHY downscaling remains Epic E
consolidation behavior. `Reinforce` remains a future recall use-case that may call `Potentiate`, not a synonym for the
primitive formula.

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

The formula shapes stay in code: saturating LTP, floor/cap clamps, exponential read-time synapse decay, the `SignalKind`
enum, and the Epic-A memory-level stubs.

**Reserved tiers.** Link seeds a synapse only from `initial_same_memory` today. The `shared_neuron` and `temporal`
tiers ([L10]) are marked as forward reservations in code and values.yaml: a shared neuron *is* the link through
activation membership (no synapse to seed, [L2]), and temporal proximity is applied as a bonus on top of an existing
base (`temporal_bonus`), not as a fresh initial ([L4]). They are kept for a later cross-memory linker that mints
distinct shared/temporal edges. Likewise `Depress` (LTD) and the read-time `EffectiveStrength`/`EffectiveBrightness`/
`EffectiveSynapseStrength` have no server production caller yet — reserved for the forgetting/recall dynamics; the
effective functions are consumed today only by the FE render mirror (golden-parity).

## 4. Golden parity

`apps/api/internal/memory/testdata/synapse-plasticity-golden.json` is the shared fixture for Go and TypeScript. It
records expected rows for the synapse functions and the memory-level stubs with a fixed `1e-9` tolerance. Go tests read
it from `testdata/`; TypeScript tests read the same file by repo-relative path.

The parity gates are:

- `pnpm test:api`
- `pnpm --filter @cosimosi/memory-logic test`
- `pnpm typecheck:memory-logic`
