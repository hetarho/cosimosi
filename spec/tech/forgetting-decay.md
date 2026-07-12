# tech: forgetting decay

> As-built rules for the pure read-time forgetting math, its TypeScript mirror, the shared golden-parity fixture, and
> the `decay_stages` + `forgetting_offset_days` read addition. Product behavior is owned by
> [plan 37](../plan/37.forgetting-decay.md); the domain policy is [policy/domain/forgetting.md](../policy/domain/forgetting.md);
> architecture placement is owned by [ARCHITECTURE.md](../ARCHITECTURE.md) §2.4, §2.5, §2.6.

## 1. Runtime homes

The Go domain implementation lives in `apps/api/internal/memory`:

- `forgetting.go`: `EffectiveElapsedDays`, `EffectiveBrightness`, `DecayStage`, `DecayDepth`,
  `AccessibilityCostWeight`, `DecayStageText`, and the helpers (`slowFactor`, `removableIndices`, `seededRemovalOrder`,
  `seededRank`, `endsSentence`, `isStopWord`).
- `effective.go`: `EffectiveStrength` (recall term).

The TypeScript mirror lives in `packages/memory-logic`, a pure cross-app package with no DOM, Vite, Metro, native, RPC,
DB, or SDK dependency: `forgetting.ts` (`effectiveElapsedDays`, `decayStage`, `decayDepth`, `accessibilityCostWeight`,
`decayStageText`) and `effective-values.ts` (`effectiveBrightness`, `slowFactor`). Web and mobile consume this package
for read-time memory math.

## 2. Purity and boundaries

All four functions are deterministic scalar/string math. They do not read clocks, repositories, proto DTOs, sqlc rows,
pgx, transport clients, SDKs, ambient randomness, DOM globals, or fetch. The word-removal randomness is a **seeded PRNG
argument** (`seed`), not IO. No LLM is anywhere in the decay path — decay texts are algorithmic, independent of the
LLM-pregenerated semantic (`semantic_stages`) axis.

## 3. The functions

- **`EffectiveElapsedDays(now, lastRecalled?, created, offsetDays)`** — `anchor = lastRecalled ?? created`;
  `max(0, universeDaysBetween(anchor, now))` then `max(0, elapsed + offsetDays)`. Forward-only, never-recalled decays
  from creation, the signed neighbor offset shifts and is floored at 0 so a memory can never be younger than new.
- **`EffectiveBrightness(effectiveElapsedDays, arousal, effectiveStrength)`** — `floor + (1 − floor)·decayFactor^(days /
slow)`, `decayFactor = 1 − brightness_decay_per_day`, clamped to `[floor, 1]`. `= 1.0` at elapsed 0, monotone
  non-increasing in elapsed, never below the floor, never 0.
- **`DecayStage(effectiveElapsedDays, arousal, effectiveStrength)`** — `clamp(floor(days / (stage_interval_days · slow)),
0, maxStage)`, `maxStage = len(stage_word_removal_ratios)`. 0 at elapsed 0, monotone non-decreasing, floored at
  `maxStage` (no stage past the last).
- **`slow = 1 + arousal·arousal_slow_coefficient + effectiveStrength·connection_slow_coefficient`** (both inputs floored
  at 0, so `slow ≥ 1`) — shared by brightness and stage, so they move together; higher arousal/strength stretch the
  time-axis (slower fade).
- **`DecayDepth(effectiveElapsedDays, arousal, effectiveStrength)`** — normalizes forgetting progress to `[0, 1]`: the
  continuous stage-fraction `clamp(days / (stage_interval_days · maxStage · slow), 0, 1)` over the same slow-stretched
  clock `DecayStage` crosses (0 = fresh, 1 = at/after the deepest stage). It is the normalized input the accessibility
  weight reads, independent of the stage count; recall resets decay → depth 0.
- **`AccessibilityCostWeight(decayDepth)`** — turns the normalized depth into an accessibility/cost **weight** ([F4]):
  `clamp(cost_weight_floor + (cost_weight_cap − cost_weight_floor)·clamp(depth,0,1)^cost_weight_curve, floor, cap)`. A
  monotone convex ease — cheap early, steepening toward silence — from the floor (depth 0, fully accessible, never free
  [G1]) to the cap (depth 1, silent engram, expensive but bounded, never unreachable [I1][F2]). It emits a **weight, not
  a Twinkle price**: the recall pricing layer turns it into a price and its spend gate re-derives the weight server-side
  (this unit computes accessibility; pricing/spending live in the Twinkle economy). Recovery on recall is expressed only
  through the input (`decayDepth → 0` after a recall resets decay, [F5]) — there is no stored `accessibility` field.
- **`DecayStageText(currentText, stage, seed)`** — stage `0` (or below) and texts of ≤ 2 words return the vivid,
  unredacted text. For stage `s` in `1..maxStage`, the removal ratio is `stage_word_removal_ratios[s-1]` (**stage 0 is
  the reserved vivid state, so the ratios describe the decayed stages 1..N**). Removable words are all words except the
  first and last of each sentence (sentence boundary = a word ending in a Latin/CJK terminator). Removable words are
  ordered content-words-first (a small language-agnostic stop-word set is the function-word tier), then by a seeded
  `seededRank`, then by index; a **prefix** of that stage-independent order is redacted, so a deeper stage removes a
  **superset** of a shallower one. Each removed word becomes the redaction token `xxxx`.

## 4. Values and formulas

Only coefficients, the floor, and the per-stage ratios live in `spec/values.yaml` (group `forgetting`):

- `forgetting.brightness_decay_per_day = 0.02`
- `forgetting.brightness_floor = 0.15` — aligned with `rendering.star_brightness_min` (the render image of this value)
- `forgetting.stage_interval_days = 30`
- `forgetting.stage_word_removal_ratios = [0.2, 0.4, 0.6, 0.85]` — strictly increasing; its **length derives the stage
  count** (`maxStage = 4`)
- `forgetting.arousal_slow_coefficient = 1.0`
- `forgetting.connection_slow_coefficient = 1.0`
- `forgetting.cost_weight_floor = 1.0` — the accessibility weight at depth 0 (cheapest, non-zero)
- `forgetting.cost_weight_cap = 4.0` — the accessibility weight at depth 1 (expensive but bounded)
- `forgetting.cost_weight_curve = 2.0` — the convex curvature of the floor→cap ease

The shapes stay in code: the exponential brightness curve, the stage step function, the depth normalization, the convex
cost-weight ease + its `[floor, cap]` clamp, the seeded word-removal + first/last + stop-word heuristic, the redaction
token string, and the derived stage count. Every Twinkle price constant lives in the Twinkle economy, never here. The
`EffectiveStrength` recall term (`[F7]` connection-strength input) is passed in by the caller, not recomputed here.

**v1 tokenization limitation ([F9] "to refine").** Word-removal is **whitespace-tokenized** (`strings.Fields` / `split(/\s+/)`).
Korean — the product's primary language — and Latin scripts delimit words with spaces, so they decay correctly. A script
written without inter-word spaces (Chinese, Japanese) tokenizes as a single "word" and hits the ≤ 2-word early return, so
it does not decay. Adding a per-language segmenter is a later refinement and would change the algorithm shape, so it is
deliberately out of the v1 language-agnostic heuristic; the contract (seed, stage, ratios) is unaffected.

## 5. Golden parity

`seededRank` is a splitmix32-style finalizer in `uint32` arithmetic (Go native `uint32`; TS `Math.imul` + `>>> 0`) so
the Go and TS removal orders are identical bit-for-bit. The Go implementation is the source of truth; the shared fixture
`apps/api/internal/memory/testdata/forgetting-decay-golden.json` is regenerated from Go with
`UPDATE_GOLDEN=1 go test -run TestWriteForgettingGolden`. `apps/api/internal/memory/forgetting_test.go` and
`packages/memory-logic/src/forgetting.test.ts` both assert against it (float within `tolerance`, decay texts byte-equal),
and both pin the `forgetting.*` constants, so a tuning change cannot desync client render from server gating.

## 6. The read addition

`ListUniverseEpisodicMemories` (`apps/api/db/queries/memory/universe.sql`) selects `decay_stages` (JSONB) and
`forgetting_offset_days` (REAL). The `memory/pg` mapper (`store.go`) decodes `decay_stages` into `EpisodicMemory.DecayStages
[]string` (NULL/empty and malformed JSON both read as `nil`) and carries `forgetting_offset_days` as `ForgettingOffsetDays
float64`. The `memory/rpc` mapper puts both on `EpisodicMemoryDto` (`decay_stages` repeated string field 10,
`forgetting_offset_days` field 11), and the FE `@cosimosi/memory` mapper carries them onto the FE `EpisodicMemory` mirror
(`decayStages`, `forgettingOffsetDays`). The read stays **stored-facts-only** — no server-side pre-rendered current decay
text — so the client computes the current stage/brightness/text from stored facts alone.
