# tech: semanticization

> As-built rules for the pure read-time gist (semanticization) math, its TypeScript mirror, and the shared golden-parity
> fixture. Product behavior is owned by [plan 40](../plan/40.semanticization.md); the domain policy is
> [policy/domain/semanticization.md](../policy/domain/semanticization.md); architecture placement is owned by
> [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4, §2.5.

## 1. Runtime homes

The Go domain implementation lives in `apps/api/internal/memory/semanticization.go`: `Semanticize`, `GistUnitsElapsed`,
`GistCoordinate`, and the private `timerModulation` + `semanticMaxStage`. The TypeScript mirror lives in
`packages/memory-logic/src/semanticization.ts` (`semanticize`, `gistUnitsElapsed`, `gistCoordinate`, `SEMANTIC_MAX_STAGE`).
Web and mobile consume the package for read-time gist math.

## 2. Purity and boundaries

All functions are deterministic scalar math — no clock (the `time.Time` args are data, not `time.Now()`), DB, transport,
SDK, or randomness. No new sqlc query, migration, proto field, or RPC: the unit reads columns that already exist on
`episodic_memories` and are already returned by `GetUniverse`.

## 3. The functions

- **`Semanticize(currentStage, unitsElapsed)`** — `min(currentStage + max(0, unitsElapsed), semanticMaxStage)`. Monotone
  non-decreasing, clamped, total; a single advance may cross multiple stages ([C7][R8a], CC5).
- **`GistUnitsElapsed(now, timerResetAt, arousal, connectionStrength)`** — whole gist-units elapsed since the reset
  anchor: `floor(max(0, universeDaysBetween(timerResetAt, now)) · timerModulation / semantic.gist_units_per_stage)`,
  date-truncated to whole universe-days ([C6a][I10]); 0 at the anchor ([F5]).
- **`timerModulation(arousal, connectionStrength)`** = `1 / slowFactor(arousal, connectionStrength)` ∈ (0, 1] — REUSES
  the forgetting slow-factor (job's `forgetting.{arousal,connection}_slow_coefficient`), so a high-arousal / well-connected
  memory gistifies slower just as it forgets slower. Arousal only, never valence ([F6][F7][I3]).
- **`GistCoordinate(hippocampalX, hippocampalY, stage)`** — `x, y` copied verbatim; `z = neocortex_z_min +
(clamp(stage,0,max)/max)·(neocortex_z_max − neocortex_z_min)`, inside the reserved neocortex band (15..25), disjoint
  from the hippocampus band (0..10) ([C5][C6][V9][I5]). The map shape is code; only the band bounds are values (reused).

## 4. Values and formulas

Only one new key lives in `spec/values.yaml`: `semantic.gist_units_per_stage = 10`. **Reused, not owned:**
`forgetting.arousal_slow_coefficient` / `forgetting.connection_slow_coefficient` (the modulation), and
`force_sim.neocortex_z_min` / `force_sim.neocortex_z_max` (the band). Code, not values: the unit-crossing division, the
modulation shape, the stage→z map, the clamp, and `SEMANTIC_MAX_STAGE` = the derived gist-ladder length (Go
`len(SemanticStages{})` = 4; the TS mirror pins the same constant, verified by the fixture).

## 5. Golden parity

The Go implementation is the source of truth; the shared fixture
`apps/api/internal/memory/testdata/semanticization-golden.json` is regenerated from Go with
`UPDATE_GOLDEN=1 go test -run TestWriteSemanticizationGolden`. `semanticization_test.go` and
`packages/memory-logic/src/semanticization.test.ts` both assert against it (within `tolerance`) and pin the
`semantic.*` / `force_sim.*` constants + the derived max stage, so a tuning change cannot desync the runtimes.

## 6. Consumers (not this unit)

The gist-text generation, the advance orchestration (firing the rise over the clock interval, one provenance append per
crossed stage via the reconsolidation port, `Downscale`/SHY, the `AdvanceProgression` binding), the neocortical render +
ascent choreography, and the gist-view price all live in later units. This unit ships the pure read-time math they call.
